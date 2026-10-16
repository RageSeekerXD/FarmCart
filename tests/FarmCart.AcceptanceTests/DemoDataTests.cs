namespace FarmCart.AcceptanceTests;

/// <summary>Демонстраційні дані режиму розробки, на яких працює протокол релізу.</summary>
public sealed class DemoDataTests
{
    [Fact(DisplayName = "DEMO Демонстраційні дані завантажуються: сезонний каталог, слоти, промокод і неверифікований продавець")]
    public async Task DemoDataIsConsistent()
    {
        using var app = new FarmCartApp(seedDemoData: true);
        var buyer = await app.LoginAsync("+380971234567");
        var farmer = await app.LoginAsync("+380671110001");
        var newcomer = await app.LoginAsync("+380671110004");

        var catalog = await buyer.GetJson("/api/catalog");
        var slots = await buyer.GetJson("/api/slots");
        var ownProducts = await farmer.GetJson("/api/farmer/products");
        var attempt = await newcomer.PostAsync("/api/farmer/products", System.Net.Http.Json.JsonContent.Create(new { name = "Сир", category = "Молочні продукти", unit = "кг", price = 100m, stock = 5 }));

        Assert.Equal(8, catalog.GetArrayLength());
        Assert.DoesNotContain("Полуниця", catalog.Names());
        Assert.Equal(3, slots.GetArrayLength());
        Assert.Equal(4, ownProducts.GetArrayLength());
        Assert.Equal("farmer_not_verified", await attempt.ErrorCode());
        Assert.True(app.Store.PromoCodes.ContainsKey("FARM10"));
    }
}
