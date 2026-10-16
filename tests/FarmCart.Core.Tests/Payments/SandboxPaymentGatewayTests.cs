namespace FarmCart.Core.Tests.Payments;

public sealed class SandboxPaymentGatewayTests
{
    private readonly SandboxPaymentGateway _gateway = new();

    [Fact]
    public void Charge_WithSameReference_ReturnsExistingChargeWithoutChargingAgain()
    {
        var first = _gateway.Charge("tok_visa", 100m, "order-1001");
        var retry = _gateway.Charge("tok_visa", 100m, "order-1001");

        Assert.True(first.Succeeded);
        Assert.Equal(first.ChargeId, retry.ChargeId);
        Assert.Single(_gateway.Charges);
    }

    [Theory]
    [InlineData(SandboxPaymentGateway.DeclinedToken, "Банк відхилив оплату")]
    [InlineData("4111111111111111", "Недійсний платіжний токен")]
    public void Charge_DeclinedOrInvalidToken_Fails(string token, string reason)
    {
        var result = _gateway.Charge(token, 100m, "order-1002");

        Assert.False(result.Succeeded);
        Assert.StartsWith(reason, result.DeclineReason);
        Assert.Empty(_gateway.Charges);
    }

    [Fact]
    public void Refund_MoreThanCharged_Throws()
    {
        var charge = _gateway.Charge("tok_mastercard", 100m, "order-1003");
        _gateway.Refund(charge.ChargeId!, 60m);

        Assert.Throws<InvalidOperationException>(() => _gateway.Refund(charge.ChargeId!, 41m));
        Assert.Equal(60m, _gateway.Charges[0].Refunded);
    }
}
