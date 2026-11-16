namespace FarmCart.Core;

/// <param name="Details">Під'їзд, поверх і код домофону - кур'єрові не доведеться телефонувати.</param>
/// <param name="Lat">Точка доставки на мапі (з підказки адреси); разом із <paramref name="Lon"/> або жодної.</param>
public sealed record CheckoutRequest(
    string Address,
    int SlotId,
    PaymentMethod PaymentMethod,
    string? PaymentToken = null,
    string? PromoCode = null,
    string? Comment = null,
    AddressDetails? Details = null,
    double? Lat = null,
    double? Lon = null);

/// <summary>Як потрапити до покупця: під'їзд, поверх, код домофону. Порожні поля - null.</summary>
public sealed record AddressDetails(string? Entrance, string? Floor, string? Intercom)
{
    public const int MaxLength = 40;

    /// <summary>Обрізані значення; усі порожні - null (деталей немає); задовге - помилка.</summary>
    public static AddressDetails? Normalize(AddressDetails? details)
    {
        static string? Clean(string? value) =>
            string.IsNullOrWhiteSpace(value) ? null
            : value.Trim().Length > MaxLength ? throw Fail.Validation("address_details_too_long", $"Під'їзд, поверх і домофон - не довше {MaxLength} символів")
            : value.Trim();

        if (details is null)
        {
            return null;
        }

        var clean = new AddressDetails(Clean(details.Entrance), Clean(details.Floor), Clean(details.Intercom));
        return clean is { Entrance: null, Floor: null, Intercom: null } ? null : clean;
    }
}

