using System.Globalization;

namespace FarmCart.Core;

public sealed record DeliveryTask(
    int OrderId,
    DateTimeOffset SlotStart,
    DateTimeOffset SlotEnd,
    LocalizedText PickupFrom,
    string Address,
    int Items,
    decimal AmountToCollect,
    string RouteUrl);

/// <summary>
/// US-09 (B-FR-11): кур'єр бачить свої доставки з маршрутом і закриває їх лише з кодом вручення. Якщо вручити не вдалося,
/// кур'єр фіксує причину, а покупець обирає новий час - і замовлення знову «в дорозі» в того самого кур'єра.
/// </summary>
public sealed class DeliveryService(InMemoryStore store, OrderWorkflow workflow, IClock clock)
{
    public IReadOnlyList<DeliveryTask> MyDeliveries(User courier)
    {
        courier.Require(Role.Courier);
        lock (store.Sync)
        {
            return [.. store.Orders.Values
                .Where(o => o.CourierId == courier.Id && o.Status == OrderStatus.InTransit)
                .OrderBy(o => o.Slot.Start)
                .ThenBy(o => o.Id)
                .Select(ToTask)];
        }
    }

    public Order Confirm(User courier, int orderId, string? code)
    {
        courier.Require(Role.Courier);
        lock (store.Sync)
        {
            var order = store.Orders.GetValueOrDefault(orderId);
            if (order is null || order.CourierId != courier.Id)
            {
                throw Fail.NotFound("delivery_not_found", $"Доставку №{orderId} не знайдено серед ваших");
            }

            OrderWorkflow.EnsureCanMove(order, OrderStatus.Delivered);
            if (string.IsNullOrWhiteSpace(code))
            {
                throw Fail.Validation("confirmation_required", "Закрити доставку можна лише з кодом вручення, який назве покупець");
            }

            if (code.Trim() != order.DeliveryCode)
            {
                throw Fail.Validation("delivery_code_invalid", "Невірний код вручення. Уточніть код у покупця");
            }

            order.SettleOnDelivery();
            workflow.Move(order, OrderStatus.Delivered, ". Смачного!");
            return order;
        }
    }

    /// <summary>Кур'єр не зміг вручити замовлення; «інша причина» потребує коментаря, щоб покупець зрозумів, що сталося.</summary>
    public Order ReportFailure(User courier, int orderId, DeliveryProblem problem, string? note)
    {
        courier.Require(Role.Courier);
        if (problem == DeliveryProblem.Other && string.IsNullOrWhiteSpace(note))
        {
            throw Fail.Validation("note_required", "Опишіть, що завадило вручити замовлення");
        }

        lock (store.Sync)
        {
            var order = CourierOrder(courier, orderId);
            OrderWorkflow.EnsureCanMove(order, OrderStatus.DeliveryFailed);
            order.Problem = problem;
            order.ProblemNote = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
            var details = order.ProblemNote is null ? problem.Title() : $"{problem.Title()}: {order.ProblemNote}";
            workflow.Move(order, OrderStatus.DeliveryFailed, $" ({details}). Оберіть новий час доставки.");
            return order;
        }
    }

    /// <summary>Покупець обирає новий слот після невдалої доставки; кур'єр той самий і отримує сповіщення про доставку.</summary>
    public Order Reschedule(User buyer, int orderId, int slotId)
    {
        lock (store.Sync)
        {
            var order = store.BuyerOrder(buyer, orderId);
            if (order.Status != OrderStatus.DeliveryFailed)
            {
                throw Fail.Conflict("invalid_status", $"Замовлення №{order.Id} не потребує перенесення доставки");
            }

            var slot = store.Slots.GetValueOrDefault(slotId)
                ?? throw Fail.NotFound("slot_not_found", $"Слот доставки #{slotId} не знайдено");
            if (slot.Start <= clock.Now)
            {
                throw Fail.Validation("slot_in_past", "Цей слот доставки вже недоступний");
            }

            if (slot.Id != order.Slot.Id && store.Booked(slot.Id) >= slot.Capacity)
            {
                throw Fail.Conflict("slot_full", $"Слот {slot.Start:dd.MM HH:mm}-{slot.End:HH:mm} заповнений, оберіть інший");
            }

            order.Slot = slot;
            workflow.Move(order, OrderStatus.InTransit, $", новий час доставки {slot.Start:dd.MM HH:mm}-{slot.End:HH:mm}");
            return order;
        }
    }

    private Order CourierOrder(User courier, int orderId)
    {
        var order = store.Orders.GetValueOrDefault(orderId);
        return order is not null && order.CourierId == courier.Id
            ? order
            : throw Fail.NotFound("delivery_not_found", $"Доставку №{orderId} не знайдено серед ваших");
    }

    private DeliveryTask ToTask(Order order)
    {
        var farmer = store.Farmers[order.FarmerId];
        var origin = string.Create(CultureInfo.InvariantCulture, $"{farmer.Location.Lat},{farmer.Location.Lon}");
        return new DeliveryTask(
            order.Id,
            order.Slot.Start,
            order.Slot.End,
            farmer.Name,
            order.Address,
            order.Lines.Sum(line => line.Quantity),
            order.PaymentStatus == PaymentStatus.PayOnDelivery ? order.Total : 0m,
            $"https://www.google.com/maps/dir/?api=1&origin={origin}&destination={Uri.EscapeDataString(order.Address)}");
    }
}
