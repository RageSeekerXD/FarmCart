namespace FarmCart.Core;

/// <summary>Обмеження платних звернень: кожен користувач має окреме ковзне вікно в одну годину.</summary>
public sealed class HourlyLimit(IClock clock, int limit)
{
    private readonly Dictionary<int, Queue<DateTimeOffset>> _attempts = [];
    private readonly Lock _sync = new();

    /// <summary>Зараховує спробу; false - за останню годину спроб уже забагато.</summary>
    public bool TryTake(int userId)
    {
        lock (_sync)
        {
            if (!_attempts.TryGetValue(userId, out var recent))
            {
                _attempts[userId] = recent = new Queue<DateTimeOffset>();
            }

            while (recent.TryPeek(out var oldest) && clock.Now - oldest >= TimeSpan.FromHours(1))
            {
                recent.Dequeue();
            }

            if (recent.Count >= limit)
            {
                return false;
            }

            recent.Enqueue(clock.Now);
            return true;
        }
    }
}
