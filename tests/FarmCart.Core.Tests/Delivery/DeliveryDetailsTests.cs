namespace FarmCart.Core.Tests.Delivery;

/// <summary>
/// Доставка без зайвих дзвінків: під'їзд, поверх і домофон, коментар і точка на мапі з оформлення;
/// кур'єр бачить контакти ферми й покупця та перелік товарів, щоб звірити замовлення під час отримання.
/// </summary>
public sealed class DeliveryDetailsTests
{
    private readonly TestWorld _world = new();

    [Fact]
    public void Checkout_StoresAddressDetailsCommentAndDropOffPoint()
    {
        var (_, order) = PlaceBreadOrder(new AddressDetails(" 2 ", "5", "25К"), 49.84, 24.02);

        Assert.Equal(new AddressDetails("2", "5", "25К"), order.Details);
        Assert.Equal(new GeoPoint(49.84, 24.02), order.DropOff);
        Assert.Equal("Наріжте хліб", order.Comment);
    }

    [Fact]
    public void Checkout_WithEmptyAddressDetails_StoresNone()
    {
        var (_, order) = PlaceBreadOrder(new AddressDetails(" ", null, ""), null, null);

        Assert.Null(order.Details);
        Assert.Null(order.DropOff);
    }

    [Fact]
    public void Checkout_WithTooLongAddressDetail_IsRejected()
    {
        var error = Assert.Throws<DomainException>(() => PlaceBreadOrder(new AddressDetails("1", "2", new string('9', 41)), null, null));

        Assert.Equal("address_details_too_long", error.Code);
    }

    [Theory]
    [InlineData(49.84, null)]
    [InlineData(120.0, 24.0)]
    public void Checkout_WithInvalidDropOffPoint_IsRejected(double? lat, double? lon)
    {
        var error = Assert.Throws<DomainException>(() => PlaceBreadOrder(null, lat, lon));

        Assert.Equal("location_invalid", error.Code);
    }

    [Fact]
    public void DeliveryTask_HasContactsLinesAccessDetailsAndCoordinates()
    {
        var (farm, order) = PlaceBreadOrder(new AddressDetails("1", "3", "15"), 49.84, 24.02);
        var courier = _world.NewUser(Role.Courier);
        _world.SendWithCourier(farm, order, courier);

        var task = Assert.Single(_world.Deliveries.MyDeliveries(courier));

        Assert.Equal(("Ірина Дмитрів", farm.Phone), (task.FarmerContact, task.FarmerPhone));
        Assert.Equal("Оксана Демченко", task.BuyerName);
        Assert.Equal(_world.Store.Users[order.BuyerId].Phone, task.BuyerPhone);
        Assert.Equal(new AddressDetails("1", "3", "15"), task.AddressDetails);
        Assert.Equal("Наріжте хліб", task.Comment);
        Assert.Equal((TestWorld.Vynnyky.Lat, TestWorld.Vynnyky.Lon), (task.PickupLat, task.PickupLon));
        Assert.Equal((49.84, 24.02), (task.DropOffLat!.Value, task.DropOffLon!.Value));
        var line = Assert.Single(task.Lines);
        Assert.Equal(("Хліб", 2), (line.Name.Uk, line.Quantity));
    }

    private (User Farm, Order Order) PlaceBreadOrder(AddressDetails? details, double? lat, double? lon)
    {
        var (farm, _) = _world.NewFarmer("Пекарня", TestWorld.Vynnyky);
        farm.Name = "Ірина Дмитрів";
        var bread = _world.NewProduct(farm, "Хліб", stock: 5, category: "bakery");
        var buyer = _world.NewUser();
        buyer.Name = "Оксана Демченко";
        _world.Carts.Add(buyer, bread.Id, 2);
        var request = new CheckoutRequest(TestWorld.Address, _world.NewSlot().Id, PaymentMethod.Cash, Comment: "Наріжте хліб", Details: details, Lat: lat, Lon: lon);
        return (farm, _world.Orders.PlaceOrder(buyer, request));
    }
}
