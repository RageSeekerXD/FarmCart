namespace FarmCart.Core;

public interface IPaymentGateway
{
    /// <summary>Списує кошти за токеном. Повторний виклик з тим самим <paramref name="reference"/> не списує вдруге.</summary>
    PaymentResult Charge(string token, decimal amount, string reference);

    void Refund(string chargeId, decimal amount);
}

public sealed record PaymentResult(bool Succeeded, string? ChargeId, string? DeclineReason);

public sealed class SandboxCharge(string id, decimal amount)
{
    public string Id { get; } = id;

    public decimal Amount { get; } = amount;

    public decimal Refunded { get; set; }
}

/// <summary>
/// Пісочниця платіжного провайдера (тестовий режим на кшталт Stripe чи LiqPay). Картку токенізує SDK
/// провайдера на пристрої покупця, тож FarmCart отримує лише токен: tok_visa, tok_mastercard,
/// tok_applepay, tok_googlepay - успішна оплата, tok_declined - відмова банку.
/// </summary>
public sealed class SandboxPaymentGateway : IPaymentGateway
{
    public const string DeclinedToken = "tok_declined";
    private readonly Dictionary<string, SandboxCharge> _chargesByReference = [];
    private readonly Lock _sync = new();

    public IReadOnlyList<SandboxCharge> Charges
    {
        get
        {
            lock (_sync)
            {
                return [.. _chargesByReference.Values];
            }
        }
    }

    public PaymentResult Charge(string token, decimal amount, string reference)
    {
        lock (_sync)
        {
            if (_chargesByReference.TryGetValue(reference, out var existing))
            {
                return new PaymentResult(true, existing.Id, null);
            }

            if (token == DeclinedToken)
            {
                return new PaymentResult(false, null, "Банк відхилив оплату: недостатньо коштів на картці");
            }

            if (!token.StartsWith("tok_", StringComparison.Ordinal))
            {
                return new PaymentResult(false, null, "Недійсний платіжний токен");
            }

            var charge = new SandboxCharge($"ch_{_chargesByReference.Count + 1:D4}", amount);
            _chargesByReference.Add(reference, charge);
            return new PaymentResult(true, charge.Id, null);
        }
    }

    public void Refund(string chargeId, decimal amount)
    {
        lock (_sync)
        {
            var charge = _chargesByReference.Values.Single(c => c.Id == chargeId);
            if (charge.Refunded + amount > charge.Amount)
            {
                throw new InvalidOperationException($"Повернення {amount} перевищує залишок платежу {charge.Id}");
            }

            charge.Refunded += amount;
        }
    }
}
