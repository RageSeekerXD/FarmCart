using FarmCart.Core;

namespace FarmCart.Api;

/// <summary>Застосунок фермера: реєстрація й каталог (US-02, US-03), обробка замовлень і передача кур'єру (US-07, US-08).</summary>
internal static class FarmerEndpoints
{
    /// <summary>Читає тіло, але не більше ніж limit + 1 байт: завеликий файл не лежатиме в пам'яті цілком.</summary>
    private static async Task<byte[]> ReadLimitedAsync(Stream body, int limit)
    {
        using var buffer = new MemoryStream();
        var chunk = new byte[81920];
        int read;
        while ((read = await body.ReadAsync(chunk)) > 0)
        {
            buffer.Write(chunk, 0, read);
            if (buffer.Length > limit)
            {
                throw Fail.Validation("photo_too_large", "Фото має бути не більше 2 МБ");
            }
        }

        return buffer.ToArray();
    }

    public static void MapFarmerEndpoints(this RouteGroupBuilder api)
    {
        api.MapPost("/farmers", (Caller caller, FarmerRegistration body, FarmerService farmers) =>
        {
            var farmer = farmers.Register(caller.User, body.FarmName, new GeoPoint(body.Lat, body.Lon), body.Certified, body.Documents);
            return Results.Created($"/api/farmers/{farmer.Id}", FarmerDto.From(farmer));
        });
        api.MapGet("/farmer/profile", (Caller caller, FarmerService farmers) => FarmerDto.From(farmers.Profile(caller.User)));
        // Фото надсилається «як є» (тіло запиту - файл зображення): без multipart і з межею розміру на читанні.
        api.MapPut("/farmer/products/{id:int}/photo", async (int id, Caller caller, HttpRequest request, FarmerService farmers) =>
            ProductDto.From(farmers.SetPhoto(caller.User, id, await ReadLimitedAsync(request.Body, FarmerService.PhotoMaxBytes))));
        api.MapDelete("/farmer/products/{id:int}/photo", (int id, Caller caller, FarmerService farmers) =>
            ProductDto.From(farmers.RemovePhoto(caller.User, id)));
        api.MapPost("/farmer/reapply", (Caller caller, FarmerService farmers) => FarmerDto.From(farmers.Reapply(caller.User)));
        api.MapGet("/farmer/products", (Caller caller, FarmerService farmers) => farmers.MyProducts(caller.User).Select(ProductDto.From));
        api.MapPost("/farmer/products", (Caller caller, ProductDraft body, FarmerService farmers) =>
        {
            var product = farmers.AddProduct(caller.User, body);
            return Results.Created($"/api/farmer/products/{product.Id}", ProductDto.From(product));
        });
        api.MapPatch("/farmer/products/{id:int}", (int id, Caller caller, ProductChanges body, FarmerService farmers) =>
            ProductDto.From(farmers.UpdateProduct(caller.User, id, body)));
        api.MapPost("/farmer/products/{id:int}/stock", (int id, Caller caller, StockChange body, FarmerService farmers) =>
            ProductDto.From(farmers.ChangeStock(caller.User, id, body.Delta)));

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
}
