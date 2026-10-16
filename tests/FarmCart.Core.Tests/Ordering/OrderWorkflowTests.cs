namespace FarmCart.Core.Tests.Ordering;

/// <summary>B-FR-05: життєвий цикл замовлення.</summary>
public sealed class OrderWorkflowTests
{
    private readonly TestWorld _world = new();

    [Theory]
    [InlineData(OrderStatus.Placed, OrderStatus.Accepted, true)]
    [InlineData(OrderStatus.Placed, OrderStatus.Rejected, true)]
    [InlineData(OrderStatus.Accepted, OrderStatus.Assembling, true)]
    [InlineData(OrderStatus.Assembling, OrderStatus.InTransit, true)]
    [InlineData(OrderStatus.InTransit, OrderStatus.Delivered, true)]
    [InlineData(OrderStatus.Placed, OrderStatus.Delivered, false)]
    [InlineData(OrderStatus.Accepted, OrderStatus.Rejected, false)]
    [InlineData(OrderStatus.Accepted, OrderStatus.Placed, false)]
    [InlineData(OrderStatus.Assembling, OrderStatus.Rejected, false)]
    [InlineData(OrderStatus.Delivered, OrderStatus.InTransit, false)]
    [InlineData(OrderStatus.Rejected, OrderStatus.Accepted, false)]
    public void CanMove_FollowsTransitionTable(OrderStatus from, OrderStatus to, bool expected) =>
        Assert.Equal(expected, OrderWorkflow.CanMove(from, to));

    [Fact]
    public void Move_RecordsHistoryAndNotifiesBuyer()
    {
        var order = NewOrder();
        _world.Clock.Advance(TimeSpan.FromMinutes(3));

        _world.Workflow.Move(order, OrderStatus.Accepted, ". Дякуємо!");

        Assert.Equal(OrderStatus.Accepted, order.Status);
        Assert.Equal(new StatusChange(OrderStatus.Accepted, _world.Clock.Now), order.History[^1]);
        Assert.Equal($"Замовлення №{order.Id}: прийнято. Дякуємо!", _world.Notifier.For(order.BuyerId)[^1].Text);
    }

    [Fact]
    public void Move_NotAllowed_IsConflictAndChangesNothing()
    {
        var order = NewOrder();
        _world.Workflow.Move(order, OrderStatus.Rejected);

        var error = Assert.Throws<DomainException>(() => _world.Workflow.Move(order, OrderStatus.Accepted));

        Assert.Equal("invalid_status", error.Code);
        Assert.Contains("«відхилено»: перехід у «прийнято» неможливий", error.Message);
        Assert.Equal(OrderStatus.Rejected, order.Status);
    }

    [Fact]
    public void FullLifecycle_NotifiesBuyerAboutEveryStatusAtTheMomentOfChange()
    {
        var (farm, _) = _world.NewFarmer();
        var buyer = _world.NewUser();
        var order = _world.Buy(buyer, _world.NewProduct(farm), 1);

        _world.Deliver(farm, order);

        Assert.Equal(
            [OrderStatus.Placed, OrderStatus.Accepted, OrderStatus.Assembling, OrderStatus.InTransit, OrderStatus.Delivered],
            order.History.Select(h => h.Status));
        var texts = _world.Notifier.For(buyer.Id).Select(n => n.Text).ToList();
        Assert.All(["оформлено", "прийнято", "збирається", "в дорозі", "доставлено"], title => Assert.Contains(texts, t => t.Contains(title)));
        Assert.All(_world.Notifier.For(buyer.Id), n => Assert.Equal(_world.Clock.Now, n.At));
    }

    private Order NewOrder()
    {
        var (farm, _) = _world.NewFarmer();
        return _world.Buy(_world.NewUser(), _world.NewProduct(farm), 1);
    }
}
