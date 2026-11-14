namespace FarmCart.Core.Tests.Reviews;

/// <summary>Відгуки для покупців (підпис автора), модерація адміністратором і деталі товару в каталозі.</summary>
public sealed class ModerationAndDetailsTests
{
    private readonly TestWorld _world = new();
    private readonly User _farm;
    private readonly Farmer _farmer;
    private readonly Product _apples;

    public ModerationAndDetailsTests()
    {
        (_farm, _farmer) = _world.NewFarmer();
        _apples = _world.NewProduct(_farm, "Яблука", 32m, stock: 50);
    }

    [Theory]
    [InlineData("Оксана Демченко", "Оксана Д.")]
    [InlineData("  Ігор   Петренко-Коваль ", "Ігор П.")]
    [InlineData("Світлана", "Світлана")]
    [InlineData("", "")]
    [InlineData(null, "")]
    public void ShortName_ShowsFirstNameAndInitialOnly(string? name, string expected) =>
        Assert.Equal(expected, ReviewService.ShortName(name));

    [Fact]
    public void Add_RemembersShortAuthorName()
    {
        var buyer = _world.NewUser();
        buyer.Name = "Оксана Демченко";
        var order = _world.Deliver(_farm, _world.Buy(buyer, _apples, 1));

        var review = _world.Reviews.Add(buyer, order.Id, 5, "Смачно");

        Assert.Equal("Оксана Д.", review.Author);
    }

    [Fact]
    public void ForModeration_ShowsHiddenReviewsWithReasonAndFarmName()
    {
        var admin = _world.NewUser(Role.Admin);
        var (kept, hidden) = (Reviewed(5), Reviewed(1));
        _world.Reviews.Hide(admin, hidden.Id, "Реклама конкурента");

        var queue = _world.Reviews.ForModeration(admin);

        Assert.Equal([hidden.Id, kept.Id], queue.Select(item => item.Review.Id));
        Assert.Equal(("Реклама конкурента", true), (queue[0].Review.HiddenReason, queue[0].Review.Hidden));
        Assert.Equal(_farmer.Name, queue[0].FarmName);
    }

    [Fact]
    public void ForModeration_IsForAdminsOnly()
    {
        var error = Assert.Throws<DomainException>(() => _world.Reviews.ForModeration(_world.NewUser()));

        Assert.Equal("role_required", error.Code);
    }

    [Fact]
    public void Restore_MakesReviewVisibleAgainAndCountsItInRating()
    {
        var admin = _world.NewUser(Role.Admin);
        Reviewed(5);
        var hidden = Reviewed(1);
        _world.Reviews.Hide(admin, hidden.Id, "Помилка модератора");

        _world.Reviews.Restore(admin, hidden.Id);

        Assert.Equal((false, (string?)null), (hidden.Hidden, hidden.HiddenReason));
        Assert.Equal((3.0, 2), (_farmer.Rating, _farmer.ReviewCount));
        Assert.Equal(2, _world.Reviews.ForFarmer(_farmer.Id).Count);
        Assert.Equal("review.restore", _world.Audit.Entries(admin)[^1].Action);
    }

    [Fact]
    public void Catalog_ShowsDescriptionSeasonAndFarmReviewCount()
    {
        var strawberries = _world.Farmers.AddProduct(_farm, new ProductDraft(
            TestWorld.Text("Полуниця"), "berries", "kg", 95m, 20, [10, 5, 6], Description: new LocalizedText(" Солодка ", " Sweet ")));
        Reviewed(4);

        var item = _world.Catalog.Search(new CatalogQuery(Text: "Полуниця")).Single();

        Assert.Equal(strawberries.Id, item.ProductId);
        Assert.Equal((new LocalizedText("Солодка", "Sweet"), 1), (item.Description, item.FarmerReviewCount));
        Assert.Equal([5, 6, 10], item.SeasonMonths);
    }

    [Fact]
    public void Description_InOneLanguageOnly_IsRejected()
    {
        var error = Assert.Throws<DomainException>(() => _world.Farmers.AddProduct(_farm, new ProductDraft(
            TestWorld.Text("Груші"), "fruits", "kg", 40m, 10, Description: new LocalizedText("Соковиті", " "))));

        Assert.Equal("description_incomplete", error.Code);
    }

    [Fact]
    public void Description_TooLong_IsRejected()
    {
        var text = new string('а', FarmerService.DescriptionMaxLength + 1);

        var error = Assert.Throws<DomainException>(() => _world.Farmers.UpdateProduct(_farm, _apples.Id, new ProductChanges(Description: new LocalizedText(text, "long"))));

        Assert.Equal("description_too_long", error.Code);
    }

    [Fact]
    public void Description_BlankInBothLanguages_RemovesIt()
    {
        _world.Farmers.UpdateProduct(_farm, _apples.Id, new ProductChanges(Description: new LocalizedText("Хрусткі", "Crunchy")));

        _world.Farmers.UpdateProduct(_farm, _apples.Id, new ProductChanges(Description: new LocalizedText(" ", "")));

        Assert.Null(_apples.Description);
    }

    private Review Reviewed(int rating)
    {
        var buyer = _world.NewUser();
        var order = _world.Deliver(_farm, _world.Buy(buyer, _apples, 1));
        return _world.Reviews.Add(buyer, order.Id, rating, comment: null);
    }
}
