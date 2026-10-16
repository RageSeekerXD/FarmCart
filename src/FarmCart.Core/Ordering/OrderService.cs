using System.Security.Cryptography;

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
            if (idempotencyKey is not null && store.OrderKeys.TryGetValue((buyer.Id, idempotencyKey), out var existingId))
            {
                return store.Orders[existingId];
            }

            var cart = store.CartOf(buyer.Id);
            var lines = SnapshotLines(cart);
            if (string.IsNullOrWhiteSpace(request.Address))
            {
                throw Fail.Validation("address_required", "Вкажіть адресу доставки");
            }

            var slot = FreeSlot(request.SlotId);
            var subtotal = lines.Sum(line => line.Total);
            var promo = ResolvePromo(request.PromoCode, subtotal);
            var discountPercent = promo?.Percent ?? 0;
            var total = subtotal - Order.DiscountFor(subtotal, discountPercent);

            // Кошти списуються до створення замовлення: відхилена оплата нічого не змінює й не займає номер (DEF-02).
            var chargeId = request.PaymentMethod == PaymentMethod.Cash
                ? null
                : Charge(request.PaymentToken, total, idempotencyKey is null ? $"checkout-{Guid.NewGuid():N}" : $"buyer-{buyer.Id}-{idempotencyKey}");
            var order = new Order
            {
                Id = store.NextId<Order>(),
                BuyerId = buyer.Id,
                FarmerId = cart.FarmerId!.Value,
                Lines = lines,
                Address = request.Address.Trim(),
                Slot = slot,
                Comment = request.Comment,
                PromoCode = promo?.Code,
                DiscountPercent = discountPercent,
                PaymentMethod = request.PaymentMethod,
                PaymentStatus = chargeId is null ? PaymentStatus.PayOnDelivery : PaymentStatus.Paid,
                ChargeId = chargeId,
                PaidAmount = chargeId is null ? 0m : total,
                DeliveryCode = RandomNumberGenerator.GetInt32(0, 10_000).ToString("D4"),
                Status = OrderStatus.Placed,
            };

            foreach (var line in lines)
            {
                store.Products[line.ProductId].Stock -= line.Quantity;
            }

            order.History.Add(new StatusChange(OrderStatus.Placed, clock.Now));
            store.Orders.Add(order.Id, order);
            if (idempotencyKey is not null)
            {
                store.OrderKeys[(buyer.Id, idempotencyKey)] = order.Id;
            }

            store.Carts.Remove(buyer.Id);
            notifier.Push(buyer.Id, $"Замовлення №{order.Id} оформлено на {Money.Format(order.Total)}");
            notifier.Push(store.Farmers[order.FarmerId].UserId, $"Нове замовлення №{order.Id} на {Money.Format(order.Total)}");
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
            var order = store.Orders.GetValueOrDefault(orderId);
            return order is not null && order.BuyerId == buyer.Id
                ? order
                : throw Fail.NotFound("order_not_found", $"Замовлення №{orderId} не знайдено");
        }
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
