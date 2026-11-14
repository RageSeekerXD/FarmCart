using System.Net;
using static FarmCart.AcceptanceTests.Journeys;

namespace FarmCart.AcceptanceTests;

/// <summary>«Як покупець, я хочу скасувати замовлення, поки фермер його не прийняв, і отримати кошти назад».</summary>
public sealed class OrderCancellationTests
{
    [Fact(DisplayName = "CANCEL-1 Скасування до прийняття повертає кошти, товар на склад і місце в слоті; фермер отримує сповіщення")]
    public async Task CancellingBeforeAcceptanceRefundsEverything()
    {
        using var app = new FarmCartApp();
        var (farmer, apples, slot) = await FarmWithApplesAsync(app);
        var buyer = await app.LoginAsync("+380971111111");
        var orderId = await OrderAsync(buyer, apples, 3, slot);

        var cancelled = await buyer.PostAsync($"/api/orders/{orderId}/cancel", null);
        var order = await cancelled.Json();
        var stock = (await farmer.GetJson("/api/farmer/products"))[0].GetProperty("stock").GetInt32();
        var remaining = (await buyer.GetJson("/api/slots"))[0].GetProperty("remaining").GetInt32();

        Assert.Equal(HttpStatusCode.OK, cancelled.StatusCode);
        Assert.Equal(("Cancelled", "Refunded", "скасовано"), (order.Str("status"), order.Str("paymentStatus"), order.Str("statusTitle")));
        Assert.Equal((96m, 96m), (order.Dec("refundedAmount"), app.Payments.Charges[0].Refunded));
        Assert.Equal((50, 3), (stock, remaining));
        Assert.Equal("order.cancelled", (await farmer.GetJson("/api/me/notifications")).LastItem().Str("kind"));
        Assert.Contains("скасовано. Кошти 96,00 грн повернено", (await buyer.GetJson("/api/me/notifications")).LastItem().Str("text"));
    }

    [Fact(DisplayName = "CANCEL-2 Після прийняття фермером скасувати замовлення вже не можна")]
    public async Task CannotCancelAfterFarmerAccepted()
    {
        using var app = new FarmCartApp();
        var (farmer, apples, slot) = await FarmWithApplesAsync(app);
        var buyer = await app.LoginAsync("+380971111111");
        var orderId = await OrderAsync(buyer, apples, 2, slot);
        (await farmer.PostAsync($"/api/farmer/orders/{orderId}/accept", null)).EnsureSuccessStatusCode();

        var refused = await buyer.PostAsync($"/api/orders/{orderId}/cancel", null);

        Assert.Equal(HttpStatusCode.Conflict, refused.StatusCode);
        Assert.Equal("cancel_unavailable", await refused.ErrorCode());
        Assert.Equal("Accepted", (await buyer.GetJson($"/api/orders/{orderId}")).Str("status"));
    }

    [Fact(DisplayName = "CANCEL-3 Чуже замовлення скасувати не можна, а повторне скасування власного нічого не змінює")]
    public async Task OnlyOwnerCancelsAndRepeatIsHarmless()
    {
        using var app = new FarmCartApp();
        var (_, apples, slot) = await FarmWithApplesAsync(app);
        var buyer = await app.LoginAsync("+380971111111");
        var stranger = await app.LoginAsync("+380972222222");
        var orderId = await OrderAsync(buyer, apples, 2, slot);

        var foreign = await stranger.PostAsync($"/api/orders/{orderId}/cancel", null);
        (await buyer.PostAsync($"/api/orders/{orderId}/cancel", null)).EnsureSuccessStatusCode();
        var repeated = await buyer.PostAsync($"/api/orders/{orderId}/cancel", null);

        Assert.Equal(HttpStatusCode.NotFound, foreign.StatusCode);
        Assert.Equal(HttpStatusCode.OK, repeated.StatusCode);
        Assert.Equal(64m, app.Payments.Charges[0].Refunded);
    }
}
