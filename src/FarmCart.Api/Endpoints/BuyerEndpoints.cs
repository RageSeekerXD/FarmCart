using FarmCart.Core;
using Microsoft.AspNetCore.Mvc;

namespace FarmCart.Api;

/// <summary>Застосунок покупця: каталог і слоти (US-04), кошик, оформлення й скасування (US-05, US-06), відгуки (US-10).</summary>
internal static class BuyerEndpoints
{
    private const int RelatedIdsLimit = 30;

    /// <summary>Ідентифікатори товарів через кому; некоректні значення пропускаються.</summary>
    private static int[] ParseIds(string? ids) =>
        [.. (ids ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(id => int.TryParse(id, out var value) ? value : 0)
            .Where(id => id > 0)
            .Distinct()
            .Take(RelatedIdsLimit)];

    public static void MapBuyerEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/ai/status", (AiAssistantService ai) => new AiStatusDto(ai.IsAvailable));
        api.MapGet("/catalog/related", (string? ids, double? lat, double? lon, CatalogService catalog) =>
            catalog.BoughtTogether(ParseIds(ids), lat is { } latitude && lon is { } longitude ? new GeoPoint(latitude, longitude) : null));
        // Кошик за рецептом платний, тому доступний лише після входу; додає товари до кошика сам покупець.
        api.MapPost("/catalog/basket-plan", async (Caller caller, BasketPlanRequest body, AiAssistantService ai, CancellationToken cancellation) =>
            await ai.PlanBasketAsync(caller.User, body.Request, body.Lang, cancellation));
        api.MapGet("/farmers/{id:int}/reviews/summary", async (int id, AiAssistantService ai, CancellationToken cancellation) =>
            new ReviewSummaryDto(await ai.FarmSummaryAsync(id, cancellation)));
        api.MapGet("/products/{id:int}/reviews/summary", async (int id, AiAssistantService ai, CancellationToken cancellation) =>
            new ReviewSummaryDto(await ai.ProductSummaryAsync(id, cancellation)));
        api.MapGet("/catalog", ([AsParameters] CatalogRequest request, CatalogService catalog) => catalog.Search(request.ToQuery()));
        api.MapGet("/catalog/smart-search", (SmartSearchService search) => new SmartSearchStatusDto(search.IsAvailable));
        // Кожен запит платний, тому розумний пошук доступний лише після входу, на відміну від самого каталогу.
        api.MapPost("/catalog/smart-search", async (Caller caller, SmartSearchRequest body, SmartSearchService search, CancellationToken cancellation) =>
            SmartSearchDto.From(await search.InterpretAsync(caller.User, body.Query, cancellation)));
        api.MapGet("/catalog/{id:int}", (int id, double? lat, double? lon, CatalogService catalog) =>
            catalog.Product(id, lat is { } latitude && lon is { } longitude ? new GeoPoint(latitude, longitude) : null));
        api.MapGet("/products/{id:int}/reviews", (int id, ReviewService reviews) => reviews.ForProduct(id).Select(ReviewDto.From));
        api.MapGet("/reference", () => Reference.All);
        api.MapGet("/farmers", (double? lat, double? lon, CatalogService catalog) =>
            catalog.Farms(lat is { } latitude && lon is { } longitude ? new GeoPoint(latitude, longitude) : null));
        api.MapGet("/slots", (OrderService orders) => orders.AvailableSlots());

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
        api.MapPost("/orders/{id:int}/reorder", (int id, Caller caller, CartService carts) => carts.Reorder(caller.User, id));
        api.MapPost("/orders/{id:int}/reschedule", (int id, Caller caller, RescheduleRequest body, DeliveryService deliveries) =>
            OrderDto.ForBuyer(deliveries.Reschedule(caller.User, id, body.SlotId)));
        api.MapPost("/orders/{id:int}/cancel", (int id, Caller caller, FulfillmentService fulfillment) =>
            OrderDto.ForBuyer(fulfillment.Cancel(caller.User, id)));

        api.MapPost("/orders/{id:int}/review", (int id, Caller caller, ReviewRequest body, ReviewService reviews) =>
        {
            var review = reviews.Add(caller.User, id, body.Rating, body.Comment);
            return Results.Created($"/api/farmers/{review.FarmerId}/reviews", ReviewDto.From(review));
        });
        api.MapGet("/orders/{id:int}/review", (int id, Caller caller, ReviewService reviews) =>
            new { review = reviews.ForOrder(caller.User, id) is { } review ? ReviewDto.From(review) : null });
        api.MapGet("/farmers/{id:int}/reviews", (int id, ReviewService reviews) => reviews.ForFarmer(id).Select(ReviewDto.From));
    }
}
