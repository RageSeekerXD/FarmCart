namespace FarmCart.Core.Tests.Ordering;

/// <summary>Скасування замовлення покупцем до прийняття фермером: повернення коштів, залишків і місця в слоті.</summary>
public sealed class OrderCancellationTests
{
    private readonly TestWorld _world = new();
    private readonly User _farm;
    private readonly User _buyer;
    private readonly Product _apples;
    private readonly Product _potatoes;

    public OrderCancellationTests()
    {
        (_farm, _) = _world.NewFarmer();
        _apples = _world.NewProduct(_farm, "Яблука", 32m, stock: 10);
        _potatoes = _world.NewProduct(_farm, "Картопля", 18m, stock: 20, category: "vegetables");
        _buyer = _world.NewUser();
    }

    [Fact]
    public void Cancel_PlacedCardOrder_RefundsEverythingReturnsStockAndFreesSlot()
    {
        var slot = _world.NewSlot(capacity: 1);
        var order = _world.BuyMany(_buyer, [(_apples, 3), (_potatoes, 5)], slot: slot);
        _world.Clock.Advance(TimeSpan.FromMinutes(3));

        _world.Fulfillment.Cancel(_buyer, order.Id);

        Assert.Equal((OrderStatus.Cancelled, PaymentStatus.Refunded, 186m), (order.Status, order.PaymentStatus, order.RefundedAmount));
        Assert.Equal([OrderStatus.Placed, OrderStatus.Cancelled], order.History.Select(h => h.Status));
        Assert.Equal(_world.Clock.Now, order.History[^1].At);
        Assert.Equal(186m, Assert.Single(_world.Payments.Charges).Refunded);
        Assert.Equal((10, 20), (_apples.Stock, _potatoes.Stock));
        Assert.Equal(1, _world.Orders.AvailableSlots().Single(s => s.Id == slot.Id).Remaining);
    }

    [Fact]
    public void Cancel_NotifiesBuyerWithRefundAndFarmerWithOwnKind()
    {
        var order = _world.Buy(_buyer, _apples, 2);

        _world.Fulfillment.Cancel(_buyer, order.Id);

        var toBuyer = _world.Notifier.For(_buyer.Id)[^1];
        var toFarmer = _world.Notifier.For(_farm.Id)[^1];
        Assert.Equal((NotificationKind.OrderStatus, "Cancelled"), (toBuyer.Kind, toBuyer.Params["status"]));
        Assert.Equal($"Замовлення №{order.Id}: скасовано. Кошти 64,00 грн повернено на картку.", toBuyer.Text);
        Assert.Equal((NotificationKind.OrderCancelled, order.Id), (toFarmer.Kind, toFarmer.OrderId));
        Assert.Equal($"Покупець скасував замовлення №{order.Id}", toFarmer.Text);
    }

    [Fact]
    public void Cancel_CashOrder_ReturnsStockWithoutRefund()
    {
        var order = _world.Buy(_buyer, _apples, 4, PaymentMethod.Cash);

        _world.Fulfillment.Cancel(_buyer, order.Id);

        Assert.Equal((OrderStatus.Cancelled, PaymentStatus.PayOnDelivery, 0m, 10), (order.Status, order.PaymentStatus, order.RefundedAmount, _apples.Stock));
        Assert.Equal($"Замовлення №{order.Id}: скасовано", _world.Notifier.For(_buyer.Id)[^1].Text);
    }

    [Fact]
    public void Cancel_AfterFarmerAccepted_IsRefusedAndChangesNothing()
    {
        var order = _world.Buy(_buyer, _apples, 2);
        _world.Fulfillment.Accept(_farm, order.Id);

        var error = Assert.Throws<DomainException>(() => _world.Fulfillment.Cancel(_buyer, order.Id));

        Assert.Equal("cancel_unavailable", error.Code);
        Assert.Equal((OrderStatus.Accepted, 0m, 8), (order.Status, order.RefundedAmount, _apples.Stock));
    }

    [Fact]
    public void Cancel_Twice_RefundsAndRestocksOnlyOnce()
    {
        var order = _world.Buy(_buyer, _apples, 3);
        _world.Fulfillment.Cancel(_buyer, order.Id);
        var sent = _world.Notifier.For(_buyer.Id).Count;

        var again = _world.Fulfillment.Cancel(_buyer, order.Id);

        Assert.Same(order, again);
        Assert.Equal((96m, 10, sent), (order.RefundedAmount, _apples.Stock, _world.Notifier.For(_buyer.Id).Count));
    }

    [Fact]
    public void Cancel_SomeoneElsesOrder_IsNotFound()
    {
        var order = _world.Buy(_buyer, _apples, 2);
        var stranger = _world.NewUser();

        var error = Assert.Throws<DomainException>(() => _world.Fulfillment.Cancel(stranger, order.Id));

        Assert.Equal(("order_not_found", OrderStatus.Placed), (error.Code, order.Status));
    }

    [Fact]
    public void Accept_CancelledOrder_IsRefused()
    {
        var order = _world.Buy(_buyer, _apples, 2);
        _world.Fulfillment.Cancel(_buyer, order.Id);

        var error = Assert.Throws<DomainException>(() => _world.Fulfillment.Accept(_farm, order.Id));

        Assert.Equal(("invalid_status", OrderStatus.Cancelled), (error.Code, order.Status));
    }

    // DEF-04 для скасування: збій провайдера під час повернення не повинен лишати замовлення напівскасованим.
    [Fact]
    public void Cancel_WhenRefundFails_ChangesNothingAndRetrySucceeds()
    {
        var order = _world.BuyMany(_buyer, [(_apples, 3), (_potatoes, 5)]);
        var unavailable = new FulfillmentService(_world.Store, new UnavailableRefunds(_world.Payments), _world.Workflow, _world.Notifier);

        Assert.Throws<InvalidOperationException>(() => unavailable.Cancel(_buyer, order.Id));
        var afterFailure = (order.Status, order.RefundedAmount, _apples.Stock, _potatoes.Stock);
        _world.Fulfillment.Cancel(_buyer, order.Id);

        Assert.Equal((OrderStatus.Placed, 0m, 7, 15), afterFailure);
        Assert.Equal((OrderStatus.Cancelled, 186m, 10, 20), (order.Status, order.RefundedAmount, _apples.Stock, _potatoes.Stock));
    }

    /// <summary>Провайдер списує кошти, але не відповідає на запит повернення (таймаут).</summary>
    private sealed class UnavailableRefunds(IPaymentGateway inner) : IPaymentGateway
    {
        public PaymentResult Charge(string token, decimal amount, string reference) => inner.Charge(token, amount, reference);

        public void Refund(string chargeId, decimal amount) => throw new InvalidOperationException("Платіжний провайдер не відповідає");
    }
}
