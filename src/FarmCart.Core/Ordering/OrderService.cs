namespace FarmCart.Core;

public sealed record CheckoutRequest(
    string Address,
    int SlotId,
    PaymentMethod PaymentMethod,
    string? PaymentToken = null,
    string? PromoCode = null,
    string? Comment = null);

public sealed record SlotView(int Id, DateTimeOffset Start, DateTimeOffset End, int Remaining);

/// <summary>
/// US-05, US-06 (B-FR-03, B-FR-04, B-NFR-02): оформлення й оплата замовлення одним атомарним кроком.
/// Якщо оплату відхилено, нічого не змінюється: замовлення не створюється, кошик і залишки зберігаються.
/// </summary>
public sealed class OrderService(InMemoryStore store, IPaymentGateway payments, INotifier notifier, IClock clock)
{
    /// <summary>Довжина коду вручення, який покупець називає кур'єру (US-09).</summary>
    public const int DeliveryCodeDigits = 4;

    public IReadOnlyList<SlotView> AvailableSlots()
    {
        lock (store.Sync)
        {
            return [.. store.Slots.Values
                .Where(slot => slot.Start > clock.Now)
                .OrderBy(slot => slot.Start)
                .Select(slot => new SlotView(slot.Id, slot.Start, slot.End, slot.Capacity - Taken(slot)))];
        }
    }

    public Order PlaceOrder(User buyer, CheckoutRequest request, string? idempotencyKey = null)
    {
        lock (store.Sync)
        {
            if (FindPlaced(buyer, idempotencyKey) is { } placed)
            {
                return placed;
            }

            var cart = store.CartOf(buyer.Id);
            var lines = SnapshotLines(cart);
            var address = RequireAddress(request.Address);
            var slot = FreeSlot(request.SlotId);
            var promo = ResolvePromo(request.PromoCode, lines.Sum(line => line.Total));
            var discountPercent = promo?.Percent ?? 0;
            var total = Order.TotalFor(lines, discountPercent);

            // Кошти списуються до створення замовлення: відхилена оплата нічого не змінює й не займає номер (DEF-02).
            var chargeId = ChargeUnlessCash(request, total, ChargeReference(buyer, idempotencyKey));
            var order = new Order(chargeId, total)
            {
                Id = store.NextId<Order>(),
                BuyerId = buyer.Id,
                FarmerId = cart.FarmerId!.Value,
                Lines = lines,
                Address = address,
                Slot = slot,
                Comment = request.Comment,
                PromoCode = promo?.Code,
                DiscountPercent = discountPercent,
                PaymentMethod = request.PaymentMethod,
                DeliveryCode = SecretCode.Digits(DeliveryCodeDigits),
            };
            Register(order, idempotencyKey);
            NotifyPlaced(order);
            return order;
        }
    }

    public IReadOnlyList<Order> MyOrders(User buyer)
    {
        lock (store.Sync)
        {
            return [.. store.Orders.Values.Where(o => o.BuyerId == buyer.Id).OrderByDescending(o => o.Id)];
        }
    }

    public Order MyOrder(User buyer, int orderId)
    {
        lock (store.Sync)
        {
            return store.BuyerOrder(buyer, orderId);
        }
    }

    /// <summary>B-NFR-02: повторний запит із тим самим Idempotency-Key повертає вже оформлене замовлення.</summary>
    private Order? FindPlaced(User buyer, string? idempotencyKey) =>
        idempotencyKey is not null && store.OrderKeys.TryGetValue((buyer.Id, idempotencyKey), out var orderId)
            ? store.Orders[orderId]
            : null;

    /// <summary>Ідентифікатор платежу для провайдера: повтор із тим самим ключем не спише кошти вдруге.</summary>
    private static string ChargeReference(User buyer, string? idempotencyKey) =>
        idempotencyKey is null ? $"checkout-{Guid.NewGuid():N}" : $"buyer-{buyer.Id}-{idempotencyKey}";

    private static string RequireAddress(string? address) =>
        string.IsNullOrWhiteSpace(address)
            ? throw Fail.Validation("address_required", "Вкажіть адресу доставки")
            : address.Trim();

