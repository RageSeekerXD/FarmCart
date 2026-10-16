namespace FarmCart.Core;

public sealed record Notification(int UserId, string Text, DateTimeOffset At);

public interface INotifier
{
    void Push(int userId, string text);
}

/// <summary>
/// Push-сповіщення в пам'яті: мобільний клієнт забирає їх через API (B-FR-05).
/// Інтеграцію з FCM/APNs відкладено до релізу 2 - вона не змінює доменної логіки.
/// </summary>
public sealed class InMemoryNotifier(IClock clock) : INotifier
{
    private readonly List<Notification> _sent = [];
    private readonly Lock _sync = new();

    public void Push(int userId, string text)
    {
        lock (_sync)
        {
            _sent.Add(new Notification(userId, text, clock.Now));
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
