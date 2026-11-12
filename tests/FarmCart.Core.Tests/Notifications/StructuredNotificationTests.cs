namespace FarmCart.Core.Tests.Notifications;

/// <summary>BE-2, BE-4: сповіщення мають вид, номер замовлення й параметри - клієнт показує їх мовою інтерфейсу.</summary>
public sealed class StructuredNotificationTests
{
    private readonly TestWorld _world = new();
    private readonly User _farm;
    private readonly User _buyer;
    private readonly Product _apples;

    public StructuredNotificationTests()
    {
        (_farm, _) = _world.NewFarmer();
        _apples = _world.NewProduct(_farm, "Яблука", 32.5m, stock: 10);
        _buyer = _world.NewUser();
    }

    [Fact]
    public void PlacedOrder_NotifiesBuyerAndFarmerWithKindOrderAndTotal()
    {
        var order = _world.Buy(_buyer, _apples, 2);

        var toBuyer = Assert.Single(_world.Notifier.For(_buyer.Id));
        var toFarmer = Assert.Single(_world.Notifier.For(_farm.Id));

        Assert.Equal((NotificationKind.OrderPlaced, order.Id, "65.0"), (toBuyer.Kind, toBuyer.OrderId, toBuyer.Params["total"]));
        Assert.Equal((NotificationKind.OrderNew, order.Id, "65.0"), (toFarmer.Kind, toFarmer.OrderId, toFarmer.Params["total"]));
        Assert.Contains("оформлено", toBuyer.Text);
    }

    [Fact]
    public void StatusChange_NotifiesBuyerWithStatusCode()
    {
        var order = _world.Buy(_buyer, _apples, 1);

        _world.Fulfillment.Accept(_farm, order.Id);

        var last = _world.Notifier.For(_buyer.Id)[^1];
        Assert.Equal((NotificationKind.OrderStatus, order.Id, "Accepted"), (last.Kind, last.OrderId, last.Params["status"]));
    }

    [Fact]
    public void HandOver_NotifiesCourierAboutNewDelivery()
    {
        var courier = _world.NewUser(Role.Courier);
        var order = _world.Buy(_buyer, _apples, 1);

        _world.SendWithCourier(_farm, order, courier);

        var toCourier = Assert.Single(_world.Notifier.For(courier.Id));
        Assert.Equal((NotificationKind.DeliveryAssigned, order.Id), (toCourier.Kind, toCourier.OrderId));
        Assert.Contains(TestWorld.Address, toCourier.Text);
        Assert.Equal("InTransit", _world.Notifier.For(_buyer.Id)[^1].Params["status"]);
    }

    [Fact]
    public void Notifications_HaveIncreasingIdsAndNoParamsByDefault()
    {
        var first = _world.Notifier.Push(_buyer.Id, "custom", "Перше");
        var second = _world.Notifier.Push(_buyer.Id, "custom", "Друге");

        Assert.True(second.Id > first.Id);
        Assert.Empty(first.Params);
        Assert.Null(first.OrderId);
    }
}
