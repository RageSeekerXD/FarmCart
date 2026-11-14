namespace FarmCart.Core.Tests.Ordering;

/// <summary>Кошик із товарами кількох ферм: по замовленню на ферму, одне списання коштів, окремі повернення.</summary>
public sealed class MultiFarmCheckoutTests
{
    private readonly TestWorld _world = new();
    private readonly User _green;
    private readonly User _cheese;
    private readonly Product _apples;
    private readonly Product _brynza;
    private readonly User _buyer;

    public MultiFarmCheckoutTests()
    {
        (_green, _) = _world.NewFarmer("Ферма «Зелений Гай»");
        (_cheese, _) = _world.NewFarmer("Сироварня");
        _apples = _world.NewProduct(_green, "Яблука", 32m, stock: 10);
        _brynza = _world.NewProduct(_cheese, "Бринза", 165m, stock: 5, category: "dairy");
        _buyer = _world.NewUser();
    }

    [Fact]
    public void Checkout_SplitsByFarmWithOneCharge()
    {
        _world.Carts.Add(_buyer, _apples.Id, 2);
        _world.Carts.Add(_buyer, _brynza.Id, 1);

        var orders = _world.Orders.Checkout(_buyer, Request(_world.NewSlot().Id));

        Assert.Equal([64m, 165m], orders.Select(order => order.Total));
        Assert.Equal([64m, 165m], orders.Select(order => order.PaidAmount));
        Assert.Equal(229m, Assert.Single(_world.Payments.Charges).Amount);
        Assert.All(orders, order => Assert.Equal(orders.Select(o => o.Id), order.CheckoutOrderIds));
        Assert.Equal((8, 4), (_apples.Stock, _brynza.Stock));
        Assert.Equal(2, _world.Notifier.For(_buyer.Id).Count(n => n.Kind == NotificationKind.OrderPlaced));
        Assert.Single(_world.Fulfillment.Incoming(_cheese));
        Assert.Empty(_world.Carts.Get(_buyer).Lines);
    }

    [Fact]
    public void Checkout_PromoIsCheckedAgainstWholeCart()
    {
        _world.NewPromo("FARM10", percent: 10, minTotal: 200m);
        _world.Carts.Add(_buyer, _apples.Id, 2);
        _world.Carts.Add(_buyer, _brynza.Id, 1);

        var orders = _world.Orders.Checkout(_buyer, Request(_world.NewSlot().Id, "FARM10"));

        Assert.Equal([57.60m, 148.50m], orders.Select(order => order.Total));
    }

    [Fact]
    public void Checkout_NeedsSlotRoomForEveryOrderAndChargesNothingOtherwise()
    {
        _world.Carts.Add(_buyer, _apples.Id, 1);
        _world.Carts.Add(_buyer, _brynza.Id, 1);

        var error = Assert.Throws<DomainException>(() => _world.Orders.Checkout(_buyer, Request(_world.NewSlot(capacity: 1).Id)));

        Assert.Equal("slot_full", error.Code);
        Assert.Empty(_world.Payments.Charges);
        Assert.Equal(2, _world.Carts.Get(_buyer).Lines.Count);
    }

    [Fact]
    public void Checkout_RepeatWithSameKeyReturnsSameOrders()
    {
        _world.Carts.Add(_buyer, _apples.Id, 1);
        _world.Carts.Add(_buyer, _brynza.Id, 1);
        var slot = _world.NewSlot().Id;

        var first = _world.Orders.Checkout(_buyer, Request(slot), "key-1");
        var repeat = _world.Orders.Checkout(_buyer, Request(slot), "key-1");

        Assert.Equal(first.Select(o => o.Id), repeat.Select(o => o.Id));
        Assert.Single(_world.Payments.Charges);
    }

    [Fact]
    public void RefundsOfSiblingOrders_ComeFromSharedChargeSeparately()
    {
        _world.Carts.Add(_buyer, _apples.Id, 2);
        _world.Carts.Add(_buyer, _brynza.Id, 1);
        var orders = _world.Orders.Checkout(_buyer, Request(_world.NewSlot().Id));

        _world.Fulfillment.Cancel(_buyer, orders[0].Id);
        var afterCancel = _world.Payments.Charges[0].Refunded;
        _world.Fulfillment.Reject(_cheese, orders[1].Id, "Бринза закінчилася");

        Assert.Equal((64m, 229m), (afterCancel, _world.Payments.Charges[0].Refunded));
        Assert.All(orders, order => Assert.Equal(PaymentStatus.Refunded, order.PaymentStatus));
    }

    private static CheckoutRequest Request(int slotId, string? promo = null) =>
        new(TestWorld.Address, slotId, PaymentMethod.Card, "tok_visa", promo);
}
