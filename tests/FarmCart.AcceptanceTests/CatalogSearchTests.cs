using System.Diagnostics;
using System.Globalization;
using FarmCart.Core;
using Microsoft.Extensions.DependencyInjection;

namespace FarmCart.AcceptanceTests;

/// <summary>US-04 (B-FR-02): «Як покупець, я хочу шукати товари за категорією, відстанню, сертифікатом і ціною, щоб швидко знайти потрібне поруч».</summary>
public sealed class CatalogSearchTests
{
    private static readonly string Lviv = string.Create(CultureInfo.InvariantCulture, $"lat={Places.LvivCenter.Lat}&lon={Places.LvivCenter.Lon}");

    [Fact(DisplayName = "US-04.1 Фільтри за категорією, відстанню, сертифікатом і ціною комбінуються")]
    public async Task FiltersCombine()
    {
        using var app = await ThreeFarmsAsync();
        var buyer = await app.LoginAsync("+380971234567");

        var found = await buyer.GetJson($"/api/catalog?category=Овочі&certified=true&{Lviv}&maxKm=20&maxPrice=20");

        Assert.Equal(["Морква"], found.Names());
        Assert.InRange(found[0].GetProperty("distanceKm").GetDouble(), 7, 8.5);
    }

    [Fact(DisplayName = "US-04.2 Результати сортуються за ціною та відстанню")]
    public async Task ResultsAreSorted()
    {
        using var app = await ThreeFarmsAsync();
        var buyer = await app.LoginAsync("+380971234567");

        var byPrice = await buyer.GetJson("/api/catalog?category=Овочі&sort=PriceDesc");
        var byDistance = await buyer.GetJson($"/api/catalog?category=Овочі&{Lviv}&sort=Distance");

        Assert.Equal(["Картопля", "Морква", "Буряк"], byPrice.Names());
        Assert.Equal(["Морква", "Картопля", "Буряк"], byDistance.Names());
    }

    [Fact(DisplayName = "US-04.3 Пошук за відстанню без координат покупця відхиляється з поясненням")]
    public async Task DistanceFilterNeedsBuyerLocation()
    {
        using var app = new FarmCartApp();
        var buyer = await app.LoginAsync("+380971234567");

        var response = await buyer.GetAsync("/api/catalog?maxKm=10");

        Assert.Equal("location_required", await response.ErrorCode());
    }

    [Fact(DisplayName = "US-04.4 (НФВ) 95-й перцентиль часу пошуку не перевищує 1 с на 5 000 товарів")]
    [Trait("Category", "Performance")]
    public async Task SearchP95IsUnderOneSecond()
    {
        using var app = new FarmCartApp();
        SeedCatalog(app, farms: 25, productsPerFarm: 200);
        var buyer = await app.LoginAsync("+380971234567");

        var timings = new List<TimeSpan>();
        for (var i = 0; i < 40; i++)
        {
            var watch = Stopwatch.StartNew();
            await buyer.GetJson($"/api/catalog?category=Овочі&{Lviv}&maxKm=50&sort=Distance");
            timings.Add(watch.Elapsed);
        }

        timings.Sort();
        Assert.True(timings[37] < TimeSpan.FromSeconds(1), $"p95 = {timings[37].TotalMilliseconds:0} мс");
    }

    private static async Task<FarmCartApp> ThreeFarmsAsync()
    {
        var app = new FarmCartApp();
        var green = await app.VerifiedFarmerAsync("+380671110001", "Ферма «Зелений Гай»", Places.Vynnyky, certified: true);
        var cheese = await app.VerifiedFarmerAsync("+380671110002", "Сироварня «Карпатська бринза»", Places.Bryukhovychi);
        var distant = await app.VerifiedFarmerAsync("+380671110003", "Хутір під Києвом", Places.Kyiv, certified: true);
        await green.PublishAsync("Морква", "Овочі", 16m);
        await green.PublishAsync("Яблука", "Фрукти", 32m);
        await cheese.PublishAsync("Картопля", "Овочі", 18m);
        await distant.PublishAsync("Буряк", "Овочі", 15m);
        return app;
    }

    private static void SeedCatalog(FarmCartApp app, int farms, int productsPerFarm)
    {
        var farmers = app.Services.GetRequiredService<FarmerService>();
        for (var f = 0; f < farms; f++)
        {
            User user;
            lock (app.Store.Sync)
            {
                user = app.Store.AddUser($"+38050{f + 1_000_000:D7}");
            }

            farmers.Register(user, $"Ферма {f}", new GeoPoint(49.6 + (f * 0.01), 24.0), certified: f % 2 == 0, documents: null).Verified = true;
            for (var p = 0; p < productsPerFarm; p++)
            {
                farmers.AddProduct(user, new ProductDraft($"Товар {f}-{p}", p % 2 == 0 ? "Овочі" : "Фрукти", "кг", 10m + p, 100));
            }
        }
    }
}
