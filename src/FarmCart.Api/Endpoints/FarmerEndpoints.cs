using FarmCart.Core;

namespace FarmCart.Api;

/// <summary>Застосунок фермера: реєстрація й каталог (US-02, US-03), обробка замовлень і передача кур'єру (US-07, US-08).</summary>
internal static class FarmerEndpoints
{
    /// <summary>Читає тіло, але не більше ніж limit + 1 байт: завеликий файл не лежатиме в пам'яті цілком.</summary>
    private static async Task<byte[]> ReadLimitedAsync(Stream body, int limit, string code = "photo_too_large", string message = "Фото має бути не більше 2 МБ")
    {
        using var buffer = new MemoryStream();
        var chunk = new byte[81920];
        int read;
        while ((read = await body.ReadAsync(chunk)) > 0)
        {
            buffer.Write(chunk, 0, read);
            if (buffer.Length > limit)
            {
                throw Fail.Validation(code, message);
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
        api.MapGet("/farmer/profile", (Caller caller, FarmerService farmers) =>
            FarmerDto.From(farmers.Profile(caller.User), farmers.Documents(caller.User).Count));
        api.MapPatch("/farmer/profile", (Caller caller, FarmProfileChanges body, FarmerService farmers) =>
            FarmerDto.From(farmers.UpdateProfile(caller.User, body), farmers.Documents(caller.User).Count));

        // Документи для верифікації надсилаються «як є», як і фото товарів; назва - у параметрі запиту.
        api.MapPost("/farmer/documents", async (string? name, Caller caller, HttpRequest request, FarmerService farmers) =>
        {
            var data = await ReadLimitedAsync(request.Body, FarmerService.DocumentMaxBytes, "document_too_large", "Документ має бути не більше 5 МБ");
            var document = farmers.AddDocument(caller.User, name, data);
            return Results.Created($"/api/farmer/documents/{document.Id}", FarmDocumentDto.From(document));
        });
        api.MapGet("/farmer/documents", (Caller caller, FarmerService farmers) => farmers.Documents(caller.User).Select(FarmDocumentDto.From));
        api.MapDelete("/farmer/documents/{id:int}", (int id, Caller caller, FarmerService farmers) =>
        {
            farmers.RemoveDocument(caller.User, id);
            return Results.NoContent();
        });
        // Фото надсилається «як є» (тіло запиту - файл зображення): без multipart і з межею розміру на читанні.
        api.MapPut("/farmer/products/{id:int}/photo", async (int id, Caller caller, HttpRequest request, FarmerService farmers) =>
            ProductDto.From(farmers.SetPhoto(caller.User, id, await ReadLimitedAsync(request.Body, FarmerService.PhotoMaxBytes))));
        api.MapDelete("/farmer/products/{id:int}/photo", (int id, Caller caller, FarmerService farmers) =>
            ProductDto.From(farmers.RemovePhoto(caller.User, id)));
        api.MapPost("/farmer/reapply", (Caller caller, FarmerService farmers) =>
            FarmerDto.From(farmers.Reapply(caller.User), farmers.Documents(caller.User).Count));
        api.MapGet("/farmer/products", (Caller caller, FarmerService farmers) => farmers.MyProducts(caller.User).Select(ProductDto.From));
        api.MapPost("/farmer/products", (Caller caller, ProductDraft body, FarmerService farmers) =>
        {
            var product = farmers.AddProduct(caller.User, body);
            return Results.Created($"/api/farmer/products/{product.Id}", ProductDto.From(product));
        });
        // Фото надсилається «як є» і лише допомагає заповнити форму: на сервері воно не зберігається.
        api.MapPost("/farmer/products/suggestion", async (Caller caller, HttpRequest request, AiAssistantService ai, CancellationToken cancellation) =>
            ProductSuggestionDto.From(await ai.SuggestProductAsync(caller.User, await ReadLimitedAsync(request.Body, FarmerService.PhotoMaxBytes), cancellation)));
        api.MapGet("/farmer/products/translation", (Caller caller, ProductTranslationService translation) =>
            new ProductTranslationStatusDto(translation.IsAvailable(caller.User)));
        api.MapPost("/farmer/products/translation", async (Caller caller, ProductTranslationRequest body, ProductTranslationService translation, CancellationToken cancellation) =>
            new ProductTranslationDto(await translation.TranslateAsync(caller.User, body.Items, cancellation)));
        api.MapPatch("/farmer/products/{id:int}", (int id, Caller caller, ProductChanges body, FarmerService farmers) =>
            ProductDto.From(farmers.UpdateProduct(caller.User, id, body)));
        api.MapPost("/farmer/products/{id:int}/stock", (int id, Caller caller, StockChange body, FarmerService farmers) =>
            ProductDto.From(farmers.ChangeStock(caller.User, id, body.Delta)));

        api.MapGet("/farmer/orders", (Caller caller, FulfillmentService fulfillment, InMemoryStore store) =>
            fulfillment.Incoming(caller.User).Select(order => OrderDto.ForStaff(order, store)));
        api.MapPost("/farmer/orders/{id:int}/accept", (int id, Caller caller, AcceptRequest? body, FulfillmentService fulfillment, InMemoryStore store) =>
            OrderDto.ForStaff(fulfillment.Accept(caller.User, id, body?.Shortages), store));
        api.MapPost("/farmer/orders/{id:int}/reject", (int id, Caller caller, RejectRequest body, FulfillmentService fulfillment, InMemoryStore store) =>
            OrderDto.ForStaff(fulfillment.Reject(caller.User, id, body.Reason), store));
        api.MapPost("/farmer/orders/{id:int}/assemble", (int id, Caller caller, FulfillmentService fulfillment, InMemoryStore store) =>
            OrderDto.ForStaff(fulfillment.StartAssembling(caller.User, id), store));
        api.MapPost("/farmer/orders/{id:int}/handover", (int id, Caller caller, HandOverRequest body, FulfillmentService fulfillment, InMemoryStore store) =>
            OrderDto.ForStaff(fulfillment.HandOver(caller.User, id, body.CourierId), store));
        api.MapGet("/couriers", (Caller caller, FulfillmentService fulfillment) =>
            fulfillment.Couriers(caller.User).Select(c => new CourierDto(c.Id, c.Name)));
    }
}
