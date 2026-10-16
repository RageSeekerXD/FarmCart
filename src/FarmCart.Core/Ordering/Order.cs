namespace FarmCart.Core;

public enum OrderStatus
{
    Placed,
    Accepted,
    Assembling,
    InTransit,
    Delivered,
    Rejected,
}

public enum PaymentMethod
{
    Card,
    ApplePay,
    GooglePay,
    Cash,
}

public enum PaymentStatus
{
    Paid,
    PayOnDelivery,
    PaidOnDelivery,
    Refunded,
}

public sealed record DeliverySlot(int Id, DateTimeOffset Start, DateTimeOffset End, int Capacity);

public sealed record PromoCode(string Code, int Percent, decimal MinTotal, DateTimeOffset ValidUntil);

public sealed record OrderLine(int ProductId, string Name, string Unit, decimal UnitPrice, int Quantity)
{
    public decimal Total => UnitPrice * Quantity;
}

public sealed record StatusChange(OrderStatus Status, DateTimeOffset At);

/// <summary>Кошик покупця: товари одного фермера («покупки з одного прилавка»).</summary>
public sealed class Cart
{
    public int? FarmerId { get; set; }

    /// <summary>Кількість за ідентифікатором товару.</summary>
    public Dictionary<int, int> Quantities { get; } = [];
}

public sealed class Order
{
    public required int Id { get; init; }

    public required int BuyerId { get; init; }

    public required int FarmerId { get; init; }

    public required List<OrderLine> Lines { get; init; }

    public required string Address { get; init; }

    public required DeliverySlot Slot { get; init; }

    public string? Comment { get; init; }

    public string? PromoCode { get; init; }

    public int DiscountPercent { get; init; }

    public required PaymentMethod PaymentMethod { get; init; }

    public PaymentStatus PaymentStatus { get; set; }

    public string? ChargeId { get; set; }

    public decimal PaidAmount { get; set; }

    public decimal RefundedAmount { get; set; }

    /// <summary>Код вручення: бачить лише покупець, кур'єр вводить його під час доставки.</summary>
    public required string DeliveryCode { get; init; }

    public OrderStatus Status { get; set; }

    public string? RejectionReason { get; set; }

    public int? CourierId { get; set; }

    public List<StatusChange> History { get; } = [];

    public decimal Subtotal => Lines.Sum(line => line.Total);

    public decimal Discount => DiscountFor(Subtotal, DiscountPercent);

    public decimal Total => Subtotal - Discount;

    public static decimal DiscountFor(decimal subtotal, int percent) =>
        Math.Round(subtotal * percent / 100m, 2, MidpointRounding.AwayFromZero);
}
