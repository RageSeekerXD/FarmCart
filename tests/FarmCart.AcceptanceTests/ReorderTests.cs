using static FarmCart.AcceptanceTests.Journeys;

namespace FarmCart.AcceptanceTests;

/// <summary>«Замовити знову» через API: кошик наповнюється позиціями минулого замовлення в межах залишку.</summary>
public sealed class ReorderTests
{
    [Fact(DisplayName = "REORDER-1 Покупець повторює доставлене замовлення; чого бракує на складі - повертається списком")]
    public async Task BuyerReordersPastOrder()
    {
        using var app = new FarmCartApp();
        var (farmer, apples, slot) = await FarmWithApplesAsync(app);
        var (courier, courierId) = await CourierAsync(app);
        var buyer = await app.LoginAsync("+380971111111");
        var orderId = await OrderAsync(buyer, apples, 30, slot);
        await SendAsync(farmer, orderId, courierId);
        await DeliverAsync(buyer, courier, orderId);

        var result = await buyer.PostJson($"/api/orders/{orderId}/reorder", new { });

        Assert.Equal(20, result.GetProperty("cart").GetProperty("lines")[0].GetProperty("quantity").GetInt32());
        var shortfall = result.GetProperty("shortfalls")[0];
        Assert.Equal((30, 20), (shortfall.GetProperty("requested").GetInt32(), shortfall.GetProperty("added").GetInt32()));
        Assert.Equal("Яблука", shortfall.GetProperty("name").Str("uk"));
    }
}