public sealed record SlotView(int Id, DateTimeOffset Start, DateTimeOffset End, int Remaining, int Capacity);

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
                .Select(slot => new SlotView(slot.Id, slot.Start, slot.End, slot.Capacity - Taken(slot), slot.Capacity))];
        }
    }

    /// <summary>Оформлення; повертає перше з замовлень (усі номери - у <see cref="Order.CheckoutOrderIds"/>).</summary>
    public Order PlaceOrder(User buyer, CheckoutRequest request, string? idempotencyKey = null) =>
        Checkout(buyer, request, idempotencyKey)[0];

    /// <summary>
    /// Оформлення кошика (п. 8 покращень): по замовленню на кожну ферму, з одним списанням коштів на всю суму.
    /// Кожне замовлення має власну сплачену суму, тож відхилення, скасування й нестача повертають кошти окремо.
    /// Промокод перевіряється за сумою всього кошика; у слоті доставки має бути місце для кожного замовлення.
    /// </summary>
    public IReadOnlyList<Order> Checkout(User buyer, CheckoutRequest request, string? idempotencyKey = null)
    {
        lock (store.Sync)
        {
            if (FindPlaced(buyer, idempotencyKey) is { } placed)
            {
                return [.. placed.CheckoutOrderIds.Select(id => store.Orders[id])];
            }

            var lines = SnapshotLines(store.CartOf(buyer.Id));
            var address = RequireAddress(request.Address);
            var details = AddressDetails.Normalize(request.Details);
            var dropOff = DropOff(request.Lat, request.Lon);
            var farms = lines.GroupBy(x => x.FarmerId).ToList();
            var slot = FreeSlot(request.SlotId, places: farms.Count);
            var promo = ResolvePromo(request.PromoCode, lines.Sum(x => x.Line.Total));
            var discountPercent = promo?.Percent ?? 0;
            var totals = farms.Select(farm => Order.TotalFor(farm.Select(x => x.Line), discountPercent)).ToList();

            // Кошти списуються до створення замовлень: відхилена оплата нічого не змінює й не займає номерів (DEF-02).
            var chargeId = ChargeUnlessCash(request, totals.Sum(), ChargeReference(buyer, idempotencyKey));
            var orders = farms.Select((farm, index) => new Order(chargeId, totals[index])
            {
                Id = store.NextId<Order>(),
                BuyerId = buyer.Id,
                FarmerId = farm.Key,
                Lines = [.. farm.Select(x => x.Line)],
                Address = address,
                Details = details,
                DropOff = dropOff,
                Slot = slot,
                Comment = string.IsNullOrWhiteSpace(request.Comment) ? null : request.Comment.Trim(),
                PromoCode = promo?.Code,
                DiscountPercent = discountPercent,
                PaymentMethod = request.PaymentMethod,
                DeliveryCode = SecretCode.Digits(DeliveryCodeDigits),
            }).ToList();
            IReadOnlyList<int> ids = [.. orders.Select(order => order.Id)];
            foreach (var order in orders)
            {
                order.CheckoutOrderIds = ids;
                Register(order);
                NotifyPlaced(order);
            }

            if (idempotencyKey is not null)
            {
                store.OrderKeys[(buyer.Id, idempotencyKey)] = orders[0].Id;
            }

            store.Carts.Remove(buyer.Id);
            return orders;
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

    /// <summary>Точка доставки необов'язкова, але якщо є - обидві координати й у межах Землі.</summary>
    private static GeoPoint? DropOff(double? lat, double? lon) =>
        (lat, lon) switch
        {
            (null, null) => null,
            ({ } latitude, { } longitude) when new GeoPoint(latitude, longitude).IsValid => new GeoPoint(latitude, longitude),
            _ => throw Fail.Validation("location_invalid", "Некоректні координати точки доставки"),
        };

    private static string RequireAddress(string? address) =>
        string.IsNullOrWhiteSpace(address)
            ? throw Fail.Validation("address_required", "Вкажіть адресу доставки")
            : address.Trim();

    /// <summary>Резервує залишки, фіксує статус «оформлено» й зберігає замовлення.</summary>
    private void Register(Order order)
    {
        foreach (var line in order.Lines)
        {
            store.Products[line.ProductId].Stock -= line.Quantity;
        }

        order.RecordStatus(OrderStatus.Placed, clock.Now);
        store.Orders.Add(order.Id, order);
    }

    private void NotifyPlaced(Order order)
    {
        var total = new Dictionary<string, string> { ["total"] = order.Total.ToString(System.Globalization.CultureInfo.InvariantCulture) };
        notifier.Push(order.BuyerId, NotificationKind.OrderPlaced, $"Замовлення №{order.Id} оформлено на {Money.Format(order.Total)}", order.Id, total);
        notifier.Push(store.Farmers[order.FarmerId].UserId, NotificationKind.OrderNew, $"Нове замовлення №{order.Id} на {Money.Format(order.Total)}", order.Id, total);
    }

    private List<(int FarmerId, OrderLine Line)> SnapshotLines(Cart cart)
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

        return [.. items.Select(x => (x.Product.FarmerId, new OrderLine(x.Product.Id, x.Product.Name, x.Product.Unit, x.Product.Price, x.Quantity)))];
    }

    private DeliverySlot FreeSlot(int slotId, int places)
    {
        var slot = store.Slots.GetValueOrDefault(slotId)
            ?? throw Fail.NotFound("slot_not_found", $"Слот доставки #{slotId} не знайдено");
        if (slot.Start <= clock.Now)
        {
            throw Fail.Validation("slot_in_past", "Цей слот доставки вже недоступний");
        }

        return Taken(slot) + places <= slot.Capacity
            ? slot
            : throw Fail.Conflict("slot_full", $"Слот {slot.Start:dd.MM HH:mm}-{slot.End:HH:mm} заповнений, оберіть інший");
    }

    private int Taken(DeliverySlot slot) => store.Booked(slot.Id);

    private PromoCode? ResolvePromo(string? code, decimal subtotal)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            return null;
        }

        var promo = store.PromoCodes.GetValueOrDefault(code.Trim())
            ?? throw Fail.Validation("promo_unknown", $"Промокоду «{code.Trim()}» не існує");
        if (!promo.Active)
        {
            throw Fail.Validation("promo_inactive", $"Промокод {promo.Code} більше не діє");
        }

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
