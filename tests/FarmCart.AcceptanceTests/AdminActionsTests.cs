using System.Net;
using System.Net.Http.Json;
using static FarmCart.AcceptanceTests.Journeys;

namespace FarmCart.AcceptanceTests;

/// <summary>Дії адміністратора, яких бракувало: відхилення заявки, зміна й видалення слоту, вимкнення промокоду.</summary>
public sealed class AdminActionsTests
{
    [Fact(DisplayName = "ADM-1 Відхилена заявка зникає з черги; фермер бачить причину й подає заявку повторно")]
    public async Task RejectedSellerSeesReasonAndReapplies()
    {
        using var app = new FarmCartApp();
        var farmer = await app.LoginAsync("+380671110005");
        var registered = await farmer.PostAsJsonAsync("/api/farmers", new { farmName = HttpJson.Bilingual("Ферма «Зелений Гай»"), lat = 49.8, lon = 24.1 });
        var farmerId = (await registered.Json()).Id();
        var admin = await app.AdminAsync();

        await admin.PostJson($"/api/admin/farmers/{farmerId}/reject", new { reason = "Немає документів" });
        var queue = await admin.GetJson("/api/admin/farmers/pending");
        var profile = await farmer.GetJson("/api/farmer/profile");
        await farmer.PostJson("/api/farmer/reapply", new { });

        Assert.Empty(queue.EnumerateArray());
        Assert.Equal("Немає документів", profile.Str("rejectionReason"));
        Assert.Single((await admin.GetJson("/api/admin/farmers/pending")).EnumerateArray());
    }

    [Fact(DisplayName = "ADM-2 Слот із замовленнями не можна перенести чи видалити, порожній - можна")]
    public async Task SlotsWithOrdersAreProtected()
    {
        using var app = new FarmCartApp();
        var (_, apples, busySlot) = await FarmWithApplesAsync(app);
        var emptySlot = await app.SlotAsync(hoursFromNow: 30);
        var buyer = await app.LoginAsync("+380971111111");
        await OrderAsync(buyer, apples, 1, busySlot);
        var admin = await app.AdminAsync();
        var start = app.Clock.Now.AddHours(48);

        var moved = await admin.PatchAsJsonAsync($"/api/admin/slots/{busySlot}", new { start, end = start.AddHours(2), capacity = 3 });
        var deleteBusy = await admin.DeleteAsync($"/api/admin/slots/{busySlot}");
        var deleteEmpty = await admin.DeleteAsync($"/api/admin/slots/{emptySlot}");
        var slots = await buyer.GetJson("/api/slots");

        Assert.Equal((HttpStatusCode.Conflict, HttpStatusCode.Conflict, HttpStatusCode.NoContent), (moved.StatusCode, deleteBusy.StatusCode, deleteEmpty.StatusCode));
        Assert.Equal("slot_in_use", await moved.ErrorCode());
        Assert.Equal([busySlot], slots.EnumerateArray().Select(s => s.Id()));
        Assert.Equal((3, 2), (slots[0].GetProperty("capacity").GetInt32(), slots[0].GetProperty("remaining").GetInt32()));
    }

    [Fact(DisplayName = "ADM-3 Вимкнений промокод не приймається при оформленні")]
    public async Task SwitchedOffPromoIsRefused()
    {
        using var app = new FarmCartApp();
        var (_, apples, slot) = await FarmWithApplesAsync(app);
        var admin = await app.AdminAsync();
        await admin.PostJson("/api/admin/promocodes", new { code = "AUTUMN15", percent = 15, minTotal = 100m, validUntil = app.Clock.Now.AddDays(10) });
        var switchedOff = await admin.PostJson("/api/admin/promocodes/AUTUMN15/deactivate", new { });
        var buyer = await app.LoginAsync("+380971111111");
        (await buyer.AddToCartAsync(apples, 5)).EnsureSuccessStatusCode();

        var refused = await buyer.CheckoutAsync(slot, promoCode: "AUTUMN15");

        Assert.False(switchedOff.GetProperty("active").GetBoolean());
        Assert.Equal(HttpStatusCode.BadRequest, refused.StatusCode);
        Assert.Equal("promo_inactive", await refused.ErrorCode());
    }
}
