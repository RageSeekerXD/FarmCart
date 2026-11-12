using System.Net;
using System.Net.Http.Json;

namespace FarmCart.AcceptanceTests;

/// <summary>
/// BE-9: «Як англомовний покупець, я хочу бачити каталог, кошик і замовлення англійською,
/// щоб українські назви не траплялися в англійському інтерфейсі». BE-1: ферми на мапі.
/// </summary>
public sealed class BilingualCatalogTests
{
    [Fact(DisplayName = "BE-9.1 Каталог шукає товар за англійською назвою й віддає обидві мови")]
    public async Task CatalogIsSearchableInEnglish()
    {
        using var app = new FarmCartApp();
        var farmer = await app.VerifiedFarmerAsync("+380671110001", "Ферма «Зелений Гай»");
        await farmer.PublishAsync("Морква", "vegetables", 16m);
        await farmer.PublishAsync("Яблука", "fruits", 32m);

        var found = await app.CreateClient().GetJson("/api/catalog?q=carr");

        var item = Assert.Single(found.EnumerateArray());
        Assert.Equal(("Морква", "Carrots"), (item.GetProperty("name").Str("uk"), item.GetProperty("name").Str("en")));
        Assert.Equal(("кг", "kg", "kg"), (item.GetProperty("unit").Str("uk"), item.GetProperty("unit").Str("en"), item.Str("unitCode")));
        Assert.Equal(("vegetables", "Zelenyi Hai Farm"), (item.Str("category"), item.GetProperty("farmerName").Str("en")));
    }

    [Fact(DisplayName = "BE-9.2 Назви впорядковуються мовою інтерфейсу: параметр lang")]
    public async Task NamesAreSortedInInterfaceLanguage()
    {
        using var app = new FarmCartApp();
        var farmer = await app.VerifiedFarmerAsync("+380671110001", "Ферма «Зелений Гай»");
        await farmer.PublishAsync("Яблука", "fruits", 32m);
        await farmer.PublishAsync("Морква", "vegetables", 16m);
        await farmer.PublishAsync("Буряк", "vegetables", 15m);
        var buyer = app.CreateClient();

        var ukrainian = await buyer.GetJson("/api/catalog?lang=uk");
        var english = await buyer.GetJson("/api/catalog?lang=en");
        var unknown = await buyer.GetAsync("/api/catalog?lang=de");

        Assert.Equal(["Буряк", "Морква", "Яблука"], ukrainian.Names());
        Assert.Equal(["Apples", "Beetroot", "Carrots"], english.Names("en"));
        Assert.Equal("lang_invalid", await unknown.ErrorCode());
    }

    [Theory(DisplayName = "BE-9.3 Товар без назви однією з мов або з невідомою категорією чи одиницею не публікується")]
    [InlineData("Яблука", "", "fruits", "kg", "name_required")]
    [InlineData("", "Apples", "fruits", "kg", "name_required")]
    [InlineData("Яблука", "Apples", "Фрукти", "kg", "category_unknown")]
    [InlineData("Яблука", "Apples", "fruits", "кг", "unit_unknown")]
    public async Task IncompleteProductIsRejected(string uk, string en, string category, string unit, string error)
    {
        using var app = new FarmCartApp();
        var farmer = await app.VerifiedFarmerAsync("+380671110001", "Ферма «Зелений Гай»");

        var response = await farmer.PostAsJsonAsync("/api/farmer/products", new { name = new { uk, en }, category, unit, price = 32m, stock = 5 });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(error, await response.ErrorCode());
    }

