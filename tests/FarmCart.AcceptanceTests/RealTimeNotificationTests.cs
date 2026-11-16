using System.Collections.Concurrent;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Extensions.Logging;

namespace FarmCart.AcceptanceTests;

/// <summary>
/// BE-2, BE-3, BE-4, BE-6: «Як покупець, фермер чи кур'єр, я хочу дізнаватися про події замовлення одразу,
/// без перезавантаження сторінки». Сповіщення структуровані й надходять через хаб лише своєму користувачу.
/// </summary>
public sealed class RealTimeNotificationTests
{
    private const string BuyerPhone = "+380971234567";
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(10);

    [Fact(DisplayName = "BE-2 Сповіщення в API мають вид, номер замовлення й параметри; текст лишається для сумісності")]
    public async Task NotificationsAreStructured()
    {
        using var app = new FarmCartApp();
        var (farmer, apples, slot) = await Journeys.FarmWithApplesAsync(app);
        var buyer = await app.LoginAsync(BuyerPhone);
        var orderId = await Journeys.OrderAsync(buyer, apples, 2, slot);
        (await farmer.PostAsJsonAsync($"/api/farmer/orders/{orderId}/accept", new { })).EnsureSuccessStatusCode();

        var toBuyer = await buyer.GetJson("/api/me/notifications");
        var toFarmer = await farmer.GetJson("/api/me/notifications");

        Assert.Equal(["order.placed", "order.status"], toBuyer.EnumerateArray().Select(n => n.Str("kind")));
        Assert.Equal((orderId, "Accepted"), (toBuyer[1].GetProperty("orderId").GetInt32(), toBuyer[1].GetProperty("params").Str("status")));
        Assert.Equal("64", toBuyer[0].GetProperty("params").Str("total"));
        Assert.Contains("прийнято", toBuyer[1].Str("text"));
        // Перше сповіщення фермера - про верифікацію господарства, далі - нове замовлення.
        Assert.Equal(["farm.verified", "order.new"], toFarmer.EnumerateArray().Select(n => n.Str("kind")));
        Assert.True(toBuyer[1].GetProperty("id").GetInt32() > toBuyer[0].GetProperty("id").GetInt32());
    }

    [Fact(DisplayName = "BE-3, BE-4 Хаб одразу надсилає події: фермеру - нове замовлення, покупцю - статус, кур'єру - доставку")]
    public async Task HubDeliversEventsToEachRole()
    {
        using var app = new FarmCartApp();
        var (farmer, apples, slot) = await Journeys.FarmWithApplesAsync(app);
        var buyer = await app.LoginAsync(BuyerPhone);
        var (courier, courierId) = await Journeys.CourierAsync(app);
        await using var farmerHub = await Listener.ConnectAsync(app, farmer);
        await using var buyerHub = await Listener.ConnectAsync(app, buyer);
        await using var courierHub = await Listener.ConnectAsync(app, courier);

        var orderId = await Journeys.OrderAsync(buyer, apples, 1, slot);
        var newOrder = await farmerHub.NextAsync();
        var placed = await buyerHub.NextAsync();
        await Journeys.SendAsync(farmer, orderId, courierId);
        var statuses = new[] { await buyerHub.NextAsync(), await buyerHub.NextAsync(), await buyerHub.NextAsync() };
        var delivery = await courierHub.NextAsync();

        Assert.Equal(("order.new", orderId), (newOrder.Str("kind"), newOrder.GetProperty("orderId").GetInt32()));
        Assert.Equal("order.placed", placed.Str("kind"));
        Assert.Equal(["Accepted", "Assembling", "InTransit"], statuses.Select(n => n.GetProperty("params").Str("status")));
        Assert.Equal(("delivery.assigned", orderId), (delivery.Str("kind"), delivery.GetProperty("orderId").GetInt32()));
        Assert.Equal(0, farmerHub.Pending + courierHub.Pending);
    }

    [Fact(DisplayName = "BE-3 Сповіщення отримує лише свій користувач, а з'єднання без дійсної сесії закривається")]
    public async Task HubIsPrivate()
    {
        using var app = new FarmCartApp();
        var (_, apples, slot) = await Journeys.FarmWithApplesAsync(app);
        var buyer = await app.LoginAsync(BuyerPhone);
        var stranger = await app.LoginAsync("+380979999999");
        await using var buyerHub = await Listener.ConnectAsync(app, buyer);
        await using var strangerHub = await Listener.ConnectAsync(app, stranger);
        await using var anonymous = await Listener.ConnectAsync(app, token: "not-a-session");

        await Journeys.OrderAsync(buyer, apples, 1, slot);
        await buyerHub.NextAsync();

        await anonymous.Closed.WaitAsync(Timeout);
        Assert.Equal(0, strangerHub.Pending + anonymous.Pending);
    }

