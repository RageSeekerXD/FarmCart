using Microsoft.Extensions.FileProviders;

namespace FarmCart.Api;

/// <summary>
/// BE-5: сервер віддає зібраний веб-клієнт (<c>web/dist</c>) і фото товарів (<c>wwwroot</c>) статикою.
/// Маршрути клієнта (/cart, /orders/1001) обслуговує index.html; шляхи API, OpenAPI, хабів і файли (з розширенням)
/// до нього не потрапляють: інакше обрана кінцева точка не дала б проміжному ПЗ статики віддати сам файл.
/// </summary>
public static class WebApp
{
    private const string ClientRoutes = @"{*path:regex(^(?!api/|openapi/|hubs/|img/|assets/)(?!.*\.[^/]+$).*$)}";

    public static void UseFarmCartWeb(this WebApplication app, string? configuredRoot)
    {
        app.UseStaticFiles();
        var root = Path.GetFullPath(configuredRoot ?? Path.Combine(app.Environment.ContentRootPath, "..", "..", "web", "dist"));
        if (!File.Exists(Path.Combine(root, "index.html")))
        {
            return;
        }

        var files = new PhysicalFileProvider(root);
        var client = new StaticFileOptions { FileProvider = files };
        app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = files });
        app.UseStaticFiles(client);
        app.MapFallbackToFile(ClientRoutes, "index.html", client);
    }
}
