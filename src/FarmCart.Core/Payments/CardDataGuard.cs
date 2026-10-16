using System.Text.RegularExpressions;

namespace FarmCart.Core;

/// <summary>
/// US-06 (B-FR-04, PCI DSS): виявляє номер платіжної картки в довільному тексті запиту -
/// 13-19 цифр (можливо, групами через пробіл чи дефіс), що проходять перевірку Луна.
/// Картки токенізує SDK провайдера на пристрої покупця, тому сервер не має бачити жодного номера.
/// </summary>
public static partial class CardDataGuard
{
    private const int MinLength = 13;
    private const int MaxLength = 19;

    public static bool ContainsCardNumber(string? text) =>
        !string.IsNullOrEmpty(text)
        && DigitGroups().Matches(text).Any(match => ContainsLuhnNumber(match.Value.Split(' ', '-')));

    /// <summary>Алгоритм Луна: кожна друга цифра справа подвоюється, сума має ділитися на 10.</summary>
    public static bool PassesLuhn(string digits)
    {
        var sum = 0;
        var doubled = false;
        for (var i = digits.Length - 1; i >= 0; i--)
        {
            var digit = digits[i] - '0';
            if (doubled)
            {
                digit = digit * 2 > 9 ? (digit * 2) - 9 : digit * 2;
            }

            sum += digit;
            doubled = !doubled;
        }

        return sum % 10 == 0;
    }

    /// <summary>
    /// Перевіряє кожен проміжок сусідніх груп цифр довжиною 13-19. Сусідні цифри (наприклад, з
    /// екранування а у JSON) не можуть «сховати» номер картки (дефект DEF-01).
    /// </summary>
    private static bool ContainsLuhnNumber(string[] groups)
    {
        for (var first = 0; first < groups.Length; first++)
        {
            var digits = "";
            for (var last = first; last < groups.Length && digits.Length < MaxLength; last++)
            {
                digits += groups[last];
                if (digits.Length is >= MinLength and <= MaxLength && PassesLuhn(digits))
                {
                    return true;
                }
            }
        }

        return false;
    }

    [GeneratedRegex("[0-9]+(?:[ -][0-9]+)*")]
    private static partial Regex DigitGroups();
}
