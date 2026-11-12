using System.Text.RegularExpressions;
using FarmCart.Core;

namespace FarmCart.AcceptanceTests;

/// <summary>Демонстраційні дані режиму розробки (BE-8), на яких працюють протокол релізу й веб-інтерфейс.</summary>
public sealed partial class DemoDataTests
{
    public static TheoryData<int> Months => new(Enumerable.Range(1, 12));

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
        var curd = new { name = HttpJson.Bilingual("Сир", "Curd"), category = "dairy", unit = "kg", price = 100m, stock = 5 };
        var attempt = await newcomer.PostAsync("/api/farmer/products", System.Net.Http.Json.JsonContent.Create(curd));

        Assert.DoesNotContain("Полуниця", catalog.Names());
        Assert.Contains("Морква", catalog.Names());
        Assert.Equal(5, slots.GetArrayLength());
        Assert.Equal(app.Clock.Now.Date.AddDays(1).AddHours(10), slots[0].GetProperty("start").GetDateTimeOffset().DateTime);
        Assert.Equal(5, ownProducts.GetArrayLength());
        Assert.Equal("farmer_not_verified", await attempt.ErrorCode());
        Assert.True(app.Store.PromoCodes.ContainsKey("FARM10"));
    }

    [Theory(DisplayName = "DEMO-3 Каталог демонстраційних даних не порожній у жодному місяці: щонайменше 20 товарів")]
    [MemberData(nameof(Months))]
    public async Task CatalogIsRichInEveryMonth(int month)
    {
        using var app = new FarmCartApp(seedDemoData: true, start: new DateTimeOffset(2026, month, 15, 10, 0, 0, TimeSpan.FromHours(2)));

        var catalog = await app.CreateClient().GetJson("/api/catalog");

        Assert.True(catalog.GetArrayLength() >= 20, $"У місяці {month} в каталозі лише {catalog.GetArrayLength()} товарів");
    }

    [Fact(DisplayName = "DEMO-4 Демонстраційні дані покривають усі категорії, мають ферми в черзі верифікації й товари без залишку")]
    public void DemoDataCoversCategoriesFarmsAndStock()
    {
        using var app = new FarmCartApp(seedDemoData: true);
        var products = app.Store.Products.Values;
        var farmers = app.Store.Farmers.Values;

        Assert.InRange(farmers.Count, 10, 12);
        Assert.Equal(2, farmers.Count(f => !f.Verified));
        Assert.InRange(products.Count, 40, 50);
        Assert.Equal(Reference.Categories.Select(c => c.Code).Order(), products.Select(p => p.Category).Distinct().Order());
        Assert.True(products.Count(p => p.SeasonMonths.Count == 0) >= products.Count * 0.6, "Цілорічних товарів менше 60 %");
        Assert.Contains(products, p => p.Stock == 0);
        Assert.Contains(farmers, f => f.Certified);
        Assert.Contains(farmers, f => !f.Certified);
    }

    [Fact(DisplayName = "DEMO-7 Демо-покупець має по одному замовленню в кожному статусі, а ферми - відгуки й рейтинг")]
    public async Task DemoBuyerHasHistory()
    {
        using var app = new FarmCartApp(seedDemoData: true);
        var buyer = await app.LoginAsync(FarmCart.Api.DemoData.DemoBuyerPhone);
        var courier = await app.LoginAsync("+380631230001");

        var orders = await buyer.GetJson("/api/orders");
        var notifications = await buyer.GetJson("/api/me/notifications");
        var deliveries = await courier.GetJson("/api/courier/deliveries");
        var farms = await buyer.GetJson("/api/farmers");

        Assert.Equal(
            Enum.GetNames<OrderStatus>().Order(),
            orders.EnumerateArray().Select(o => o.Str("status")).Order());
        Assert.Equal("Refunded", orders.EnumerateArray().Single(o => o.Str("status") == "Rejected").Str("paymentStatus"));
        Assert.True(notifications.GetArrayLength() >= 6);
        Assert.Single(deliveries.EnumerateArray());
        Assert.True(farms.EnumerateArray().Count(f => f.GetProperty("rating").ValueKind == System.Text.Json.JsonValueKind.Number) >= 4);
        var green = farms.EnumerateArray().Single(f => f.GetProperty("name").Str("uk") == "Ферма «Зелений Гай»");
        Assert.Equal(System.Text.Json.JsonValueKind.Null, green.GetProperty("rating").ValueKind);
    }

    [Fact(DisplayName = "DEMO-8 Після вручення демо-покупець бачить власний відгук на замовлення")]
    public async Task DemoBuyerSeesOwnReview()
    {
        using var app = new FarmCartApp(seedDemoData: true);
        var buyer = await app.LoginAsync(FarmCart.Api.DemoData.DemoBuyerPhone);
        var delivered = (await buyer.GetJson("/api/orders")).EnumerateArray().Single(o => o.Str("status") == "Delivered");

        var review = await buyer.GetJson($"/api/orders/{delivered.Id()}/review");

        Assert.Equal(5, review.GetProperty("review").GetProperty("rating").GetInt32());
    }

    [Fact(DisplayName = "DEMO-9 Демонстраційні акаунти покривають усі ролі, і кожному є що показати; поза демо-режимом їх немає")]
    public async Task DemoAccountsCoverEveryRole()
    {
        using var app = new FarmCartApp(seedDemoData: true);
        using var production = new FarmCartApp();

        var accounts = await app.CreateClient().GetJson("/api/demo/accounts");
        var hidden = await production.CreateClient().GetJson("/api/demo/accounts");

        Assert.Equal(Enum.GetNames<Role>(), accounts.EnumerateArray().Select(a => a.Str("role")));
        Assert.Equal(0, hidden.GetArrayLength());
        foreach (var account in accounts.EnumerateArray())
        {
            var client = await app.LoginAsync(account.Str("phone"));
            var roles = (await client.GetJson("/api/me")).GetProperty("roles").EnumerateArray().Select(r => r.GetString());
            Assert.Contains(account.Str("role"), roles);
            Assert.False(string.IsNullOrWhiteSpace(account.GetProperty("title").Str("en")));
        }

        var farmer = await app.LoginAsync(accounts[1].Str("phone"));
        var incoming = await farmer.GetJson("/api/farmer/orders");
        Assert.Contains(incoming.EnumerateArray(), o => o.Str("status") == "Placed");
    }

    [Fact(DisplayName = "DEMO-5 Жодне англійське поле демонстраційних даних і довідників не містить кирилиці")]
    public void EnglishFieldsHaveNoCyrillic()
    {
        using var app = new FarmCartApp(seedDemoData: true);
        var english = app.Store.Products.Values.SelectMany(p => new[] { p.Name.En, p.Unit.En })
            .Concat(app.Store.Farmers.Values.Select(f => f.Name.En))
            .Concat(Reference.Categories.Concat(Reference.Units).Select(item => item.Title.En));

        Assert.All(english, text => Assert.False(Cyrillic().IsMatch(text), $"Кирилиця в англійському полі: {text}"));
    }

    [Fact(DisplayName = "DEMO-6 Кожне фото товару існує на диску й має запис про автора та ліцензію")]
    public void EveryPhotoExistsAndIsAttributed()
    {
        using var app = new FarmCartApp(seedDemoData: true);
        var root = RepositoryRoot();
        var attributionsPath = Path.Combine(root, "docs", "attributions.md");
        var attributions = File.Exists(attributionsPath) ? File.ReadAllText(attributionsPath) : "";

        foreach (var photo in app.Store.Products.Values.Select(p => p.PhotoUrl).OfType<string>())
        {
            var file = Path.Combine(root, "src", "FarmCart.Api", "wwwroot", photo.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));
            Assert.True(File.Exists(file), $"Немає файлу фото {photo}");
            Assert.Contains(Path.GetFileName(file), attributions, StringComparison.Ordinal);
        }
    }

    private static string RepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "FarmCart.slnx")))
        {
            directory = directory.Parent;
        }

        return directory?.FullName ?? throw new InvalidOperationException("Не знайдено корінь репозиторію (FarmCart.slnx)");
    }

    [GeneratedRegex(@"\p{IsCyrillic}")]
    private static partial Regex Cyrillic();
}
