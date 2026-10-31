using FarmCart.Core;
using Microsoft.AspNetCore.Mvc;

namespace FarmCart.Api;

/// <summary>Застосунок покупця: каталог і слоти (US-04), кошик і оформлення (US-05, US-06), відгуки (US-10).</summary>
internal static class BuyerEndpoints
{
    public static void MapBuyerEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/catalog", ([AsParameters] CatalogRequest request, CatalogService catalog) => catalog.Search(request.ToQuery()));
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

        api.MapPost("/orders/{id:int}/review", (int id, Caller caller, ReviewRequest body, ReviewService reviews) =>
        {
            var review = reviews.Add(caller.User, id, body.Rating, body.Comment);
            return Results.Created($"/api/farmers/{review.FarmerId}/reviews", ReviewDto.From(review));
        });
        api.MapGet("/farmers/{id:int}/reviews", (int id, ReviewService reviews) => reviews.ForFarmer(id).Select(ReviewDto.From));
    }
}
