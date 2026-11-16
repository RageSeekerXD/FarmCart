namespace FarmCart.Core.Tests.Catalog;

/// <summary>
/// Вітрина: склад, термін і умови зберігання товару; історія й дні доставки ферми; товари, яких немає в наявності;
/// картка окремого товару й відгуки покупців, які його купували.
/// </summary>
public sealed class StorefrontTests
{
    private readonly TestWorld _world = new();

    [Fact]
    public void AddProduct_KeepsCompositionShelfLifeAndStorageInBothLanguages()
    {
        var (farm, _) = _world.NewFarmer();

        var product = _world.Farmers.AddProduct(farm, new ProductDraft(
            TestWorld.Text("Бринза"),
            "dairy",
            "kg",
            165m,
            10,
            Composition: new LocalizedText(" Овече молоко, сіль ", "Sheep milk, salt"),
            ShelfLife: new LocalizedText("30 діб", "30 days"),
            Storage: new LocalizedText("У розсолі при +2…+6 °C", "In brine at +2…+6 °C")));

        Assert.Equal("Овече молоко, сіль", product.Composition!.Uk);
        Assert.Equal("30 days", product.ShelfLife!.En);
        Assert.Equal("In brine at +2…+6 °C", product.Storage!.En);
    }

    [Fact]
    public void ProductDetails_InOneLanguageOnly_AreRejected()
    {
        var (farm, _) = _world.NewFarmer();
        var product = _world.NewProduct(farm);

        var error = Assert.Throws<DomainException>(() =>
            _world.Farmers.UpdateProduct(farm, product.Id, new ProductChanges(Storage: new LocalizedText("У холодильнику", " "))));

        Assert.Equal("product_details_incomplete", error.Code);
    }

    [Fact]
    public void UpdateProfile_SetsStoryAndDeliveryDays_AndEmptyStoryRemovesIt()
    {
        var (farm, farmer) = _world.NewFarmer();

        _world.Farmers.UpdateProfile(farm, new FarmProfileChanges(
            new LocalizedText("Варимо сир з 1998 року", "Making cheese since 1998"),
            [DayOfWeek.Saturday, DayOfWeek.Tuesday, DayOfWeek.Tuesday]));

        Assert.Equal("Making cheese since 1998", farmer.Story!.En);
        Assert.Equal([DayOfWeek.Tuesday, DayOfWeek.Saturday], farmer.DeliveryDays.Order());

        _world.Farmers.UpdateProfile(farm, new FarmProfileChanges(Story: new LocalizedText("", "")));

        Assert.Null(farmer.Story);
        Assert.Equal(2, farmer.DeliveryDays.Count);
    }

    [Fact]
    public void Search_CanIncludeSoldOutProducts_WhichGoLast()
    {
        var (farm, _) = _world.NewFarmer();
        _world.NewProduct(farm, "Агрус", stock: 0);
        _world.NewProduct(farm, "Яблука", stock: 5);

        Assert.Equal(["Яблука"], Names(new CatalogQuery()));
        Assert.Equal(["Яблука", "Агрус"], Names(new CatalogQuery(IncludeSoldOut: true)));
    }

    [Fact]
    public void Search_ByDeliveryDay_KeepsFarmsDeliveringThatDayOrEveryDay()
    {
        var (weekend, weekendFarm) = _world.NewFarmer("Суботня");
        var (daily, _) = _world.NewFarmer("Щоденна");
        var (midweek, midweekFarm) = _world.NewFarmer("Середня");
        weekendFarm.DeliveryDays = new HashSet<DayOfWeek> { DayOfWeek.Saturday };
        midweekFarm.DeliveryDays = new HashSet<DayOfWeek> { DayOfWeek.Wednesday };
        _world.NewProduct(weekend, "Мед");
        _world.NewProduct(daily, "Хліб");
        _world.NewProduct(midweek, "Сир");

        Assert.Equal(["Мед", "Хліб"], Names(new CatalogQuery(DeliveryDay: DayOfWeek.Saturday)));
    }

    [Fact]
    public void Product_ReturnsCardEvenWhenSoldOutOrOutOfSeason()
    {
        var (farm, _) = _world.NewFarmer();
        var soldOut = _world.NewProduct(farm, "Агрус", stock: 0);
        var strawberries = _world.NewProduct(farm, "Полуниця", season: [5, 6, 7]);

        var card = _world.Catalog.Product(soldOut.Id, TestWorld.LvivCenter);

        Assert.Equal((0, true), (card.Stock, card.InSeason));
        Assert.InRange(card.DistanceKm!.Value, 7.0, 8.5);
        Assert.False(_world.Catalog.Product(strawberries.Id).InSeason);
    }

    [Fact]
    public void Product_OfUnknownOrUnverifiedFarm_IsNotFound()
    {
        var (farm, farmer) = _world.NewFarmer();
        var product = _world.NewProduct(farm);
        farmer.Verified = false;

        Assert.Equal("product_not_found", Assert.Throws<DomainException>(() => _world.Catalog.Product(product.Id)).Code);
        Assert.Equal("product_not_found", Assert.Throws<DomainException>(() => _world.Catalog.Product(999)).Code);
    }

    [Fact]
    public void ReviewsOfProduct_AreReviewsOfOrdersThatContainedIt()
    {
        var (farm, _) = _world.NewFarmer();
        var cheese = _world.NewProduct(farm, "Сир", stock: 20);
        var milk = _world.NewProduct(farm, "Молоко", stock: 20);
        var buyer = _world.NewUser();
        var other = _world.NewUser();
        var cheeseOrder = _world.Deliver(farm, _world.Buy(buyer, cheese, 1));
        var milkOrder = _world.Deliver(farm, _world.Buy(other, milk, 1));
        _world.Reviews.Add(buyer, cheeseOrder.Id, 5, "Смачний сир");
        _world.Reviews.Add(other, milkOrder.Id, 4, "Свіже молоко");

        Assert.Equal(["Смачний сир"], _world.Reviews.ForProduct(cheese.Id).Select(review => review.Comment));
    }

    private string[] Names(CatalogQuery query) => [.. _world.Catalog.Search(query).Select(item => item.Name.Uk)];
}
