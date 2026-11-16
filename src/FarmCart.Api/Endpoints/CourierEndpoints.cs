using FarmCart.Core;

namespace FarmCart.Api;

/// <summary>Застосунок кур'єра (US-09): доставки з маршрутом і вручення за кодом.</summary>
internal static class CourierEndpoints
{
    public static void MapCourierEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/courier/deliveries", (Caller caller, DeliveryService deliveries) => deliveries.MyDeliveries(caller.User));
        api.MapPost("/courier/deliveries/{id:int}/fail", (int id, Caller caller, DeliveryFailureRequest body, DeliveryService deliveries, InMemoryStore store) =>
            OrderDto.ForStaff(deliveries.ReportFailure(caller.User, id, body.Problem, body.Note), store));
        api.MapPost("/courier/deliveries/{id:int}/confirm", (int id, Caller caller, ConfirmRequest body, DeliveryService deliveries, InMemoryStore store) =>
            OrderDto.ForStaff(deliveries.Confirm(caller.User, id, body.Code), store));
    }
}
