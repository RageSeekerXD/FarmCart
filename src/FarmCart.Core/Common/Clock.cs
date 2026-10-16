namespace FarmCart.Core;

/// <summary>Джерело поточного часу. Правила з часом (строк дії коду, блокування, сезонність) тестуються через <see cref="ManualClock"/>.</summary>
public interface IClock
{
    DateTimeOffset Now { get; }
}

public sealed class SystemClock : IClock
{
    public DateTimeOffset Now => DateTimeOffset.Now;
}

/// <summary>Годинник, що рухається лише вручну: тести й симуляції.</summary>
public sealed class ManualClock(DateTimeOffset start) : IClock
{
    public DateTimeOffset Now { get; private set; } = start;

    public void Advance(TimeSpan by) => Now += by;
}
