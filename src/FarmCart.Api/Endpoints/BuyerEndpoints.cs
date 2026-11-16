using FarmCart.Core;
using Microsoft.AspNetCore.Mvc;

namespace FarmCart.Api;

/// <summary>Застосунок покупця: каталог і слоти (US-04), кошик, оформлення й скасування (US-05, US-06), відгуки (US-10).</summary>
internal static class BuyerEndpoints
{
    public static void MapBuyerEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/catalog", ([AsParameters] CatalogRequest request, CatalogService catalog) => catalog.Search(request.ToQuery()));
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
