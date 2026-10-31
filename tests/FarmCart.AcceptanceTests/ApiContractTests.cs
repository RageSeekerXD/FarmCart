using System.Net;
using System.Text;
using Microsoft.AspNetCore.Hosting;

namespace FarmCart.AcceptanceTests;

/// <summary>Технічні вимоги до API: перевірка стану сервера й зрозумілі відповіді на некоректні запити.</summary>
public sealed class ApiContractTests
{
    [Fact(DisplayName = "API-01 Перевірка стану сервера повертає версію релізу й час сервера")]
    public async Task HealthReportsReleaseVersionAndServerTime()
    {
        using var app = new FarmCartApp();

        var health = await app.CreateClient().GetJson("/api/health");

        Assert.Equal(("ok", "1.1.0"), (health.Str("status"), health.Str("version")));
        Assert.Equal(app.Clock.Now, health.GetProperty("time").GetDateTimeOffset());
    }

    [Fact(DisplayName = "API-03 Повернення кодів із SMS у відповіді API заборонено в Production")]
    public void SmsCodesCannotBeExposedInProduction()
    {
        using var app = new FarmCartApp().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Production");
            builder.UseSetting("FarmCart:ExposeSmsCodes", "true");
        });

        var error = Assert.Throws<InvalidOperationException>(() => app.CreateClient());

        Assert.Contains("ExposeSmsCodes", error.Message);
    }

    [Fact(DisplayName = "API-02 Некоректний JSON отримує відповідь 400 з поясненням, а не помилку сервера")]
    public async Task MalformedJsonIsBadRequest()
    {
        using var app = new FarmCartApp();

        var response = await app.CreateClient().PostAsync("/api/auth/code", new StringContent("{ phone: ", Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("bad_request", await response.ErrorCode());
    }
}
