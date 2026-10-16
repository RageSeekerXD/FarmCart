namespace FarmCart.Core.Tests.Ordering;

/// <summary>US-07 (B-FR-09): обробка замовлення фермером і автоматичне повернення коштів.</summary>
public sealed class FulfillmentServiceTests
{
    private readonly TestWorld _world = new();
    private readonly User _farm;
    private readonly User _buyer;
    private readonly Product _apples;
    private readonly Product _potatoes;

    public FulfillmentServiceTests()
    {
        (_farm, _) = _world.NewFarmer();
        _apples = _world.NewProduct(_farm, "Яблука", 32m, stock: 10);
        _potatoes = _world.NewProduct(_farm, "Картопля", 18m, stock: 20, category: "Овочі");
        _buyer = _world.NewUser();
    }

    [Fact]
    public void Accept_PlacedOrder_RecordsHistoryAndNotifiesBuyer()
    {
        var order = _world.Buy(_buyer, _apples, 2);
        _world.Clock.Advance(TimeSpan.FromMinutes(7));

        _world.Fulfillment.Accept(_farm, order.Id);

        Assert.Equal(OrderStatus.Accepted, order.Status);
        Assert.Equal([OrderStatus.Placed, OrderStatus.Accepted], order.History.Select(h => h.Status));
        Assert.Equal(_world.Clock.Now, order.History[^1].At);
        Assert.Equal($"Замовлення №{order.Id}: прийнято", _world.Notifier.For(_buyer.Id)[^1].Text);
    }

    [Fact]
    public void Accept_WithShortage_ReducesLinesAndRefundsDifference()
    {
        var order = _world.BuyMany(_buyer, [(_apples, 3), (_potatoes, 5)]);

        _world.Fulfillment.Accept(_farm, order.Id, [new Shortage(_potatoes.Id, 1)]);

        Assert.Equal((168m, 18m), (order.Total, order.RefundedAmount));
        Assert.Equal(4, order.Lines.Single(l => l.ProductId == _potatoes.Id).Quantity);
        Assert.Equal(18m, Assert.Single(_world.Payments.Charges).Refunded);
        Assert.Equal(PaymentStatus.Paid, order.PaymentStatus);
        Assert.EndsWith("повернено 18,00 грн", _world.Notifier.For(_buyer.Id)[^1].Text);
    }

    [Fact]
    public void Accept_WithShortageOfWholeLine_RemovesLineAndRefundsWithDiscount()
    {
        _world.NewPromo("FARM10", percent: 10, minTotal: 300m);
        var order = _world.BuyMany(_buyer, [(_apples, 10), (_potatoes, 5)], promo: "FARM10");

        _world.Fulfillment.Accept(_farm, order.Id, [new Shortage(_potatoes.Id, 5)]);

        Assert.Equal(_apples.Id, Assert.Single(order.Lines).ProductId);
        Assert.Equal((369m, 288m, 81m), (order.PaidAmount, order.Total, order.RefundedAmount));
    }

    [Fact]
    public void Accept_WithShortageOnCashOrder_LowersAmountDueWithoutRefund()
    {
        var order = _world.BuyMany(_buyer, [(_apples, 3), (_potatoes, 5)], PaymentMethod.Cash);

        _world.Fulfillment.Accept(_farm, order.Id, [new Shortage(_apples.Id, 2)]);

        Assert.Equal((0m, 122m), (order.RefundedAmount, order.Total));
        Assert.EndsWith("до сплати 122,00 грн", _world.Notifier.For(_buyer.Id)[^1].Text);
    }

    [Fact]
    public void Accept_WhenEverythingIsMissing_AsksToRejectAndKeepsOrderIntact()
    {
        var order = _world.Buy(_buyer, _apples, 2);

        var error = Assert.Throws<DomainException>(() => _world.Fulfillment.Accept(_farm, order.Id, [new Shortage(_apples.Id, 2)]));

        Assert.Equal("nothing_to_deliver", error.Code);
        Assert.Equal((OrderStatus.Placed, 2), (order.Status, order.Lines[0].Quantity));
    }

    [Theory]
    [InlineData(999, 1)]
    [InlineData(0, 4)]
    [InlineData(0, 0)]
    public void Accept_WithInvalidShortage_IsRejected(int productOffset, int quantity)
    {
        var order = _world.Buy(_buyer, _apples, 3);

        var error = Assert.Throws<DomainException>(() =>
            _world.Fulfillment.Accept(_farm, order.Id, [new Shortage(_apples.Id + productOffset, quantity)]));

        Assert.Equal("shortage_invalid", error.Code);
    }

    [Fact]
    public void Accept_Twice_IsConflict()
    {
        var order = _world.Buy(_buyer, _apples, 1);
        _world.Fulfillment.Accept(_farm, order.Id);

        var error = Assert.Throws<DomainException>(() => _world.Fulfillment.Accept(_farm, order.Id));

        Assert.Equal("invalid_status", error.Code);
    }

    [Fact]
    public void Reject_PaidOrder_RefundsEverythingAndRestoresStock()
    {
        var order = _world.BuyMany(_buyer, [(_apples, 3), (_potatoes, 5)]);

        _world.Fulfillment.Reject(_farm, order.Id, "  Град пошкодив урожай ");

        Assert.Equal((OrderStatus.Rejected, PaymentStatus.Refunded), (order.Status, order.PaymentStatus));
        Assert.Equal((186m, "Град пошкодив урожай"), (order.RefundedAmount, order.RejectionReason));
        Assert.Equal((10, 20), (_apples.Stock, _potatoes.Stock));
        Assert.Contains("Кошти 186,00 грн повернено на картку", _world.Notifier.For(_buyer.Id)[^1].Text);
    }

    [Fact]
    public void Reject_CashOrder_RestoresStockWithoutRefund()
    {
        var order = _world.Buy(_buyer, _apples, 4, PaymentMethod.Cash);

        _world.Fulfillment.Reject(_farm, order.Id, "Немає транспорту");

        Assert.Equal((PaymentStatus.PayOnDelivery, 0m, 10), (order.PaymentStatus, order.RefundedAmount, _apples.Stock));
        Assert.DoesNotContain("повернено", _world.Notifier.For(_buyer.Id)[^1].Text);
    }

    [Fact]
    public void Reject_WithoutReason_IsRejected()
    {
        var order = _world.Buy(_buyer, _apples, 1);

        var error = Assert.Throws<DomainException>(() => _world.Fulfillment.Reject(_farm, order.Id, " "));

        Assert.Equal("reason_required", error.Code);
    }

    [Fact]
    public void Reject_AcceptedOrder_IsConflict()
    {
        var order = _world.Buy(_buyer, _apples, 1);
        _world.Fulfillment.Accept(_farm, order.Id);

        var error = Assert.Throws<DomainException>(() => _world.Fulfillment.Reject(_farm, order.Id, "Передумав"));

        Assert.Equal("invalid_status", error.Code);
    }

    [Fact]
    public void FarmerCannotProcessOrSeeOrdersOfAnotherFarm()
    {
        var order = _world.Buy(_buyer, _apples, 1);
        var (stranger, _) = _world.NewFarmer("Чужа ферма");

        var error = Assert.Throws<DomainException>(() => _world.Fulfillment.Accept(stranger, order.Id));

        Assert.Equal("order_not_found", error.Code);
        Assert.Empty(_world.Fulfillment.Incoming(stranger));
        Assert.Equal([order.Id], _world.Fulfillment.Incoming(_farm).Select(o => o.Id));
    }
}
