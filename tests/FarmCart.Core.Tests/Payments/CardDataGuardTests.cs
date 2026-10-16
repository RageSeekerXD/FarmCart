namespace FarmCart.Core.Tests.Payments;

/// <summary>US-06 (B-FR-04, PCI DSS): номер картки не повинен потрапляти на сервери FarmCart.</summary>
public sealed class CardDataGuardTests
{
    [Theory]
    [InlineData("4111111111111111", true)]
    [InlineData("5555555555554444", true)]
    [InlineData("378282246310005", true)]
    [InlineData("79927398713", true)]
    [InlineData("4111111111111112", false)]
    [InlineData("5555555555554443", false)]
    public void PassesLuhn_ValidatesCheckDigit(string digits, bool expected) =>
        Assert.Equal(expected, CardDataGuard.PassesLuhn(digits));

    [Theory]
    [InlineData("4111111111111111")]
    [InlineData("Оплачу карткою 4111 1111 1111 1111, передзвоніть")]
    [InlineData("{\"comment\":\"5555-5555-5555-4444\"}")]
    [InlineData("{\"token\":4111111111111111}")]
    [InlineData("amex 3782 822463 10005")]
    public void ContainsCardNumber_DetectsCardInAnyText(string text) =>
        Assert.True(CardDataGuard.ContainsCardNumber(text));

    // DEF-01: приймальний тест US-06.3 показав, що System.Text.Json екранує кирилицю як а,
    // і цифри перед номером картки «з'їдали» його в регулярному виразі. Тест відтворює дефект.
    [Theory]
    [InlineData("{\"comment\":\"\\u043A\\u0430 4111 1111 1111 1111\"}")]
    [InlineData("12 4111 1111 1111 1111")]
    [InlineData("2026-10-17 5555-5555-5555-4444")]
    public void ContainsCardNumber_CardPrecededByOtherDigits_IsStillDetected(string text) =>
        Assert.True(CardDataGuard.ContainsCardNumber(text));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("tok_visa")]
    [InlineData("+380 67 123 45 67")]
    [InlineData("Замовлення №1001, код вручення 4821")]
    [InlineData("4111 1111 1111 1112")]
    [InlineData("41111111111111111111111")]
    public void ContainsCardNumber_IgnoresPhonesCodesAndInvalidNumbers(string? text) =>
        Assert.False(CardDataGuard.ContainsCardNumber(text));
}
