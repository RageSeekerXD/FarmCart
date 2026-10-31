namespace FarmCart.Core;

/// <summary>
/// Життєвий цикл замовлення (B-FR-05): таблиця дозволених переходів, історія статусів і push-сповіщення покупцю.
/// Виділено рефакторингом в ітерації 3 замість однакових перевірок і записів у кожній операції.
/// </summary>
public sealed class OrderWorkflow(INotifier notifier, IClock clock)
{
    private static readonly Dictionary<OrderStatus, OrderStatus[]> Transitions = new()
    {
        [OrderStatus.Placed] = [OrderStatus.Accepted, OrderStatus.Rejected],
        [OrderStatus.Accepted] = [OrderStatus.Assembling],
        [OrderStatus.Assembling] = [OrderStatus.InTransit],
        [OrderStatus.InTransit] = [OrderStatus.Delivered],
    };

    public static bool CanMove(OrderStatus from, OrderStatus to) =>
        Transitions.TryGetValue(from, out var allowed) && allowed.Contains(to);

    /// <summary>Перевірка до побічних дій операції (повернення коштів, зміна залишків).</summary>
    public static void EnsureCanMove(Order order, OrderStatus to)
    {
        if (!CanMove(order.Status, to))
        {
            throw Fail.Conflict("invalid_status", $"Замовлення №{order.Id} має статус «{order.Status.Title()}»: перехід у «{to.Title()}» неможливий");
        }
    }

    public void Move(Order order, OrderStatus to, string details = "")
    {
        EnsureCanMove(order, to);
        order.RecordStatus(to, clock.Now);
        notifier.Push(order.BuyerId, $"Замовлення №{order.Id}: {to.Title()}{details}");
    }
}
