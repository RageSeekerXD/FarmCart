using System.Net;
using System.Net.Http.Json;

namespace FarmCart.AcceptanceTests;

/// <summary>US-05 (B-FR-03): «Як покупець, я хочу зібрати кошик і оформити доставку в зручний слот, у тому числі з промокодом».</summary>
public sealed class CheckoutTests
{
    [Fact(DisplayName = "US-05.1 Замовлення створюється лише з товарів, що є в наявності")]
    public async Task OrderIsCreatedOnlyFromAvailableStock()
    {
        using var app = new FarmCartApp();
        var farmer = await app.VerifiedFarmerAsync("+380671110001", "Ферма «Зелений Гай»");
        var apples = await farmer.PublishAsync("Яблука", "Фрукти", 32m, stock: 3);
        var slot = await app.SlotAsync();
        var anna = await app.LoginAsync("+380971111111");
        var petro = await app.LoginAsync("+380972222222");
        await anna.AddToCartAsync(apples, 3);
        await petro.AddToCartAsync(apples, 2);

        var first = await anna.CheckoutAsync(slot);
        var second = await petro.CheckoutAsync(slot);

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
        Assert.Equal("out_of_stock", await second.ErrorCode());
        Assert.Single((await petro.GetJson("/api/cart")).GetProperty("lines").EnumerateArray());
    }

    [Fact(DisplayName = "US-05.2 Кількість замовлень у слоті доставки не перевищує його ємності")]
    public async Task SlotCapacityIsRespected()
    {
        using var app = new FarmCartApp();
        var farmer = await app.VerifiedFarmerAsync("+380671110001", "Ферма «Зелений Гай»");
        var apples = await farmer.PublishAsync("Яблука", "Фрукти", 32m);
        var slot = await app.SlotAsync(capacity: 1);
        var anna = await app.LoginAsync("+380971111111");
        var petro = await app.LoginAsync("+380972222222");
        await anna.AddToCartAsync(apples, 1);
        await petro.AddToCartAsync(apples, 1);

        await anna.CheckoutAsync(slot);
        var second = await petro.CheckoutAsync(slot);
        var slots = await petro.GetJson("/api/slots");

        Assert.Equal("slot_full", await second.ErrorCode());
        Assert.Equal(0, slots[0].GetProperty("remaining").GetInt32());
    }

    [Fact(DisplayName = "US-05.3 Промокод зменшує суму, а замовлення нижче мінімальної суми отримує пояснення")]
    public async Task PromoCodeAppliesDiscount()
    {
        using var app = new FarmCartApp();
        var farmer = await app.VerifiedFarmerAsync("+380671110001", "Ферма «Зелений Гай»");
        var apples = await farmer.PublishAsync("Яблука", "Фрукти", 32m);
        var slot = await app.SlotAsync();
        var admin = await app.AdminAsync();
        await admin.PostJson("/api/admin/promocodes", new { code = "OSIN15", percent = 15, minTotal = 300m, validUntil = app.Clock.Now.AddDays(30) });
        var anna = await app.LoginAsync("+380971111111");
        var petro = await app.LoginAsync("+380972222222");
        await anna.AddToCartAsync(apples, 10);
        await petro.AddToCartAsync(apples, 1);

        var discounted = await (await anna.CheckoutAsync(slot, promoCode: "osin15")).Json();
        var tooSmall = await (await petro.CheckoutAsync(slot, promoCode: "OSIN15")).Json();

        Assert.Equal((320m, 48m, 272m), (discounted.Dec("subtotal"), discounted.Dec("discount"), discounted.Dec("total")));
        Assert.Equal("promo_min_total", tooSmall.Str("error"));
        Assert.Contains("300,00 грн", tooSmall.Str("message"));
    }

    [Fact(DisplayName = "US-05.4 Повторний запит із тим самим Idempotency-Key не створює дубль і не списує кошти вдруге")]
    public async Task RepeatedCheckoutIsIdempotent()
    {
        using var app = new FarmCartApp();
        var farmer = await app.VerifiedFarmerAsync("+380671110001", "Ферма «Зелений Гай»");
        var apples = await farmer.PublishAsync("Яблука", "Фрукти", 32m, stock: 10);
        var slot = await app.SlotAsync();
        var buyer = await app.LoginAsync("+380971111111");
        await buyer.AddToCartAsync(apples, 2);

        var first = await (await buyer.CheckoutAsync(slot, idempotencyKey: "a1b2c3")).Json();
        var retry = await (await buyer.CheckoutAsync(slot, idempotencyKey: "a1b2c3")).Json();

        Assert.Equal(first.Id(), retry.Id());
        Assert.Single((await buyer.GetJson("/api/orders")).EnumerateArray());
        Assert.Single(app.Payments.Charges);
        Assert.Equal(8, (await farmer.GetJson("/api/farmer/products"))[0].GetProperty("stock").GetInt32());
    }

    [Fact(DisplayName = "US-05.6 Покупець прибирає товар із кошика; порожній кошик приймає товари іншого фермера")]
    public async Task BuyerRemovesItemFromCart()
    {
        using var app = new FarmCartApp();
        var green = await app.VerifiedFarmerAsync("+380671110001", "Ферма «Зелений Гай»");
        var cheese = await app.VerifiedFarmerAsync("+380671110002", "Сироварня «Карпатська бринза»");
        var apples = await green.PublishAsync("Яблука", "Фрукти", 32m);
        var brynza = await cheese.PublishAsync("Бринза", "Молочні продукти", 165m);
        var buyer = await app.LoginAsync("+380971111111");
        await buyer.AddToCartAsync(apples, 2);

        var removed = await buyer.DeleteAsync($"/api/cart/items/{apples}");
        var otherFarm = await buyer.AddToCartAsync(brynza, 1);

        Assert.Empty((await removed.Json()).GetProperty("lines").EnumerateArray());
        Assert.Equal(HttpStatusCode.OK, otherFarm.StatusCode);
    }

    [Fact(DisplayName = "US-05.5 У кошику можуть бути товари лише одного фермера")]
    public async Task CartHoldsProductsOfOneFarmer()
    {
        using var app = new FarmCartApp();
        var green = await app.VerifiedFarmerAsync("+380671110001", "Ферма «Зелений Гай»");
        var cheese = await app.VerifiedFarmerAsync("+380671110002", "Сироварня «Карпатська бринза»");
        var apples = await green.PublishAsync("Яблука", "Фрукти", 32m);
        var brynza = await cheese.PublishAsync("Бринза", "Молочні продукти", 165m);
        var buyer = await app.LoginAsync("+380971111111");
        await buyer.AddToCartAsync(apples, 1);

        var response = await buyer.AddToCartAsync(brynza, 1);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("cart_other_farmer", await response.ErrorCode());
    }
}
