using FarmCart.Core;
using Microsoft.AspNetCore.Mvc;

namespace FarmCart.Api;

/// <summary>REST API FarmCart. Кожен маршрут лише перекладає HTTP на виклик доменного сервісу.</summary>
public static class Endpoints
{
    public static void MapFarmCartApi(this WebApplication app)
    {
        var api = app.MapGroup("/api");
        api.MapGet("/health", () => new { status = "ok", version = typeof(Endpoints).Assembly.GetName().Version?.ToString(3) });
        MapAuth(api);
        MapFarmers(api);
        MapCatalog(api);
        MapOrders(api);
        MapFulfillment(api);
        MapDelivery(api);
        MapReviews(api);
        MapAdmin(api);
    }

    // US-01: вхід за номером телефону з одноразовим кодом.
    private static void MapAuth(RouteGroupBuilder api)
    {
        api.MapPost("/auth/code", (PhoneRequest body, AuthService auth, InMemorySmsGateway sms, IHostEnvironment env) =>
        {
            var expiresAt = auth.RequestCode(body.Phone);
            // У режимі розробки SMS не надсилаються, тож код повертається клієнту для демонстрації.
            var devCode = env.IsDevelopment() ? sms.LastCodeFor(PhoneNumber.Normalize(body.Phone)) : null;
            return Results.Accepted(value: new { expiresAt, devCode });
        });
        api.MapPost("/auth/verify", (VerifyRequest body, AuthService auth) =>
        {
            var session = auth.Verify(body.Phone, body.Code);
            return new { token = session.Token, isNewUser = session.IsNewUser, user = UserDto.From(session.User) };
        });
        api.MapGet("/me", (Caller caller) => UserDto.From(caller.User));
        api.MapGet("/me/notifications", (Caller caller, InMemoryNotifier notifier) => notifier.For(caller.User.Id));
    }

    // US-02, US-03: реєстрація продавця та керування власним каталогом.
    private static void MapFarmers(RouteGroupBuilder api)
    {
        api.MapPost("/farmers", (Caller caller, FarmerRegistration body, FarmerService farmers) =>
        {
            var farmer = farmers.Register(caller.User, body.FarmName, new GeoPoint(body.Lat, body.Lon), body.Certified, body.Documents);
            return Results.Created($"/api/farmers/{farmer.Id}", FarmerDto.From(farmer));
        });
        api.MapGet("/farmer/products", (Caller caller, FarmerService farmers) => farmers.MyProducts(caller.User));
        api.MapPost("/farmer/products", (Caller caller, ProductDraft body, FarmerService farmers) =>
        {
            var product = farmers.AddProduct(caller.User, body);
            return Results.Created($"/api/farmer/products/{product.Id}", product);
        });
        api.MapPatch("/farmer/products/{id:int}", (int id, Caller caller, ProductChanges body, FarmerService farmers) =>
            farmers.UpdateProduct(caller.User, id, body));
        api.MapPost("/farmer/products/{id:int}/stock", (int id, Caller caller, StockChange body, FarmerService farmers) =>
            farmers.ChangeStock(caller.User, id, body.Delta));
    }

    // US-04: пошук і фільтрація каталогу; слоти доставки.
    private static void MapCatalog(RouteGroupBuilder api)
    {
        api.MapGet("/catalog", ([AsParameters] CatalogRequest request, CatalogService catalog) => catalog.Search(request.ToQuery()));
        api.MapGet("/slots", (OrderService orders) => orders.AvailableSlots());
    }

    // US-05, US-06: кошик, оформлення й оплата замовлення.
    private static void MapOrders(RouteGroupBuilder api)
    {
        api.MapGet("/cart", (Caller caller, CartService carts) => carts.Get(caller.User));
        api.MapPost("/cart/items", (Caller caller, CartItemRequest body, CartService carts) =>
            carts.Add(caller.User, body.ProductId, body.Quantity));
        api.MapDelete("/cart/items/{productId:int}", (int productId, Caller caller, CartService carts) =>
            carts.Remove(caller.User, productId));
        api.MapPost("/orders", (Caller caller, CheckoutRequest body, [FromHeader(Name = "Idempotency-Key")] string? key, OrderService orders) =>
        {
            var order = orders.PlaceOrder(caller.User, body, key);
            return Results.Created($"/api/orders/{order.Id}", OrderDto.ForBuyer(order));
        });
        api.MapGet("/orders", (Caller caller, OrderService orders) => orders.MyOrders(caller.User).Select(OrderDto.ForBuyer));
        api.MapGet("/orders/{id:int}", (int id, Caller caller, OrderService orders) => OrderDto.ForBuyer(orders.MyOrder(caller.User, id)));
    }

    // US-07, US-08: обробка замовлень фермером і передача кур'єру.
    private static void MapFulfillment(RouteGroupBuilder api)
    {
        api.MapGet("/farmer/orders", (Caller caller, FulfillmentService fulfillment) =>
            fulfillment.Incoming(caller.User).Select(OrderDto.ForStaff));
        api.MapPost("/farmer/orders/{id:int}/accept", (int id, Caller caller, AcceptRequest? body, FulfillmentService fulfillment) =>
            OrderDto.ForStaff(fulfillment.Accept(caller.User, id, body?.Shortages)));
        api.MapPost("/farmer/orders/{id:int}/reject", (int id, Caller caller, RejectRequest body, FulfillmentService fulfillment) =>
            OrderDto.ForStaff(fulfillment.Reject(caller.User, id, body.Reason)));
        api.MapPost("/farmer/orders/{id:int}/assemble", (int id, Caller caller, FulfillmentService fulfillment) =>
            OrderDto.ForStaff(fulfillment.StartAssembling(caller.User, id)));
        api.MapPost("/farmer/orders/{id:int}/handover", (int id, Caller caller, HandOverRequest body, FulfillmentService fulfillment) =>
            OrderDto.ForStaff(fulfillment.HandOver(caller.User, id, body.CourierId)));
        api.MapGet("/couriers", (Caller caller, FulfillmentService fulfillment) =>
            fulfillment.Couriers(caller.User).Select(c => new CourierDto(c.Id, c.Name)));
    }

    // US-09: доставки кур'єра та вручення за кодом.
    private static void MapDelivery(RouteGroupBuilder api)
    {
        api.MapGet("/courier/deliveries", (Caller caller, DeliveryService deliveries) => deliveries.MyDeliveries(caller.User));
        api.MapPost("/courier/deliveries/{id:int}/confirm", (int id, Caller caller, ConfirmRequest body, DeliveryService deliveries) =>
            OrderDto.ForStaff(deliveries.Confirm(caller.User, id, body.Code)));
    }

    // US-10: відгуки й рейтинг фермера.
    private static void MapReviews(RouteGroupBuilder api)
    {
        api.MapPost("/orders/{id:int}/review", (int id, Caller caller, ReviewRequest body, ReviewService reviews) =>
        {
            var review = reviews.Add(caller.User, id, body.Rating, body.Comment);
            return Results.Created($"/api/farmers/{review.FarmerId}/reviews", ReviewDto.From(review));
        });
        api.MapGet("/farmers/{id:int}/reviews", (int id, ReviewService reviews) => reviews.ForFarmer(id).Select(ReviewDto.From));
    }

    // B-FR-07, B-FR-12: дії адміністратора й журнал аудиту.
    private static void MapAdmin(RouteGroupBuilder api)
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
