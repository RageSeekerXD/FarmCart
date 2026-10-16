using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace FarmCart.AcceptanceTests;

/// <summary>US-07 (B-FR-09): «Як фермер, я хочу приймати, частково виконувати або відхиляти замовлення».</summary>
public sealed class OrderFulfillmentTests
{
    [Fact(DisplayName = "US-07.1 Відхилення замовлення автоматично повертає кошти покупцю й товар на склад")]
    public async Task RejectionRefundsBuyerAutomatically()
    {
        using var app = new FarmCartApp();
        var (farmer, buyer, order) = await PaidOrderAsync(app);

        var rejected = await farmer.PostAsJsonAsync($"/api/farmer/orders/{order.Id()}/reject", new { reason = "Град пошкодив урожай" });
        var seenByBuyer = await buyer.GetJson($"/api/orders/{order.Id()}");
        var notifications = await buyer.GetJson("/api/me/notifications");

        Assert.Equal(HttpStatusCode.OK, rejected.StatusCode);
        Assert.Equal(("Rejected", "Refunded"), (seenByBuyer.Str("status"), seenByBuyer.Str("paymentStatus")));
        Assert.Equal(seenByBuyer.Dec("paidAmount"), seenByBuyer.Dec("refundedAmount"));
        Assert.Equal(186m, app.Payments.Charges[0].Refunded);
        Assert.Contains("відхилено (Град пошкодив урожай)", notifications.LastItem().Str("text"));
        Assert.Equal([10, 20], (await farmer.GetJson("/api/farmer/products")).EnumerateArray().Select(p => p.GetProperty("stock").GetInt32()));
    }

    [Fact(DisplayName = "US-07.2 Часткове виконання повертає покупцю вартість відсутніх товарів")]
    public async Task PartialFulfillmentRefundsMissingItems()
    {
        using var app = new FarmCartApp();
        var (farmer, buyer, order) = await PaidOrderAsync(app);
        var potatoes = order.GetProperty("lines")[1].GetProperty("productId").GetInt32();

        var accepted = await farmer.PostJson($"/api/farmer/orders/{order.Id()}/accept", new { shortages = new[] { new { productId = potatoes, quantity = 1 } } });
        var seenByBuyer = await buyer.GetJson($"/api/orders/{order.Id()}");

        Assert.Equal("Accepted", accepted.Str("status"));
        Assert.Equal((168m, 18m), (seenByBuyer.Dec("total"), seenByBuyer.Dec("refundedAmount")));
        Assert.EndsWith("повернено 18,00 грн", (await buyer.GetJson("/api/me/notifications")).LastItem().Str("text"));
    }

    [Fact(DisplayName = "US-07.3 Фермер бачить лише власні замовлення і не бачить коду вручення")]
    public async Task FarmerSeesOnlyOwnOrdersWithoutDeliveryCode()
    {
        using var app = new FarmCartApp();
        var (farmer, _, order) = await PaidOrderAsync(app);
        var stranger = await app.VerifiedFarmerAsync("+380671110009", "Чужа ферма");

        var incoming = await farmer.GetJson("/api/farmer/orders");
        var foreignAccept = await stranger.PostAsync($"/api/farmer/orders/{order.Id()}/accept", null);

        Assert.Equal(JsonValueKind.Null, incoming[0].GetProperty("deliveryCode").ValueKind);
        Assert.Matches(@"^\d{4}$", order.Str("deliveryCode"));
        Assert.Equal(HttpStatusCode.NotFound, foreignAccept.StatusCode);
        Assert.Empty((await stranger.GetJson("/api/farmer/orders")).EnumerateArray());
    }

    private static async Task<(HttpClient Farmer, HttpClient Buyer, JsonElement Order)> PaidOrderAsync(FarmCartApp app)
    {
        var farmer = await app.VerifiedFarmerAsync("+380671110001", "Ферма «Зелений Гай»");
        var apples = await farmer.PublishAsync("Яблука", "Фрукти", 32m, stock: 10);
        var potatoes = await farmer.PublishAsync("Картопля", "Овочі", 18m, stock: 20);
        var slot = await app.SlotAsync();
        var buyer = await app.LoginAsync("+380971111111");
        await buyer.AddToCartAsync(apples, 3);
        await buyer.AddToCartAsync(potatoes, 5);
        var order = await (await buyer.CheckoutAsync(slot)).Json();
        return (farmer, buyer, order);
    }
}
