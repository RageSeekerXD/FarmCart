namespace FarmCart.Core.Tests.Delivery;

/// <summary>US-08, US-09 (B-FR-05, B-FR-11): передача кур'єру та вручення за кодом.</summary>
public sealed class DeliveryServiceTests
{
    private readonly TestWorld _world = new();
    private readonly User _farm;
    private readonly User _buyer;
    private readonly User _courier;
    private readonly Product _apples;

    public DeliveryServiceTests()
    {
        (_farm, _) = _world.NewFarmer();
        _apples = _world.NewProduct(_farm, "Яблука", 32m, stock: 50);
        _buyer = _world.NewUser();
        _courier = _world.NewUser(Role.Courier);
        _courier.Name = "Андрій";
    }

    [Fact]
    public void HandOver_AssignsCourierAndTellsBuyerWhoIsComing()
    {
        var order = _world.Buy(_buyer, _apples, 2);

        _world.SendWithCourier(_farm, order, _courier);

        Assert.Equal((OrderStatus.InTransit, _courier.Id), (order.Status, order.CourierId));
        Assert.Equal($"Замовлення №{order.Id}: в дорозі, кур'єр Андрій", _world.Notifier.For(_buyer.Id)[^1].Text);
    }

    [Fact]
    public void HandOver_BeforeAssembling_IsConflict()
    {
        var order = _world.Buy(_buyer, _apples, 1);
        _world.Fulfillment.Accept(_farm, order.Id);

        var error = Assert.Throws<DomainException>(() => _world.Fulfillment.HandOver(_farm, order.Id, _courier.Id));

        Assert.Equal("invalid_status", error.Code);
        Assert.Null(order.CourierId);
    }

    [Fact]
    public void HandOver_ToUserWhoIsNotCourier_IsRejected()
    {
        var order = _world.Buy(_buyer, _apples, 1);
        _world.Fulfillment.Accept(_farm, order.Id);
        _world.Fulfillment.StartAssembling(_farm, order.Id);

        var error = Assert.Throws<DomainException>(() => _world.Fulfillment.HandOver(_farm, order.Id, _buyer.Id));

        Assert.Equal("courier_invalid", error.Code);
    }

    [Fact]
    public void Couriers_AreListedForFarmersOnly()
    {
        Assert.Equal([_courier.Id], _world.Fulfillment.Couriers(_farm).Select(c => c.Id));
        Assert.Equal("not_a_farmer", Assert.Throws<DomainException>(() => _world.Fulfillment.Couriers(_buyer)).Code);
    }

    [Fact]
    public void MyDeliveries_ListsOnlyOwnOrdersInTransitSortedBySlotWithRoute()
    {
        var evening = _world.SendWithCourier(_farm, _world.Buy(_buyer, _apples, 1, slot: _world.NewSlot(hoursFromNow: 30)), _courier);
        var morning = _world.SendWithCourier(_farm, _world.Buy(_buyer, _apples, 3, slot: _world.NewSlot(hoursFromNow: 20)), _courier);
        _world.SendWithCourier(_farm, _world.Buy(_buyer, _apples, 1), _world.NewUser(Role.Courier));
        _world.Buy(_buyer, _apples, 1);

        var tasks = _world.Deliveries.MyDeliveries(_courier);

        Assert.Equal([morning.Id, evening.Id], tasks.Select(t => t.OrderId));
        Assert.Equal((3, 0m), (tasks[0].Items, tasks[0].AmountToCollect));
        Assert.StartsWith("https://www.google.com/maps/dir/?api=1&origin=49.816,24.13&destination=", tasks[0].RouteUrl);
    }

    [Fact]
    public void Confirm_WithoutCode_IsRejectedAndOrderStaysInTransit()
    {
        var order = _world.SendWithCourier(_farm, _world.Buy(_buyer, _apples, 1), _courier);

        var error = Assert.Throws<DomainException>(() => _world.Deliveries.Confirm(_courier, order.Id, "  "));

        Assert.Equal("confirmation_required", error.Code);
        Assert.Equal(OrderStatus.InTransit, order.Status);
    }

    [Fact]
    public void Confirm_WithWrongCode_IsRejected()
    {
        var order = _world.SendWithCourier(_farm, _world.Buy(_buyer, _apples, 1), _courier);
        var wrong = order.DeliveryCode == "0000" ? "1111" : "0000";

        var error = Assert.Throws<DomainException>(() => _world.Deliveries.Confirm(_courier, order.Id, wrong));

        Assert.Equal("delivery_code_invalid", error.Code);
        Assert.Equal(OrderStatus.InTransit, order.Status);
    }

    [Fact]
    public void Confirm_WithBuyersCode_DeliversOrder()
    {
        var order = _world.SendWithCourier(_farm, _world.Buy(_buyer, _apples, 1), _courier);

        _world.Deliveries.Confirm(_courier, order.Id, $" {order.DeliveryCode} ");

        Assert.Equal(OrderStatus.Delivered, order.Status);
        Assert.Empty(_world.Deliveries.MyDeliveries(_courier));
    }

    [Fact]
    public void Confirm_CashOrder_RecordsCashPaymentAtHandover()
    {
        var order = _world.SendWithCourier(_farm, _world.Buy(_buyer, _apples, 2, PaymentMethod.Cash), _courier);
        Assert.Equal(64m, Assert.Single(_world.Deliveries.MyDeliveries(_courier)).AmountToCollect);

        _world.Deliveries.Confirm(_courier, order.Id, order.DeliveryCode);

        Assert.Equal((PaymentStatus.PaidOnDelivery, 64m), (order.PaymentStatus, order.PaidAmount));
    }

    [Fact]
    public void Confirm_SomeoneElsesDelivery_IsNotFound()
    {
        var order = _world.SendWithCourier(_farm, _world.Buy(_buyer, _apples, 1), _courier);

        var error = Assert.Throws<DomainException>(() => _world.Deliveries.Confirm(_world.NewUser(Role.Courier), order.Id, order.DeliveryCode));

        Assert.Equal("delivery_not_found", error.Code);
    }

    [Fact]
    public void Confirm_Twice_IsConflict()
    {
        var order = _world.SendWithCourier(_farm, _world.Buy(_buyer, _apples, 1), _courier);
        _world.Deliveries.Confirm(_courier, order.Id, order.DeliveryCode);

        var error = Assert.Throws<DomainException>(() => _world.Deliveries.Confirm(_courier, order.Id, order.DeliveryCode));

        Assert.Equal("invalid_status", error.Code);
    }

    [Fact]
    public void Deliveries_AreAvailableToCouriersOnly() =>
        Assert.Equal(ErrorKind.Forbidden, Assert.Throws<DomainException>(() => _world.Deliveries.MyDeliveries(_buyer)).Kind);
}
