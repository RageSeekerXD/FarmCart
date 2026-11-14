namespace FarmCart.Core.Tests.Delivery;

/// <summary>Невдала доставка: кур'єр фіксує причину, покупець обирає новий час, замовлення знову «в дорозі».</summary>
public sealed class DeliveryFailureTests
{
    private readonly TestWorld _world = new();
    private readonly User _farm;
    private readonly User _buyer;
    private readonly User _courier;
    private readonly Order _order;

    public DeliveryFailureTests()
    {
        (_farm, _) = _world.NewFarmer();
        var apples = _world.NewProduct(_farm, stock: 50);
        _buyer = _world.NewUser();
        _courier = _world.NewUser(Role.Courier);
        _order = _world.SendWithCourier(_farm, _world.Buy(_buyer, apples, 2), _courier);
    }

    [Fact]
    public void ReportFailure_LeavesCourierListAndAsksBuyerForNewTime()
    {
        _world.Deliveries.ReportFailure(_courier, _order.Id, DeliveryProblem.BuyerAbsent, note: null);

        Assert.Equal((OrderStatus.DeliveryFailed, DeliveryProblem.BuyerAbsent), (_order.Status, _order.Problem));
        Assert.Empty(_world.Deliveries.MyDeliveries(_courier));
        Assert.Equal($"Замовлення №{_order.Id}: не вручено (покупця не було вдома). Оберіть новий час доставки.", _world.Notifier.For(_buyer.Id)[^1].Text);
    }

    [Fact]
    public void ReportFailure_OtherReasonNeedsNote()
    {
        var error = Assert.Throws<DomainException>(() => _world.Deliveries.ReportFailure(_courier, _order.Id, DeliveryProblem.Other, " "));
        var withNote = _world.Deliveries.ReportFailure(_courier, _order.Id, DeliveryProblem.Other, " Шлагбаум зачинено ");

        Assert.Equal("note_required", error.Code);
        Assert.Equal("Шлагбаум зачинено", withNote.ProblemNote);
    }

    [Fact]
    public void ReportFailure_ForSomeoneElsesDelivery_IsNotFound()
    {
        var stranger = _world.NewUser(Role.Courier);

        var error = Assert.Throws<DomainException>(() => _world.Deliveries.ReportFailure(stranger, _order.Id, DeliveryProblem.BuyerAbsent, null));

        Assert.Equal(("delivery_not_found", OrderStatus.InTransit), (error.Code, _order.Status));
    }

    [Fact]
    public void Reschedule_PutsOrderBackInTransitForSameCourier()
    {
        _world.Deliveries.ReportFailure(_courier, _order.Id, DeliveryProblem.AddressNotFound, null);
        var later = _world.NewSlot(hoursFromNow: 48);

        _world.Deliveries.Reschedule(_buyer, _order.Id, later.Id);

        Assert.Equal((OrderStatus.InTransit, later.Id), (_order.Status, _order.Slot.Id));
        Assert.Equal([_order.Id], _world.Deliveries.MyDeliveries(_courier).Select(task => task.OrderId));
        Assert.Equal(NotificationKind.DeliveryAssigned, _world.Notifier.For(_courier.Id)[^1].Kind);
        Assert.Equal(
            [OrderStatus.Placed, OrderStatus.Accepted, OrderStatus.Assembling, OrderStatus.InTransit, OrderStatus.DeliveryFailed, OrderStatus.InTransit],
            _order.History.Select(change => change.Status));
    }

    [Fact]
    public void Reschedule_RefusesFullOrPastSlotsAndOrdersNotFailed()
    {
        var notFailed = Assert.Throws<DomainException>(() => _world.Deliveries.Reschedule(_buyer, _order.Id, _world.NewSlot().Id));
        _world.Deliveries.ReportFailure(_courier, _order.Id, DeliveryProblem.BuyerAbsent, null);
        var full = _world.NewSlot(capacity: 1, hoursFromNow: 30);
        _world.Buy(_world.NewUser(), _world.NewProduct(_farm, "Груші", stock: 5), 1, slot: full);
        var past = _world.NewSlot(hoursFromNow: -2);

        var fullError = Assert.Throws<DomainException>(() => _world.Deliveries.Reschedule(_buyer, _order.Id, full.Id));
        var pastError = Assert.Throws<DomainException>(() => _world.Deliveries.Reschedule(_buyer, _order.Id, past.Id));

        Assert.Equal(("invalid_status", "slot_full", "slot_in_past"), (notFailed.Code, fullError.Code, pastError.Code));
        Assert.Equal(OrderStatus.DeliveryFailed, _order.Status);
    }
}