    [Fact(DisplayName = "BE-6 Токен сесії з рядка запиту хаба не потрапляє в журнал сервера")]
    public async Task HubTokenIsNotLogged()
    {
        var log = new CapturedLog();
        using var factory = new FarmCartApp();
        using var app = factory.WithWebHostBuilder(builder => builder.ConfigureLogging(logging => logging.AddProvider(log).SetMinimumLevel(LogLevel.Debug)));
        var buyer = await LoginAsync(app);
        var token = buyer.DefaultRequestHeaders.Authorization!.Parameter!;

        await using (var hub = await Listener.ConnectAsync(app, token, tokenInQuery: true))
        {
            await buyer.GetJson("/api/me");
        }

        Assert.Contains(log.Lines, line => line.Contains("/hubs/notifications", StringComparison.Ordinal));
        Assert.DoesNotContain(log.Lines, line => line.Contains(token, StringComparison.Ordinal));
    }

    private static async Task<HttpClient> LoginAsync(WebApplicationFactory<Program> app)
    {
        var client = app.CreateClient();
        var sms = (Core.InMemorySmsGateway)app.Services.GetService(typeof(Core.InMemorySmsGateway))!;
        (await client.PostAsJsonAsync("/api/auth/code", new { phone = BuyerPhone })).EnsureSuccessStatusCode();
        var session = await client.PostJson("/api/auth/verify", new { phone = BuyerPhone, code = sms.LastCodeFor(BuyerPhone) });
        client.DefaultRequestHeaders.Authorization = new("Bearer", session.Str("token"));
        return client;
    }

    /// <summary>Клієнт хаба, що складає отримані події в чергу.</summary>
    private sealed class Listener : IAsyncDisposable
    {
        private readonly HubConnection _connection;
        private readonly System.Threading.Channels.Channel<JsonElement> _events = System.Threading.Channels.Channel.CreateUnbounded<JsonElement>();
        private readonly TaskCompletionSource _closed = new(TaskCreationOptions.RunContinuationsAsynchronously);

        private Listener(HubConnection connection)
        {
            _connection = connection;
            _connection.On<JsonElement>("notification", notification => _events.Writer.TryWrite(notification));
            _connection.Closed += _ =>
            {
                _closed.TrySetResult();
                return Task.CompletedTask;
            };
        }

        public Task Closed => _closed.Task;

        public int Pending => _events.Reader.Count;

        public static Task<Listener> ConnectAsync(WebApplicationFactory<Program> app, HttpClient user) =>
            ConnectAsync(app, user.DefaultRequestHeaders.Authorization!.Parameter!);

        public static async Task<Listener> ConnectAsync(WebApplicationFactory<Program> app, string token, bool tokenInQuery = false)
        {
            var url = new Uri(app.Server.BaseAddress, tokenInQuery ? $"hubs/notifications?access_token={token}" : "hubs/notifications");
            var connection = new HubConnectionBuilder()
                .WithUrl(url, options =>
                {
                    options.HttpMessageHandlerFactory = _ => app.Server.CreateHandler();
                    options.Transports = HttpTransportType.LongPolling;
                    if (!tokenInQuery)
                    {
                        options.AccessTokenProvider = () => Task.FromResult<string?>(token);
                    }
                })
                .Build();
            var listener = new Listener(connection);
            try
            {
                await connection.StartAsync();
            }
            catch (Exception) when (token == "not-a-session")
            {
                // Сервер може закрити з'єднання ще під час рукостискання - для тесту це той самий результат.
                listener._closed.TrySetResult();
            }

            return listener;
        }

        public async Task<JsonElement> NextAsync()
        {
            using var timeout = new CancellationTokenSource(Timeout);
            return await _events.Reader.ReadAsync(timeout.Token);
        }

        public ValueTask DisposeAsync() => _connection.DisposeAsync();
    }

    private sealed class CapturedLog : ILoggerProvider
    {
        private readonly ConcurrentQueue<string> _lines = new();

        public IEnumerable<string> Lines => _lines;

        public ILogger CreateLogger(string categoryName) => new Writer(_lines);

        public void Dispose()
        {
        }

        private sealed class Writer(ConcurrentQueue<string> lines) : ILogger
        {
            public IDisposable? BeginScope<TState>(TState state)
                where TState : notnull => null;

            public bool IsEnabled(LogLevel logLevel) => true;

            public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter) =>
                lines.Enqueue($"{formatter(state, exception)} {exception}");
        }
    }
}
