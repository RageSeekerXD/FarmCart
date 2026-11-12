using System.Net.Http.Json;

namespace FarmCart.AcceptanceTests;

/// <summary>B-FR-12: «Кожна дія адміністратора потрапляє до журналу аудиту».</summary>
public sealed class AdminAuditTests
{
    [Fact(DisplayName = "UI-11 Адміністратор бачить список промокодів; іншим ролям він недоступний")]
    public async Task AdminListsPromoCodes()
    {
        using var app = new FarmCartApp();
        var admin = await app.AdminAsync();
        var buyer = await app.LoginAsync("+380971234567");
        await admin.PostJson("/api/admin/promocodes", new { code = "osin15", percent = 15, minTotal = 300m, validUntil = app.Clock.Now.AddDays(30) });
        await admin.PostJson("/api/admin/promocodes", new { code = "ZYMA20", percent = 20, minTotal = 500m, validUntil = app.Clock.Now.AddDays(90) });

        var codes = await admin.GetJson("/api/admin/promocodes");
        var forbidden = await buyer.GetAsync("/api/admin/promocodes");

        Assert.Equal(["ZYMA20", "OSIN15"], codes.EnumerateArray().Select(c => c.Str("code")));
        Assert.Equal((15, 300m), (codes[1].GetProperty("percent").GetInt32(), codes[1].Dec("minTotal")));
        Assert.Equal("role_required", await forbidden.ErrorCode());
    }


    [Fact(DisplayName = "B-FR-12 Кожна дія адміністратора потрапляє до журналу аудиту")]
    public async Task EveryAdminActionIsAudited()
    {
        using var app = new FarmCartApp();
        var (farmer, apples, slot) = await Journeys.FarmWithApplesAsync(app);
        var (courier, courierId) = await Journeys.CourierAsync(app);
        var buyer = await app.LoginAsync("+380971234567");
        var orderId = await Journeys.OrderAsync(buyer, apples, 1, slot);
        await Journeys.SendAsync(farmer, orderId, courierId);
        await Journeys.DeliverAsync(buyer, courier, orderId);
        var review = await buyer.PostJson($"/api/orders/{orderId}/review", new { rating = 1, comment = "Спам" });
        var admin = await app.AdminAsync();
        var adminId = (await admin.GetJson("/api/me")).Id();

        await admin.PostJson("/api/admin/promocodes", new { code = "OSIN15", percent = 15, minTotal = 300m, validUntil = app.Clock.Now.AddDays(30) });
        await admin.PostJson($"/api/admin/reviews/{review.Id()}/hide", new { reason = "Спам" });
        var audit = (await admin.GetJson("/api/admin/audit")).EnumerateArray().ToList();

        Assert.Equal(["farmer.verify", "slot.create", "promo.create", "review.hide"], audit.Select(e => e.Str("action")));
        Assert.All(audit, entry => Assert.Equal(adminId, entry.GetProperty("adminId").GetInt32()));
    }
}
