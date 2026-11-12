namespace FarmCart.Core;

/// <summary>Запис довідника: стабільний код для API та фільтрів і назва двома мовами.</summary>
public sealed record ReferenceItem(string Code, LocalizedText Title);

public sealed record ReferenceData(IReadOnlyList<ReferenceItem> Categories, IReadOnlyList<ReferenceItem> Units);

/// <summary>
/// Довідники каталогу (BE-9). Категорії й одиниці продажу - не вільний текст, а коди:
/// вільний текст фермера неможливо перекласти, а код має назву обома мовами.
/// </summary>
public static class Reference
{
    public static readonly IReadOnlyList<ReferenceItem> Categories =
    [
        new("vegetables", new("Овочі", "Vegetables")),
        new("fruits", new("Фрукти", "Fruits")),
        new("berries", new("Ягоди", "Berries")),
        new("dairy", new("Молочні продукти", "Dairy")),
        new("honey", new("Мед", "Honey")),
        new("meat-eggs", new("М'ясо та яйця", "Meat & eggs")),
        new("bakery", new("Випічка", "Bakery")),
    ];

    public static readonly IReadOnlyList<ReferenceItem> Units =
    [
        new("kg", new("кг", "kg")),
        new("kg-0.5", new("0,5 кг", "0.5 kg")),
        new("kg-0.3", new("0,3 кг", "0.3 kg")),
        new("basket-0.5kg", new("кошик 0,5 кг", "0.5 kg basket")),
        new("l", new("л", "l")),
        new("l-0.5", new("0,5 л", "0.5 l")),
        new("jar-0.5l", new("банка 0,5 л", "0.5 l jar")),
        new("jar-0.25l", new("банка 0,25 л", "0.25 l jar")),
        new("pcs", new("шт.", "pc")),
        new("dozen-10", new("десяток", "pack of 10")),
        new("bunch", new("пучок", "bunch")),
        new("loaf", new("буханець", "loaf")),
    ];

    public static readonly ReferenceData All = new(Categories, Units);

    public static ReferenceItem? Category(string? code) => Find(Categories, code);

    public static ReferenceItem? Unit(string? code) => Find(Units, code);

    private static ReferenceItem? Find(IReadOnlyList<ReferenceItem> items, string? code) =>
        items.FirstOrDefault(item => string.Equals(item.Code, code?.Trim(), StringComparison.OrdinalIgnoreCase));
}
