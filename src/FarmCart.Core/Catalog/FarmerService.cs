namespace FarmCart.Core;

public sealed record ProductDraft(
    string Name,
    string Category,
    string Unit,
    decimal Price,
    int Stock,
    IReadOnlyCollection<int>? SeasonMonths = null,
    string? PhotoUrl = null);

public sealed record ProductChanges(string? Name = null, decimal? Price = null, int? Stock = null, IReadOnlyCollection<int>? SeasonMonths = null);

/// <summary>US-02, US-03 (B-FR-07, B-FR-08): реєстрація продавця та керування власним каталогом.</summary>
public sealed class FarmerService(InMemoryStore store)
{
    public Farmer Register(User user, string farmName, GeoPoint location, bool certified, string? documents)
    {
        if (string.IsNullOrWhiteSpace(farmName))
        {
            throw Fail.Validation("farm_name_required", "Вкажіть назву господарства");
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
                Name = farmName.Trim(),
                Location = location,
                Certified = certified,
                Documents = documents,
            };
            store.Farmers.Add(farmer.Id, farmer);
            user.Roles.Add(Role.Farmer);
            return farmer;
        }
    }

    public Product AddProduct(User user, ProductDraft draft)
    {
        RequireText(draft.Name, "Назва товару");
        RequireText(draft.Category, "Категорія");
        RequireText(draft.Unit, "Одиниця продажу");
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
                Name = draft.Name.Trim(),
                Category = draft.Category.Trim(),
                Unit = draft.Unit.Trim(),
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
                RequireText(name, "Назва товару");
                product.Name = name.Trim();
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

    private static void RequireText(string? value, string field)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw Fail.Validation("field_required", $"Поле «{field}» обов'язкове");
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
