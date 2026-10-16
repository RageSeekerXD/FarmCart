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

public sealed record CatalogQuery(
    string? Text = null,
    string? Category = null,
    int? FarmerId = null,
    GeoPoint? From = null,
    double? MaxDistanceKm = null,
    bool CertifiedOnly = false,
    decimal? MinPrice = null,
    decimal? MaxPrice = null,
    CatalogSort Sort = CatalogSort.Name);

public sealed record CatalogItem(
    int ProductId,
    string Name,
    string Category,
    string Unit,
    decimal Price,
    int Stock,
    int FarmerId,
    string FarmerName,
    bool Certified,
    double? FarmerRating,
    double? DistanceKm);

/// <summary>US-04 (B-FR-02): пошук, фільтрація й сортування каталогу.</summary>
public sealed class CatalogService(InMemoryStore store, IClock clock)
{
    private static readonly StringComparer UkrainianOrder = StringComparer.Create(CultureInfo.GetCultureInfo("uk-UA"), ignoreCase: true);

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

        var month = clock.Now.Month;
        lock (store.Sync)
        {
            var items = store.Products.Values
                .Where(p => p.Stock > 0 && p.IsInSeason(month))
                .Select(p => (Product: p, Farmer: store.Farmers[p.FarmerId]))
                .Where(x => Matches(x.Product, x.Farmer, query))
                .Select(x => ToItem(x.Product, x.Farmer, query.From))
                .Where(item => query.MaxDistanceKm is null || item.DistanceKm <= query.MaxDistanceKm);
            return [.. Sort(items, query.Sort)];
        }
    }

    private static bool Matches(Product product, Farmer farmer, CatalogQuery query) =>
        (query.Text is null || product.Name.Contains(query.Text, StringComparison.OrdinalIgnoreCase))
        && (query.Category is null || string.Equals(product.Category, query.Category, StringComparison.OrdinalIgnoreCase))
        && (query.FarmerId is null || product.FarmerId == query.FarmerId)
        && (!query.CertifiedOnly || farmer.Certified)
        && (query.MinPrice is null || product.Price >= query.MinPrice)
        && (query.MaxPrice is null || product.Price <= query.MaxPrice);

    private static CatalogItem ToItem(Product product, Farmer farmer, GeoPoint? from) => new(
        product.Id,
        product.Name,
        product.Category,
        product.Unit,
        product.Price,
        product.Stock,
        farmer.Id,
        farmer.Name,
        farmer.Certified,
        farmer.Rating,
        from is { } point ? Math.Round(point.DistanceKmTo(farmer.Location), 1) : null);

    private static IEnumerable<CatalogItem> Sort(IEnumerable<CatalogItem> items, CatalogSort sort) => sort switch
    {
        CatalogSort.PriceAsc => items.OrderBy(i => i.Price).ThenBy(i => i.Name, UkrainianOrder),
        CatalogSort.PriceDesc => items.OrderByDescending(i => i.Price).ThenBy(i => i.Name, UkrainianOrder),
        CatalogSort.Distance => items.OrderBy(i => i.DistanceKm).ThenBy(i => i.Name, UkrainianOrder),
        CatalogSort.Rating => items.OrderByDescending(i => i.FarmerRating ?? 0).ThenBy(i => i.Name, UkrainianOrder),
        _ => items.OrderBy(i => i.Name, UkrainianOrder),
    };
}
