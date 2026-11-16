using FarmCart.Core;

namespace FarmCart.Api;

/// <summary>Застосунок адміністратора (B-FR-07, B-FR-12): верифікація продавців, слоти, промокоди, модерація, журнал аудиту.</summary>
internal static class AdminEndpoints
{
    public static void MapAdminEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/admin/farmers/pending", (Caller caller, AdminService admin) =>
            admin.PendingFarmers(caller.User).Select(farmer => FarmerDto.From(farmer, admin.FarmerDocuments(caller.User, farmer.Id).Count)));
        api.MapGet("/admin/farmers/{id:int}/documents", (int id, Caller caller, AdminService admin) =>
            admin.FarmerDocuments(caller.User, id).Select(FarmDocumentDto.From));
        api.MapGet("/admin/farmers/{id:int}/documents/{documentId:int}", (int id, int documentId, Caller caller, AdminService admin, HttpResponse response) =>
        {
            var document = admin.FarmerDocument(caller.User, id, documentId);
            // Документи не кешуються: їх бачить лише адміністратор, а браузер міг би віддати їх іншому користувачу.
            response.Headers.CacheControl = "no-store";
            return Results.File(document.Data, document.ContentType);
        });
        api.MapPost("/admin/farmers/{id:int}/verify", (int id, Caller caller, AdminService admin) =>
            FarmerDto.From(admin.VerifyFarmer(caller.User, id)));
        api.MapPost("/admin/slots", (Caller caller, SlotRequest body, AdminService admin) =>
            Results.Created("/api/slots", admin.AddDeliverySlot(caller.User, body.Start, body.End, body.Capacity)));
        api.MapPost("/admin/farmers/{id:int}/reject", (int id, Caller caller, RejectRequest body, AdminService admin) =>
            FarmerDto.From(admin.RejectFarmer(caller.User, id, body.Reason)));
        api.MapPatch("/admin/slots/{id:int}", (int id, Caller caller, SlotRequest body, AdminService admin) =>
            admin.UpdateDeliverySlot(caller.User, id, body.Start, body.End, body.Capacity));
        api.MapDelete("/admin/slots/{id:int}", (int id, Caller caller, AdminService admin) =>
        {
            admin.DeleteDeliverySlot(caller.User, id);
            return Results.NoContent();
        });
        api.MapPost("/admin/promocodes/{code}/deactivate", (string code, Caller caller, AdminService admin) =>
            admin.SetPromoActive(caller.User, code, active: false));
        api.MapPost("/admin/promocodes/{code}/activate", (string code, Caller caller, AdminService admin) =>
            admin.SetPromoActive(caller.User, code, active: true));
        api.MapGet("/admin/promocodes", (Caller caller, AdminService admin) => admin.PromoCodes(caller.User));
        api.MapPost("/admin/promocodes", (Caller caller, PromoRequest body, AdminService admin) =>
            Results.Created("/api/admin/promocodes", admin.CreatePromoCode(caller.User, body.Code, body.Percent, body.MinTotal, body.ValidUntil)));
        api.MapPost("/admin/reviews/{id:int}/hide", (int id, Caller caller, ModerationRequest body, ReviewService reviews) =>
            ReviewDto.From(reviews.Hide(caller.User, id, body.Reason)));
        api.MapGet("/admin/reviews", (Caller caller, ReviewService reviews) =>
            reviews.ForModeration(caller.User).Select(AdminReviewDto.From));
        api.MapPost("/admin/reviews/{id:int}/restore", (int id, Caller caller, ReviewService reviews) =>
            ReviewDto.From(reviews.Restore(caller.User, id)));
        api.MapGet("/admin/audit", (Caller caller, AuditLog audit) => audit.Entries(caller.User));
    }
}
