using System.Diagnostics.CodeAnalysis;
using System.Security.Cryptography;
using System.Text;

namespace FarmCart.Core;

public sealed class OtpState
{
    public string? Code { get; set; }

    public DateTimeOffset ExpiresAt { get; set; }

    public int FailedAttempts { get; set; }

    public DateTimeOffset? LockedUntil { get; set; }
}

public sealed record Session(string Token, User User, bool IsNewUser);

/// <summary>US-01 (B-FR-01): вхід і реєстрація за номером телефону з одноразовим кодом.</summary>
public sealed class AuthService(InMemoryStore store, ISmsGateway sms, IClock clock)
{
    public const int MaxFailedAttempts = 5;
    public const int CodeDigits = 6;
    public static readonly TimeSpan CodeLifetime = TimeSpan.FromMinutes(5);
    public static readonly TimeSpan LockoutPeriod = TimeSpan.FromMinutes(15);

    public DateTimeOffset RequestCode(string phone)
    {
        var number = PhoneNumber.Normalize(phone);
        lock (store.Sync)
        {
            var otp = store.Otps.GetValueOrDefault(number) ?? new OtpState();
            EnsureNotLocked(otp);
            otp.Code = SecretCode.Digits(CodeDigits);
            otp.ExpiresAt = clock.Now + CodeLifetime;
            store.Otps[number] = otp;
            sms.Send(number, $"FarmCart: код входу {otp.Code}. Дійсний {CodeLifetime.TotalMinutes:0} хв.");
            return otp.ExpiresAt;
        }
    }

    public Session Verify(string phone, string code)
    {
        var number = PhoneNumber.Normalize(phone);
        lock (store.Sync)
        {
            var otp = store.Otps.GetValueOrDefault(number)
                ?? throw Fail.Validation("code_not_requested", "Спочатку запросіть код підтвердження");
            EnsureNotLocked(otp);
            if (otp.Code is null || clock.Now > otp.ExpiresAt)
            {
                throw Fail.Validation("code_expired", "Строк дії коду минув. Запросіть новий код");
            }

            if (!SameCode(otp.Code, code))
            {
                RegisterFailedAttempt(otp);
            }

            store.Otps.Remove(number);
            return OpenSession(number);
        }
    }

    public User? FindByToken(string token)
    {
        lock (store.Sync)
        {
            return store.Sessions.TryGetValue(token, out var userId) ? store.Users[userId] : null;
        }
    }

    private Session OpenSession(string phone)
    {
        var user = store.Users.Values.FirstOrDefault(u => u.Phone == phone);
        var isNewUser = user is null;
        user ??= store.AddUser(phone);
        var token = Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(20));
        store.Sessions[token] = user.Id;
        return new Session(token, user, isNewUser);
    }

    /// <summary>Блокування діє 15 хв; після нього лічильник хибних спроб обнуляється.</summary>
    private void EnsureNotLocked(OtpState otp)
    {
        if (otp.LockedUntil is not { } until)
        {
            return;
        }

        if (clock.Now < until)
        {
            var minutes = (int)Math.Ceiling((until - clock.Now).TotalMinutes);
            throw Fail.TooManyAttempts("login_locked", $"Вхід заблоковано після {MaxFailedAttempts} хибних спроб. Спробуйте через {minutes} хв");
        }

        otp.LockedUntil = null;
        otp.FailedAttempts = 0;
    }

    [DoesNotReturn]
    private void RegisterFailedAttempt(OtpState otp)
    {
        otp.FailedAttempts++;
        if (otp.FailedAttempts < MaxFailedAttempts)
        {
            throw Fail.Validation("code_invalid", $"Невірний код. Залишилось спроб: {MaxFailedAttempts - otp.FailedAttempts}");
        }

        otp.Code = null;
        otp.LockedUntil = clock.Now + LockoutPeriod;
        throw Fail.TooManyAttempts("login_locked", $"Вхід заблоковано на {LockoutPeriod.TotalMinutes:0} хв після {MaxFailedAttempts} хибних спроб");
    }

    // Порівняння за сталий час не дає підбирати код за часом відповіді.
    private static bool SameCode(string expected, string? actual) =>
        CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(expected), Encoding.ASCII.GetBytes(actual ?? ""));
}
