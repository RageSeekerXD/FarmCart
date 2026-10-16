using System.Net;
using System.Net.Http.Json;

namespace FarmCart.AcceptanceTests;

/// <summary>US-08 (B-FR-05): «Як покупець, я хочу бачити статус замовлення й отримувати push-сповіщення про кожну зміну».</summary>
public sealed class OrderTrackingTests
{
    [Fact(DisplayName = "US-08.1 Кожна зміна статусу доходить до покупця push-сповіщенням не пізніше ніж за 10 с")]
    public async Task EveryStatusChangeIsPushedToBuyer()
    {
        using var app = new FarmCartApp();
        var (farmer, apples, slot) = await Journeys.FarmWithApplesAsync(app);
        var (courier, courierId) = await Journeys.CourierAsync(app);
        var buyer = await app.LoginAsync("+380971234567");
        var orderId = await Journeys.OrderAsync(buyer, apples, 2, slot);

        async Task Step(HttpClient actor, string url, object body, string expectedTitle)
        {
            app.Clock.Advance(TimeSpan.FromMinutes(15));
            var changedAt = app.Clock.Now;
            (await actor.PostAsJsonAsync(url, body)).EnsureSuccessStatusCode();
            var latest = (await buyer.GetJson("/api/me/notifications")).LastItem();
            Assert.Contains($"№{orderId}: {expectedTitle}", latest.Str("text"));
            Assert.InRange(latest.GetProperty("at").GetDateTimeOffset() - changedAt, TimeSpan.Zero, TimeSpan.FromSeconds(10));
        }

        await Step(farmer, $"/api/farmer/orders/{orderId}/accept", new { }, "прийнято");
        await Step(farmer, $"/api/farmer/orders/{orderId}/assemble", new { }, "збирається");
        await Step(farmer, $"/api/farmer/orders/{orderId}/handover", new { courierId }, "в дорозі");
        var code = (await buyer.GetJson($"/api/orders/{orderId}")).Str("deliveryCode");
        await Step(courier, $"/api/courier/deliveries/{orderId}/confirm", new { code }, "доставлено");

        var history = (await buyer.GetJson($"/api/orders/{orderId}")).GetProperty("history");
        Assert.Equal(["оформлено", "прийнято", "збирається", "в дорозі", "доставлено"], history.EnumerateArray().Select(h => h.Str("title")));
    }

    [Fact(DisplayName = "US-08.2 Статуси змінюються лише в дозволеному порядку")]
    public async Task StatusesFollowAllowedOrder()
    {
        using var app = new FarmCartApp();
        var (farmer, apples, slot) = await Journeys.FarmWithApplesAsync(app);
        var (_, courierId) = await Journeys.CourierAsync(app);
        var buyer = await app.LoginAsync("+380971234567");
        var orderId = await Journeys.OrderAsync(buyer, apples, 1, slot);
        await farmer.PostAsJsonAsync($"/api/farmer/orders/{orderId}/accept", new { });

        var handOverTooEarly = await farmer.PostAsJsonAsync($"/api/farmer/orders/{orderId}/handover", new { courierId });
        var rejectAccepted = await farmer.PostAsJsonAsync($"/api/farmer/orders/{orderId}/reject", new { reason = "Передумав" });

        Assert.Equal(HttpStatusCode.Conflict, handOverTooEarly.StatusCode);
        Assert.Equal("invalid_status", await handOverTooEarly.ErrorCode());
        Assert.Equal(HttpStatusCode.Conflict, rejectAccepted.StatusCode);
        Assert.Equal("Accepted", (await buyer.GetJson($"/api/orders/{orderId}")).Str("status"));
    }
}
