using FarmCart.Core;

namespace FarmCart.Api;

/// <summary>Автентифікований користувач запиту: заголовок <c>Authorization: Bearer &lt;token&gt;</c>.</summary>
public sealed record Caller(User User)
{
    public static ValueTask<Caller?> BindAsync(HttpContext context)
    {
        const string Prefix = "Bearer ";
        var header = context.Request.Headers.Authorization.ToString();
        if (!header.StartsWith(Prefix, StringComparison.OrdinalIgnoreCase))
        {
            throw Fail.Unauthorized("auth_required", "Потрібен вхід: увійдіть за номером телефону");
        }

        var auth = context.RequestServices.GetRequiredService<AuthService>();
        var user = auth.FindByToken(header[Prefix.Length..].Trim())
            ?? throw Fail.Unauthorized("session_invalid", "Сесія недійсна. Увійдіть знову");
        return ValueTask.FromResult<Caller?>(new Caller(user));
    }
}

public sealed record PhoneRequest(string Phone);

public sealed record VerifyRequest(string Phone, string Code);

public sealed record FarmerRegistration(LocalizedText FarmName, double Lat, double Lon, bool Certified, string? Documents);

public sealed record StockChange(int Delta);

public sealed record CartItemRequest(int ProductId, int Quantity);

public sealed record AcceptRequest(IReadOnlyCollection<Shortage>? Shortages);

public sealed record RejectRequest(string Reason);

public sealed record HandOverRequest(int CourierId);

public sealed record ConfirmRequest(string? Code);

public sealed record DeliveryFailureRequest(DeliveryProblem Problem, string? Note);

public sealed record RescheduleRequest(int SlotId);

public sealed record ReviewRequest(int Rating, string? Comment);

public sealed record ModerationRequest(string Reason);

public sealed record SlotRequest(DateTimeOffset Start, DateTimeOffset End, int Capacity);

public sealed record PromoRequest(string Code, int Percent, decimal MinTotal, DateTimeOffset ValidUntil);

public sealed record CatalogRequest(
    string? Q,
    string? Category,
    int? FarmerId,
    double? Lat,
    double? Lon,
    double? MaxKm,
    bool? Certified,
    decimal? MinPrice,
    decimal? MaxPrice,
    CatalogSort? Sort,
    string? Lang,
    bool? IncludeSoldOut,
    DayOfWeek? DeliveryDay)
{
    public CatalogQuery ToQuery() => new(
        Q,
        Category,
        FarmerId,
        Lat is { } lat && Lon is { } lon ? new GeoPoint(lat, lon) : null,
        MaxKm,
        Certified ?? false,
        MinPrice,
        MaxPrice,
        Sort ?? CatalogSort.Name,
        Lang ?? LocalizedText.Ukrainian,
        IncludeSoldOut ?? false,
        DeliveryDay);
}

public sealed record UserDto(int Id, string Phone, string Name, IEnumerable<Role> Roles)
{
    public static UserDto From(User user) => new(user.Id, user.Phone, user.Name, user.Roles.Order());
}

public sealed record FarmerDto(
    int Id,
    LocalizedText Name,
    double Lat,
    double Lon,
    bool Certified,
    bool Verified,
    double? Rating,
    int ReviewCount,
    string? RejectionReason,
    LocalizedText? Story,
    IReadOnlyList<DayOfWeek> DeliveryDays,
    int DocumentCount)
{
    public static FarmerDto From(Farmer farmer, int documentCount = 0) => new(
        farmer.Id,
        farmer.Name,
        farmer.Location.Lat,
        farmer.Location.Lon,
        farmer.Certified,
        farmer.Verified,
        farmer.Rating,
        farmer.ReviewCount,
        farmer.RejectionReason,
        farmer.Story,
        [.. farmer.DeliveryDays.Order()],
        documentCount);
}

/// <summary>Документ продавця без вмісту: вміст адміністратор отримує окремим запитом.</summary>
public sealed record FarmDocumentDto(int Id, string Name, string ContentType, int Size, DateTimeOffset UploadedAt)
{
    public static FarmDocumentDto From(FarmDocument document) => new(document.Id, document.Name, document.ContentType, document.Size, document.UploadedAt);
}

/// <summary>Товар у каталозі фермера: знімок доменної сутності, щоб зміни в класі Product не змінювали HTTP-контракт непомітно.</summary>
public sealed record ProductDto(
    int Id,
    int FarmerId,
    LocalizedText Name,
    string Category,
    string UnitCode,
    LocalizedText Unit,
    decimal Price,
    int Stock,
    string? PhotoUrl,
    IReadOnlyList<int> SeasonMonths,
    LocalizedText? Description,
    LocalizedText? Composition,
    LocalizedText? ShelfLife,
    LocalizedText? Storage)
{
    public static ProductDto From(Product product) => new(
        product.Id,
        product.FarmerId,
        product.Name,
        product.Category,
        product.UnitCode,
        product.Unit,
        product.Price,
        product.Stock,
        product.PhotoUrl,
        [.. product.SeasonMonths],
        product.Description,
        product.Composition,
        product.ShelfLife,
        product.Storage);
}

public sealed record CourierDto(int Id, string Name);

/// <summary>Чи можна запропонувати фермеру автоматичний переклад полів товару.</summary>
public sealed record ProductTranslationStatusDto(bool Available);

public sealed record ProductTranslationRequest(IReadOnlyList<ProductText>? Items);

public sealed record ProductTranslationDto(IReadOnlyList<ProductText> Items);

/// <summary>Чи ввімкнено на сервері підказки ШІ.</summary>
public sealed record AiStatusDto(bool Available);

