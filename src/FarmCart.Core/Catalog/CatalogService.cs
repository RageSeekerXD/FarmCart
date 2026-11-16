using System.Globalization;

namespace FarmCart.Core;

public enum CatalogSort
{
    Name,
    PriceAsc,
    PriceDesc,
    Distance,
    Rating,

    /// <summary>Спершу товари, які частіше замовляють (скасовані покупцем замовлення не враховуються).</summary>
    Popular,
}

/// <param name="Text">Текст пошуку: шукається в назві товару обома мовами.</param>
/// <param name="Category">Код категорії з довідника <see cref="Reference.Categories"/>.</param>
/// <param name="Lang">Мова інтерфейсу покупця («uk» або «en»): нею впорядковуються назви.</param>
/// <param name="IncludeSoldOut">Показати й товари, яких зараз немає в наявності (вони йдуть останніми).</param>
/// <param name="DeliveryDay">Лише ферми, що возять замовлення цього дня тижня (або щодня).</param>
public sealed record CatalogQuery(
    string? Text = null,
    string? Category = null,
    int? FarmerId = null,
    GeoPoint? From = null,
    double? MaxDistanceKm = null,
    bool CertifiedOnly = false,
    decimal? MinPrice = null,
    decimal? MaxPrice = null,
    CatalogSort Sort = CatalogSort.Name,
    string Lang = LocalizedText.Ukrainian,
    bool IncludeSoldOut = false,
    DayOfWeek? DeliveryDay = null);

public sealed record CatalogItem(
    int ProductId,
    LocalizedText Name,
    string Category,
    string UnitCode,
    LocalizedText Unit,
    decimal Price,
    int Stock,
    string? PhotoUrl,
    int FarmerId,
    LocalizedText FarmerName,
    bool Certified,
    double? FarmerRating,
    double? DistanceKm,
    LocalizedText? Description,
    IReadOnlyList<int> SeasonMonths,
    int FarmerReviewCount,
    bool InSeason,
    IReadOnlyList<DayOfWeek> FarmerDeliveryDays,
    LocalizedText? Composition,
    LocalizedText? ShelfLife,
    LocalizedText? Storage);

/// <summary>Верифікована ферма на мапі покупця (BE-1): відстань рахується від точки покупця, якщо її передано.</summary>
public sealed record FarmOnMap(
    int Id,
    LocalizedText Name,
    double Lat,
    double Lon,
    bool Certified,
    double? Rating,
    int ReviewCount,
    int ProductCount,
    double? DistanceKm,
    LocalizedText? Story,
    IReadOnlyList<DayOfWeek> DeliveryDays);

/// <summary>US-04 (B-FR-02): пошук, фільтрація й сортування каталогу.</summary>
public sealed class CatalogService(InMemoryStore store, IClock clock)
{
    private static readonly StringComparer UkrainianOrder = StringComparer.Create(CultureInfo.GetCultureInfo("uk-UA"), ignoreCase: true);
    private static readonly StringComparer EnglishOrder = StringComparer.InvariantCultureIgnoreCase;

    public IReadOnlyList<CatalogItem> Search(CatalogQuery query)
    {
        if ((query.MaxDistanceKm is not null || query.Sort == CatalogSort.Distance) && query.From is null)
        {
            throw Fail.Validation("location_required", "Для пошуку за відстанню передайте координати покупця");
        }

        if (query.MinPrice > query.MaxPrice)
        {
            throw Fail.Validation("price_range_invalid", "Мінімальна ціна більша за максимальну");
        }

        if (query.Lang is not (LocalizedText.Ukrainian or LocalizedText.English))
        {
            throw Fail.Validation("lang_invalid", "Мова каталогу: uk або en");
        }

        if (query.Category is not null && Reference.Category(query.Category) is null)
        {
            throw Fail.Validation("category_unknown", "Невідома категорія: передайте код із довідника");
        }

        var month = clock.Now.Month;
        lock (store.Sync)
        {
            var items = store.Products.Values
                .Where(p => (query.IncludeSoldOut || p.Stock > 0) && p.IsInSeason(month))
                .Select(p => (Product: p, Farmer: store.Farmers[p.FarmerId]))
                .Where(x => Matches(x.Product, x.Farmer, query))
                .Select(x => ToItem(x.Product, x.Farmer, query.From, month))
                .Where(item => query.MaxDistanceKm is null || item.DistanceKm <= query.MaxDistanceKm);
            var popularity = query.Sort == CatalogSort.Popular ? OrderCounts() : [];
            return [.. Sort(items, query.Sort, query.Lang, popularity)];
        }
    }

