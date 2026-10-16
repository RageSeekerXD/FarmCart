using System.Net;
using System.Net.Http.Json;

namespace FarmCart.AcceptanceTests;

/// <summary>US-03 (B-FR-08): «Як фермер, я хочу вести каталог (ціни, залишки, сезонність), щоб покупці бачили актуальні товари».</summary>
public sealed class FarmerCatalogTests
{
    [Fact(DisplayName = "US-03.1 Зміни ціни й залишку одразу видно покупцям у каталозі")]
    public async Task PriceAndStockChangesAreVisibleImmediately()
    {
        using var app = new FarmCartApp();
        var farmer = await app.VerifiedFarmerAsync("+380671110001", "Ферма «Зелений Гай»");
        var buyer = await app.LoginAsync("+380971234567");
        var productId = await farmer.PublishAsync("Яблука «Голден»", "Фрукти", 32m, stock: 150);
        var before = (await buyer.GetJson("/api/catalog"))[0];

        await farmer.PatchAsJsonAsync($"/api/farmer/products/{productId}", new { price = 29.5m, stock = 100 });
        var after = (await buyer.GetJson("/api/catalog"))[0];

        Assert.Equal((32m, 150), (before.GetProperty("price").GetDecimal(), before.GetProperty("stock").GetInt32()));
        Assert.Equal((29.5m, 100), (after.GetProperty("price").GetDecimal(), after.GetProperty("stock").GetInt32()));
    }

    [Fact(DisplayName = "US-03.2 Залишок не може стати від'ємним")]
    public async Task StockNeverBecomesNegative()
    {
        using var app = new FarmCartApp();
        var farmer = await app.VerifiedFarmerAsync("+380671110001", "Ферма «Зелений Гай»");
        var productId = await farmer.PublishAsync("Морква", "Овочі", 16m, stock: 5);

        var tooMuch = await farmer.PostAsJsonAsync($"/api/farmer/products/{productId}/stock", new { delta = -6 });
        var products = await farmer.GetJson("/api/farmer/products");

        Assert.Equal(HttpStatusCode.Conflict, tooMuch.StatusCode);
        Assert.Equal("stock_negative", await tooMuch.ErrorCode());
        Assert.Equal(5, products[0].GetProperty("stock").GetInt32());
    }

    [Fact(DisplayName = "US-03.3 Сезонний товар показується покупцям лише в сезон")]
    public async Task SeasonalProductIsShownOnlyInSeason()
    {
        using var app = new FarmCartApp();
        var farmer = await app.VerifiedFarmerAsync("+380671110001", "Ферма «Зелений Гай»");
        var buyer = await app.LoginAsync("+380971234567");
        await farmer.PublishAsync("Полуниця", "Ягоди", 95m, seasonMonths: [5, 6, 7]);

        var inOctober = await buyer.GetJson("/api/catalog");
        app.Clock.Advance(TimeSpan.FromDays(245));
        var inJune = await buyer.GetJson("/api/catalog");

        Assert.Empty(inOctober.Names());
        Assert.Equal(["Полуниця"], inJune.Names());
    }
}
