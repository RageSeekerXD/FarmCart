using System.Net;
using System.Net.Http.Json;

namespace FarmCart.AcceptanceTests;

/// <summary>US-01 (B-FR-01): «Як покупець, я хочу входити за номером телефону й кодом із SMS, щоб не вигадувати пароль».</summary>
public sealed class PhoneLoginTests
{
    private const string Phone = "+380971234567";

    [Fact(DisplayName = "US-01.1 Новий покупець реєструється за кодом із SMS і отримує сесію")]
    public async Task NewBuyerRegistersWithSmsCode()
    {
        using var app = new FarmCartApp();
        var client = app.CreateClient();

        var requested = await client.PostAsJsonAsync("/api/auth/code", new { phone = "097 123 45 67" });
        var verified = await client.PostAsJsonAsync("/api/auth/verify", new { phone = Phone, code = app.Sms.LastCodeFor(Phone) });

        Assert.Equal(HttpStatusCode.Accepted, requested.StatusCode);
        var session = await verified.Json();
        Assert.True(session.GetProperty("isNewUser").GetBoolean());
        client.DefaultRequestHeaders.Authorization = new("Bearer", session.GetProperty("token").GetString());
        var me = await client.GetJson("/api/me");
        Assert.Equal(Phone, me.GetProperty("phone").GetString());
        Assert.Equal("Buyer", me.GetProperty("roles")[0].GetString());
    }

    [Fact(DisplayName = "US-01.2 Код діє 5 хв: після спливання строку вхід відхиляється")]
    public async Task CodeExpiresAfterFiveMinutes()
    {
        using var app = new FarmCartApp();
        var client = app.CreateClient();
        await client.PostAsJsonAsync("/api/auth/code", new { phone = Phone });
        app.Clock.Advance(TimeSpan.FromMinutes(5) + TimeSpan.FromSeconds(1));

        var verified = await client.PostAsJsonAsync("/api/auth/verify", new { phone = Phone, code = app.Sms.LastCodeFor(Phone) });

        Assert.Equal(HttpStatusCode.BadRequest, verified.StatusCode);
        Assert.Equal("code_expired", await verified.ErrorCode());
    }

    [Fact(DisplayName = "US-01.3 Після 5 хибних спроб вхід блокується на 15 хв, а потім знову доступний")]
    public async Task FiveWrongCodesLockLoginForFifteenMinutes()
    {
        using var app = new FarmCartApp();
        var client = app.CreateClient();
        await client.PostAsJsonAsync("/api/auth/code", new { phone = Phone });
        var code = app.Sms.LastCodeFor(Phone)!;
        var wrong = code == "000000" ? "111111" : "000000";

        var statuses = new List<HttpStatusCode>();
        for (var attempt = 1; attempt <= 5; attempt++)
        {
            statuses.Add((await client.PostAsJsonAsync("/api/auth/verify", new { phone = Phone, code = wrong })).StatusCode);
        }

        var withCorrectCode = await client.PostAsJsonAsync("/api/auth/verify", new { phone = Phone, code });
        app.Clock.Advance(TimeSpan.FromMinutes(15));
        var afterLockout = await client.PostAsJsonAsync("/api/auth/code", new { phone = Phone });
        var login = await client.PostAsJsonAsync("/api/auth/verify", new { phone = Phone, code = app.Sms.LastCodeFor(Phone) });

        Assert.Equal([.. Enumerable.Repeat(HttpStatusCode.BadRequest, 4), HttpStatusCode.TooManyRequests], statuses);
        Assert.Equal(HttpStatusCode.TooManyRequests, withCorrectCode.StatusCode);
        Assert.Equal(HttpStatusCode.Accepted, afterLockout.StatusCode);
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
    }

    [Fact(DisplayName = "US-01.4 Запит без сесії або з чужим токеном відхиляється зі статусом 401")]
    public async Task RequestsWithoutSessionAreUnauthorized()
    {
        using var app = new FarmCartApp();
        var anonymous = app.CreateClient();
        var forged = app.CreateClient();
        forged.DefaultRequestHeaders.Authorization = new("Bearer", "0123456789abcdef");

        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/me")).StatusCode);
        Assert.Equal("session_invalid", await (await forged.GetAsync("/api/me")).ErrorCode());
    }
}
