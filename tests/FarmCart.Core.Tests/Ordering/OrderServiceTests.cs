namespace FarmCart.Core.Tests.Ordering;

/// <summary>US-05, US-06 (B-FR-03, B-FR-04, B-NFR-02): оформлення й оплата замовлення.</summary>
public sealed class OrderServiceTests
{
    private readonly TestWorld _world = new();
    private readonly User _farm;
    private readonly User _buyer;
    private readonly Product _apples;
    private readonly Product _potatoes;

    public OrderServiceTests()
    {
        (_farm, _) = _world.NewFarmer();
        _apples = _world.NewProduct(_farm, "Яблука", 32m, stock: 10);
        _potatoes = _world.NewProduct(_farm, "Картопля", 18m, stock: 20, category: "Овочі");
        _buyer = _world.NewUser();
    }

    [Fact]
    public void PlaceOrder_ByCard_ChargesTotalReservesStockAndClearsCart()
    {
        var order = _world.BuyMany(_buyer, [(_apples, 3), (_potatoes, 5)]);

        Assert.Equal((OrderStatus.Placed, PaymentStatus.Paid), (order.Status, order.PaymentStatus));
        Assert.Equal((186m, 186m), (order.Total, order.PaidAmount));
        Assert.Equal(186m, Assert.Single(_world.Payments.Charges).Amount);
        Assert.Equal((7, 15), (_apples.Stock, _potatoes.Stock));
        Assert.Empty(_world.Carts.Get(_buyer).Lines);
        Assert.Matches(@"^\d{4}$", order.DeliveryCode);
        Assert.Equal(1001, order.Id);
    }

    [Fact]
    public void PlaceOrder_WithCash_DoesNotChargeAnything()
    {
        var order = _world.Buy(_buyer, _apples, 2, PaymentMethod.Cash);

        Assert.Equal(PaymentStatus.PayOnDelivery, order.PaymentStatus);
        Assert.Null(order.ChargeId);
        Assert.Empty(_world.Payments.Charges);
    }

    [Fact]
    public void PlaceOrder_DeclinedCard_CreatesNothingAndKeepsCartAndStock()
    {
        _world.Carts.Add(_buyer, _apples.Id, 3);
        var request = new CheckoutRequest(TestWorld.Address, _world.NewSlot().Id, PaymentMethod.Card, SandboxPaymentGateway.DeclinedToken);

        var error = Assert.Throws<DomainException>(() => _world.Orders.PlaceOrder(_buyer, request));

        Assert.Equal(ErrorKind.PaymentDeclined, error.Kind);
        Assert.Contains("відхилив", error.Message);
        Assert.Empty(_world.Orders.MyOrders(_buyer));
        Assert.Equal(3, Assert.Single(_world.Carts.Get(_buyer).Lines).Quantity);
        Assert.Equal(10, _apples.Stock);
    }

    // DEF-02: зауваження замовника на демонстрації - після відхиленої оплати номер №1001 «зникав».
    [Fact]
    public void PlaceOrder_DeclinedPayment_DoesNotTakeOrderNumber()
    {
        _world.Carts.Add(_buyer, _apples.Id, 1);
        var slot = _world.NewSlot();
        Assert.Throws<DomainException>(() =>
            _world.Orders.PlaceOrder(_buyer, new CheckoutRequest(TestWorld.Address, slot.Id, PaymentMethod.Card, SandboxPaymentGateway.DeclinedToken)));

        var order = _world.Orders.PlaceOrder(_buyer, new CheckoutRequest(TestWorld.Address, slot.Id, PaymentMethod.Card, "tok_visa"));

        Assert.Equal(1001, order.Id);
    }

    [Fact]
    public void PlaceOrder_ByCardWithoutToken_IsRejected()
    {
        _world.Carts.Add(_buyer, _apples.Id, 1);

        var error = Assert.Throws<DomainException>(() =>
            _world.Orders.PlaceOrder(_buyer, new CheckoutRequest(TestWorld.Address, _world.NewSlot().Id, PaymentMethod.GooglePay)));

        Assert.Equal("payment_token_required", error.Code);
    }

    [Fact]
    public void PlaceOrder_RepeatedWithSameIdempotencyKey_ReturnsSameOrderAndChargesOnce()
    {
        _world.Carts.Add(_buyer, _apples.Id, 3);
        var request = new CheckoutRequest(TestWorld.Address, _world.NewSlot().Id, PaymentMethod.Card, "tok_visa");

        var first = _world.Orders.PlaceOrder(_buyer, request, idempotencyKey: "checkout-7f3a");
        var retry = _world.Orders.PlaceOrder(_buyer, request, idempotencyKey: "checkout-7f3a");

        Assert.Same(first, retry);
        Assert.Single(_world.Payments.Charges);
        Assert.Equal(7, _apples.Stock);
    }

    [Fact]
    public void PlaceOrder_ProductSoldOutMeanwhile_IsConflictNamingTheProduct()
    {
        var other = _world.NewUser();
        _world.Carts.Add(_buyer, _apples.Id, 8);
        _world.Buy(other, _apples, 5);

        var error = Assert.Throws<DomainException>(() =>
            _world.Orders.PlaceOrder(_buyer, new CheckoutRequest(TestWorld.Address, _world.NewSlot().Id, PaymentMethod.Cash)));

        Assert.Equal("out_of_stock", error.Code);
        Assert.Contains("«Яблука» (доступно 5)", error.Message);
    }

