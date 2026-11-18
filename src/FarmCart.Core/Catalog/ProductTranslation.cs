namespace FarmCart.Core;

/// <summary>Текст одного поля товару: у запиті - вихідний текст, у відповіді - переклад мовою <paramref name="TargetLang"/>.</summary>
/// <param name="Field">Поле: name, description, composition, shelfLife, storage або story (історія ферми).</param>
/// <param name="TargetLang">Мова перекладу: uk або en.</param>
/// <param name="Text">Текст поля.</param>
public sealed record ProductText(string Field, string TargetLang, string Text);

/// <summary>Зовнішній сервіс машинного перекладу текстів товару.</summary>
public interface IProductTranslator
{
    /// <summary>Чи налаштовано сервіс: якщо ні, веб-клієнт не показує кнопку перекладу.</summary>
    bool IsAvailable { get; }

    Task<IReadOnlyList<ProductText>> TranslateAsync(IReadOnlyList<ProductText> items, CancellationToken cancellation);
}

/// <summary>Переклад вимкнено: ключ сервісу не налаштовано, а форма товару працює як звичайно.</summary>
public sealed class UnavailableProductTranslator : IProductTranslator
{
    public bool IsAvailable => false;

    public Task<IReadOnlyList<ProductText>> TranslateAsync(IReadOnlyList<ProductText> items, CancellationToken cancellation) =>
        throw ProductTranslationService.Unavailable();
}

/// <summary>Імітація перекладу для режиму розробки: позначає текст мовою перекладу й не звертається до зовнішнього сервісу.</summary>
public sealed class EchoProductTranslator : IProductTranslator
{
    public bool IsAvailable => true;

    public Task<IReadOnlyList<ProductText>> TranslateAsync(IReadOnlyList<ProductText> items, CancellationToken cancellation) =>
        Task.FromResult<IReadOnlyList<ProductText>>([.. items.Select(Echo)]);

    private static ProductText Echo(ProductText item)
    {
        var text = $"[{item.TargetLang}] {item.Text}";
        return item with { Text = text[..Math.Min(text.Length, ProductTranslationService.MaxLength(item.Field))] };
    }
}

/// <summary>
/// Переклад текстів товару для форми фермера. Результат лише підставляється у форму: фермер перевіряє його
/// перед збереженням. Кількість запитів обмежено, бо кожен виклик зовнішнього сервісу платний.
/// </summary>
public sealed class ProductTranslationService(InMemoryStore store, IProductTranslator translator, IClock clock)
{
    /// <summary>Скільки разів на годину один фермер може запустити переклад.</summary>
    public const int RequestsPerHour = 30;

    /// <summary>Найбільша довжина назви товару кожною мовою (як у формі товару).</summary>
    public const int NameMaxLength = 80;

    private static readonly Dictionary<string, int> Limits = new()
    {
        ["name"] = NameMaxLength,
        ["description"] = FarmerService.DescriptionMaxLength,
        ["composition"] = FarmerService.DetailsMaxLength,
        ["shelfLife"] = FarmerService.DetailsMaxLength,
        ["storage"] = FarmerService.DetailsMaxLength,
        ["story"] = FarmerService.StoryMaxLength,
    };

    private readonly HourlyLimit _limit = new(clock, RequestsPerHour);

    /// <summary>Поля товару, які можна перекладати.</summary>
    public static IReadOnlyCollection<string> Fields => Limits.Keys;

    public static int MaxLength(string field) => Limits[field];

    public static DomainException Unavailable() =>
        Fail.Unavailable("translation_unavailable", "Автоматичний переклад зараз вимкнено");

    public static DomainException Failed() =>
        Fail.Unavailable("translation_failed", "Не вдалося перекласти текст. Спробуйте ще раз або заповніть поля вручну");

    /// <summary>Чи показувати фермеру кнопку перекладу.</summary>
    public bool IsAvailable(User user)
    {
        RequireVerifiedFarmer(user);
        return translator.IsAvailable;
    }

    public async Task<IReadOnlyList<ProductText>> TranslateAsync(User user, IReadOnlyList<ProductText>? items, CancellationToken cancellation = default)
    {
        RequireVerifiedFarmer(user);
        if (!translator.IsAvailable)
        {
            throw Unavailable();
        }

        var requested = Validated(items);
        if (!_limit.TryTake(user.Id))
        {
            throw Fail.TooManyAttempts("translation_limit", "Забагато перекладів за годину. Спробуйте пізніше");
        }

        return Checked(requested, await translator.TranslateAsync(requested, cancellation));
    }

    private void RequireVerifiedFarmer(User user)
    {
        lock (store.Sync)
        {
            if (!store.FarmerOf(user).Verified)
            {
                throw Fail.Forbidden("farmer_not_verified", "Продавець без верифікації не може публікувати товари");
            }
        }
    }

    private static List<ProductText> Validated(IReadOnlyList<ProductText>? items)
    {
        if (items is not { Count: > 0 })
        {
            throw Invalid();
        }

        var fields = new HashSet<string>();
        var requested = new List<ProductText>(items.Count);
        foreach (var item in items)
        {
            if (item is not { Field: not null, TargetLang: LocalizedText.Ukrainian or LocalizedText.English, Text: not null }
                || !Limits.TryGetValue(item.Field, out var limit)
                || !fields.Add(item.Field)
                || string.IsNullOrWhiteSpace(item.Text)
                || item.Text.Trim().Length > limit)
            {
                throw Invalid();
            }

            requested.Add(item with { Text = item.Text.Trim() });
        }

        return requested;
    }

    private static DomainException Invalid() =>
        Fail.Validation("translation_invalid", "Передайте заповнені поля товару, які треба перекласти");

    /// <summary>Відповідь зовнішнього сервісу не приймається на віру: потрібен непорожній переклад кожного поля в межах довжини.</summary>
    private static List<ProductText> Checked(List<ProductText> requested, IReadOnlyList<ProductText> translated)
    {
        var result = new List<ProductText>(requested.Count);
        foreach (var item in requested)
        {
            var text = translated.FirstOrDefault(t => t.Field == item.Field && t.TargetLang == item.TargetLang)?.Text?.Trim();
            if (string.IsNullOrEmpty(text) || text.Length > Limits[item.Field])
            {
                throw Failed();
            }

            result.Add(item with { Text = text });
        }

        return result;
    }
}
