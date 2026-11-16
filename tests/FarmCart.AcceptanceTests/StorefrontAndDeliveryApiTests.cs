using System.Net;
using System.Net.Http.Json;
using FarmCart.Core;

namespace FarmCart.AcceptanceTests;

/// <summary>
/// Вітрина й доставка через HTTP: картка товару з відгуками, профіль ферми з днями доставки, документи для верифікації,
/// контакти й під'їзд/поверх/домофон у фермера та кур'єра.
/// </summary>
public sealed class StorefrontAndDeliveryApiTests
{
    [Fact(DisplayName = "SHOP-1 Картка товару доступна й тоді, коли товару немає в наявності; каталог показує його лише на прохання")]
    public async Task ProductCardAndSoldOutFilter()
    {
        using var app = new FarmCartApp();
        var farmer = await app.VerifiedFarmerAsync("+380671110001", "Ферма «Зелений Гай»");
        var gooseberries = await farmer.PublishAsync("Агрус", "berries", 90m, stock: 0);
        var buyer = await app.LoginAsync("+380971234567");

        var card = await buyer.GetJson($"/api/catalog/{gooseberries}");
        var catalog = await buyer.GetJson("/api/catalog");
        var withSoldOut = await buyer.GetJson("/api/catalog?includeSoldOut=true");
        var missing = await buyer.GetAsync("/api/catalog/999");

        Assert.Equal((0, true), (card.GetProperty("stock").GetInt32(), card.GetProperty("inSeason").GetBoolean()));
        Assert.Empty(catalog.Names());
        Assert.Equal(["Агрус"], withSoldOut.Names());
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
    }

    [Fact(DisplayName = "SHOP-2 Ферма розповідає історію й дні доставки; каталог фільтрується за днем доставки")]
    public async Task FarmStoryAndDeliveryDays()
    {
        using var app = new FarmCartApp();
        var saturday = await app.VerifiedFarmerAsync("+380671110001", "Ферма «Зелений Гай»");
        var daily = await app.VerifiedFarmerAsync("+380671110002", "Пекарня «Житній колос»");
        await saturday.PublishAsync("Морква", "vegetables", 16m);
        await daily.PublishAsync("Хліб", "bakery", 48m);

        var profile = await saturday.PatchAsJsonAsync("/api/farmer/profile", new
        {
            story = new { uk = "Сімейна ферма з 2009 року", en = "A family farm since 2009" },
            deliveryDays = new[] { "Saturday" },
        });
        var buyer = await app.LoginAsync("+380971234567");
        var farms = await buyer.GetJson("/api/farmers");
        var onFriday = await buyer.GetJson("/api/catalog?deliveryDay=Friday");

        profile.EnsureSuccessStatusCode();
        var green = farms.EnumerateArray().Single(f => f.GetProperty("name").Str("uk") == "Ферма «Зелений Гай»");
        Assert.Equal("A family farm since 2009", green.GetProperty("story").Str("en"));
        Assert.Equal(["Saturday"], green.GetProperty("deliveryDays").EnumerateArray().Select(d => d.GetString()));
        Assert.Equal(["Хліб"], onFriday.Names());
    }

    [Fact(DisplayName = "SHOP-3 Відгуки про товар - від покупців, у чиєму замовленні він був")]
    public async Task ProductReviews()
    {
        using var app = new FarmCartApp();
        var (farmer, apples, slot) = await Journeys.FarmWithApplesAsync(app);
        var buyer = await app.LoginAsync("+380971234567");
        var (courier, courierId) = await Journeys.CourierAsync(app);
        var orderId = await Journeys.OrderAsync(buyer, apples, 2, slot);
        await Journeys.SendAsync(farmer, orderId, courierId);
        await Journeys.DeliverAsync(buyer, courier, orderId);
        (await buyer.PostAsJsonAsync($"/api/orders/{orderId}/review", new { rating = 5, comment = "Хрусткі яблука" })).EnsureSuccessStatusCode();

        var reviews = await buyer.GetJson($"/api/products/{apples}/reviews");

        Assert.Equal(["Хрусткі яблука"], reviews.EnumerateArray().Select(r => r.Str("comment")));
    }

