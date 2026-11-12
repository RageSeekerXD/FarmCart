namespace FarmCart.Core;

public sealed class Product
{
    public required int Id { get; init; }

    public required int FarmerId { get; init; }

    /// <summary>Назва двома мовами (BE-9).</summary>
    public required LocalizedText Name { get; set; }

    /// <summary>Код категорії з довідника <see cref="Reference.Categories"/>: «vegetables», «dairy».</summary>
    public required string Category { get; init; }

    /// <summary>Код одиниці продажу з довідника <see cref="Reference.Units"/>: «kg», «jar-0.5l».</summary>
    public required string UnitCode { get; init; }

    /// <summary>Одиниця продажу словами: «кг» / «kg», «банка 0,5 л» / «0.5 l jar».</summary>
    public required LocalizedText Unit { get; init; }

    public decimal Price { get; set; }

    public int Stock { get; set; }

    public string? PhotoUrl { get; init; }

    /// <summary>Місяці сезону (1-12); порожня множина - товар доступний цілий рік.</summary>
    public IReadOnlySet<int> SeasonMonths { get; set; } = new HashSet<int>();

    public bool IsInSeason(int month) => SeasonMonths.Count == 0 || SeasonMonths.Contains(month);
}
