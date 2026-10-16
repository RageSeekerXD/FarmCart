namespace FarmCart.Core.Tests.Auth;

public sealed class PhoneNumberTests
{
    [Theory]
    [InlineData("+380671234567")]
    [InlineData("+38 (067) 123-45-67")]
    [InlineData("380671234567")]
    [InlineData("0671234567")]
    public void Normalize_AcceptsCommonUkrainianFormats(string input) =>
        Assert.Equal("+380671234567", PhoneNumber.Normalize(input));

    [Theory]
    [InlineData("")]
    [InlineData("12345")]
    [InlineData("+14155552671")]
    [InlineData("+38067123456a")]
    [InlineData("+3806712345678")]
    public void Normalize_RejectsInvalidNumbers(string input)
    {
        var error = Assert.Throws<DomainException>(() => PhoneNumber.Normalize(input));

        Assert.Equal("phone_invalid", error.Code);
    }
}
