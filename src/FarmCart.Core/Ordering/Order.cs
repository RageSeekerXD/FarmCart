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

/// <summary>Нестача товару, яку фермер виявив під час прийняття замовлення.</summary>
public sealed record Shortage(int ProductId, int Quantity);

/// <summary>Кошик покупця: товари одного фермера («покупки з одного прилавка»).</summary>
public sealed class Cart
{
    public int? FarmerId { get; set; }

    /// <summary>Кількість за ідентифікатором товару.</summary>
    public Dictionary<int, int> Quantities { get; } = [];
}

/// <summary>
/// Замовлення. Позиції, статус і оплату змінюють лише методи замовлення (їх викликають сервіси ядра),
/// тому правила - нестача, повернення коштів, оплата готівкою, історія статусів - записано в одному місці.
/// </summary>
public sealed class Order
{
    private readonly List<OrderLine> _lines = [];
    private readonly List<StatusChange> _history = [];

    /// <summary>Нове замовлення: оплачене через провайдера (платіж <paramref name="chargeId"/> на суму <paramref name="charged"/>)
    /// або з оплатою готівкою при отриманні (<paramref name="chargeId"/> = null).</summary>
    internal Order(string? chargeId, decimal charged)
    {
        ChargeId = chargeId;
        PaidAmount = chargeId is null ? 0m : charged;
        PaymentStatus = chargeId is null ? PaymentStatus.PayOnDelivery : PaymentStatus.Paid;
    }

    public required int Id { get; init; }

    public required int BuyerId { get; init; }

    public required int FarmerId { get; init; }

    /// <summary>Знімок кошика; після оформлення змінюється лише нестачею (<see cref="ApplyShortages"/>).</summary>
    public required IReadOnlyList<OrderLine> Lines
    {
        get => _lines;
        init => _lines.AddRange(value);
    }

    public required string Address { get; init; }

    public required DeliverySlot Slot { get; init; }

    public string? Comment { get; init; }

    public string? PromoCode { get; init; }

    public int DiscountPercent { get; init; }

    public required PaymentMethod PaymentMethod { get; init; }

    public PaymentStatus PaymentStatus { get; private set; }

    public string? ChargeId { get; }

    public decimal PaidAmount { get; private set; }

    public decimal RefundedAmount { get; private set; }

    /// <summary>Код вручення: бачить лише покупець, кур'єр вводить його під час доставки.</summary>
    public required string DeliveryCode { get; init; }

    public OrderStatus Status { get; private set; }

    public string? RejectionReason { get; internal set; }

    public int? CourierId { get; internal set; }

    public IReadOnlyList<StatusChange> History => _history;

    public decimal Subtotal => Lines.Sum(line => line.Total);

    public decimal Discount => DiscountFor(Subtotal, DiscountPercent);

    public decimal Total => TotalFor(_lines, DiscountPercent);

    /// <summary>Сплачено й ще не повернуто.</summary>
    public decimal Unrefunded => PaidAmount - RefundedAmount;

    public static decimal DiscountFor(decimal subtotal, int percent) =>
        Math.Round(subtotal * percent / 100m, 2, MidpointRounding.AwayFromZero);

    /// <summary>Сума до сплати за позиції зі знижкою - одна формула для оформлення (до створення замовлення) і для замовлення.</summary>
    public static decimal TotalFor(IEnumerable<OrderLine> lines, int discountPercent)
    {
        var subtotal = lines.Sum(line => line.Total);
        return subtotal - DiscountFor(subtotal, discountPercent);
    }

    /// <summary>Переводить замовлення в статус і записує зміну в історію; дозволеність переходу перевіряє <see cref="OrderWorkflow"/>.</summary>
    internal void RecordStatus(OrderStatus status, DateTimeOffset at)
    {
        Status = status;
        _history.Add(new StatusChange(status, at));
    }

    /// <summary>Переплата, яку доведеться повернути покупцю, якщо застосувати нестачу; саме замовлення не змінюється.</summary>
    internal decimal OverpaidAfter(IReadOnlyCollection<Shortage> shortages) =>
        Unrefunded - TotalFor(LinesAfter(shortages), DiscountPercent);

    /// <summary>US-07: зменшує позиції на нестачу; позиції, яких не лишилося, зникають із замовлення.</summary>
    internal void ApplyShortages(IReadOnlyCollection<Shortage> shortages)
    {
        var reduced = LinesAfter(shortages);
        _lines.Clear();
        _lines.AddRange(reduced);
    }

    private List<OrderLine> LinesAfter(IReadOnlyCollection<Shortage> shortages)
    {
        var remaining = _lines.ToDictionary(line => line.ProductId, line => line.Quantity);
        foreach (var shortage in shortages)
        {
            if (!remaining.TryGetValue(shortage.ProductId, out var ordered) || shortage.Quantity <= 0 || shortage.Quantity > ordered)
            {
                throw Fail.Validation("shortage_invalid", "Нестача має стосуватися позиції замовлення й не перевищувати замовлену кількість");
            }

            remaining[shortage.ProductId] = ordered - shortage.Quantity;
        }

        if (remaining.Values.All(quantity => quantity == 0))
        {
            throw Fail.Validation("nothing_to_deliver", "Жодного товару немає - відхиліть замовлення");
        }

        return [.. _lines
            .Select(line => line with { Quantity = remaining[line.ProductId] })
            .Where(line => line.Quantity > 0)];
    }

    /// <summary>Фіксує повернення коштів; коли повернено все сплачене, оплата отримує статус «кошти повернено».</summary>
    internal void RegisterRefund(decimal amount)
    {
        RefundedAmount += amount;
        if (RefundedAmount == PaidAmount)
        {
            PaymentStatus = PaymentStatus.Refunded;
        }
    }

    /// <summary>US-09: оплату готівкою фіксують під час вручення - сплачено всю суму замовлення.</summary>
    internal void SettleOnDelivery()
    {
        if (PaymentStatus == PaymentStatus.PayOnDelivery)
        {
            PaymentStatus = PaymentStatus.PaidOnDelivery;
            PaidAmount = Total;
        }
    }
}
