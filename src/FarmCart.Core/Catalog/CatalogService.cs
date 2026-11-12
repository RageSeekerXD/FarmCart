using System.Globalization;

namespace FarmCart.Core;

public enum CatalogSort
{
    Name,
    PriceAsc,
    PriceDesc,
    Distance,
    Rating,
}

/// <param name="Text">Текст пошуку: шукається в назві товару обома мовами.</param>
/// <param name="Category">Код категорії з довідника <see cref="Reference.Categories"/>.</param>
/// <param name="Lang">Мова інтерфейсу покупця («uk» або «en»): нею впорядковуються назви.</param>
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
    string Lang = LocalizedText.Ukrainian);

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
    double? DistanceKm);

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
    double? DistanceKm);

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
                .Where(p => p.Stock > 0 && p.IsInSeason(month))
                .Select(p => (Product: p, Farmer: store.Farmers[p.FarmerId]))
                .Where(x => Matches(x.Product, x.Farmer, query))
                .Select(x => ToItem(x.Product, x.Farmer, query.From))
                .Where(item => query.MaxDistanceKm is null || item.DistanceKm <= query.MaxDistanceKm);
            return [.. Sort(items, query.Sort, query.Lang)];
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
                    Distance(from, f)));
            return [.. from is null ? farms.OrderBy(f => f.Id) : farms.OrderBy(f => f.DistanceKm)];
        }
    }

    private static bool Matches(Product product, Farmer farmer, CatalogQuery query) =>
        (query.Text is null || product.Name.Contains(query.Text))
        && (query.Category is null || string.Equals(product.Category, query.Category, StringComparison.OrdinalIgnoreCase))
        && (query.FarmerId is null || product.FarmerId == query.FarmerId)
        && (!query.CertifiedOnly || farmer.Certified)
        && (query.MinPrice is null || product.Price >= query.MinPrice)
        && (query.MaxPrice is null || product.Price <= query.MaxPrice);

    private static CatalogItem ToItem(Product product, Farmer farmer, GeoPoint? from) => new(
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
        Distance(from, farmer));

    private static double? Distance(GeoPoint? from, Farmer farmer) =>
        from is { } point ? Math.Round(point.DistanceKmTo(farmer.Location), 1) : null;

    private static IEnumerable<CatalogItem> Sort(IEnumerable<CatalogItem> items, CatalogSort sort, string lang)
    {
        var order = lang == LocalizedText.English ? EnglishOrder : UkrainianOrder;
        string Name(CatalogItem item) => item.Name.In(lang);
        return sort switch
        {
            CatalogSort.PriceAsc => items.OrderBy(i => i.Price).ThenBy(Name, order),
            CatalogSort.PriceDesc => items.OrderByDescending(i => i.Price).ThenBy(Name, order),
            CatalogSort.Distance => items.OrderBy(i => i.DistanceKm).ThenBy(Name, order),
            CatalogSort.Rating => items.OrderByDescending(i => i.FarmerRating ?? 0).ThenBy(Name, order),
            _ => items.OrderBy(Name, order),
        };
    }
}
