using System.Net;
using System.Net.Http.Json;

namespace FarmCart.AcceptanceTests;

/// <summary>US-09 (B-FR-11): «Як кур'єр, я хочу бачити свої доставки з маршрутом і підтверджувати вручення кодом».</summary>
public sealed class CourierDeliveryTests
{
    [Fact(DisplayName = "US-09.1 Доставку неможливо закрити без правильного коду вручення")]
    public async Task DeliveryCannotBeClosedWithoutCorrectCode()
    {
        using var app = new FarmCartApp();
        var (farmer, apples, slot) = await Journeys.FarmWithApplesAsync(app);
        var (courier, courierId) = await Journeys.CourierAsync(app);
        var buyer = await app.LoginAsync("+380971234567");
        var orderId = await Journeys.OrderAsync(buyer, apples, 2, slot);
        await Journeys.SendAsync(farmer, orderId, courierId);
        var code = (await buyer.GetJson($"/api/orders/{orderId}")).Str("deliveryCode");
        var wrong = code == "0000" ? "1111" : "0000";

        var withoutCode = await courier.PostAsJsonAsync($"/api/courier/deliveries/{orderId}/confirm", new { });
        var withWrongCode = await courier.PostAsJsonAsync($"/api/courier/deliveries/{orderId}/confirm", new { code = wrong });
        var statusAfterAttempts = (await buyer.GetJson($"/api/orders/{orderId}")).Str("status");
        var withCode = await courier.PostAsJsonAsync($"/api/courier/deliveries/{orderId}/confirm", new { code });

        Assert.Equal("confirmation_required", await withoutCode.ErrorCode());
        Assert.Equal("delivery_code_invalid", await withWrongCode.ErrorCode());
        Assert.Equal("InTransit", statusAfterAttempts);
        Assert.Equal(HttpStatusCode.OK, withCode.StatusCode);
        Assert.Equal("Delivered", (await buyer.GetJson($"/api/orders/{orderId}")).Str("status"));
    }

    [Fact(DisplayName = "US-09.2 Кур'єр бачить лише свої доставки в порядку слотів, з маршрутом і без коду вручення")]
    public async Task CourierSeesOwnDeliveriesInSlotOrder()
    {
        using var app = new FarmCartApp();
        var (farmer, apples, _) = await Journeys.FarmWithApplesAsync(app);
        var evening = await app.SlotAsync(hoursFromNow: 33);
        var morning = await app.SlotAsync(hoursFromNow: 25);
        var (andrii, andriiId) = await Journeys.CourierAsync(app, "+380631230001");
        var (olha, olhaId) = await Journeys.CourierAsync(app, "+380631230002");
        var buyer = await app.LoginAsync("+380971234567");
        var eveningOrder = await Journeys.OrderAsync(buyer, apples, 1, evening);
        var morningOrder = await Journeys.OrderAsync(buyer, apples, 4, morning);
        var olhasOrder = await Journeys.OrderAsync(buyer, apples, 1, morning);
        await Journeys.SendAsync(farmer, eveningOrder, andriiId);
        await Journeys.SendAsync(farmer, morningOrder, andriiId);
        await Journeys.SendAsync(farmer, olhasOrder, olhaId);

        var couriers = await farmer.GetJson("/api/couriers");
        var andriiTasks = await andrii.GetJson("/api/courier/deliveries");
        var olhaTasks = await olha.GetJson("/api/courier/deliveries");

        Assert.Equal([andriiId, olhaId], couriers.EnumerateArray().Select(c => c.Id()));
        Assert.Equal([morningOrder, eveningOrder], andriiTasks.EnumerateArray().Select(t => t.GetProperty("orderId").GetInt32()));
        Assert.Equal(olhasOrder, Assert.Single(olhaTasks.EnumerateArray()).GetProperty("orderId").GetInt32());
        Assert.StartsWith("https://www.google.com/maps/dir/", andriiTasks[0].Str("routeUrl"));
        Assert.False(andriiTasks[0].TryGetProperty("deliveryCode", out _));
    }

    [Fact(DisplayName = "US-09.3 Оплату готівкою фіксують під час вручення")]
    public async Task CashIsCollectedAtHandover()
    {
        using var app = new FarmCartApp();
        var (farmer, apples, slot) = await Journeys.FarmWithApplesAsync(app);
        var (courier, courierId) = await Journeys.CourierAsync(app);
        var buyer = await app.LoginAsync("+380971234567");
        var orderId = await Journeys.OrderAsync(buyer, apples, 3, slot, "Cash");
        await Journeys.SendAsync(farmer, orderId, courierId);

        var toCollect = (await courier.GetJson("/api/courier/deliveries"))[0].Dec("amountToCollect");
        await Journeys.DeliverAsync(buyer, courier, orderId);
        var order = await buyer.GetJson($"/api/orders/{orderId}");

        Assert.Equal(96m, toCollect);
        Assert.Equal(("PaidOnDelivery", 96m), (order.Str("paymentStatus"), order.Dec("paidAmount")));
    }
}
