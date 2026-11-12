namespace FarmCart.Core;

public sealed record ProductDraft(
    LocalizedText Name,
    string Category,
    string Unit,
    decimal Price,
    int Stock,
    IReadOnlyCollection<int>? SeasonMonths = null,
    string? PhotoUrl = null);

public sealed record ProductChanges(LocalizedText? Name = null, decimal? Price = null, int? Stock = null, IReadOnlyCollection<int>? SeasonMonths = null);

/// <summary>US-02, US-03 (B-FR-07, B-FR-08): реєстрація продавця та керування власним каталогом.</summary>
public sealed class FarmerService(InMemoryStore store)
{
    public Farmer Register(User user, LocalizedText farmName, GeoPoint location, bool certified, string? documents)
    {
        if (farmName is not { IsComplete: true })
        {
            throw Fail.Validation("farm_name_required", "Вкажіть назву господарства українською й англійською");
        }

        if (!location.IsValid)
        {
            throw Fail.Validation("location_invalid", "Некоректні координати господарства");
        }

        lock (store.Sync)
        {
            if (store.Farmers.Values.Any(f => f.UserId == user.Id))
            {
                throw Fail.Conflict("already_farmer", "Користувача вже зареєстровано як продавця");
            }

            var farmer = new Farmer
            {
                Id = store.NextId<Farmer>(),
                UserId = user.Id,
                Name = farmName.Trimmed(),
                Location = location,
                Certified = certified,
                Documents = documents,
            };
            store.Farmers.Add(farmer.Id, farmer);
            user.Roles.Add(Role.Farmer);
            return farmer;
        }
    }

    /// <summary>Господарство продавця: за ним веб-кабінет показує, чи пройдено верифікацію.</summary>
    public Farmer Profile(User user)
    {
        lock (store.Sync)
        {
            return store.FarmerOf(user);
        }
    }

    public Product AddProduct(User user, ProductDraft draft)
    {
        RequireName(draft.Name);
        var category = Reference.Category(draft.Category) ?? throw Fail.Validation("category_unknown", "Оберіть категорію з довідника");
        var unit = Reference.Unit(draft.Unit) ?? throw Fail.Validation("unit_unknown", "Оберіть одиницю продажу з довідника");
        RequirePositive(draft.Price);
        RequireNonNegative(draft.Stock);
        var season = ToSeason(draft.SeasonMonths);
        lock (store.Sync)
        {
            var farmer = store.FarmerOf(user);
            if (!farmer.Verified)
            {
                throw Fail.Forbidden("farmer_not_verified", "Продавець без верифікації не може публікувати товари");
            }

            var product = new Product
            {
                Id = store.NextId<Product>(),
                FarmerId = farmer.Id,
                Name = draft.Name.Trimmed(),
                Category = category.Code,
                UnitCode = unit.Code,
                Unit = unit.Title,
                Price = draft.Price,
                Stock = draft.Stock,
                PhotoUrl = draft.PhotoUrl,
                SeasonMonths = season,
            };
            store.Products.Add(product.Id, product);
            return product;
        }
    }

    public Product UpdateProduct(User user, int productId, ProductChanges changes)
    {
        lock (store.Sync)
        {
            var product = OwnProduct(user, productId);
            if (changes.Name is { } name)
            {
                RequireName(name);
                product.Name = name.Trimmed();
            }

            if (changes.Price is { } price)
            {
                RequirePositive(price);
                product.Price = price;
            }

            if (changes.Stock is { } stock)
            {
                RequireNonNegative(stock);
                product.Stock = stock;
            }

            if (changes.SeasonMonths is { } months)
            {
                product.SeasonMonths = ToSeason(months);
            }

            return product;
        }
    }

    public Product ChangeStock(User user, int productId, int delta)
    {
        lock (store.Sync)
        {
            var product = OwnProduct(user, productId);
            if (product.Stock + delta < 0)
            {
                throw Fail.Conflict("stock_negative", $"Залишок не може стати від'ємним: на складі {product.Stock} × {product.Unit}");
            }

            product.Stock += delta;
            return product;
        }
    }

    public IReadOnlyList<Product> MyProducts(User user)
    {
        lock (store.Sync)
        {
            var farmer = store.FarmerOf(user);
            return [.. store.Products.Values.Where(p => p.FarmerId == farmer.Id).OrderBy(p => p.Id)];
        }
    }

    private Product OwnProduct(User user, int productId)
    {
        var farmer = store.FarmerOf(user);
        var product = store.Products.GetValueOrDefault(productId)
            ?? throw Fail.NotFound("product_not_found", $"Товар #{productId} не знайдено");
        return product.FarmerId == farmer.Id
            ? product
            : throw Fail.Forbidden("not_your_product", "Змінювати можна лише власні товари");
    }

    private static void RequireName(LocalizedText? name)
    {
        if (name is not { Uk: not null, En: not null, IsComplete: true })
        {
            throw Fail.Validation("name_required", "Вкажіть назву товару українською й англійською");
        }
    }

    private static void RequirePositive(decimal price)
    {
        if (price <= 0)
        {
            throw Fail.Validation("price_invalid", "Ціна має бути більшою за нуль");
        }
    }

    private static void RequireNonNegative(int stock)
    {
        if (stock < 0)
        {
            throw Fail.Validation("stock_negative", "Залишок не може бути від'ємним");
        }
    }

    private static HashSet<int> ToSeason(IReadOnlyCollection<int>? months)
    {
        var season = (months ?? []).ToHashSet();
        return season.All(m => m is >= 1 and <= 12)
            ? season
            : throw Fail.Validation("season_invalid", "Місяці сезону задаються числами від 1 до 12");
    }
}
