using System.Net;
using System.Net.Http.Json;

namespace FarmCart.AcceptanceTests;

/// <summary>US-02 (B-FR-07, B-FR-12): «Як адміністратор, я хочу верифікувати фермерів, щоб у каталозі були лише перевірені продавці».</summary>
public sealed class SellerVerificationTests
{
    private const string FarmerPhone = "+380671110001";
    private static readonly object Apples = new { name = "Яблука «Голден»", category = "Фрукти", unit = "кг", price = 32m, stock = 150 };

    [Fact(DisplayName = "US-02.1 Продавець без верифікації не може публікувати товари")]
    public async Task UnverifiedSellerCannotPublish()
    {
        using var app = new FarmCartApp();
        var farmer = await app.LoginAsync(FarmerPhone);

        var registered = await farmer.PostAsJsonAsync("/api/farmers", new { farmName = "Ферма «Зелений Гай»", lat = 49.816, lon = 24.13, certified = true });
        var published = await farmer.PostAsJsonAsync("/api/farmer/products", Apples);

        Assert.Equal(HttpStatusCode.Created, registered.StatusCode);
        Assert.False((await registered.Json()).GetProperty("verified").GetBoolean());
        Assert.Equal(HttpStatusCode.Forbidden, published.StatusCode);
        Assert.Equal("farmer_not_verified", await published.ErrorCode());
    }

    [Fact(DisplayName = "US-02.2 Після верифікації адміністратором фермер публікує товар; дія є в журналі аудиту")]
    public async Task VerificationAllowsPublishingAndIsAudited()
    {
        using var app = new FarmCartApp();
        var farmer = await app.LoginAsync(FarmerPhone);
        var farmerId = (await farmer.PostJson("/api/farmers", new { farmName = "Ферма «Зелений Гай»", lat = 49.816, lon = 24.13, certified = true })).Id();
        var admin = await app.AdminAsync();
        var pending = await admin.GetJson("/api/admin/farmers/pending");

        var verified = await admin.PostAsync($"/api/admin/farmers/{farmerId}/verify", null);
        var published = await farmer.PostAsJsonAsync("/api/farmer/products", Apples);
        var audit = await admin.GetJson("/api/admin/audit");

        Assert.Equal(farmerId, Assert.Single(pending.EnumerateArray()).Id());
        Assert.Equal(HttpStatusCode.OK, verified.StatusCode);
        Assert.Equal(HttpStatusCode.Created, published.StatusCode);
        var entry = Assert.Single(audit.EnumerateArray());
        Assert.Equal("farmer.verify", entry.GetProperty("action").GetString());
        Assert.Equal($"farmer#{farmerId}", entry.GetProperty("target").GetString());
    }

    [Fact(DisplayName = "US-02.3 Верифікувати продавця та читати журнал аудиту може лише адміністратор")]
    public async Task OnlyAdminCanVerifyAndReadAudit()
    {
        using var app = new FarmCartApp();
        var farmer = await app.LoginAsync(FarmerPhone);
        var farmerId = (await farmer.PostJson("/api/farmers", new { farmName = "Ферма", lat = 49.816, lon = 24.13, certified = false })).Id();

        var selfVerification = await farmer.PostAsync($"/api/admin/farmers/{farmerId}/verify", null);
        var auditRead = await farmer.GetAsync("/api/admin/audit");

        Assert.Equal(HttpStatusCode.Forbidden, selfVerification.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, auditRead.StatusCode);
    }
}
