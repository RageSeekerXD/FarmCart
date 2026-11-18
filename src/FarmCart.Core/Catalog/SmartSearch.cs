using System.Text.RegularExpressions;

namespace FarmCart.Core;

/// <summary>Запит покупця власними словами й те, що допомагає його зрозуміти.</summary>
/// <param name="Request">Текст покупця.</param>
/// <param name="Today">Сьогоднішній день тижня: для «завтра» чи «сьогодні».</param>
/// <param name="ProductNames">Назви товарів каталогу: слово для пошуку має збігатися з ними.</param>
public sealed record SmartSearchContext(string Request, DayOfWeek Today, IReadOnlyList<string> ProductNames);

/// <summary>Фільтри каталогу, які випливають із запиту покупця.</summary>
public sealed record SearchIntent(
    string? Text = null,
    string? Category = null,
    bool Certified = false,
    decimal? MinPrice = null,
    decimal? MaxPrice = null,
    int? MaxKm = null,
    CatalogSort? Sort = null,
    DayOfWeek? DeliveryDay = null)
{
    /// <summary>У запиті не знайшлося жодного фільтра.</summary>
    public bool IsEmpty => this == new SearchIntent();
}

/// <summary>Зовнішній сервіс, що перетворює запит покупця на фільтри каталогу.</summary>
public interface ICatalogSearchInterpreter
{
    /// <summary>Чи налаштовано сервіс: якщо ні, веб-клієнт показує лише звичайний пошук.</summary>
    bool IsAvailable { get; }

    Task<SearchIntent> InterpretAsync(SmartSearchContext context, CancellationToken cancellation);
}

/// <summary>Розумний пошук вимкнено: ключ сервісу не налаштовано, а звичайний пошук працює як раніше.</summary>
public sealed class UnavailableCatalogSearchInterpreter : ICatalogSearchInterpreter
{
    public bool IsAvailable => false;

    public Task<SearchIntent> InterpretAsync(SmartSearchContext context, CancellationToken cancellation) =>
        throw SmartSearchService.Unavailable();
}

/// <summary>Імітація для режиму розробки: розпізнає кілька ключових слів і не звертається до зовнішнього сервісу.</summary>
public sealed partial class KeywordCatalogSearchInterpreter : ICatalogSearchInterpreter
{
    public bool IsAvailable => true;

    public Task<SearchIntent> InterpretAsync(SmartSearchContext context, CancellationToken cancellation)
    {
        var request = context.Request;
        var category = Reference.Categories.FirstOrDefault(c => Has(request, c.Title.Uk) || Has(request, c.Title.En))?.Code;
        var distance = Distance().Match(request);
        var price = MaxPrice().Match(request);
        return Task.FromResult(new SearchIntent(
            Category: category,
            Certified: Has(request, "сертиф") || Has(request, "certified") || Has(request, "organic"),
            MaxPrice: price.Success ? decimal.Parse(price.Groups[1].Value, System.Globalization.CultureInfo.InvariantCulture) : null,
            MaxKm: distance.Success ? int.Parse(distance.Groups[1].Value, System.Globalization.CultureInfo.InvariantCulture) : null,
            Sort: Has(request, "дешев") || Has(request, "недорог") || Has(request, "cheap") ? CatalogSort.PriceAsc : null));
    }

    private static bool Has(string request, string word) => request.Contains(word, StringComparison.OrdinalIgnoreCase);

    [GeneratedRegex(@"(\d{1,4})\s*(?:км|km)", RegexOptions.IgnoreCase)]
    private static partial Regex Distance();

    [GeneratedRegex(@"(?:до|under)\s*(\d{1,6})(?!\d)(?!\s*(?:км|km))", RegexOptions.IgnoreCase)]
    private static partial Regex MaxPrice();
}

/// <summary>
/// Розумний пошук каталогу: запит покупця стає звичайними фільтрами, тож товари показує той самий каталог,
/// а покупець бачить і може змінити кожен фільтр. Кількість запитів обмежено, бо кожен виклик платний.
/// </summary>
public sealed class SmartSearchService(CatalogService catalog, ICatalogSearchInterpreter interpreter, IClock clock)
{
    /// <summary>Скільки разів на годину один покупець може скористатися розумним пошуком.</summary>
    public const int RequestsPerHour = 60;

    /// <summary>Найбільша довжина запиту покупця.</summary>
    public const int RequestMaxLength = 200;

    /// <summary>Скільки назв товарів передається сервісу для підбору слова пошуку.</summary>
    public const int ProductNamesLimit = 300;

    private const int TextMaxLength = 80;

    /// <summary>Відстані, які пропонує фільтр каталогу.</summary>
    private static readonly int[] DistancesKm = [5, 10, 20, 50];

    private readonly HourlyLimit _limit = new(clock, RequestsPerHour);

    public bool IsAvailable => interpreter.IsAvailable;

    public static DomainException Unavailable() =>
        Fail.Unavailable("smart_search_unavailable", "Розумний пошук зараз вимкнено");

    public static DomainException Failed() =>
        Fail.Unavailable("smart_search_failed", "Не вдалося опрацювати запит. Спробуйте ще раз або скористайтеся фільтрами");

    public async Task<SearchIntent> InterpretAsync(User user, string? request, CancellationToken cancellation = default)
    {
        if (!interpreter.IsAvailable)
        {
            throw Unavailable();
        }

        var text = request?.Trim();
        if (string.IsNullOrEmpty(text) || text.Length > RequestMaxLength)
        {
            throw Fail.Validation("smart_search_invalid", $"Опишіть, що шукаєте: до {RequestMaxLength} символів");
        }

        if (!_limit.TryTake(user.Id))
        {
            throw Fail.TooManyAttempts("smart_search_limit", "Забагато запитів за годину. Спробуйте пізніше");
        }

        var names = catalog.Search(new CatalogQuery(IncludeSoldOut: true))
            .Select(item => $"{item.Name.Uk} / {item.Name.En}")
            .Distinct()
            .Take(ProductNamesLimit)
            .ToList();
        return Normalized(await interpreter.InterpretAsync(new SmartSearchContext(text, clock.Now.DayOfWeek, names), cancellation));
    }

    /// <summary>Відповідь зовнішнього сервісу не приймається на віру: лишаються тільки значення, які розуміє каталог.</summary>
    private static SearchIntent Normalized(SearchIntent intent)
    {
        var minPrice = intent.MinPrice is >= 0 ? intent.MinPrice : null;
        var maxPrice = intent.MaxPrice is >= 0 ? intent.MaxPrice : null;
        var swapped = minPrice > maxPrice;
        return new SearchIntent(
            intent.Text?.Trim() is { Length: > 0 and <= TextMaxLength } text ? text : null,
            Reference.Category(intent.Category)?.Code,
            intent.Certified,
            swapped ? maxPrice : minPrice,
            swapped ? minPrice : maxPrice,
            RoundedDistance(intent.MaxKm),
            intent.Sort is { } sort && Enum.IsDefined(sort) ? sort : null,
            intent.DeliveryDay is { } day && Enum.IsDefined(day) ? day : null);
    }

    /// <summary>Найближча більша відстань фільтра, щоб не загубити ферми; понад найбільшу - без обмеження.</summary>
    private static int? RoundedDistance(int? km) =>
        km is > 0 ? DistancesKm.Cast<int?>().FirstOrDefault(distance => distance >= km) : null;
}
