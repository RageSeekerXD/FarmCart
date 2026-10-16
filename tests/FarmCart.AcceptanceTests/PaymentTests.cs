using System.Net;

namespace FarmCart.AcceptanceTests;

/// <summary>US-06 (B-FR-04): «Як покупець, я хочу оплатити карткою, Apple Pay чи Google Pay або готівкою при отриманні».</summary>
public sealed class PaymentTests
{
    [Fact(DisplayName = "US-06.1 Успішна оплата карткою відображається як «оплачено»; на сервер надходить лише токен")]
    public async Task CardPaymentIsShownAsPaid()
    {
        using var app = new FarmCartApp();
        var (buyer, slot) = await BuyerWithCartAsync(app);

        var order = await (await buyer.CheckoutAsync(slot, "ApplePay", "tok_applepay")).Json();

        Assert.Equal(("Paid", "оформлено"), (order.Str("paymentStatus"), order.Str("statusTitle")));
        Assert.Equal(order.Dec("total"), order.Dec("paidAmount"));
        Assert.Equal(96m, Assert.Single(app.Payments.Charges).Amount);
    }

    [Fact(DisplayName = "US-06.2 Відхилена банком оплата повертає зрозуміле повідомлення; замовлення не створюється, кошик зберігається")]
    public async Task DeclinedPaymentKeepsCart()
    {
        using var app = new FarmCartApp();
        var (buyer, slot) = await BuyerWithCartAsync(app);

        var response = await buyer.CheckoutAsync(slot, token: "tok_declined");

        Assert.Equal(HttpStatusCode.PaymentRequired, response.StatusCode);
        Assert.StartsWith("Банк відхилив оплату", (await response.Json()).Str("message"));
        Assert.Empty((await buyer.GetJson("/api/orders")).EnumerateArray());
        Assert.Single((await buyer.GetJson("/api/cart")).GetProperty("lines").EnumerateArray());
    }

    [Fact(DisplayName = "US-06.3 Запит із номером картки відхиляється, і номер не потрапляє в систему")]
    public async Task CardNumberNeverReachesServer()
    {
        using var app = new FarmCartApp();
        var (buyer, slot) = await BuyerWithCartAsync(app);

        var inBody = await buyer.CheckoutAsync(slot, comment: "Моя картка 4111 1111 1111 1111, спишіть звідти");
        var inQuery = await buyer.GetAsync("/api/catalog?q=4111111111111111");

        Assert.Equal(HttpStatusCode.BadRequest, inBody.StatusCode);
        Assert.Equal("card_data_forbidden", await inBody.ErrorCode());
        Assert.Equal("card_data_forbidden", await inQuery.ErrorCode());
        Assert.Empty(app.Store.Orders);
        Assert.Empty(app.Payments.Charges);
    }

    [Fact(DisplayName = "US-06.4 Оплата готівкою при отриманні не списує кошти")]
    public async Task CashOnDeliveryChargesNothing()
    {
        using var app = new FarmCartApp();
        var (buyer, slot) = await BuyerWithCartAsync(app);

        var order = await (await buyer.CheckoutAsync(slot, "Cash", token: null)).Json();

        Assert.Equal("PayOnDelivery", order.Str("paymentStatus"));
        Assert.Equal(0m, order.Dec("paidAmount"));
        Assert.Empty(app.Payments.Charges);
    }

    private static async Task<(HttpClient Buyer, int Slot)> BuyerWithCartAsync(FarmCartApp app)
    {
        var farmer = await app.VerifiedFarmerAsync("+380671110001", "Ферма «Зелений Гай»");
        var apples = await farmer.PublishAsync("Яблука", "Фрукти", 32m);
        var slot = await app.SlotAsync();
        var buyer = await app.LoginAsync("+380971111111");
        await buyer.AddToCartAsync(apples, 3);
        return (buyer, slot);
    }
}
