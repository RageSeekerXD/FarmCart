using System.Net;
using Microsoft.AspNetCore.Hosting;

namespace FarmCart.AcceptanceTests;

/// <summary>BE-5: сервер віддає зібраний веб-клієнт статикою, а маршрути клієнта обслуговує index.html.</summary>
public sealed class WebClientHostingTests : IDisposable
{
    private const string Page = "<!doctype html><title>FarmCart</title><div id=\"root\"></div>";
    private readonly string _dist = Directory.CreateTempSubdirectory("farmcart-web-").FullName;

    public WebClientHostingTests()
    {
        File.WriteAllText(Path.Combine(_dist, "index.html"), Page);
        Directory.CreateDirectory(Path.Combine(_dist, "assets"));
        File.WriteAllText(Path.Combine(_dist, "assets", "app.js"), "console.log('farmcart')");
    }

    public void Dispose() => Directory.Delete(_dist, recursive: true);

    [Theory(DisplayName = "BE-5.1 Корінь сайту й маршрути веб-клієнта віддають index.html")]
    [InlineData("/")]
    [InlineData("/cart")]
    [InlineData("/orders/1001")]
    public async Task ClientRoutesServeIndexHtml(string path)
    {
        using var app = AppWithClient();

        var response = await app.CreateClient().GetAsync(path);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(Page, await response.Content.ReadAsStringAsync());
    }

    [Fact(DisplayName = "BE-5.2 Файли збірки віддаються як є, а невідомі шляхи API не підміняються сторінкою")]
    public async Task AssetsAreServedAndApiIsNotShadowed()
    {
        using var app = AppWithClient();
        var client = app.CreateClient();

        var asset = await client.GetAsync("/assets/app.js");
        var unknownApi = await client.GetAsync("/api/unknown");
        var health = await client.GetJson("/api/health");

        Assert.Contains("javascript", asset.Content.Headers.ContentType?.MediaType);
        Assert.Contains("farmcart", await asset.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.NotFound, unknownApi.StatusCode);
        Assert.Equal("ok", health.Str("status"));
    }

    [Fact(DisplayName = "BE-5.3 Без зібраного клієнта сервер працює як звичайний API")]
    public async Task ApiWorksWithoutClientBuild()
    {
        using var app = new FarmCartApp().WithWebHostBuilder(builder => builder.UseSetting("FarmCart:WebRoot", Path.Combine(_dist, "missing")));
        var client = app.CreateClient();

        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/cart")).StatusCode);
        Assert.Equal("ok", (await client.GetJson("/api/health")).Str("status"));
    }

    private Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program> AppWithClient() =>
        new FarmCartApp().WithWebHostBuilder(builder => builder.UseSetting("FarmCart:WebRoot", _dist));
}
