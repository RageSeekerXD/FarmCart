using FarmCart.Core;

namespace FarmCart.Api;

/// <summary>
/// REST API FarmCart. Маршрути згруповано за застосунками-клієнтами (вхід, покупець, фермер, кур'єр, адміністратор);
/// кожен маршрут лише перекладає HTTP на виклик доменного сервісу.
/// </summary>
public static class Endpoints
{
    public static void MapFarmCartApi(this WebApplication app)
    {
        var api = app.MapGroup("/api");
        // Час сервера: клієнти (зокрема демонстраційний сценарій) звіряють із ним сезонність і слоти доставки.
        api.MapGet("/health", (IClock clock) => new { status = "ok", version = typeof(Endpoints).Assembly.GetName().Version?.ToString(3), time = clock.Now });
        api.MapAuthEndpoints();
        api.MapBuyerEndpoints();
        api.MapFarmerEndpoints();
        api.MapCourierEndpoints();
        api.MapAdminEndpoints();
    }
}
