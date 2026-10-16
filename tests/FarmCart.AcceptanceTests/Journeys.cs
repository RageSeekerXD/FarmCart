using System.Net.Http.Json;
using FarmCart.Core;

namespace FarmCart.AcceptanceTests;

/// <summary>Повторювані кроки приймальних сценаріїв мовою замовника: ферма, замовлення, кур'єр, вручення.</summary>
public static class Journeys
{
    /// <summary>Верифікована ферма з яблуками (32 грн/кг, 50 кг) і слот доставки.</summary>
    public static async Task<(HttpClient Farmer, int Apples, int Slot)> FarmWithApplesAsync(FarmCartApp app, string phone = "+380671110001")
    {
        var farmer = await app.VerifiedFarmerAsync(phone, "Ферма «Зелений Гай»");
        var apples = await farmer.PublishAsync("Яблука", "Фрукти", 32m, stock: 50);
        return (farmer, apples, await app.SlotAsync());
    }

    public static async Task<int> OrderAsync(HttpClient buyer, int productId, int quantity, int slotId, string method = "Card")
    {
        (await buyer.AddToCartAsync(productId, quantity)).EnsureSuccessStatusCode();
        var response = await buyer.CheckoutAsync(slotId, method, method == "Cash" ? null : "tok_visa");
        response.EnsureSuccessStatusCode();
        return (await response.Json()).Id();
    }

    public static async Task<(HttpClient Courier, int CourierId)> CourierAsync(FarmCartApp app, string phone = "+380631230001")
    {
        var courier = await app.LoginWithRoleAsync(phone, Role.Courier);
        return (courier, (await courier.GetJson("/api/me")).Id());
    }

    /// <summary>Фермер приймає замовлення, збирає його й передає кур'єру.</summary>
    public static async Task SendAsync(HttpClient farmer, int orderId, int courierId)
    {
        (await farmer.PostAsJsonAsync($"/api/farmer/orders/{orderId}/accept", new { })).EnsureSuccessStatusCode();
        (await farmer.PostAsJsonAsync($"/api/farmer/orders/{orderId}/assemble", new { })).EnsureSuccessStatusCode();
        (await farmer.PostAsJsonAsync($"/api/farmer/orders/{orderId}/handover", new { courierId })).EnsureSuccessStatusCode();
    }

    /// <summary>Кур'єр вручає замовлення за кодом, який називає покупець.</summary>
    public static async Task DeliverAsync(HttpClient buyer, HttpClient courier, int orderId)
    {
        var code = (await buyer.GetJson($"/api/orders/{orderId}")).Str("deliveryCode");
        (await courier.PostAsJsonAsync($"/api/courier/deliveries/{orderId}/confirm", new { code })).EnsureSuccessStatusCode();
    }
}
