namespace FarmCart.Core;

/// <summary>Види сповіщень (BE-2): за видом клієнт обирає текст мовою інтерфейсу й екран, який слід оновити.</summary>
public static class NotificationKind
{
    /// <summary>Покупцю: замовлення оформлено. Параметр: total.</summary>
    public const string OrderPlaced = "order.placed";

    /// <summary>Фермеру: надійшло нове замовлення. Параметр: total.</summary>
    public const string OrderNew = "order.new";

    /// <summary>Покупцю: статус замовлення змінився. Параметр: status.</summary>
    public const string OrderStatus = "order.status";

    /// <summary>Кур'єру: йому передано доставку.</summary>
    public const string DeliveryAssigned = "delivery.assigned";
}

/// <summary>
/// Сповіщення користувачу. <see cref="Kind"/>, <see cref="OrderId"/> і <see cref="Params"/> - структура для клієнта,
/// який показує текст мовою інтерфейсу; <see cref="Text"/> лишається українським для сумісності з клієнтами релізу 1.
/// </summary>
public sealed record Notification(
    int Id,
    int UserId,
    string Kind,
    int? OrderId,
    IReadOnlyDictionary<string, string> Params,
    string Text,
    DateTimeOffset At);

public interface INotifier
{
    Notification Push(int userId, string kind, string text, int? orderId = null, IReadOnlyDictionary<string, string>? parameters = null);
}

/// <summary>
/// Сповіщення в пам'яті: клієнт забирає їх через API (B-FR-05), а веб-клієнт ще й отримує одразу через хаб (BE-3).
/// </summary>
public sealed class InMemoryNotifier(IClock clock) : INotifier
{
    private static readonly IReadOnlyDictionary<string, string> NoParams = new Dictionary<string, string>();
    private readonly List<Notification> _sent = [];
    private readonly Lock _sync = new();

    public Notification Push(int userId, string kind, string text, int? orderId = null, IReadOnlyDictionary<string, string>? parameters = null)
    {
        lock (_sync)
        {
            var notification = new Notification(_sent.Count + 1, userId, kind, orderId, parameters ?? NoParams, text, clock.Now);
            _sent.Add(notification);
            return notification;
        }
    }

    public IReadOnlyList<Notification> For(int userId)
    {
        lock (_sync)
        {
            return [.. _sent.Where(n => n.UserId == userId)];
        }
    }
}
