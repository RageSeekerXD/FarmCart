using System.Net;
using System.Net.Http.Json;

namespace FarmCart.AcceptanceTests;

/// <summary>US-10 (B-FR-06): «Як покупець, я хочу оцінити фермера після доставки, щоб інші обирали перевірених».</summary>
public sealed class ReviewTests
{
    [Fact(DisplayName = "US-10.1 Відгук можливий лише для доставленого замовлення; рейтинг фермера в каталозі оновлюється одразу")]
    public async Task ReviewOnlyAfterDeliveryAndRatingUpdatesImmediately()
    {
        using var app = new FarmCartApp();
        var (farmer, apples, slot) = await Journeys.FarmWithApplesAsync(app);
        var (courier, courierId) = await Journeys.CourierAsync(app);
        var buyer = await app.LoginAsync("+380971234567");
        var orderId = await Journeys.OrderAsync(buyer, apples, 2, slot);

        var tooEarly = await buyer.PostAsJsonAsync($"/api/orders/{orderId}/review", new { rating = 5, comment = "Ще не отримав" });
        await Journeys.SendAsync(farmer, orderId, courierId);
        await Journeys.DeliverAsync(buyer, courier, orderId);
        var created = await buyer.PostAsJsonAsync($"/api/orders/{orderId}/review", new { rating = 5, comment = "Хрусткі й солодкі" });
        var duplicate = await buyer.PostAsJsonAsync($"/api/orders/{orderId}/review", new { rating = 1 });
        var catalogItem = (await buyer.GetJson("/api/catalog"))[0];

        Assert.Equal("not_delivered", await tooEarly.ErrorCode());
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.Equal("already_reviewed", await duplicate.ErrorCode());
        Assert.Equal(5.0, catalogItem.GetProperty("farmerRating").GetDouble());
    }

    [Fact(DisplayName = "US-10.2 Адміністратор приховує недоречний відгук, і рейтинг перераховується")]
    public async Task HiddenReviewIsExcludedFromRating()
    {
        using var app = new FarmCartApp();
        var (farmer, apples, slot) = await Journeys.FarmWithApplesAsync(app);
        var (courier, courierId) = await Journeys.CourierAsync(app);
        var fan = await app.LoginAsync("+380971111111");
        var troll = await app.LoginAsync("+380972222222");
        var fanOrder = await Journeys.OrderAsync(fan, apples, 1, slot);
        var trollOrder = await Journeys.OrderAsync(troll, apples, 1, slot);
        foreach (var (buyer, order) in new[] { (fan, fanOrder), (troll, trollOrder) })
        {
            await Journeys.SendAsync(farmer, order, courierId);
            await Journeys.DeliverAsync(buyer, courier, order);
        }

        await fan.PostJson($"/api/orders/{fanOrder}/review", new { rating = 5 });
        var spam = await troll.PostJson($"/api/orders/{trollOrder}/review", new { rating = 1, comment = "Купуйте в іншому магазині!" });
        var ratingBefore = (await fan.GetJson("/api/catalog"))[0].GetProperty("farmerRating").GetDouble();
        var admin = await app.AdminAsync();
        await admin.PostJson($"/api/admin/reviews/{spam.Id()}/hide", new { reason = "Реклама конкурента" });
        var ratingAfter = (await fan.GetJson("/api/catalog"))[0].GetProperty("farmerRating").GetDouble();
        var farmerId = (await fan.GetJson("/api/catalog"))[0].GetProperty("farmerId").GetInt32();

        Assert.Equal((3.0, 5.0), (ratingBefore, ratingAfter));
        Assert.Single((await fan.GetJson($"/api/farmers/{farmerId}/reviews")).EnumerateArray());
    }
}
