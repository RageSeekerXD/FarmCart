namespace FarmCart.Core;

public sealed class Product
{
    public required int Id { get; init; }

    public required int FarmerId { get; init; }

    public required string Name { get; set; }

    public required string Category { get; init; }

    /// <summary>Одиниця продажу: «кг», «л», «банка 0,5 л».</summary>
    public required string Unit { get; init; }

    public decimal Price { get; set; }

    public int Stock { get; set; }

    public string? PhotoUrl { get; init; }

    /// <summary>Місяці сезону (1-12); порожня множина - товар доступний цілий рік.</summary>
    public IReadOnlySet<int> SeasonMonths { get; set; } = new HashSet<int>();

    public bool IsInSeason(int month) => SeasonMonths.Count == 0 || SeasonMonths.Contains(month);
}