    /// <summary>Резервує залишки, фіксує статус «оформлено», зберігає замовлення з ключем ідемпотентності й очищає кошик.</summary>
    private void Register(Order order, string? idempotencyKey)
    {
        foreach (var line in order.Lines)
        {
            store.Products[line.ProductId].Stock -= line.Quantity;
        }

        order.RecordStatus(OrderStatus.Placed, clock.Now);
        store.Orders.Add(order.Id, order);
        if (idempotencyKey is not null)
        {
            store.OrderKeys[(order.BuyerId, idempotencyKey)] = order.Id;
        }

        store.Carts.Remove(order.BuyerId);
    }

    private void NotifyPlaced(Order order)
    {
        notifier.Push(order.BuyerId, $"Замовлення №{order.Id} оформлено на {Money.Format(order.Total)}");
        notifier.Push(store.Farmers[order.FarmerId].UserId, $"Нове замовлення №{order.Id} на {Money.Format(order.Total)}");
    }

    private List<OrderLine> SnapshotLines(Cart cart)
    {
        if (cart.Quantities.Count == 0)
        {
            throw Fail.Validation("cart_empty", "Кошик порожній");
        }

        var items = cart.Quantities.Select(item => (Product: store.Products[item.Key], Quantity: item.Value)).ToList();
        var missing = items
            .Where(x => x.Product.Stock < x.Quantity)
            .Select(x => $"«{x.Product.Name}» (доступно {x.Product.Stock})")
            .ToList();
        if (missing.Count > 0)
        {
            throw Fail.Conflict("out_of_stock", $"Недостатньо на складі: {string.Join(", ", missing)}");
        }

        return [.. items.Select(x => new OrderLine(x.Product.Id, x.Product.Name, x.Product.Unit, x.Product.Price, x.Quantity))];
    }

    private DeliverySlot FreeSlot(int slotId)
    {
        var slot = store.Slots.GetValueOrDefault(slotId)
            ?? throw Fail.NotFound("slot_not_found", $"Слот доставки #{slotId} не знайдено");
        if (slot.Start <= clock.Now)
        {
            throw Fail.Validation("slot_in_past", "Цей слот доставки вже недоступний");
        }

        return Taken(slot) < slot.Capacity
            ? slot
            : throw Fail.Conflict("slot_full", $"Слот {slot.Start:dd.MM HH:mm}-{slot.End:HH:mm} заповнений, оберіть інший");
    }

    private int Taken(DeliverySlot slot) =>
        store.Orders.Values.Count(o => o.Slot.Id == slot.Id && o.Status != OrderStatus.Rejected);

    private PromoCode? ResolvePromo(string? code, decimal subtotal)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            return null;
        }

        var promo = store.PromoCodes.GetValueOrDefault(code.Trim())
            ?? throw Fail.Validation("promo_unknown", $"Промокоду «{code.Trim()}» не існує");
        if (promo.ValidUntil < clock.Now)
        {
            throw Fail.Validation("promo_expired", $"Строк дії промокоду {promo.Code} минув");
        }

        return subtotal >= promo.MinTotal
            ? promo
            : throw Fail.Validation("promo_min_total", $"Промокод {promo.Code} діє для замовлень від {Money.Format(promo.MinTotal)}");
    }

    /// <summary>Оплата карткою, Apple Pay чи Google Pay списується за токеном; готівку отримують під час вручення.</summary>
    private string? ChargeUnlessCash(CheckoutRequest request, decimal total, string reference) =>
        request.PaymentMethod == PaymentMethod.Cash ? null : Charge(request.PaymentToken, total, reference);

    private string Charge(string? token, decimal amount, string reference)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            throw Fail.Validation("payment_token_required", "Для оплати карткою потрібен токен платіжного провайдера");
        }

        var result = payments.Charge(token, amount, reference);
        return result.Succeeded
            ? result.ChargeId!
            : throw Fail.PaymentDeclined("payment_declined", result.DeclineReason ?? "Оплату відхилено");
    }
}
