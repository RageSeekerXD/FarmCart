using System.Diagnostics;

namespace FarmCart.Core.Tests.Catalog;

/// <summary>US-04 (B-FR-02): пошук, фільтри й сортування каталогу.</summary>
public sealed class CatalogServiceTests
{
    private readonly TestWorld _world = new();

    [Fact]
    public void Search_HidesSoldOutAndOutOfSeasonProducts()
    {
        var (farm, _) = _world.NewFarmer();
        _world.NewProduct(farm, "Яблука", stock: 10);
        _world.NewProduct(farm, "Груші", stock: 0);
        _world.NewProduct(farm, "Полуниця", season: [5, 6, 7]);

        Assert.Equal(["Яблука"], Names(new CatalogQuery()));
    }

    [Fact]
    public void Search_ShowsSeasonalProductInItsSeason()
    {
        var (farm, _) = _world.NewFarmer();
        _world.NewProduct(farm, "Полуниця", season: [5, 6, 7]);
        _world.Clock.Advance(TimeSpan.FromDays(245));

        Assert.Equal(["Полуниця"], Names(new CatalogQuery()));
    }

    [Fact]
    public void Search_ByTextIsCaseInsensitive()
    {
        var (farm, _) = _world.NewFarmer();
        _world.NewProduct(farm, "Мед липовий", category: "Мед");
        _world.NewProduct(farm, "Яблука");

        Assert.Equal(["Мед липовий"], Names(new CatalogQuery(Text: "мед")));
    }

    [Fact]
    public void Search_CombinesCategoryCertificateAndPriceFilters()
    {
        var (organic, _) = _world.NewFarmer("Органік", certified: true);
        var (regular, _) = _world.NewFarmer("Звичайна", certified: false);
        _world.NewProduct(organic, "Морква", 16m, category: "Овочі");
        _world.NewProduct(organic, "Буряк", 60m, category: "Овочі");
        _world.NewProduct(organic, "Яблука", 30m, category: "Фрукти");
        _world.NewProduct(regular, "Картопля", 18m, category: "Овочі");

        var found = Names(new CatalogQuery(Category: "овочі", CertifiedOnly: true, MinPrice: 10m, MaxPrice: 50m));

        Assert.Equal(["Морква"], found);
    }

    [Fact]
    public void Search_ByFarmer_ReturnsOnlyThatFarmersProducts()
    {
        var (first, firstFarm) = _world.NewFarmer("Перша");
        var (second, _) = _world.NewFarmer("Друга");
        _world.NewProduct(first, "Сир");
        _world.NewProduct(second, "Молоко");

        Assert.Equal(["Сир"], Names(new CatalogQuery(FarmerId: firstFarm.Id)));
    }

    [Fact]
    public void Search_ByMaxDistance_ExcludesFarFarmersAndReportsDistance()
    {
        var (near, _) = _world.NewFarmer("Винники", TestWorld.Vynnyky);
        var (far, _) = _world.NewFarmer("Київ", new GeoPoint(50.4501, 30.5234));
        _world.NewProduct(near, "Яблука");
        _world.NewProduct(far, "Груші");

        var found = _world.Catalog.Search(new CatalogQuery(From: TestWorld.LvivCenter, MaxDistanceKm: 15));

        var item = Assert.Single(found);
        Assert.Equal("Яблука", item.Name);
        Assert.InRange(item.DistanceKm!.Value, 7.0, 8.5);
    }

    [Fact]
    public void Search_DistanceFilterWithoutBuyerLocation_IsRejected()
    {
        var error = Assert.Throws<DomainException>(() => _world.Catalog.Search(new CatalogQuery(MaxDistanceKm: 10)));

        Assert.Equal("location_required", error.Code);
    }

    [Fact]
    public void Search_WithInvertedPriceRange_IsRejected()
    {
        var error = Assert.Throws<DomainException>(() => _world.Catalog.Search(new CatalogQuery(MinPrice: 50, MaxPrice: 10)));

        Assert.Equal("price_range_invalid", error.Code);
    }

    [Theory]
    [InlineData(CatalogSort.PriceAsc, new[] { "Морква", "Яблука", "Мед" })]
    [InlineData(CatalogSort.PriceDesc, new[] { "Мед", "Яблука", "Морква" })]
    [InlineData(CatalogSort.Name, new[] { "Мед", "Морква", "Яблука" })]
    public void Search_SortsByPriceOrUkrainianName(CatalogSort sort, string[] expected)
    {
        var (farm, _) = _world.NewFarmer();
        _world.NewProduct(farm, "Яблука", 30m);
        _world.NewProduct(farm, "Мед", 290m);
        _world.NewProduct(farm, "Морква", 16m);

        Assert.Equal(expected, Names(new CatalogQuery(Sort: sort)));
    }

    [Fact]
    public void Search_SortsByDistanceAndRating()
    {
        var (near, nearFarm) = _world.NewFarmer("Близька", TestWorld.Vynnyky);
        var (far, farFarm) = _world.NewFarmer("Далека", new GeoPoint(49.7170, 23.9100));
        _world.NewProduct(near, "Сир");
        _world.NewProduct(far, "Мед");
        nearFarm.Rating = 4.1;
        farFarm.Rating = 4.9;

        Assert.Equal(["Сир", "Мед"], Names(new CatalogQuery(From: TestWorld.LvivCenter, Sort: CatalogSort.Distance)));
        Assert.Equal(["Мед", "Сир"], Names(new CatalogQuery(Sort: CatalogSort.Rating)));
    }

    [Fact]
    [Trait("Category", "Performance")]
    public void Search_Over10000Products_P95IsUnderOneSecond()
    {
        for (var f = 0; f < 50; f++)
        {
            var (user, _) = _world.NewFarmer($"Ферма {f}", new GeoPoint(49.5 + (f * 0.01), 24.0));
            for (var p = 0; p < 200; p++)
            {
                _world.NewProduct(user, $"Товар {f}-{p}", 10m + p, category: p % 2 == 0 ? "Овочі" : "Фрукти");
            }
        }

        var timings = Enumerable.Range(0, 40).Select(_ =>
        {
            var watch = Stopwatch.StartNew();
            _world.Catalog.Search(new CatalogQuery(Category: "Овочі", From: TestWorld.LvivCenter, MaxDistanceKm: 50, Sort: CatalogSort.Distance));
            return watch.Elapsed;
        }).Order().ToList();

        Assert.True(timings[(int)(timings.Count * 0.95) - 1] < TimeSpan.FromSeconds(1));
    }

    private string[] Names(CatalogQuery query) => [.. _world.Catalog.Search(query).Select(i => i.Name)];
}
