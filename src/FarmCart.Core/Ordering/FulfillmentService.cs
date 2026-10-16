namespace FarmCart.Core;

/// <summary>Нестача товару, яку фермер виявив під час прийняття замовлення.</summary>
public sealed record Shortage(int ProductId, int Quantity);

/// <summary>US-07 (B-FR-09): фермер приймає, частково виконує або відхиляє замовлення; кошти повертаються автоматично.</summary>
public sealed class FulfillmentService(InMemoryStore store, IPaymentGateway payments, OrderWorkflow workflow)
{
    public IReadOnlyList<Order> Incoming(User farmerUser)
    {
        lock (store.Sync)
        {
            var farmer = store.FarmerOf(farmerUser);
            return [.. store.Orders.Values.Where(o => o.FarmerId == farmer.Id).OrderByDescending(o => o.Id)];
        }
    }

    public Order Accept(User farmerUser, int orderId, IReadOnlyCollection<Shortage>? shortages = null)
    {
        lock (store.Sync)
        {
            var order = FarmerOrder(farmerUser, orderId);
            OrderWorkflow.EnsureCanMove(order, OrderStatus.Accepted);
            var note = shortages is { Count: > 0 } ? ShortageNote(order, RemoveShortages(order, shortages)) : "";
            workflow.Move(order, OrderStatus.Accepted, note);
            return order;
        }
    }

    public Order Reject(User farmerUser, int orderId, string reason)
    {
        if (string.IsNullOrWhiteSpace(reason))
        {
            throw Fail.Validation("reason_required", "Вкажіть причину відхилення");
        }

        lock (store.Sync)
        {
            var order = FarmerOrder(farmerUser, orderId);
            OrderWorkflow.EnsureCanMove(order, OrderStatus.Rejected);
            foreach (var line in order.Lines)
            {
                store.Products[line.ProductId].Stock += line.Quantity;
            }

            var refund = Refund(order, order.PaidAmount - order.RefundedAmount);
            order.RejectionReason = reason.Trim();
            var note = refund > 0 ? $" Кошти {Money.Format(refund)} повернено на картку." : "";
            workflow.Move(order, OrderStatus.Rejected, $" ({order.RejectionReason}).{note}");
            return order;
        }
    }

    /// <summary>US-08 (B-FR-05): фермер почав збирати замовлення.</summary>
    public Order StartAssembling(User farmerUser, int orderId)
    {
        lock (store.Sync)
        {
            var order = FarmerOrder(farmerUser, orderId);
            workflow.Move(order, OrderStatus.Assembling);
            return order;
        }
    }

    /// <summary>US-08, US-09: замовлення передано кур'єру, і воно «в дорозі».</summary>
    public Order HandOver(User farmerUser, int orderId, int courierId)
    {
        lock (store.Sync)
        {
            var order = FarmerOrder(farmerUser, orderId);
            var courier = store.Users.GetValueOrDefault(courierId);
            if (courier is null || !courier.Is(Role.Courier))
            {
                throw Fail.Validation("courier_invalid", $"Кур'єра #{courierId} не знайдено");
            }

            OrderWorkflow.EnsureCanMove(order, OrderStatus.InTransit);
            order.CourierId = courier.Id;
            workflow.Move(order, OrderStatus.InTransit, $", кур'єр {courier.Name}");
            return order;
        }
    }

    public IReadOnlyList<User> Couriers(User farmerUser)
    {
        lock (store.Sync)
        {
            _ = store.FarmerOf(farmerUser); // список кур'єрів бачать лише продавці
            return [.. store.Users.Values.Where(u => u.Is(Role.Courier)).OrderBy(u => u.Id)];
        }
    }

    private static string ShortageNote(Order order, decimal refund) => refund > 0
        ? $". Частини товарів немає, повернено {Money.Format(refund)}"
        : $". Частини товарів немає, до сплати {Money.Format(order.Total)}";

    /// <summary>Зменшує позиції на нестачу й повертає різницю між сплаченим і новою сумою.</summary>
    private decimal RemoveShortages(Order order, IReadOnlyCollection<Shortage> shortages)
    {
        var remaining = order.Lines.ToDictionary(line => line.ProductId, line => line.Quantity);
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

        var reduced = order.Lines
            .Select(line => line with { Quantity = remaining[line.ProductId] })
            .Where(line => line.Quantity > 0)
            .ToList();
        order.Lines.Clear();
        order.Lines.AddRange(reduced);
        return Refund(order, order.PaidAmount - order.RefundedAmount - order.Total);
    }

    private decimal Refund(Order order, decimal amount)
    {
        if (order.ChargeId is null || amount <= 0)
        {
            return 0m;
        }

        payments.Refund(order.ChargeId, amount);
        order.RefundedAmount += amount;
        if (order.RefundedAmount == order.PaidAmount)
        {
            order.PaymentStatus = PaymentStatus.Refunded;
        }

        return amount;
    }

    private Order FarmerOrder(User farmerUser, int orderId)
    {
        var farmer = store.FarmerOf(farmerUser);
        var order = store.Orders.GetValueOrDefault(orderId);
        return order is not null && order.FarmerId == farmer.Id
            ? order
            : throw Fail.NotFound("order_not_found", $"Замовлення №{orderId} не знайдено серед ваших");
    }
}