    [Fact(DisplayName = "VERIFY-1 Фермер завантажує скани документів, адміністратор їх переглядає, інші - ні")]
    public async Task VerificationDocuments()
    {
        using var app = new FarmCartApp();
        var farmer = await app.LoginAsync("+380671110004");
        var registered = await farmer.PostAsJsonAsync("/api/farmers", new { farmName = HttpJson.Bilingual("Еко-ферма «Сокільники»"), lat = 49.8, lon = 23.98, certified = true });
        var farmerId = (await registered.Json()).Id();
        byte[] pdf = [.. "%PDF-1.7\n"u8, 1, 2, 3];

        var upload = await farmer.PostAsync("/api/farmer/documents?name=Сертифікат.pdf", new ByteArrayContent(pdf) { Headers = { ContentType = new("application/pdf") } });
        var wrongType = await farmer.PostAsync("/api/farmer/documents?name=x", new StringContent("<svg/>", System.Text.Encoding.UTF8, "image/svg+xml"));
        var admin = await app.AdminAsync();
        var pending = await admin.GetJson("/api/admin/farmers/pending");
        var documents = await admin.GetJson($"/api/admin/farmers/{farmerId}/documents");
        var file = await admin.GetAsync($"/api/admin/farmers/{farmerId}/documents/{documents[0].Id()}");
        var stranger = await (await app.LoginAsync("+380971234567")).GetAsync($"/api/admin/farmers/{farmerId}/documents");

        Assert.Equal(HttpStatusCode.Created, upload.StatusCode);
        Assert.Equal("document_type_invalid", await wrongType.ErrorCode());
        Assert.Equal(1, pending[0].GetProperty("documentCount").GetInt32());
        Assert.Equal("Сертифікат.pdf", documents[0].Str("name"));
        Assert.Equal("application/pdf", file.Content.Headers.ContentType!.MediaType);
        Assert.Equal(pdf, await file.Content.ReadAsByteArrayAsync());
        Assert.Equal(HttpStatusCode.Forbidden, stranger.StatusCode);
    }

    [Fact(DisplayName = "DELIVERY-1 Фермер і кур'єр бачать контакти, під'їзд, поверх і домофон; кур'єр - ще й склад і координати")]
    public async Task StaffSeeContactsAndAccessDetails()
    {
        using var app = new FarmCartApp();
        var (farmer, apples, slot) = await Journeys.FarmWithApplesAsync(app);
        var buyer = await app.LoginAsync("+380971234567");
        var (courier, courierId) = await Journeys.CourierAsync(app);
        (await buyer.AddToCartAsync(apples, 3)).EnsureSuccessStatusCode();
        var placed = await buyer.PostAsJsonAsync("/api/orders", new
        {
            address = "Львів, вул. Личаківська, 24, кв. 5",
            slotId = slot,
            paymentMethod = "Cash",
            comment = "Подзвоніть за 10 хвилин",
            details = new { entrance = "2", floor = "3", intercom = "5К" },
            lat = 49.8378,
            lon = 24.0468,
        });
        var orderId = (await placed.Json()).Id();

        var incoming = (await farmer.GetJson("/api/farmer/orders")).EnumerateArray().Single();
        await Journeys.SendAsync(farmer, orderId, courierId);
        var task = (await courier.GetJson("/api/courier/deliveries")).EnumerateArray().Single();
        var own = await buyer.GetJson($"/api/orders/{orderId}");

        Assert.Equal("+380971234567", incoming.Str("buyerPhone"));
        Assert.Equal("5К", incoming.GetProperty("addressDetails").Str("intercom"));
        Assert.Equal(System.Text.Json.JsonValueKind.Null, own.GetProperty("buyerPhone").ValueKind);
        Assert.Equal(("+380971234567", "+380671110001"), (task.Str("buyerPhone"), task.Str("farmerPhone")));
        Assert.Equal(("2", "3"), (task.GetProperty("addressDetails").Str("entrance"), task.GetProperty("addressDetails").Str("floor")));
        Assert.Equal(49.8378, task.GetProperty("dropOffLat").GetDouble());
        Assert.Equal("Подзвоніть за 10 хвилин", task.Str("comment"));
        Assert.Equal(3, task.GetProperty("lines")[0].GetProperty("quantity").GetInt32());
    }
}
