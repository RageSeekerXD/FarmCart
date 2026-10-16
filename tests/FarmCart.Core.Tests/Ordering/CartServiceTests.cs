namespace FarmCart.Core.Tests.Ordering;

/// <summary>US-05 (B-FR-03): кошик покупця.</summary>
public sealed class CartServiceTests
{
    private readonly TestWorld _world = new();

    [Fact]
    public void Add_SameProductTwice_SumsQuantityAndTotal()
    {
        var (farm, _) = _world.NewFarmer();
        var apples = _world.NewProduct(farm, "Яблука", 32m, stock: 10);
        var buyer = _world.NewUser();

        _world.Carts.Add(buyer, apples.Id, 2);
        var cart = _world.Carts.Add(buyer, apples.Id, 1);

        var line = Assert.Single(cart.Lines);
        Assert.Equal((3, 96m), (line.Quantity, line.Total));
        Assert.Equal(96m, cart.Total);
    }

    [Fact]
    public void Add_MoreThanInStock_IsConflict()
    {
        var (farm, _) = _world.NewFarmer();
        var honey = _world.NewProduct(farm, "Мед", 290m, stock: 2);
        var buyer = _world.NewUser();

        var error = Assert.Throws<DomainException>(() => _world.Carts.Add(buyer, honey.Id, 3));

        Assert.Equal("out_of_stock", error.Code);
        Assert.Empty(_world.Carts.Get(buyer).Lines);
    }

    [Fact]
    public void Add_ProductOfAnotherFarmer_IsConflict()
    {
        var (first, _) = _world.NewFarmer("Перша");
        var (second, _) = _world.NewFarmer("Друга");
        var buyer = _world.NewUser();
        _world.Carts.Add(buyer, _world.NewProduct(first, "Сир").Id, 1);

        var error = Assert.Throws<DomainException>(() => _world.Carts.Add(buyer, _world.NewProduct(second, "Молоко").Id, 1));

        Assert.Equal("cart_other_farmer", error.Code);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-2)]
    public void Add_NonPositiveQuantity_IsRejected(int quantity)
    {
        var (farm, _) = _world.NewFarmer();

        var error = Assert.Throws<DomainException>(() => _world.Carts.Add(_world.NewUser(), _world.NewProduct(farm).Id, quantity));

        Assert.Equal("quantity_invalid", error.Code);
    }

    [Fact]
    public void Add_UnknownProduct_IsNotFound()
    {
        var error = Assert.Throws<DomainException>(() => _world.Carts.Add(_world.NewUser(), 404, 1));

        Assert.Equal(ErrorKind.NotFound, error.Kind);
    }

    [Fact]
    public void Remove_LastLine_EmptiesCartAndAllowsAnotherFarmer()
    {
        var (first, _) = _world.NewFarmer("Перша");
        var (second, _) = _world.NewFarmer("Друга");
        var buyer = _world.NewUser();
        var cheese = _world.NewProduct(first, "Сир");
        _world.Carts.Add(buyer, cheese.Id, 1);

        var empty = _world.Carts.Remove(buyer, cheese.Id);
        var cart = _world.Carts.Add(buyer, _world.NewProduct(second, "Молоко").Id, 1);

        Assert.Null(empty.FarmerId);
        Assert.Equal("Молоко", Assert.Single(cart.Lines).Name);
    }

    [Fact]
    public void Get_ShowsCurrentPrices()
    {
        var (farm, _) = _world.NewFarmer();
        var apples = _world.NewProduct(farm, "Яблука", 30m);
        var buyer = _world.NewUser();
        _world.Carts.Add(buyer, apples.Id, 2);

        _world.Farmers.UpdateProduct(farm, apples.Id, new ProductChanges(Price: 28m));

        Assert.Equal(56m, _world.Carts.Get(buyer).Total);
    }
}
