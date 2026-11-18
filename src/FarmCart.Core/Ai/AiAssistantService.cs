namespace FarmCart.Core;

/// <summary>
/// Підказки ШІ для покупців, фермерів і адміністраторів. Відповідь сервісу не приймається на віру, кожен виклик
/// обмежено або кешовано, бо він платний, а остаточне рішення завжди лишається за людиною.
/// </summary>
public sealed class AiAssistantService(
    InMemoryStore store,
    CatalogService catalog,
    ReviewService reviews,
    AdminService adminService,
    AuditLog audit,
    IFarmCartAi ai,
    IClock clock)
{
    /// <summary>Скільки відгуків із текстом потрібно, щоб підсумок мав сенс.</summary>
    public const int SummaryMinReviews = 3;

    public const int SummaryMaxReviews = 40;
    public const int SuggestionsPerHour = 20;
    public const int BasketsPerHour = 20;
    public const int ModerationChecksPerHour = 20;
    public const int DocumentChecksPerHour = 30;
    public const int RequestMaxLength = 200;
    public const int BasketOptionsLimit = 300;
    public const int BasketMaxLines = 15;
    public const int ModerationBatch = 40;

    private const int CommentMaxLength = 500;
    private const int SummaryTextMaxLength = 300;
    private const int ConcernMaxLength = 300;
    private const int FieldMaxLength = 120;
    private const int MissingMaxLength = 60;
    private const int MissingMaxItems = 10;
    private const int ConcernsMaxItems = 6;

    /// <summary>Після невдачі підсумок не запитується знову кілька хвилин: сторінки публічні, а виклики платні.</summary>
    private static readonly TimeSpan SummaryRetryDelay = TimeSpan.FromMinutes(10);

    private static readonly string[] AdviceCategories = ["abuse", "spam", "personal_data", "off_topic", "other"];
    private static readonly string[] DocumentTypes = ["application/pdf", "image/jpeg", "image/png", "image/svg+xml"];

    private readonly HourlyLimit _suggestions = new(clock, SuggestionsPerHour);
    private readonly HourlyLimit _baskets = new(clock, BasketsPerHour);
    private readonly HourlyLimit _moderation = new(clock, ModerationChecksPerHour);
    private readonly HourlyLimit _documents = new(clock, DocumentChecksPerHour);
    private readonly SemaphoreSlim _summaryGate = new(1, 1);
    private readonly Dictionary<string, CachedSummary> _summaries = [];
    private readonly Dictionary<int, ModerationAdvice?> _checkedReviews = [];
    private readonly Dictionary<int, DocumentCheck> _checkedDocuments = [];
    private readonly Lock _sync = new();

    private sealed record CachedSummary(string Fingerprint, ReviewSummary? Summary, DateTimeOffset ValidUntil);

    public bool IsAvailable => ai.IsAvailable;

    public static DomainException Unavailable() => Fail.Unavailable("ai_unavailable", "Функції ШІ зараз вимкнено");

    public static DomainException Failed() => Fail.Unavailable("ai_failed", "ШІ зараз не відповідає. Спробуйте ще раз пізніше");

    private static DomainException Invalid() => Fail.Validation("ai_invalid", "Запит не можна опрацювати: перевірте дані");

    /// <summary>Підсумок видимих відгуків про ферму; null - відгуків замало або ШІ недоступний.</summary>
    public Task<ReviewSummary?> FarmSummaryAsync(int farmerId, CancellationToken cancellation = default) =>
        SummaryAsync($"farm:{farmerId}", reviews.ForFarmer(farmerId), cancellation);

    /// <summary>Підсумок видимих відгуків покупців цього товару; null - відгуків замало або ШІ недоступний.</summary>
    public Task<ReviewSummary?> ProductSummaryAsync(int productId, CancellationToken cancellation = default) =>
        SummaryAsync($"product:{productId}", reviews.ForProduct(productId), cancellation);

    /// <summary>Чернетка товару за фото; null - на фото не вдалося впізнати товар.</summary>
    public async Task<ProductSuggestion?> SuggestProductAsync(User user, byte[] photo, CancellationToken cancellation = default)
    {
        RequireAvailable();
        lock (store.Sync)
        {
            if (!store.FarmerOf(user).Verified)
            {
                throw Fail.Forbidden("farmer_not_verified", "Продавець без верифікації не може публікувати товари");
            }
        }

        var type = FarmerService.DetectImageType(photo) ?? throw Fail.Validation("photo_type_invalid", "Завантажте фото у форматі JPEG, PNG або WebP");
        Take(_suggestions, user);
        var suggestion = await ai.SuggestProductAsync(new ProductPhotoForAi(type, photo), cancellation);
        var name = Text(suggestion.Name, ProductTranslationService.NameMaxLength);
        return name is null
            ? null
            : new ProductSuggestion(name, Reference.Category(suggestion.Category)?.Code, Text(suggestion.Description, FarmerService.DescriptionMaxLength));
    }

    /// <summary>Кошик за рецептом лише з товарів, які справді є в наявності, у кількості не більшій за залишок.</summary>
    public async Task<PlannedBasket> PlanBasketAsync(User user, string? request, string? lang, CancellationToken cancellation = default)
    {
        RequireAvailable();
        var text = request?.Trim();
        if (string.IsNullOrEmpty(text) || text.Length > RequestMaxLength)
        {
            throw Invalid();
        }

        Take(_baskets, user);
        var language = lang == LocalizedText.English ? LocalizedText.English : LocalizedText.Ukrainian;
        var items = catalog.Search(new CatalogQuery(Lang: language)).Take(BasketOptionsLimit).ToDictionary(item => item.ProductId);
        var options = items.Values.Select(item => new BasketOption(item.ProductId, item.Name.In(language), item.Unit.In(language), item.Price, item.Stock)).ToList();
        var draft = await ai.PlanBasketAsync(new BasketBrief(text, language, options), cancellation);
        var lines = (draft.Lines ?? [])
            .Where(line => line.Quantity > 0 && items.ContainsKey(line.ProductId))
            .DistinctBy(line => line.ProductId)
            .Take(BasketMaxLines)
            .Select(line => new PlannedLine(items[line.ProductId], Math.Min(line.Quantity, items[line.ProductId].Stock)))
            .ToList();
        var missing = (draft.Missing ?? [])
            .Select(item => item?.Trim())
            .OfType<string>()
            .Where(item => item.Length is > 0 and <= MissingMaxLength)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(MissingMaxItems)
            .ToList();
        return new PlannedBasket(lines, missing);
    }

    /// <summary>Перевіряє ще не перевірені видимі відгуки партіями; перевірений відгук повторно не надсилається.</summary>
    public async Task<ReviewCheckResult> CheckReviewsAsync(User admin, CancellationToken cancellation = default)
    {
        admin.Require(Role.Admin);
        RequireAvailable();
        var visible = reviews.ForModeration(admin).Select(item => item.Review).Where(review => !review.Hidden && !string.IsNullOrWhiteSpace(review.Comment)).ToList();
        List<ReviewForAi> pending;
        lock (_sync)
        {
            pending = [.. visible.Where(review => !_checkedReviews.ContainsKey(review.Id)).Take(ModerationBatch).Select(ForAi)];
        }

        if (pending.Count > 0)
        {
            Take(_moderation, admin);
            var advice = await ai.CheckReviewsAsync(pending, cancellation);
            lock (_sync)
            {
                foreach (var review in pending)
                {
                    _checkedReviews[review.Id] = Usable(advice.FirstOrDefault(item => item.ReviewId == review.Id));
                }
            }

            audit.Record(admin, "review.ai_check", "reviews", $"ШІ перевірив відгуків: {pending.Count}");
        }

        lock (_sync)
        {
            return new ReviewCheckResult(
                [.. visible.Select(review => _checkedReviews.GetValueOrDefault(review.Id)).OfType<ModerationAdvice>()],
                visible.Count(review => !_checkedReviews.ContainsKey(review.Id)));
        }
    }

    /// <summary>Попередня перевірка одного документа на прохання адміністратора; результат запам'ятовується.</summary>
    public async Task<DocumentCheck> CheckDocumentAsync(User admin, int farmerId, int documentId, CancellationToken cancellation = default)
    {
        admin.Require(Role.Admin);
        RequireAvailable();
        var document = adminService.FarmerDocument(admin, farmerId, documentId);
        lock (_sync)
        {
            if (_checkedDocuments.TryGetValue(document.Id, out var known))
            {
                return known;
            }
        }

        if (!DocumentTypes.Contains(document.ContentType))
        {
            throw Invalid();
        }

        Take(_documents, admin);
        LocalizedText farmName;
        lock (store.Sync)
        {
            farmName = store.Farmers[farmerId].Name;
        }

        var answer = await ai.CheckDocumentAsync(new DocumentForAi(farmName, document.ContentType, document.Data, DateOnly.FromDateTime(clock.Now.Date)), cancellation);
        var check = new DocumentCheck(
            Text(answer.Kind, FieldMaxLength),
            Field(answer.HolderName),
            Field(answer.Number),
            Field(answer.IssuedOn),
            Field(answer.ValidUntil),
            [.. (answer.Concerns ?? []).Select(concern => Text(concern, ConcernMaxLength)).OfType<LocalizedText>().Take(ConcernsMaxItems)]);
        lock (_sync)
        {
            _checkedDocuments[document.Id] = check;
        }

        audit.Record(admin, "document.ai_check", $"farmer#{farmerId}", $"ШІ перевірив документ #{document.Id}");
        return check;
    }

    private async Task<ReviewSummary?> SummaryAsync(string key, IReadOnlyList<Review> visible, CancellationToken cancellation)
    {
        if (!ai.IsAvailable)
        {
            return null;
        }

        var written = visible.Where(review => !string.IsNullOrWhiteSpace(review.Comment)).Take(SummaryMaxReviews).Select(ForAi).ToList();
        if (written.Count < SummaryMinReviews)
        {
            return null;
        }

        var fingerprint = string.Join(',', written.Select(review => review.Id));
        await _summaryGate.WaitAsync(cancellation);
        try
        {
            if (_summaries.TryGetValue(key, out var cached) && cached.Fingerprint == fingerprint && clock.Now < cached.ValidUntil)
            {
                return cached.Summary;
            }

            var entry = await GenerateSummaryAsync(fingerprint, written);
            _summaries[key] = entry;
            return entry.Summary;
        }
        finally
        {
            _summaryGate.Release();
        }
    }

    /// <summary>Виклик не скасовується разом із запитом відвідувача: готовий підсумок знадобиться наступним.</summary>
    private async Task<CachedSummary> GenerateSummaryAsync(string fingerprint, List<ReviewForAi> written)
    {
        try
        {
            var answer = await ai.SummarizeReviewsAsync(written, CancellationToken.None);
            var likes = Text(answer.Likes, SummaryTextMaxLength);
            var complaints = Text(answer.Complaints, SummaryTextMaxLength);
            return new CachedSummary(fingerprint, likes is null && complaints is null ? null : new ReviewSummary(likes, complaints), DateTimeOffset.MaxValue);
        }
        catch (DomainException e) when (e.Kind == ErrorKind.Unavailable)
        {
            return new CachedSummary(fingerprint, null, clock.Now + SummaryRetryDelay);
        }
    }

    private void RequireAvailable()
    {
        if (!ai.IsAvailable)
        {
            throw Unavailable();
        }
    }

    private static void Take(HourlyLimit limit, User user)
    {
        if (!limit.TryTake(user.Id))
        {
            throw Fail.TooManyAttempts("ai_limit", "Забагато запитів до ШІ за годину. Спробуйте пізніше");
        }
    }

    private static ReviewForAi ForAi(Review review)
    {
        var comment = review.Comment!.Trim();
        return new ReviewForAi(review.Id, review.Rating, comment.Length > CommentMaxLength ? comment[..CommentMaxLength] : comment);
    }

    private static ModerationAdvice? Usable(ModerationAdvice? advice) =>
        advice is not null && Text(advice.Reason, ConcernMaxLength) is { } reason
            ? new ModerationAdvice(advice.ReviewId, AdviceCategories.Contains(advice.Category) ? advice.Category : "other", reason)
            : null;

    private static LocalizedText? Text(LocalizedText? text, int maxLength) =>
        text is { Uk: not null, En: not null, IsComplete: true } && text.Trimmed() is var trimmed && trimmed.Uk.Length <= maxLength && trimmed.En.Length <= maxLength
            ? trimmed
            : null;

    private static string? Field(string? value) =>
        value?.Trim() is { Length: > 0 and <= FieldMaxLength } text ? text : null;
}