    [Fact]
    public void PlaceOrder_IntoFullSlot_IsConflict()
    {
        var slot = _world.NewSlot(capacity: 1);
        _world.Buy(_world.NewUser(), _apples, 1, slot: slot);

        var error = Assert.Throws<DomainException>(() => _world.Buy(_buyer, _apples, 1, slot: slot));

        Assert.Equal("slot_full", error.Code);
    }

    [Fact]
    public void RejectedOrder_FreesItsSlot()
    {
        var slot = _world.NewSlot(capacity: 1);
        var rejected = _world.Buy(_world.NewUser(), _apples, 1, slot: slot);
        _world.Fulfillment.Reject(_farm, rejected.Id, "Град пошкодив урожай");

        var order = _world.Buy(_buyer, _apples, 1, slot: slot);

        Assert.Equal(slot, order.Slot);
    }

    [Fact]
    public void PlaceOrder_IntoPastSlot_IsRejected()
    {
        var slot = _world.NewSlot(hoursFromNow: 1);
        _world.Clock.Advance(TimeSpan.FromHours(2));

        var error = Assert.Throws<DomainException>(() => _world.Buy(_buyer, _apples, 1, slot: slot));

        Assert.Equal("slot_in_past", error.Code);
    }

    [Fact]
    public void PlaceOrder_UnknownSlot_IsNotFound()
    {
        _world.Carts.Add(_buyer, _apples.Id, 1);

        var error = Assert.Throws<DomainException>(() =>
            _world.Orders.PlaceOrder(_buyer, new CheckoutRequest(TestWorld.Address, 404, PaymentMethod.Cash)));

        Assert.Equal("slot_not_found", error.Code);
    }

    [Fact]
    public void PlaceOrder_WithEmptyCart_IsRejected()
    {
        var error = Assert.Throws<DomainException>(() =>
            _world.Orders.PlaceOrder(_buyer, new CheckoutRequest(TestWorld.Address, _world.NewSlot().Id, PaymentMethod.Cash)));

        Assert.Equal("cart_empty", error.Code);
    }

    [Fact]
    public void PlaceOrder_WithoutAddress_IsRejected()
    {
        _world.Carts.Add(_buyer, _apples.Id, 1);

        var error = Assert.Throws<DomainException>(() =>
            _world.Orders.PlaceOrder(_buyer, new CheckoutRequest("  ", _world.NewSlot().Id, PaymentMethod.Cash)));

        Assert.Equal("address_required", error.Code);
    }

    [Fact]
    public void PlaceOrder_WithPromo_AppliesDiscountToChargedAmount()
    {
        _world.NewPromo("FARM10", percent: 10, minTotal: 300m);

        var order = _world.BuyMany(_buyer, [(_apples, 5), (_potatoes, 15)], promo: "farm10");

        Assert.Equal((430m, 43m, 387m), (order.Subtotal, order.Discount, order.Total));
        Assert.Equal(387m, order.PaidAmount);
        Assert.Equal("FARM10", order.PromoCode);
    }

    [Theory]
    [InlineData("NOPE", 0, "promo_unknown")]
    [InlineData("FARM10", 31, "promo_expired")]
    public void PlaceOrder_WithInvalidPromo_IsRejected(string code, int daysLater, string expected)
    {
        _world.NewPromo("FARM10", minTotal: 0m);
        _world.Clock.Advance(TimeSpan.FromDays(daysLater));

        var error = Assert.Throws<DomainException>(() => _world.Buy(_buyer, _apples, 1, promo: code));

        Assert.Equal(expected, error.Code);
    }

    [Fact]
    public void PlaceOrder_PromoBelowMinimumTotal_IsRejected()
    {
        _world.NewPromo("FARM10", minTotal: 300m);

        var error = Assert.Throws<DomainException>(() => _world.Buy(_buyer, _apples, 1, promo: "FARM10"));

        Assert.Equal("promo_min_total", error.Code);
        Assert.Contains("300,00 грн", error.Message);
    }

    [Fact]
    public void PlaceOrder_NotifiesBuyerAndFarmer()
    {
        var order = _world.Buy(_buyer, _apples, 2);

        Assert.Contains($"№{order.Id} оформлено", Assert.Single(_world.Notifier.For(_buyer.Id)).Text);
        Assert.Contains($"Нове замовлення №{order.Id}", Assert.Single(_world.Notifier.For(_farm.Id)).Text);
    }

    [Fact]
    public void AvailableSlots_ShowRemainingCapacityAndHidePastSlots()
    {
        var past = _world.NewSlot(hoursFromNow: 1);
        var tomorrow = _world.NewSlot(capacity: 3, hoursFromNow: 24);
        _world.Buy(_buyer, _apples, 1, slot: tomorrow);
        _world.Clock.Advance(TimeSpan.FromHours(2));

        var slot = Assert.Single(_world.Orders.AvailableSlots());

        Assert.NotEqual(past.Id, slot.Id);
        Assert.Equal((tomorrow.Id, 2), (slot.Id, slot.Remaining));
    }

    [Fact]
    public void MyOrder_OfAnotherBuyer_IsNotFound()
    {
        var order = _world.Buy(_buyer, _apples, 1);

        var error = Assert.Throws<DomainException>(() => _world.Orders.MyOrder(_world.NewUser(), order.Id));

        Assert.Equal("order_not_found", error.Code);
        Assert.Same(order, _world.Orders.MyOrder(_buyer, order.Id));
    }
}
