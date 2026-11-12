namespace FarmCart.Core.Tests.Catalog;

/// <summary>US-02, US-03 (B-FR-07, B-FR-08).</summary>
public sealed class FarmerServiceTests
{
    private readonly TestWorld _world = new();

    [Fact]
    public void Profile_ReturnsOwnFarm_AndIsRefusedForNonFarmer()
    {
        var (user, farmer) = _world.NewFarmer(verified: false);

        var error = Assert.Throws<DomainException>(() => _world.Farmers.Profile(_world.NewUser()));

        Assert.Same(farmer, _world.Farmers.Profile(user));
        Assert.Equal("not_a_farmer", error.Code);
    }

    [Fact]
    public void Register_CreatesUnverifiedFarmerAndGrantsRole()
    {
        var user = _world.NewUser();

        var farmer = _world.Farmers.Register(user, new LocalizedText("  Пасіка «Медовий шлях»  ", " Medovyi Shliakh Apiary "), TestWorld.Vynnyky, certified: true, "docs/42.pdf");

        Assert.False(farmer.Verified);
        Assert.Equal(new LocalizedText("Пасіка «Медовий шлях»", "Medovyi Shliakh Apiary"), farmer.Name);
        Assert.Contains(Role.Farmer, user.Roles);
    }

    [Fact]
    public void Register_Twice_IsConflict()
    {
        var (user, _) = _world.NewFarmer();

        var error = Assert.Throws<DomainException>(() => _world.Farmers.Register(user, TestWorld.Text("Друга ферма"), TestWorld.Vynnyky, false, null));

        Assert.Equal("already_farmer", error.Code);
    }

    [Theory]
    [InlineData("", "Farm", 49.8, 24.0, "farm_name_required")]
    [InlineData("Ферма", " ", 49.8, 24.0, "farm_name_required")]
    [InlineData("Ферма", "Farm", 95.0, 24.0, "location_invalid")]
    public void Register_WithInvalidData_IsRejected(string name, string english, double lat, double lon, string code)
    {
        var error = Assert.Throws<DomainException>(() => _world.Farmers.Register(_world.NewUser(), new LocalizedText(name, english), new GeoPoint(lat, lon), false, null));

        Assert.Equal(code, error.Code);
    }

    [Fact]
    public void AddProduct_ByUnverifiedFarmer_IsForbidden()
    {
        var (user, _) = _world.NewFarmer(verified: false);

        var error = Assert.Throws<DomainException>(() => _world.NewProduct(user));

        Assert.Equal("farmer_not_verified", error.Code);
        Assert.Empty(_world.Store.Products);
    }

    [Fact]
    public void AddProduct_ByUserWithoutFarm_IsForbidden()
    {
        var error = Assert.Throws<DomainException>(() => _world.NewProduct(_world.NewUser()));

        Assert.Equal("not_a_farmer", error.Code);
    }

    [Fact]
    public void AddProduct_ByVerifiedFarmer_PublishesProduct()
    {
        var (user, farmer) = _world.NewFarmer();

        var product = _world.Farmers.AddProduct(user, new ProductDraft(new LocalizedText(" Мед липовий ", " Linden honey "), "honey", "L", 290m, 20, [6, 7, 8]));

        Assert.Equal(farmer.Id, product.FarmerId);
        Assert.Equal(new LocalizedText("Мед липовий", "Linden honey"), product.Name);
        Assert.Equal(("honey", "l", new LocalizedText("л", "l")), (product.Category, product.UnitCode, product.Unit));
        Assert.True(product.IsInSeason(7));
        Assert.False(product.IsInSeason(1));
    }

    [Theory]
    [InlineData(0, 5, "price_invalid")]
    [InlineData(-10, 5, "price_invalid")]
    [InlineData(10, -1, "stock_negative")]
    public void AddProduct_WithInvalidPriceOrStock_IsRejected(int price, int stock, string code)
    {
        var (user, _) = _world.NewFarmer();

        var error = Assert.Throws<DomainException>(() => _world.NewProduct(user, price: price, stock: stock));

        Assert.Equal(code, error.Code);
    }