    /// <summary>
    /// Картка одного товару (сторінка товару): і тоді, коли його зараз немає в наявності чи не сезон, -
    /// покупець бачить чесне «немає» замість помилки. Товари неверифікованих ферм не показуються.
    /// </summary>
    public CatalogItem Product(int productId, GeoPoint? from = null)
    {
        lock (store.Sync)
        {
            return store.Products.GetValueOrDefault(productId) is { } product && store.Farmers[product.FarmerId] is { Verified: true } farmer
                ? ToItem(product, farmer, from, clock.Now.Month)
                : throw Fail.NotFound("product_not_found", $"Товар #{productId} не знайдено");
        }
    }

    /// <summary>BE-1: верифіковані ферми для мапи; з точкою покупця - від найближчої.</summary>
    public IReadOnlyList<FarmOnMap> Farms(GeoPoint? from = null)
    {
        if (from is { IsValid: false })
        {
            throw Fail.Validation("location_invalid", "Некоректні координати покупця");
        }

        var month = clock.Now.Month;
        lock (store.Sync)
        {
            var farms = store.Farmers.Values
                .Where(f => f.Verified)
                .Select(f => new FarmOnMap(
                    f.Id,
                    f.Name,
                    f.Location.Lat,
                    f.Location.Lon,
                    f.Certified,
                    f.Rating,
                    f.ReviewCount,
                    store.Products.Values.Count(p => p.FarmerId == f.Id && p.Stock > 0 && p.IsInSeason(month)),
                    Distance(from, f),
                    f.Story,
                    [.. f.DeliveryDays.Order()]));
            return [.. from is null ? farms.OrderBy(f => f.Id) : farms.OrderBy(f => f.DistanceKm)];
        }
    }

    /// <summary>Попит на товари: у скількох замовленнях (крім скасованих покупцем) є кожен товар.</summary>
    private Dictionary<int, int> OrderCounts() =>
        store.Orders.Values
            .Where(order => order.Status != OrderStatus.Cancelled)
            .SelectMany(order => order.Lines.Select(line => line.ProductId).Distinct())
            .CountBy(productId => productId)
            .ToDictionary();

    private static bool Matches(Product product, Farmer farmer, CatalogQuery query) =>
        (query.Text is null || product.Name.Contains(query.Text))
        && (query.Category is null || string.Equals(product.Category, query.Category, StringComparison.OrdinalIgnoreCase))
        && (query.FarmerId is null || product.FarmerId == query.FarmerId)
        && (!query.CertifiedOnly || farmer.Certified)
        && (query.MinPrice is null || product.Price >= query.MinPrice)
        && (query.MaxPrice is null || product.Price <= query.MaxPrice)
        && (query.DeliveryDay is not { } day || farmer.DeliversOn(day));

    private static CatalogItem ToItem(Product product, Farmer farmer, GeoPoint? from, int month) => new(
        product.Id,
        product.Name,
        product.Category,
        product.UnitCode,
        product.Unit,
        product.Price,
        product.Stock,
        product.PhotoUrl,
        farmer.Id,
        farmer.Name,
        farmer.Certified,
        farmer.Rating,
        Distance(from, farmer),
        product.Description,
        [.. product.SeasonMonths.Order()],
        farmer.ReviewCount,
        product.IsInSeason(month),
        [.. farmer.DeliveryDays.Order()],
        product.Composition,
        product.ShelfLife,
        product.Storage);

    private static double? Distance(GeoPoint? from, Farmer farmer) =>
        from is { } point ? Math.Round(point.DistanceKmTo(farmer.Location), 1) : null;

    private static IEnumerable<CatalogItem> Sort(IEnumerable<CatalogItem> items, CatalogSort sort, string lang, Dictionary<int, int> popularity)
    {
        var order = lang == LocalizedText.English ? EnglishOrder : UkrainianOrder;
        string Name(CatalogItem item) => item.Name.In(lang);
        // Товари, яких немає в наявності (якщо їх просили показати), - завжди в кінці списку.
        var available = items.OrderBy(i => i.Stock == 0);
        return sort switch
        {
            CatalogSort.PriceAsc => available.ThenBy(i => i.Price).ThenBy(Name, order),
            CatalogSort.PriceDesc => available.ThenByDescending(i => i.Price).ThenBy(Name, order),
            CatalogSort.Distance => available.ThenBy(i => i.DistanceKm).ThenBy(Name, order),
            CatalogSort.Rating => available.ThenByDescending(i => i.FarmerRating ?? 0).ThenBy(Name, order),
            CatalogSort.Popular => available.ThenByDescending(i => popularity.GetValueOrDefault(i.ProductId)).ThenBy(Name, order),
            _ => available.ThenBy(Name, order),
        };
    }
}
