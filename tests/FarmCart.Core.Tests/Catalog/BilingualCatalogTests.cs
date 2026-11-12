namespace FarmCart.Core.Tests.Catalog;

/// <summary>BE-9: дані каталогу двома мовами - пошук, сортування, довідники і знімки назв у кошику та замовленні.</summary>
public sealed class BilingualCatalogTests
{
    private readonly TestWorld _world = new();

    [Theory]
    [InlineData("мед", new[] { "Мед липовий" })]
    [InlineData("HONEY", new[] { "Мед липовий" })]
    [InlineData("appl", new[] { "Яблука" })]
    [InlineData("сир", new string[0])]
    public void Search_FindsTextInEitherLanguage(string text, string[] expected)
    {
        var (farm, _) = _world.NewFarmer();
        Publish(farm, "Мед липовий", "Linden honey", "honey");
        Publish(farm, "Яблука", "Apples", "fruits");

        var found = _world.Catalog.Search(new CatalogQuery(Text: text)).Select(i => i.Name.Uk);

        Assert.Equal(expected, found);
    }

    [Theory]
    [InlineData("uk", new[] { "Буряк", "Морква", "Яблука" })]
    [InlineData("en", new[] { "Apples", "Beetroot", "Carrots" })]
    public void Search_SortsNamesInInterfaceLanguage(string lang, string[] expected)
    {
        var (farm, _) = _world.NewFarmer();
        Publish(farm, "Яблука", "Apples", "fruits");
        Publish(farm, "Морква", "Carrots", "vegetables");
        Publish(farm, "Буряк", "Beetroot", "vegetables");

        var names = _world.Catalog.Search(new CatalogQuery(Lang: lang)).Select(i => i.Name.In(lang));

        Assert.Equal(expected, names);
    }

    [Fact]
    public void Search_WithUnknownLanguage_IsRejected()
    {
        var error = Assert.Throws<DomainException>(() => _world.Catalog.Search(new CatalogQuery(Lang: "de")));

        Assert.Equal("lang_invalid", error.Code);
    }

    [Fact]
    public void Search_WithCategoryThatIsNotAReferenceCode_IsRejected()
    {
        var error = Assert.Throws<DomainException>(() => _world.Catalog.Search(new CatalogQuery(Category: "Овочі")));

        Assert.Equal("category_unknown", error.Code);
    }

    [Fact]
    public void CatalogItem_CarriesBothLanguagesForNameUnitAndFarm()
    {
        var (farm, _) = _world.NewFarmer("Ферма «Зелений Гай»");
        _world.Farmers.AddProduct(farm, new ProductDraft(new LocalizedText("Мед гречаний", "Buckwheat honey"), "honey", "jar-0.5l", 170m, 15));

        var item = Assert.Single(_world.Catalog.Search(new CatalogQuery()));

        Assert.Equal(new LocalizedText("Мед гречаний", "Buckwheat honey"), item.Name);
        Assert.Equal(("honey", "jar-0.5l", new LocalizedText("банка 0,5 л", "0.5 l jar")), (item.Category, item.UnitCode, item.Unit));
        Assert.Equal("Ферма «Зелений Гай»", item.FarmerName.Uk);
    }

    [Fact]
    public void UpdateProduct_WithoutEnglishName_IsRejected()
    {
        var (farm, _) = _world.NewFarmer();
        var product = _world.NewProduct(farm);

        var error = Assert.Throws<DomainException>(() =>
            _world.Farmers.UpdateProduct(farm, product.Id, new ProductChanges(new LocalizedText("Яблука Голден", ""))));

        Assert.Equal("name_required", error.Code);
    }

    [Fact]
    public void Order_KeepsNamesOfBothLanguagesAfterProductIsRenamed()
    {
        var (farm, _) = _world.NewFarmer();
        var apples = Publish(farm, "Яблука", "Apples", "fruits");
        var buyer = _world.NewUser();

        var order = _world.Buy(buyer, apples, 2);
        _world.Farmers.UpdateProduct(farm, apples.Id, new ProductChanges(new LocalizedText("Яблука «Голден»", "Golden apples")));

        var line = Assert.Single(order.Lines);
        Assert.Equal(new LocalizedText("Яблука", "Apples"), line.Name);
        Assert.Equal(new LocalizedText("кг", "kg"), line.Unit);
    }

    [Fact]
    public void Cart_ShowsNamesOfBothLanguages()
    {
        var (farm, _) = _world.NewFarmer();
        var apples = Publish(farm, "Яблука", "Apples", "fruits");

        var cart = _world.Carts.Add(_world.NewUser(), apples.Id, 1);

        Assert.Equal(new LocalizedText("Яблука", "Apples"), Assert.Single(cart.Lines).Name);
    }

    [Fact]
    public void Reference_ListsEveryCategoryAndUnitInBothLanguages()
    {
        Assert.Equal(
            ["vegetables", "fruits", "berries", "dairy", "honey", "meat-eggs", "bakery"],
            Reference.Categories.Select(c => c.Code));
        Assert.All(Reference.Categories.Concat(Reference.Units), item => Assert.True(item.Title.IsComplete));
        Assert.Equal(Reference.Units.Count, Reference.Units.Select(u => u.Code).Distinct().Count());
        Assert.Null(Reference.Unit("відро"));
    }

    [Fact]
    public void Farms_ListsOnlyVerifiedFarmsNearestFirstWithProductCount()
    {
        var (near, nearFarm) = _world.NewFarmer("Близька", TestWorld.Vynnyky);
        var (_, farFarm) = _world.NewFarmer("Далека", new GeoPoint(49.7170, 23.9100));
        _world.NewFarmer("Неперевірена", verified: false);
        _world.NewProduct(near, "Яблука");
        _world.NewProduct(near, "Груші", stock: 0);

        var farms = _world.Catalog.Farms(TestWorld.LvivCenter);

        Assert.Equal([nearFarm.Id, farFarm.Id], farms.Select(f => f.Id));
        Assert.Equal((1, 0), (farms[0].ProductCount, farms[1].ProductCount));
        Assert.InRange(farms[0].DistanceKm!.Value, 7.0, 8.0);
        Assert.All(_world.Catalog.Farms(), farm => Assert.Null(farm.DistanceKm));
    }

    [Fact]
    public void Farms_WithInvalidPoint_IsRejected()
    {
        var error = Assert.Throws<DomainException>(() => _world.Catalog.Farms(new GeoPoint(95, 24)));

        Assert.Equal("location_invalid", error.Code);
    }

    private Product Publish(User farm, string uk, string en, string category) =>
        _world.Farmers.AddProduct(farm, new ProductDraft(new LocalizedText(uk, en), category, "kg", 30m, 10));
}
