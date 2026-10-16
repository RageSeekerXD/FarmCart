namespace FarmCart.Core.Tests.Auth;

/// <summary>US-01 (B-FR-01): вхід за номером телефону з одноразовим кодом.</summary>
public sealed class AuthServiceTests
{
    private const string Phone = "+380671234567";
    private readonly ManualClock _clock = new(new DateTimeOffset(2026, 10, 1, 9, 0, 0, TimeSpan.FromHours(3)));
    private readonly InMemorySmsGateway _sms = new();
    private readonly AuthService _auth;

    public AuthServiceTests() => _auth = new AuthService(new InMemoryStore(), _sms, _clock);

    [Fact]
    public void RequestCode_SendsSixDigitCodeBySms()
    {
        var expiresAt = _auth.RequestCode(Phone);

        Assert.Matches(@"^\d{6}$", _sms.LastCodeFor(Phone));
        Assert.Equal(_clock.Now.AddMinutes(5), expiresAt);
    }

    [Fact]
    public void Verify_WithCorrectCode_RegistersNewBuyer()
    {
        _auth.RequestCode(Phone);

        var session = _auth.Verify(Phone, _sms.LastCodeFor(Phone)!);

        Assert.True(session.IsNewUser);
        Assert.Contains(Role.Buyer, session.User.Roles);
        Assert.Same(session.User, _auth.FindByToken(session.Token));
    }

    [Fact]
    public void Verify_ForKnownPhone_ReturnsSameAccount()
    {
        var first = Login();

        var second = Login();

        Assert.False(second.IsNewUser);
        Assert.Equal(first.User.Id, second.User.Id);
        Assert.NotEqual(first.Token, second.Token);
    }

    [Fact]
    public void Verify_ExactlyFiveMinutesAfterRequest_CodeIsStillValid()
    {
        _auth.RequestCode(Phone);
        _clock.Advance(TimeSpan.FromMinutes(5));

        var session = _auth.Verify(Phone, _sms.LastCodeFor(Phone)!);

        Assert.NotNull(session.Token);
    }

    [Fact]
    public void Verify_CodeOlderThanFiveMinutes_IsExpired()
    {
        _auth.RequestCode(Phone);
        _clock.Advance(TimeSpan.FromMinutes(5) + TimeSpan.FromSeconds(1));

        var error = Assert.Throws<DomainException>(() => _auth.Verify(Phone, _sms.LastCodeFor(Phone)!));

        Assert.Equal("code_expired", error.Code);
    }

    [Fact]
    public void Verify_WithoutRequestedCode_IsRejected()
    {
        var error = Assert.Throws<DomainException>(() => _auth.Verify(Phone, "123456"));

        Assert.Equal("code_not_requested", error.Code);
    }

    [Fact]
    public void Verify_WrongCode_ReportsRemainingAttempts()
    {
        _auth.RequestCode(Phone);

        var error = Assert.Throws<DomainException>(() => _auth.Verify(Phone, WrongCode()));

        Assert.Equal("code_invalid", error.Code);
        Assert.Contains("Залишилось спроб: 4", error.Message);
    }

    [Fact]
    public void Verify_FifthWrongCode_LocksLoginForFifteenMinutes()
    {
        _auth.RequestCode(Phone);
        var code = _sms.LastCodeFor(Phone)!;
        FailAttempts(4);

        var fifth = Assert.Throws<DomainException>(() => _auth.Verify(Phone, WrongCode()));

        Assert.Equal(ErrorKind.TooManyAttempts, fifth.Kind);
        Assert.Equal(ErrorKind.TooManyAttempts, Assert.Throws<DomainException>(() => _auth.Verify(Phone, code)).Kind);
        Assert.Equal(ErrorKind.TooManyAttempts, Assert.Throws<DomainException>(() => _auth.RequestCode(Phone)).Kind);
    }

    [Fact]
    public void Lockout_OneSecondBeforeFifteenMinutes_IsStillActive()
    {
        _auth.RequestCode(Phone);
        FailAttempts(5);
        _clock.Advance(TimeSpan.FromMinutes(15) - TimeSpan.FromSeconds(1));

        var error = Assert.Throws<DomainException>(() => _auth.RequestCode(Phone));

        Assert.Equal("login_locked", error.Code);
        Assert.Contains("1 хв", error.Message);
    }

    [Fact]
    public void Login_AfterLockoutExpires_IsAllowedAgain()
    {
        _auth.RequestCode(Phone);
        FailAttempts(5);
        _clock.Advance(TimeSpan.FromMinutes(15));

        var session = Login();

        Assert.True(session.IsNewUser);
    }

    [Fact]
    public void FailedAttempts_AreNotResetByRequestingNewCode()
    {
        _auth.RequestCode(Phone);
        FailAttempts(4);
        _auth.RequestCode(Phone);

        var error = Assert.Throws<DomainException>(() => _auth.Verify(Phone, WrongCode()));

        Assert.Equal(ErrorKind.TooManyAttempts, error.Kind);
    }

    [Fact]
    public void FindByToken_UnknownToken_ReturnsNull() => Assert.Null(_auth.FindByToken("missing"));

    private Session Login()
    {
        _auth.RequestCode(Phone);
        return _auth.Verify(Phone, _sms.LastCodeFor(Phone)!);
    }

    private void FailAttempts(int count)
    {
        for (var i = 0; i < count; i++)
        {
            Assert.Throws<DomainException>(() => _auth.Verify(Phone, WrongCode()));
        }
    }

    private string WrongCode() => ((int.Parse(_sms.LastCodeFor(Phone)!) + 1) % 1_000_000).ToString("D6");
}
