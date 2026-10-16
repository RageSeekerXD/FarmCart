using System.Globalization;

namespace FarmCart.Core;

public sealed record DeliveryTask(
    int OrderId,
    DateTimeOffset SlotStart,
    DateTimeOffset SlotEnd,
    string PickupFrom,
    string Address,
    int Items,
    decimal AmountToCollect,
    string RouteUrl);

/// <summary>US-09 (B-FR-11): кур'єр бачить свої доставки з маршрутом і закриває їх лише з кодом вручення.</summary>
public sealed class DeliveryService(InMemoryStore store, OrderWorkflow workflow)
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

            if (order.PaymentStatus == PaymentStatus.PayOnDelivery)
            {
                order.PaymentStatus = PaymentStatus.PaidOnDelivery;
                order.PaidAmount = order.Total;
            }

            workflow.Move(order, OrderStatus.Delivered, ". Смачного!");
            return order;
        }
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
