namespace FarmCart.Core;

/// <summary>
/// Текст, яким керує система, двома мовами інтерфейсу: українською й англійською (BE-9).
/// Користувацький текст (відгуки, адреси, коментарі) не перекладається й лишається звичайним рядком.
/// </summary>
public sealed record LocalizedText(string Uk, string En)
{
    public const string Ukrainian = "uk";
    public const string English = "en";

    /// <summary>Обидві мови обов'язкові: англомовний покупець не має бачити українських назв, і навпаки.</summary>
    public bool IsComplete => !string.IsNullOrWhiteSpace(Uk) && !string.IsNullOrWhiteSpace(En);

    public string In(string lang) => lang == English ? En : Uk;

    public LocalizedText Trimmed() => new(Uk.Trim(), En.Trim());

    public bool Contains(string text) =>
        Uk.Contains(text, StringComparison.OrdinalIgnoreCase) || En.Contains(text, StringComparison.OrdinalIgnoreCase);

    /// <summary>У повідомленнях ядра (помилки, аудит), які поки що лише українські, текст підставляється українською.</summary>
    public override string ToString() => Uk;
}
