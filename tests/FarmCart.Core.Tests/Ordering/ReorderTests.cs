namespace FarmCart.Core.Tests.Ordering;

/// <summary>«Замовити знову»: кошик наповнюється позиціями минулого замовлення в межах наявного залишку.</summary>
public sealed class ReorderTests
{
    private readonly TestWorld _world = new();
    private readonly User _farm;
    private readonly User _buyer;
    private readonly Product _apples;
    private readonly Product _potatoes;

    public ReorderTests()
    {
        (_farm, _) = _world.NewFarmer();
        _apples = _world.NewProduct(_farm, "Яблука", 32m, stock: 10);
        _potatoes = _world.NewProduct(_farm, "Картопля", 18m, stock: 20, category: "vegetables");
        _buyer = _world.NewUser();
    }

    [Fact]
    public void Reorder_PutsSameQuantitiesIntoCart()
    {
        var past = _world.BuyMany(_buyer, [(_apples, 2), (_potatoes, 5)]);

        var result = _world.Carts.Reorder(_buyer, past.Id);

        Assert.Empty(result.Shortfalls);
        Assert.Equal([(_apples.Id, 2), (_potatoes.Id, 5)], result.Cart.Lines.Select(line => (line.ProductId, line.Quantity)));
    }

    [Fact]
    public void Reorder_LimitsToStockAndReportsShortfalls()
    {
        var past = _world.BuyMany(_buyer, [(_apples, 6), (_potatoes, 5)]);
        _apples.Stock = 4;
        _potatoes.Stock = 0;

        var result = _world.Carts.Reorder(_buyer, past.Id);

        Assert.Equal([(_apples.Id, 4)], result.Cart.Lines.Select(line => (line.ProductId, line.Quantity)));
        Assert.Equal([("Яблука", 6, 4), ("Картопля", 5, 0)], result.Shortfalls.Select(s => (s.Name.Uk, s.Requested, s.Added)));
    }

    [Fact]
    public void Reorder_CountsWhatIsAlreadyInCart()
    {
        var past = _world.Buy(_buyer, _apples, 6);
        _world.Carts.Add(_buyer, _apples.Id, 3);

        var result = _world.Carts.Reorder(_buyer, past.Id);

        Assert.Equal(4, result.Cart.Lines.Single().Quantity);
        Assert.Equal((6, 1), (result.Shortfalls.Single().Requested, result.Shortfalls.Single().Added));
    }

    [Fact]
    public void Reorder_SomeoneElsesOrder_IsNotFound()
    {
        var past = _world.Buy(_buyer, _apples, 1);

        var error = Assert.Throws<DomainException>(() => _world.Carts.Reorder(_world.NewUser(), past.Id));

        Assert.Equal("order_not_found", error.Code);
    }
}
