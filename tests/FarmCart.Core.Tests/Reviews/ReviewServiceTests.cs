namespace FarmCart.Core.Tests.Reviews;

/// <summary>US-10 (B-FR-06, B-FR-12): відгуки, рейтинг фермера й модерація.</summary>
public sealed class ReviewServiceTests
{
    private readonly TestWorld _world = new();
    private readonly User _farm;
    private readonly Farmer _farmer;
    private readonly Product _apples;

    public ReviewServiceTests()
    {
        (_farm, _farmer) = _world.NewFarmer();
        _apples = _world.NewProduct(_farm, "Яблука", 32m, stock: 50);
    }

    [Fact]
    public void Add_BeforeDelivery_IsRejected()
    {
        var buyer = _world.NewUser();
        var order = _world.Buy(buyer, _apples, 1);

        var error = Assert.Throws<DomainException>(() => _world.Reviews.Add(buyer, order.Id, 5, "Смачно"));

        Assert.Equal("not_delivered", error.Code);
        Assert.Null(_farmer.Rating);
    }

    [Fact]
    public void Add_AfterDelivery_UpdatesFarmerRatingImmediately()
    {
        var first = _world.NewUser();
        var second = _world.NewUser();
        var firstOrder = _world.Deliver(_farm, _world.Buy(first, _apples, 1));
        var secondOrder = _world.Deliver(_farm, _world.Buy(second, _apples, 1));

        _world.Reviews.Add(first, firstOrder.Id, 5, " Дуже смачні яблука ");
        _world.Reviews.Add(second, secondOrder.Id, 4, null);

        Assert.Equal((4.5, 2), (_farmer.Rating, _farmer.ReviewCount));
        Assert.Equal("Дуже смачні яблука", _world.Reviews.ForFarmer(_farmer.Id)[^1].Comment);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(6)]
    public void Add_RatingOutsideOneToFive_IsRejected(int rating)
    {
        var buyer = _world.NewUser();
        var order = _world.Deliver(_farm, _world.Buy(buyer, _apples, 1));

        Assert.Equal("rating_invalid", Assert.Throws<DomainException>(() => _world.Reviews.Add(buyer, order.Id, rating, null)).Code);
    }

    [Fact]
    public void Add_SecondReviewForSameOrder_IsConflict()
    {
        var buyer = _world.NewUser();
        var order = _world.Deliver(_farm, _world.Buy(buyer, _apples, 1));
        _world.Reviews.Add(buyer, order.Id, 5, null);

        Assert.Equal("already_reviewed", Assert.Throws<DomainException>(() => _world.Reviews.Add(buyer, order.Id, 1, null)).Code);
    }

    [Fact]
    public void Add_ForSomeoneElsesOrder_IsNotFound()
    {
        var order = _world.Deliver(_farm, _world.Buy(_world.NewUser(), _apples, 1));

        Assert.Equal("order_not_found", Assert.Throws<DomainException>(() => _world.Reviews.Add(_world.NewUser(), order.Id, 1, null)).Code);
    }

    [Fact]
    public void Hide_RecalculatesRatingAndWritesAudit()
    {
        var admin = _world.NewUser(Role.Admin);
        var fan = _world.NewUser();
        var troll = _world.NewUser();
        _world.Reviews.Add(fan, _world.Deliver(_farm, _world.Buy(fan, _apples, 1)).Id, 5, null);
        var spam = _world.Reviews.Add(troll, _world.Deliver(_farm, _world.Buy(troll, _apples, 1)).Id, 1, "Реклама іншого магазину");

        _world.Reviews.Hide(admin, spam.Id, "Реклама");

        Assert.Equal((5.0, 1), (_farmer.Rating, _farmer.ReviewCount));
        Assert.DoesNotContain(_world.Reviews.ForFarmer(_farmer.Id), r => r.Id == spam.Id);
        var entry = Assert.Single(_world.Audit.Entries(admin));
        Assert.Equal(("review.hide", $"review#{spam.Id}", "Реклама"), (entry.Action, entry.Target, entry.Details));
    }

    [Fact]
    public void Hide_LastReview_ClearsRating()
    {
        var buyer = _world.NewUser();
        var review = _world.Reviews.Add(buyer, _world.Deliver(_farm, _world.Buy(buyer, _apples, 1)).Id, 2, null);

        _world.Reviews.Hide(_world.NewUser(Role.Admin), review.Id, "Образливий текст");

        Assert.Equal((null, 0), (_farmer.Rating, _farmer.ReviewCount));
    }

    [Fact]
    public void Hide_ByNonAdminOrWithoutReason_IsRejected()
    {
        var buyer = _world.NewUser();
        var review = _world.Reviews.Add(buyer, _world.Deliver(_farm, _world.Buy(buyer, _apples, 1)).Id, 2, null);

        Assert.Equal(ErrorKind.Forbidden, Assert.Throws<DomainException>(() => _world.Reviews.Hide(buyer, review.Id, "Не подобається")).Kind);
        Assert.Equal("reason_required", Assert.Throws<DomainException>(() => _world.Reviews.Hide(_world.NewUser(Role.Admin), review.Id, " ")).Code);
        Assert.Equal("review_not_found", Assert.Throws<DomainException>(() => _world.Reviews.Hide(_world.NewUser(Role.Admin), 404, "Спам")).Code);
    }
}