    [Theory]
    [InlineData("", "Apples", "fruits", "kg", "name_required")]
    [InlineData("Яблука", " ", "fruits", "kg", "name_required")]
    [InlineData("Яблука", "Apples", " ", "kg", "category_unknown")]
    [InlineData("Яблука", "Apples", "Фрукти", "kg", "category_unknown")]
    [InlineData("Яблука", "Apples", "fruits", "", "unit_unknown")]
    [InlineData("Яблука", "Apples", "fruits", "відро", "unit_unknown")]
    public void AddProduct_WithoutBothNamesOrWithUnknownCategoryOrUnit_IsRejected(string name, string english, string category, string unit, string code)
    {
        var (user, _) = _world.NewFarmer();

        var error = Assert.Throws<DomainException>(() => _world.Farmers.AddProduct(user, new ProductDraft(new LocalizedText(name, english), category, unit, 10m, 1)));

        Assert.Equal(code, error.Code);
    }

    [Fact]
    public void AddProduct_WithMonthOutsideCalendar_IsRejected()
    {
        var (user, _) = _world.NewFarmer();

        var error = Assert.Throws<DomainException>(() => _world.NewProduct(user, season: [13]));

        Assert.Equal("season_invalid", error.Code);
    }

    [Fact]
    public void UpdateProduct_ChangesPriceStockNameAndSeason()
    {
        var (user, _) = _world.NewFarmer();
        var product = _world.NewProduct(user);

        _world.Farmers.UpdateProduct(user, product.Id, new ProductChanges(new LocalizedText("Яблука Голден", "Golden apples"), 35m, 40, [9, 10]));

        Assert.Equal((new LocalizedText("Яблука Голден", "Golden apples"), 35m, 40), (product.Name, product.Price, product.Stock));
        Assert.Equal([9, 10], product.SeasonMonths.Order());
    }

    [Fact]
    public void UpdateProduct_OfAnotherFarmer_IsForbidden()
    {
        var (owner, _) = _world.NewFarmer();
        var (stranger, _) = _world.NewFarmer("Чужа ферма");
        var product = _world.NewProduct(owner);

        var error = Assert.Throws<DomainException>(() => _world.Farmers.UpdateProduct(stranger, product.Id, new ProductChanges(Price: 1m)));

        Assert.Equal("not_your_product", error.Code);
    }

    [Fact]
    public void UpdateProduct_Unknown_IsNotFound()
    {
        var (user, _) = _world.NewFarmer();

        var error = Assert.Throws<DomainException>(() => _world.Farmers.UpdateProduct(user, 999, new ProductChanges(Price: 1m)));

        Assert.Equal(ErrorKind.NotFound, error.Kind);
    }

    [Fact]
    public void ChangeStock_BelowZero_IsConflictAndStockUnchanged()
    {
        var (user, _) = _world.NewFarmer();
        var product = _world.NewProduct(user, stock: 5);

        var error = Assert.Throws<DomainException>(() => _world.Farmers.ChangeStock(user, product.Id, -6));

        Assert.Equal("stock_negative", error.Code);
        Assert.Equal(5, product.Stock);
    }

    [Fact]
    public void ChangeStock_ToExactlyZero_IsAllowed()
    {
        var (user, _) = _world.NewFarmer();
        var product = _world.NewProduct(user, stock: 5);

        _world.Farmers.ChangeStock(user, product.Id, -5);

        Assert.Equal(0, product.Stock);
    }

    [Fact]
    public void MyProducts_ReturnsOnlyOwnProducts()
    {
        var (owner, _) = _world.NewFarmer();
        var (other, _) = _world.NewFarmer("Інша ферма");
        _world.NewProduct(owner, "Яблука");
        _world.NewProduct(other, "Груші");

        Assert.Equal(["Яблука"], _world.Farmers.MyProducts(owner).Select(p => p.Name.Uk));
    }
}
