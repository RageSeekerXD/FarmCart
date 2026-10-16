using System.Globalization;

namespace FarmCart.Core;

public static class Money
{
    private static readonly CultureInfo Ukrainian = CultureInfo.GetCultureInfo("uk-UA");

    /// <summary>Сума для повідомлень користувачу: «1 234,50 грн».</summary>
    public static string Format(decimal amount) => $"{amount.ToString("N2", Ukrainian)} грн";
}
