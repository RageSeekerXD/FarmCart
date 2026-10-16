using System.Net.Http.Json;

namespace FarmCart.AcceptanceTests;

/// <summary>B-FR-12: «Кожна дія адміністратора потрапляє до журналу аудиту».</summary>
public sealed class AdminAuditTests
{
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
