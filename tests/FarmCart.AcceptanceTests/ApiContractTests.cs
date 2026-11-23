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

        Assert.Equal(("ok", "2.1.0"), (health.Str("status"), health.Str("version")));
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

    [Fact(DisplayName = "BE-7 Зафіксований час сервера: наскрізні тести веб-клієнта не залежать від дня запуску")]
    public async Task ServerTimeCanBeFixedOutsideProduction()
    {
        var moment = new DateTimeOffset(2026, 10, 1, 9, 0, 0, TimeSpan.FromHours(3));
        using var app = new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("FarmCart:SeedDemoData", "true");
            builder.UseSetting("FarmCart:FixedTime", "2026-10-01T09:00:00+03:00");
        });
        var client = app.CreateClient();

        var health = await client.GetJson("/api/health");
        var slots = await client.GetJson("/api/slots");
        var catalog = await client.GetJson("/api/catalog");

        Assert.Equal(moment, health.GetProperty("time").GetDateTimeOffset());
        Assert.Equal(moment.Date.AddDays(1).AddHours(10), slots[0].GetProperty("start").GetDateTimeOffset().DateTime);
        Assert.Contains("Яблука «Голден»", catalog.Names());
        Assert.DoesNotContain("Полуниця", catalog.Names());
    }

    [Fact(DisplayName = "BE-7 Зафіксований час заборонено в Production")]
    public void FixedTimeIsForbiddenInProduction()
    {
        using var app = new FarmCartApp().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Production");
            builder.UseSetting("FarmCart:FixedTime", "2026-10-01T09:00:00+03:00");
        });

        var error = Assert.Throws<InvalidOperationException>(() => app.CreateClient());

        Assert.Contains("FixedTime", error.Message);
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