/// <summary>Підсумок відгуків; <paramref name="Summary"/> = null - відгуків замало або ШІ недоступний.</summary>
public sealed record ReviewSummaryDto(ReviewSummary? Summary);

/// <summary>Чернетка товару за фото; <paramref name="Understood"/> = false - на фото не вдалося впізнати товар.</summary>
public sealed record ProductSuggestionDto(bool Understood, LocalizedText? Name, string? Category, LocalizedText? Description)
{
    public static ProductSuggestionDto From(ProductSuggestion? suggestion) =>
        new(suggestion is not null, suggestion?.Name, suggestion?.Category, suggestion?.Description);
}

public sealed record BasketPlanRequest(string? Request, string? Lang);

/// <summary>Чи можна запропонувати покупцю розумний пошук.</summary>
public sealed record SmartSearchStatusDto(bool Available);

public sealed record SmartSearchRequest(string? Query);

/// <summary>Фільтри каталогу за запитом покупця; <paramref name="Understood"/> = false - у запиті не знайшлося жодного фільтра.</summary>
public sealed record SmartSearchDto(
    bool Understood,
    string? Text,
    string? Category,
    bool Certified,
    decimal? MinPrice,
    decimal? MaxPrice,
    int? MaxKm,
    CatalogSort? Sort,
    DayOfWeek? DeliveryDay)
{
    public static SmartSearchDto From(SearchIntent intent) => new(
        !intent.IsEmpty,
        intent.Text,
        intent.Category,
        intent.Certified,
        intent.MinPrice,
        intent.MaxPrice,
        intent.MaxKm,
        intent.Sort,
        intent.DeliveryDay);
}

public sealed record ReviewDto(int Id, int OrderId, int Rating, string? Comment, string Author, DateTimeOffset At)
{
    public static ReviewDto From(Review review) => new(review.Id, review.OrderId, review.Rating, review.Comment, review.Author, review.At);
}

/// <summary>Відгук у кабінеті адміністратора: з назвою ферми й станом модерації.</summary>
public sealed record AdminReviewDto(
    int Id,
    int OrderId,
    int FarmerId,
    LocalizedText FarmName,
    int Rating,
    string? Comment,
    string Author,
    DateTimeOffset At,
    bool Hidden,
    string? HiddenReason)
{
    public static AdminReviewDto From(ModerationItem item) => new(
        item.Review.Id,
        item.Review.OrderId,
        item.Review.FarmerId,
        item.FarmName,
        item.Review.Rating,
        item.Review.Comment,
        item.Review.Author,
        item.Review.At,
        item.Review.Hidden,
        item.Review.HiddenReason);
}

public sealed record OrderLineDto(int ProductId, LocalizedText Name, LocalizedText Unit, decimal UnitPrice, int Quantity, decimal Total);

public sealed record StatusChangeDto(OrderStatus Status, string Title, DateTimeOffset At);

public sealed record OrderDto(
    int Id,
    OrderStatus Status,
    string StatusTitle,
    int FarmerId,
    IReadOnlyList<OrderLineDto> Lines,
    decimal Subtotal,
    decimal Discount,
    decimal Total,
    PaymentMethod PaymentMethod,
    PaymentStatus PaymentStatus,
    string PaymentTitle,
    decimal PaidAmount,
    decimal RefundedAmount,
    string Address,
    DateTimeOffset SlotStart,
    DateTimeOffset SlotEnd,
    string? Comment,
    string? PromoCode,
    string? DeliveryCode,
    string? RejectionReason,
    IReadOnlyList<StatusChangeDto> History,
    DeliveryProblem? DeliveryProblem,
    string? DeliveryProblemNote,
    IReadOnlyList<int> CheckoutOrderIds,
    AddressDetails? AddressDetails,
    double? DropOffLat,
    double? DropOffLon,
    string? BuyerName,
    string? BuyerPhone)
{
    public static OrderDto ForBuyer(Order order) => From(order, order.DeliveryCode, buyer: null);

    /// <summary>
    /// Фермер і кур'єр не бачать коду вручення (його називає покупець при отриманні), зате бачать ім'я й телефон
    /// покупця: зв'язатися щодо замовлення.
    /// </summary>
    public static OrderDto ForStaff(Order order, InMemoryStore store)
    {
        User buyer;
        lock (store.Sync)
        {
            buyer = store.Users[order.BuyerId];
        }

        return From(order, deliveryCode: null, buyer);
    }

    private static OrderDto From(Order order, string? deliveryCode, User? buyer) => new(
        order.Id,
        order.Status,
        order.Status.Title(),
        order.FarmerId,
        [.. order.Lines.Select(l => new OrderLineDto(l.ProductId, l.Name, l.Unit, l.UnitPrice, l.Quantity, l.Total))],
        order.Subtotal,
        order.Discount,
        order.Total,
        order.PaymentMethod,
        order.PaymentStatus,
        order.PaymentStatus.Title(),
        order.PaidAmount,
        order.RefundedAmount,
        order.Address,
        order.Slot.Start,
        order.Slot.End,
        order.Comment,
        order.PromoCode,
        deliveryCode,
        order.RejectionReason,
        [.. order.History.Select(h => new StatusChangeDto(h.Status, h.Status.Title(), h.At))],
        order.Problem,
        order.ProblemNote,
        order.CheckoutOrderIds.Count > 0 ? order.CheckoutOrderIds : [order.Id],
        order.Details,
        order.DropOff?.Lat,
        order.DropOff?.Lon,
        buyer?.Name,
        buyer?.Phone);
}
