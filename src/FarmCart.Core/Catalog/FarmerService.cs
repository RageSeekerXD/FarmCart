namespace FarmCart.Core;

public sealed record ProductDraft(
    LocalizedText Name,
    string Category,
    string Unit,
    decimal Price,
    int Stock,
    IReadOnlyCollection<int>? SeasonMonths = null,
    string? PhotoUrl = null,
    LocalizedText? Description = null,
    LocalizedText? Composition = null,
    LocalizedText? ShelfLife = null,
    LocalizedText? Storage = null);

/// <summary>Зміни товару; текст з обома порожніми мовами (опис, склад, термін, зберігання) прибирає його.</summary>
public sealed record ProductChanges(
    LocalizedText? Name = null,
    decimal? Price = null,
    int? Stock = null,
    IReadOnlyCollection<int>? SeasonMonths = null,
    LocalizedText? Description = null,
    LocalizedText? Composition = null,
    LocalizedText? ShelfLife = null,
    LocalizedText? Storage = null);

/// <summary>Зміни профілю ферми: історія (обидві мови порожні - прибрати) і дні доставки (порожньо - щодня); null - не змінювати.</summary>
public sealed record FarmProfileChanges(LocalizedText? Story = null, IReadOnlyCollection<DayOfWeek>? DeliveryDays = null);

/// <summary>US-02, US-03 (B-FR-07, B-FR-08): реєстрація продавця та керування власним каталогом.</summary>
public sealed class FarmerService(InMemoryStore store, IClock clock)
{
    /// <summary>Найбільша довжина опису товару кожною мовою.</summary>
    public const int DescriptionMaxLength = 600;

    /// <summary>Найбільша довжина складу, терміну й умов зберігання кожною мовою.</summary>
    public const int DetailsMaxLength = 400;

    /// <summary>Найбільша довжина історії ферми кожною мовою.</summary>
    public const int StoryMaxLength = 1200;

    /// <summary>Найбільший розмір документа для верифікації: 5 МБ.</summary>
    public const int DocumentMaxBytes = 5 * 1024 * 1024;

    /// <summary>Скільки документів може завантажити один продавець.</summary>
    public const int DocumentsLimit = 10;

    /// <summary>Найбільший розмір фото товару: 2 МБ.</summary>
    public const int PhotoMaxBytes = 2 * 1024 * 1024;

    /// <summary>
    /// Фото товару (п. 5 покращень): JPEG, PNG чи WebP до 2 МБ. Тип визначається за сигнатурою файлу, а не лише
    /// за заголовком запиту, тож під виглядом зображення не завантажити довільний файл.
    /// </summary>
    public Product SetPhoto(User user, int productId, byte[] data)
    {
        if (data.Length > PhotoMaxBytes)
        {
            throw Fail.Validation("photo_too_large", "Фото має бути не більше 2 МБ");
        }

        var type = DetectImageType(data) ?? throw Fail.Validation("photo_type_invalid", "Завантажте фото у форматі JPEG, PNG або WebP");
        lock (store.Sync)
        {
            var product = OwnProduct(user, productId);
            var version = (store.Photos.GetValueOrDefault(product.Id)?.Version ?? 0) + 1;
            store.Photos[product.Id] = new ProductPhoto(type, data, version);
            product.PhotoUrl = $"/img/products/{product.Id}?v={version}";
            return product;
        }
    }

    public Product RemovePhoto(User user, int productId)
    {
        lock (store.Sync)
        {
            var product = OwnProduct(user, productId);
            store.Photos.Remove(product.Id);
            product.PhotoUrl = null;
            return product;
        }
    }

    /// <summary>Фото для покупців: публічне, як і каталог.</summary>
    public ProductPhoto? Photo(int productId)
    {
        lock (store.Sync)
        {
            return store.Photos.GetValueOrDefault(productId);
        }
    }

