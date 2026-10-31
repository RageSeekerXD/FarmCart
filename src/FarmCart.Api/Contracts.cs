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

public sealed record FarmerRegistration(string FarmName, double Lat, double Lon, bool Certified, string? Documents);

public sealed record StockChange(int Delta);

public sealed record CartItemRequest(int ProductId, int Quantity);

public sealed record AcceptRequest(IReadOnlyCollection<Shortage>? Shortages);

public sealed record RejectRequest(string Reason);

public sealed record HandOverRequest(int CourierId);

public sealed record ConfirmRequest(string? Code);

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
    CatalogSort? Sort)
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
        Sort ?? CatalogSort.Name);
}

public sealed record UserDto(int Id, string Phone, string Name, IEnumerable<Role> Roles)
{
    public static UserDto From(User user) => new(user.Id, user.Phone, user.Name, user.Roles.Order());
}

public sealed record FarmerDto(int Id, string Name, double Lat, double Lon, bool Certified, bool Verified, double? Rating, int ReviewCount)
{
    public static FarmerDto From(Farmer farmer) => new(
        farmer.Id,
        farmer.Name,
        farmer.Location.Lat,
        farmer.Location.Lon,
        farmer.Certified,
        farmer.Verified,
        farmer.Rating,
        farmer.ReviewCount);
}

/// <summary>Товар у каталозі фермера: знімок доменної сутності, щоб зміни в класі Product не змінювали HTTP-контракт непомітно.</summary>
public sealed record ProductDto(
    int Id,
    int FarmerId,
    string Name,
    string Category,
    string Unit,
    decimal Price,
    int Stock,
    string? PhotoUrl,
    IReadOnlyList<int> SeasonMonths)
{
    public static ProductDto From(Product product) => new(
        product.Id,
        product.FarmerId,
        product.Name,
        product.Category,
        product.Unit,
        product.Price,
        product.Stock,
        product.PhotoUrl,
        [.. product.SeasonMonths]);
}

public sealed record CourierDto(int Id, string Name);

public sealed record ReviewDto(int Id, int OrderId, int Rating, string? Comment, DateTimeOffset At)
{
    public static ReviewDto From(Review review) => new(review.Id, review.OrderId, review.Rating, review.Comment, review.At);
}

public sealed record OrderLineDto(int ProductId, string Name, string Unit, decimal UnitPrice, int Quantity, decimal Total);

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
    IReadOnlyList<StatusChangeDto> History)
{
    public static OrderDto ForBuyer(Order order) => From(order, order.DeliveryCode);

    /// <summary>Фермер і кур'єр не бачать коду вручення: його називає покупець при отриманні.</summary>
    public static OrderDto ForStaff(Order order) => From(order, deliveryCode: null);

    private static OrderDto From(Order order, string? deliveryCode) => new(
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
        [.. order.History.Select(h => new StatusChangeDto(h.Status, h.Status.Title(), h.At))]);
}
