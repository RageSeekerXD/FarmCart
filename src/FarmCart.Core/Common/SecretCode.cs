using System.Security.Cryptography;

namespace FarmCart.Core;

/// <summary>Випадкові цифрові коди з криптографічного генератора: код входу з SMS (US-01) і код вручення (US-09).</summary>
public static class SecretCode
{
    private const string DigitChars = "0123456789";

    /// <summary>Рівномірно випадковий рядок із <paramref name="length"/> цифр; не залежить від культури потоку.</summary>
    public static string Digits(int length) => RandomNumberGenerator.GetString(DigitChars, length);
}
