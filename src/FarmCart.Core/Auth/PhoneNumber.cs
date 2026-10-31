using System.Text.RegularExpressions;

namespace FarmCart.Core;

/// <summary>Номер мобільного телефону України у форматі +380XXXXXXXXX.</summary>
public static partial class PhoneNumber
{
    public static string Normalize(string? input)
    {
        var compact = Separators().Replace(input ?? "", "");
        var normalized = compact.Length == 10 && compact.StartsWith('0') ? "+38" + compact
            : compact.StartsWith("380", StringComparison.Ordinal) ? "+" + compact
            : compact;
        return UkrainianMobile().IsMatch(normalized)
            ? normalized
            : throw Fail.Validation("phone_invalid", "Вкажіть номер телефону у форматі +380XXXXXXXXX");
    }

    [GeneratedRegex(@"[\s\-()]")]
    private static partial Regex Separators();

    [GeneratedRegex(@"^\+380[0-9]{9}$")]
    private static partial Regex UkrainianMobile();
}
