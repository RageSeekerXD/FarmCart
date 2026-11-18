namespace FarmCart.Core;

/// <summary>Відгук для ШІ: лише оцінка й текст, без автора.</summary>
public sealed record ReviewForAi(int Id, int Rating, string Comment);

/// <summary>Що покупцям подобається й на що вони скаржаться, обома мовами.</summary>
public sealed record ReviewSummary(LocalizedText? Likes, LocalizedText? Complaints);

public sealed record ProductPhotoForAi(string ContentType, byte[] Data);

/// <summary>Чернетка товару за фото. Склад і термін придатності навмисно відсутні: фото їх не доводить.</summary>
public sealed record ProductSuggestion(LocalizedText? Name, string? Category, LocalizedText? Description);

public sealed record BasketOption(int ProductId, string Name, string Unit, decimal Price, int Stock);

public sealed record BasketBrief(string Request, string Lang, IReadOnlyList<BasketOption> Products);

public sealed record BasketIdea(int ProductId, int Quantity);

public sealed record BasketDraft(IReadOnlyList<BasketIdea> Lines, IReadOnlyList<string> Missing);

public sealed record PlannedLine(CatalogItem Item, int Quantity);

/// <summary>Кошик за рецептом: наявні товари й те, чого в каталозі немає. Додає до кошика лише сам покупець.</summary>
public sealed record PlannedBasket(IReadOnlyList<PlannedLine> Lines, IReadOnlyList<string> Missing);

/// <summary>Підозрілий відгук: категорія й причина обома мовами. Рішення приймає адміністратор.</summary>
public sealed record ModerationAdvice(int ReviewId, string Category, LocalizedText Reason);

public sealed record ReviewCheckResult(IReadOnlyList<ModerationAdvice> Flagged, int Remaining);

public sealed record DocumentForAi(LocalizedText FarmName, string ContentType, byte[] Data, DateOnly Today);

/// <summary>Попередня перевірка документа: дані з нього й сумніви для адміністратора.</summary>
public sealed record DocumentCheck(
    LocalizedText? Kind,
    string? HolderName,
    string? Number,
    string? IssuedOn,
    string? ValidUntil,
    IReadOnlyList<LocalizedText> Concerns);

/// <summary>Зовнішній сервіс ШІ для підказок покупцям, фермерам і адміністраторам.</summary>
public interface IFarmCartAi
{
    /// <summary>Чи налаштовано сервіс: якщо ні, веб-клієнт не показує функції ШІ.</summary>
    bool IsAvailable { get; }

    Task<ReviewSummary> SummarizeReviewsAsync(IReadOnlyList<ReviewForAi> reviews, CancellationToken cancellation);

    Task<ProductSuggestion> SuggestProductAsync(ProductPhotoForAi photo, CancellationToken cancellation);

    Task<BasketDraft> PlanBasketAsync(BasketBrief brief, CancellationToken cancellation);

    /// <summary>Повертає лише підозрілі відгуки.</summary>
    Task<IReadOnlyList<ModerationAdvice>> CheckReviewsAsync(IReadOnlyList<ReviewForAi> reviews, CancellationToken cancellation);

    Task<DocumentCheck> CheckDocumentAsync(DocumentForAi document, CancellationToken cancellation);
}

/// <summary>ШІ вимкнено: ключ сервісу не налаштовано, а решта застосунку працює як звичайно.</summary>
public sealed class UnavailableFarmCartAi : IFarmCartAi
{
    public bool IsAvailable => false;

    public Task<ReviewSummary> SummarizeReviewsAsync(IReadOnlyList<ReviewForAi> reviews, CancellationToken cancellation) =>
        throw AiAssistantService.Unavailable();

    public Task<ProductSuggestion> SuggestProductAsync(ProductPhotoForAi photo, CancellationToken cancellation) =>
        throw AiAssistantService.Unavailable();

    public Task<BasketDraft> PlanBasketAsync(BasketBrief brief, CancellationToken cancellation) =>
        throw AiAssistantService.Unavailable();

    public Task<IReadOnlyList<ModerationAdvice>> CheckReviewsAsync(IReadOnlyList<ReviewForAi> reviews, CancellationToken cancellation) =>
        throw AiAssistantService.Unavailable();

    public Task<DocumentCheck> CheckDocumentAsync(DocumentForAi document, CancellationToken cancellation) =>
        throw AiAssistantService.Unavailable();
}

/// <summary>Імітація для режиму розробки: передбачувані відповіді без звернення до зовнішнього сервісу.</summary>
public sealed class FakeFarmCartAi : IFarmCartAi
{
    public bool IsAvailable => true;

    public Task<ReviewSummary> SummarizeReviewsAsync(IReadOnlyList<ReviewForAi> reviews, CancellationToken cancellation) =>
        Task.FromResult(new ReviewSummary(
            new LocalizedText($"[імітація] Покупці хвалять якість у {reviews.Count(r => r.Rating >= 4)} відгуках.", $"[demo] Buyers praise the quality in {reviews.Count(r => r.Rating >= 4)} reviews."),
            reviews.Any(r => r.Rating <= 3) ? new LocalizedText("[імітація] Трапляються зауваження до доставки.", "[demo] Some buyers mention delivery issues.") : null));

    public Task<ProductSuggestion> SuggestProductAsync(ProductPhotoForAi photo, CancellationToken cancellation) =>
        Task.FromResult(new ProductSuggestion(
            new LocalizedText("[імітація] Товар із фото", "[demo] Product from photo"),
            "vegetables",
            new LocalizedText("[імітація] Опис за фото.", "[demo] Description from the photo.")));

    public Task<BasketDraft> PlanBasketAsync(BasketBrief brief, CancellationToken cancellation) =>
        Task.FromResult(new BasketDraft(
            [.. brief.Products.Take(3).Select(product => new BasketIdea(product.ProductId, 1))],
            [brief.Lang == LocalizedText.English ? "[demo] salt" : "[імітація] сіль"]));

    public Task<IReadOnlyList<ModerationAdvice>> CheckReviewsAsync(IReadOnlyList<ReviewForAi> reviews, CancellationToken cancellation) =>
        Task.FromResult<IReadOnlyList<ModerationAdvice>>([.. reviews
            .Where(review => review.Rating <= 2)
            .Select(review => new ModerationAdvice(review.Id, "other", new LocalizedText("[імітація] Перевірте цей відгук.", "[demo] Please check this review.")))]);

    public Task<DocumentCheck> CheckDocumentAsync(DocumentForAi document, CancellationToken cancellation) =>
        Task.FromResult(new DocumentCheck(
            new LocalizedText("[імітація] Сертифікат", "[demo] Certificate"),
            document.FarmName.Uk,
            "DEMO-001",
            null,
            null,
            [new LocalizedText("[імітація] Не вдалося прочитати строк дії.", "[demo] The expiry date could not be read.")]));
}
