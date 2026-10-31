using FarmCart.Core;

namespace FarmCart.Api;

/// <summary>Застосунок адміністратора (B-FR-07, B-FR-12): верифікація продавців, слоти, промокоди, модерація, журнал аудиту.</summary>
internal static class AdminEndpoints
{
    public static void MapAdminEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/admin/farmers/pending", (Caller caller, AdminService admin) =>
            admin.PendingFarmers(caller.User).Select(FarmerDto.From));
        api.MapPost("/admin/farmers/{id:int}/verify", (int id, Caller caller, AdminService admin) =>
            FarmerDto.From(admin.VerifyFarmer(caller.User, id)));
        api.MapPost("/admin/slots", (Caller caller, SlotRequest body, AdminService admin) =>
            Results.Created("/api/slots", admin.AddDeliverySlot(caller.User, body.Start, body.End, body.Capacity)));
        api.MapPost("/admin/promocodes", (Caller caller, PromoRequest body, AdminService admin) =>
            Results.Created("/api/admin/promocodes", admin.CreatePromoCode(caller.User, body.Code, body.Percent, body.MinTotal, body.ValidUntil)));
        api.MapPost("/admin/reviews/{id:int}/hide", (int id, Caller caller, ModerationRequest body, ReviewService reviews) =>
            ReviewDto.From(reviews.Hide(caller.User, id, body.Reason)));
        api.MapGet("/admin/audit", (Caller caller, AuditLog audit) => audit.Entries(caller.User));
    }
}