    /// <summary>JPEG (FF D8 FF), PNG (89 50 4E 47 0D 0A 1A 0A) чи WebP (RIFF....WEBP); інакше null.</summary>
    public static string? DetectImageType(ReadOnlySpan<byte> data)
    {
        if (data.Length >= 3 && data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF)
        {
            return "image/jpeg";
        }

        if (data.Length >= 8 && data[..8].SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }))
        {
            return "image/png";
        }

        return data.Length >= 12 && data[..4].SequenceEqual("RIFF"u8) && data[8..12].SequenceEqual("WEBP"u8) ? "image/webp" : null;
    }
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

    /// <summary>Повторна заявка після відхилення: господарство знову в черзі на верифікацію.</summary>
    public Farmer Reapply(User user)
    {
        lock (store.Sync)
        {
            var farmer = store.FarmerOf(user);
            if (farmer.RejectionReason is null)
            {
                throw Fail.Conflict("not_rejected", "Заявку не відхилено - повторно подавати її не треба");
            }

            farmer.RejectionReason = null;
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
        var description = ToDescription(draft.Description);
        var composition = ToDetails(draft.Composition);
        var shelfLife = ToDetails(draft.ShelfLife);
        var storage = ToDetails(draft.Storage);
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
                Description = description,
                Composition = composition,
                ShelfLife = shelfLife,
                Storage = storage,
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

            if (changes.Description is { } text)
            {
                product.Description = ToDescription(text);
            }

            if (changes.Composition is { } composition)
            {
                product.Composition = ToDetails(composition);
            }

            if (changes.ShelfLife is { } shelfLife)
            {
                product.ShelfLife = ToDetails(shelfLife);
            }

            if (changes.Storage is { } storage)
            {
                product.Storage = ToDetails(storage);
            }

            return product;
        }
    }

    private static LocalizedText? ToDescription(LocalizedText? text) =>
        OptionalText(text, DescriptionMaxLength, "description", "Опис товару");

    /// <summary>Склад, термін придатності чи умови зберігання: як і опис - обома мовами або жодною.</summary>
    private static LocalizedText? ToDetails(LocalizedText? text) =>
        OptionalText(text, DetailsMaxLength, "product_details", "Склад, термін і умови зберігання");

    /// <summary>
    /// Необов'язковий двомовний текст: обидві мови порожні - тексту немає; заповнено лише одну - помилка
    /// «{code}_incomplete», бо покупець іншою мовою побачив би порожнечу (BE-9); задовгий - «{code}_too_long».
    /// </summary>
    private static LocalizedText? OptionalText(LocalizedText? text, int maxLength, string code, string what)
    {
        if (text is null || (string.IsNullOrWhiteSpace(text.Uk) && string.IsNullOrWhiteSpace(text.En)))
        {
            return null;
        }

        if (!text.IsComplete)
        {
            throw Fail.Validation($"{code}_incomplete", $"{what}: потрібно обома мовами або жодною");
        }

        var trimmed = text.Trimmed();
        return trimmed.Uk.Length > maxLength || trimmed.En.Length > maxLength
            ? throw Fail.Validation($"{code}_too_long", $"{what}: не довше {maxLength} символів кожною мовою")
            : trimmed;
    }

    /// <summary>Історія ферми й дні, коли вона возить замовлення (сторінка ферми, фільтр каталогу за днем доставки).</summary>
    public Farmer UpdateProfile(User user, FarmProfileChanges changes)
    {
        var story = changes.Story is null ? null : OptionalText(changes.Story, StoryMaxLength, "story", "Історія ферми");
        lock (store.Sync)
        {
            var farmer = store.FarmerOf(user);
            if (changes.Story is not null)
            {
                farmer.Story = story;
            }

            if (changes.DeliveryDays is { } days)
            {
                farmer.DeliveryDays = days.ToHashSet();
            }

            return farmer;
        }
    }

    /// <summary>
    /// Скан документа для верифікації: PDF, JPEG чи PNG до 5 МБ, тип - за сигнатурою файлу.
    /// Документи бачать лише сам продавець і адміністратор.
    /// </summary>
    public FarmDocument AddDocument(User user, string? name, byte[] data)
    {
        if (data.Length > DocumentMaxBytes)
        {
            throw Fail.Validation("document_too_large", "Документ має бути не більше 5 МБ");
        }

        var type = DetectDocumentType(data) ?? throw Fail.Validation("document_type_invalid", "Завантажте документ у форматі PDF, JPEG або PNG");
        var title = string.IsNullOrWhiteSpace(name) ? "Документ" : name.Trim();
        lock (store.Sync)
        {
            var farmer = store.FarmerOf(user);
            if (store.FarmDocuments.Values.Count(d => d.FarmerId == farmer.Id) >= DocumentsLimit)
            {
                throw Fail.Conflict("documents_limit", $"Можна завантажити не більше {DocumentsLimit} документів");
            }

            var document = new FarmDocument(store.NextId<FarmDocument>(), farmer.Id, title.Length > 120 ? title[..120] : title, type, data, clock.Now);
            store.FarmDocuments.Add(document.Id, document);
            return document;
        }
    }

    public IReadOnlyList<FarmDocument> Documents(User user)
    {
        lock (store.Sync)
        {
            var farmer = store.FarmerOf(user);
            return [.. store.FarmDocuments.Values.Where(d => d.FarmerId == farmer.Id).OrderBy(d => d.Id)];
        }
    }

    public void RemoveDocument(User user, int documentId)
    {
        lock (store.Sync)
        {
            var farmer = store.FarmerOf(user);
            if (store.FarmDocuments.GetValueOrDefault(documentId) is not { } document || document.FarmerId != farmer.Id)
            {
                throw Fail.NotFound("document_not_found", $"Документ #{documentId} не знайдено");
            }

            store.FarmDocuments.Remove(document.Id);
        }
    }

    /// <summary>PDF (%PDF), JPEG чи PNG за сигнатурою; інакше null.</summary>
    public static string? DetectDocumentType(ReadOnlySpan<byte> data) =>
        data.Length >= 4 && data[..4].SequenceEqual("%PDF"u8)
            ? "application/pdf"
            : DetectImageType(data) is "image/jpeg" or "image/png" ? DetectImageType(data) : null;

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
