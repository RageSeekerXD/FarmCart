using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using FarmCart.Core;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace FarmCart.AcceptanceTests;

/// <summary>
/// FarmCart у пам'яті тестового процесу з керованим годинником. Кожен приймальний тест
/// створює власний екземпляр, тому тести не залежать один від одного.
/// </summary>
public sealed class FarmCartApp(bool seedDemoData = false) : WebApplicationFactory<Program>
{
    public const string AdminPhone = "+380500000001";
    private HttpClient? _admin;

    /// <summary>1 жовтня 2026 р., 09:00 за Києвом.</summary>
    public ManualClock Clock { get; } = new(new DateTimeOffset(2026, 10, 1, 9, 0, 0, TimeSpan.FromHours(3)));

    public InMemoryStore Store => Services.GetRequiredService<InMemoryStore>();

    public InMemorySmsGateway Sms => Services.GetRequiredService<InMemorySmsGateway>();

    public SandboxPaymentGateway Payments => Services.GetRequiredService<SandboxPaymentGateway>();

    /// <summary>Слот доставки (за замовчуванням - на завтра), створений адміністратором через API.</summary>
    public async Task<int> SlotAsync(int capacity = 3, int hoursFromNow = 24)
    {
        var admin = await AdminAsync();
        var start = Clock.Now.AddHours(hoursFromNow);
        return (await admin.PostJson("/api/admin/slots", new { start, end = start.AddHours(2), capacity })).Id();
    }

    /// <summary>Вхід так, як це робить мобільний клієнт: запит коду, код із SMS, підтвердження.</summary>
    public async Task<HttpClient> LoginAsync(string phone)
    {
        var client = CreateClient();
        (await client.PostAsJsonAsync("/api/auth/code", new { phone })).EnsureSuccessStatusCode();
        var verify = await client.PostAsJsonAsync("/api/auth/verify", new { phone, code = Sms.LastCodeFor(phone) });
        var token = (await verify.Json()).GetProperty("token").GetString();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    /// <summary>Вхід користувача з роллю, яку видає оператор платформи (адміністратор, кур'єр).</summary>
    public Task<HttpClient> LoginWithRoleAsync(string phone, Role role)
    {
        lock (Store.Sync)
        {
            Store.AddUser(phone, role.Title(), role);
        }

        return LoginAsync(phone);
    }

    public async Task<HttpClient> AdminAsync() => _admin ??= await LoginWithRoleAsync(AdminPhone, Role.Admin);

    /// <summary>Фермер, якого зареєстровано й верифіковано через API.</summary>
    public async Task<HttpClient> VerifiedFarmerAsync(string phone, string farmName, GeoPoint? at = null, bool certified = false)
    {
        var location = at ?? Places.Vynnyky;
        var farmer = await LoginAsync(phone);
        var registered = await farmer.PostAsJsonAsync("/api/farmers", new { farmName, lat = location.Lat, lon = location.Lon, certified });
        var farmerId = (await registered.Json()).GetProperty("id").GetInt32();
        var admin = await AdminAsync();
        (await admin.PostAsync($"/api/admin/farmers/{farmerId}/verify", null)).EnsureSuccessStatusCode();
        return farmer;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("FarmCart:SeedDemoData", seedDemoData ? "true" : "false");
        builder.ConfigureLogging(logging => logging.ClearProviders());
        builder.ConfigureServices(services => services.AddSingleton<IClock>(Clock));
    }
}

public static class Places
{
    public static readonly GeoPoint LvivCenter = new(49.8419, 24.0315);
    public static readonly GeoPoint Vynnyky = new(49.8160, 24.1300);
    public static readonly GeoPoint Bryukhovychi = new(49.9000, 23.9600);
    public static readonly GeoPoint Kyiv = new(50.4501, 30.5234);
}

public static class HttpJson
{
    public static async Task<JsonElement> Json(this HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>();

    public static async Task<JsonElement> GetJson(this HttpClient client, string url)
    {
        var response = await client.GetAsync(url);
        response.EnsureSuccessStatusCode();
        return await response.Json();
    }

    public static async Task<JsonElement> PostJson(this HttpClient client, string url, object body)
    {
        var response = await client.PostAsJsonAsync(url, body);
        response.EnsureSuccessStatusCode();
        return await response.Json();
    }

    public static async Task<string> ErrorCode(this HttpResponseMessage response) =>
        (await response.Json()).GetProperty("error").GetString()!;

    public static int Id(this JsonElement element) => element.GetProperty("id").GetInt32();

    public static string[] Names(this JsonElement items) =>
        [.. items.EnumerateArray().Select(i => i.GetProperty("name").GetString()!)];

    /// <summary>Публікує товар від імені фермера й повертає його ідентифікатор.</summary>
    public static async Task<int> PublishAsync(this HttpClient farmer, string name, string category, decimal price, int stock = 50, int[]? seasonMonths = null) =>
        (await farmer.PostJson("/api/farmer/products", new { name, category, unit = "кг", price, stock, seasonMonths })).Id();

    public static Task<HttpResponseMessage> AddToCartAsync(this HttpClient buyer, int productId, int quantity) =>
        buyer.PostAsJsonAsync("/api/cart/items", new { productId, quantity });

    /// <summary>Оформлення замовлення так, як його надсилає мобільний клієнт.</summary>
    public static Task<HttpResponseMessage> CheckoutAsync(
        this HttpClient buyer,
        int slotId,
        string method = "Card",
        string? token = "tok_visa",
        string? promoCode = null,
        string? comment = null,
        string? idempotencyKey = null)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/orders")
        {
            Content = JsonContent.Create(new { address = "Львів, вул. Городоцька, 1", slotId, paymentMethod = method, paymentToken = token, promoCode, comment }),
        };
        if (idempotencyKey is not null)
        {
            request.Headers.Add("Idempotency-Key", idempotencyKey);
        }

        return buyer.SendAsync(request);
    }

    public static decimal Dec(this JsonElement element, string property) => element.GetProperty(property).GetDecimal();

    public static string Str(this JsonElement element, string property) => element.GetProperty(property).GetString()!;

    public static JsonElement LastItem(this JsonElement array) => array.EnumerateArray().Last();
}