    [Fact(DisplayName = "BE-9.4 Кошик і замовлення зберігають англійську назву, навіть коли фермер перейменував товар")]
    public async Task OrderKeepsEnglishNameSnapshot()
    {
        using var app = new FarmCartApp();
        var (farmer, apples, slot) = await Journeys.FarmWithApplesAsync(app);
        var buyer = await app.LoginAsync("+380971234567");

        var cart = await (await buyer.AddToCartAsync(apples, 1)).Json();
        var orderId = await Journeys.OrderAsync(buyer, apples, 1, slot);
        var renamed = await farmer.PatchAsJsonAsync($"/api/farmer/products/{apples}", new { name = new { uk = "Яблука «Голден»", en = "Golden apples" } });
        var order = await buyer.GetJson($"/api/orders/{orderId}");

        Assert.Equal("Apples", cart.GetProperty("lines")[0].GetProperty("name").Str("en"));
        Assert.Equal("Golden apples", (await renamed.Json()).GetProperty("name").Str("en"));
        var line = order.GetProperty("lines")[0];
        Assert.Equal(("Яблука", "Apples", "kg"), (line.GetProperty("name").Str("uk"), line.GetProperty("name").Str("en"), line.GetProperty("unit").Str("en")));
    }

    [Fact(DisplayName = "BE-9.5 Довідник категорій та одиниць продажу доступний без входу обома мовами")]
    public async Task ReferenceIsPublic()
    {
        using var app = new FarmCartApp();

        var reference = await app.CreateClient().GetJson("/api/reference");

        var dairy = reference.GetProperty("categories").EnumerateArray().Single(c => c.Str("code") == "dairy");
        Assert.Equal(("Молочні продукти", "Dairy"), (dairy.GetProperty("title").Str("uk"), dairy.GetProperty("title").Str("en")));
        Assert.Equal(7, reference.GetProperty("categories").GetArrayLength());
        Assert.Contains(reference.GetProperty("units").EnumerateArray(), u => u.Str("code") == "jar-0.5l");
    }

    [Fact(DisplayName = "BE-9.6 Господарство без англійської назви не реєструється")]
    public async Task FarmNeedsBothNames()
    {
        using var app = new FarmCartApp();
        var farmer = await app.LoginAsync("+380671110001");

        var response = await farmer.PostAsJsonAsync("/api/farmers", new { farmName = new { uk = "Ферма", en = " " }, lat = 49.816, lon = 24.13, certified = false });

        Assert.Equal("farm_name_required", await response.ErrorCode());
    }

    [Fact(DisplayName = "BE-1 Публічний список верифікованих ферм для мапи з відстанню від покупця")]
    public async Task VerifiedFarmsAreListedForTheMap()
    {
        using var app = new FarmCartApp();
        var near = await app.VerifiedFarmerAsync("+380671110001", "Ферма «Зелений Гай»", Places.Vynnyky, certified: true);
        await app.VerifiedFarmerAsync("+380671110003", "Хутір під Києвом", Places.Kyiv);
        var pending = await app.LoginAsync("+380671110004");
        await pending.PostAsJsonAsync("/api/farmers", new { farmName = HttpJson.Bilingual("Нова ферма", "New farm"), lat = 49.8, lon = 23.98, certified = false });
        await near.PublishAsync("Морква", "vegetables", 16m);
        var anonymous = app.CreateClient();

        var farms = await anonymous.GetJson("/api/farmers?lat=49.8419&lon=24.0315");
        var withoutPoint = await anonymous.GetJson("/api/farmers");

        Assert.Equal(["Ферма «Зелений Гай»", "Хутір під Києвом"], farms.Names());
        Assert.Equal(("Zelenyi Hai Farm", 1, true), (farms[0].GetProperty("name").Str("en"), farms[0].GetProperty("productCount").GetInt32(), farms[0].GetProperty("certified").GetBoolean()));
        Assert.InRange(farms[0].GetProperty("distanceKm").GetDouble(), 7, 8.5);
        Assert.True(farms[1].GetProperty("distanceKm").GetDouble() > 400);
        Assert.Equal(System.Text.Json.JsonValueKind.Null, withoutPoint[0].GetProperty("distanceKm").ValueKind);
    }
}
