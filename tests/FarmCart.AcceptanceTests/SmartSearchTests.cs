using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Anthropic;
using FarmCart.Api;
using FarmCart.Core;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace FarmCart.AcceptanceTests;

/// <summary>Керований сервіс розумного пошуку: тести не звертаються до зовнішнього сервісу навіть за наявності ключа API.</summary>
public sealed class ScriptedSearchInterpreter : ICatalogSearchInterpreter
{
    public bool IsAvailable { get; set; } = true;

    public List<SmartSearchContext> Received { get; } = [];

    public SearchIntent Intent { get; set; } = new(Category: "honey");

    public Task<SearchIntent> InterpretAsync(SmartSearchContext context, CancellationToken cancellation)
    {
        Received.Add(context);
        return Task.FromResult(Intent);
    }
}

/// <summary>AI-3: покупець описує товар своїми словами, а каталог показує результат за звичайними фільтрами.</summary>
public sealed class SmartSearchTests
{
    private const string Url = "/api/catalog/smart-search";

    [Fact(DisplayName = "AI-3.1 Запит покупця стає фільтрами каталогу")]
    public async Task RequestBecomesCatalogFilters()
    {
        using var app = new FarmCartApp();
        var buyer = await app.LoginAsync("+380971234567");
        app.SearchInterpreter.Intent = new SearchIntent("мед", "honey", true, 100m, 300m, 20, CatalogSort.PriceAsc, DayOfWeek.Saturday);

        var reply = await buyer.PostJson(Url, new { query = "  недорогий сертифікований мед на суботу  " });

        Assert.True(reply.GetProperty("understood").GetBoolean());
        Assert.Equal(("мед", "honey"), (reply.Str("text"), reply.Str("category")));
        Assert.True(reply.GetProperty("certified").GetBoolean());
        Assert.Equal((100m, 300m), (reply.Dec("minPrice"), reply.Dec("maxPrice")));
        Assert.Equal(20, reply.GetProperty("maxKm").GetInt32());
        Assert.Equal(("PriceAsc", "Saturday"), (reply.Str("sort"), reply.Str("deliveryDay")));
        Assert.Equal("недорогий сертифікований мед на суботу", app.SearchInterpreter.Received[0].Request);
    }

    [Fact(DisplayName = "AI-3.2 Сервіс отримує назви товарів каталогу й сьогоднішній день")]
    public async Task InterpreterReceivesProductNamesAndToday()
    {
        using var app = new FarmCartApp();
        var farmer = await app.VerifiedFarmerAsync("+380671110001", "Ферма «Зелений Гай»");
        await farmer.PublishAsync("Морква", "vegetables", 16m);
        var buyer = await app.LoginAsync("+380971234567");

        await buyer.PostJson(Url, new { query = "морква" });

        var context = app.SearchInterpreter.Received[0];
        Assert.Equal(["Морква / Carrots"], context.ProductNames);
        Assert.Equal(app.Clock.Now.DayOfWeek, context.Today);
    }

    [Fact(DisplayName = "AI-3.3 Незрозумілий запит не змінює фільтри")]
    public async Task EmptyIntentIsReportedAsNotUnderstood()
    {
        using var app = new FarmCartApp();
        var buyer = await app.LoginAsync("+380971234567");
        app.SearchInterpreter.Intent = new SearchIntent();

        var reply = await buyer.PostJson(Url, new { query = "яка сьогодні погода?" });

        Assert.False(reply.GetProperty("understood").GetBoolean());
    }

    public static TheoryData<SearchIntent, SearchIntent> UnusableValues => new()
    {
        { new SearchIntent(Category: "cars"), new SearchIntent() },
        { new SearchIntent(Text: "   "), new SearchIntent() },
        { new SearchIntent(Text: new string('м', 81)), new SearchIntent() },
        { new SearchIntent(MinPrice: -5m, MaxPrice: -1m), new SearchIntent() },
        { new SearchIntent(MinPrice: 300m, MaxPrice: 100m), new SearchIntent(MinPrice: 100m, MaxPrice: 300m) },
        { new SearchIntent(MaxKm: 15), new SearchIntent(MaxKm: 20) },
        { new SearchIntent(MaxKm: 5), new SearchIntent(MaxKm: 5) },
        { new SearchIntent(MaxKm: 51), new SearchIntent() },
        { new SearchIntent(MaxKm: -3), new SearchIntent() },
        { new SearchIntent(Sort: (CatalogSort)99), new SearchIntent() },
        { new SearchIntent(DeliveryDay: (DayOfWeek)9), new SearchIntent() },
        { new SearchIntent(Category: "HONEY"), new SearchIntent(Category: "honey") },
    };

    [Theory(DisplayName = "AI-3.4 Відповідь сервісу приводиться до значень, які розуміє каталог")]
    [MemberData(nameof(UnusableValues))]
    public async Task IntentIsNormalized(SearchIntent returned, SearchIntent expected)
    {
        using var app = new FarmCartApp();
        var service = app.Services.GetRequiredService<SmartSearchService>();
        app.SearchInterpreter.Intent = returned;
        var buyer = Buyer(app);

        var result = await service.InterpretAsync(buyer, "запит");

        Assert.Equal(expected, result);
    }

    private static User Buyer(FarmCartApp app)
    {
        lock (app.Store.Sync)
        {
            return app.Store.AddUser("+380971234567", "Покупець", Role.Buyer);
        }
    }

    [Theory(DisplayName = "AI-3.5 Порожній чи задовгий запит відхиляється без звернення до сервісу")]
    [InlineData("   ")]
    [InlineData(null)]
    [InlineData("TOO_LONG")]
    public async Task InvalidRequestsNeverReachTheService(string? query)
    {
        using var app = new FarmCartApp();
        var buyer = await app.LoginAsync("+380971234567");
        var text = query == "TOO_LONG" ? new string('м', SmartSearchService.RequestMaxLength + 1) : query;

        var response = await buyer.PostAsJsonAsync(Url, new { query = text });

        Assert.Equal((HttpStatusCode.BadRequest, "smart_search_invalid"), (response.StatusCode, await response.ErrorCode()));
        Assert.Empty(app.SearchInterpreter.Received);
    }

    [Fact(DisplayName = "AI-3.6 Платний пошук доступний лише після входу")]
    public async Task AnonymousVisitorsCannotSpendRequests()
    {
        using var app = new FarmCartApp();

        var response = await app.CreateClient().PostAsJsonAsync(Url, new { query = "мед" });

        Assert.Equal((HttpStatusCode.Unauthorized, "auth_required"), (response.StatusCode, await response.ErrorCode()));
        Assert.Empty(app.SearchInterpreter.Received);
    }

    [Fact(DisplayName = "AI-3.7 Клієнт дізнається, чи ввімкнено розумний пошук, а вимкнений дає зрозумілу помилку")]
    public async Task StatusAndDisabledSearch()
    {
        using var app = new FarmCartApp();
        var buyer = await app.LoginAsync("+380971234567");

        var on = await app.CreateClient().GetJson(Url);
        app.SearchInterpreter.IsAvailable = false;
        var off = await app.CreateClient().GetJson(Url);
        var response = await buyer.PostAsJsonAsync(Url, new { query = "мед" });

        Assert.True(on.GetProperty("available").GetBoolean());
        Assert.False(off.GetProperty("available").GetBoolean());
        Assert.Equal((HttpStatusCode.ServiceUnavailable, "smart_search_unavailable"), (response.StatusCode, await response.ErrorCode()));
    }

    [Fact(DisplayName = "AI-3.8 Кількість запитів на годину обмежена для кожного покупця окремо")]
    public async Task RequestsAreLimitedPerBuyerPerHour()
    {
        using var app = new FarmCartApp();
        var buyer = await app.LoginAsync("+380971234567");
        var other = await app.LoginAsync("+380971234568");
        for (var i = 0; i < SmartSearchService.RequestsPerHour; i++)
        {
            await buyer.PostJson(Url, new { query = "мед" });
        }

        var overLimit = await buyer.PostAsJsonAsync(Url, new { query = "мед" });
        var otherBuyer = await other.PostAsJsonAsync(Url, new { query = "мед" });
        app.Clock.Advance(TimeSpan.FromHours(1));
        var nextHour = await buyer.PostAsJsonAsync(Url, new { query = "мед" });

        Assert.Equal((HttpStatusCode.TooManyRequests, "smart_search_limit"), (overLimit.StatusCode, await overLimit.ErrorCode()));
        Assert.Equal(HttpStatusCode.OK, otherBuyer.StatusCode);
        Assert.Equal(HttpStatusCode.OK, nextHour.StatusCode);
    }
}

/// <summary>AI-4: звернення до Claude перевіряється на підставній HTTP-відповіді, без мережі й без витрат.</summary>
public sealed class ClaudeCatalogSearchInterpreterTests
{
    private static readonly SmartSearchContext Context = new("недорогий мед на завтра", DayOfWeek.Friday, ["Мед липовий / Linden honey"]);

    private sealed class StubHandler(HttpStatusCode status, string body) : HttpMessageHandler
    {
        public string? Sent { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Sent = await request.Content!.ReadAsStringAsync(cancellationToken);
            return new HttpResponseMessage(status) { Content = new StringContent(body, Encoding.UTF8, "application/json") };
        }
    }

    private static string Message(string text) => JsonSerializer.Serialize(new
    {
        id = "msg_test",
        type = "message",
        role = "assistant",
        model = ClaudeJsonClient.Model,
        content = new[] { new { type = "text", text } },
        stop_reason = "end_turn",
        stop_sequence = (string?)null,
        usage = new { input_tokens = 10, output_tokens = 10 },
    });

    private static ClaudeCatalogSearchInterpreter Interpreter(StubHandler handler) => new(new ClaudeJsonClient(
        new AnthropicClient { ApiKey = "test-key", HttpClient = new HttpClient(handler), MaxRetries = 0 },
        NullLogger<ClaudeJsonClient>.Instance));

    [Fact(DisplayName = "AI-4.1 Відповідь стає фільтрами, а до сервісу йдуть лише запит, день і довідники")]
    public async Task ReplyBecomesIntent()
    {
        var reply = """{ "text": "Мед", "category": "honey", "certified": true, "minPrice": null, "maxPrice": 300, "maxKm": 20, "sort": "PriceAsc", "deliveryDay": "Saturday" }""";
        var handler = new StubHandler(HttpStatusCode.OK, Message(reply));

        var intent = await Interpreter(handler).InterpretAsync(Context, CancellationToken.None);

        Assert.Equal(new SearchIntent("Мед", "honey", true, null, 300m, 20, CatalogSort.PriceAsc, DayOfWeek.Saturday), intent);
        using var sent = JsonDocument.Parse(handler.Sent!);
        var content = sent.RootElement.GetProperty("messages")[0].GetProperty("content").ToString();
        Assert.Contains("недорогий мед на завтра", content, StringComparison.Ordinal);
        Assert.Contains("Friday", content, StringComparison.Ordinal);
        Assert.Contains("Мед липовий / Linden honey", content, StringComparison.Ordinal);
    }

    [Fact(DisplayName = "AI-4.2 Невідомі сортування й день ігноруються")]
    public async Task UnknownEnumsAreIgnored()
    {
        var reply = """{ "text": null, "category": null, "certified": false, "minPrice": null, "maxPrice": null, "maxKm": null, "sort": "Random", "deliveryDay": "Funday" }""";

        var intent = await Interpreter(new StubHandler(HttpStatusCode.OK, Message(reply))).InterpretAsync(Context, CancellationToken.None);

        Assert.True(intent.IsEmpty);
    }

    [Theory(DisplayName = "AI-4.3 Невдача сервісу стає зрозумілою помилкою пошуку")]
    [InlineData(HttpStatusCode.OK, "це не JSON")]
    [InlineData(HttpStatusCode.TooManyRequests, """{ "type": "error", "error": { "type": "rate_limit_error", "message": "slow down" } }""")]
    public async Task FailuresBecomeSmartSearchFailed(HttpStatusCode status, string reply)
    {
        var body = status == HttpStatusCode.OK ? Message(reply) : reply;

        var error = await Assert.ThrowsAsync<DomainException>(() =>
            Interpreter(new StubHandler(status, body)).InterpretAsync(Context, CancellationToken.None));

        Assert.Equal((ErrorKind.Unavailable, "smart_search_failed"), (error.Kind, error.Code));
    }

    [Theory(DisplayName = "AI-4.4 Без ключа API пошук вимкнено; з ключем працює Claude; у розробці можна ввімкнути імітацію")]
    [InlineData(null, false, typeof(UnavailableCatalogSearchInterpreter))]
    [InlineData("test-key", false, typeof(ClaudeCatalogSearchInterpreter))]
    [InlineData("test-key", true, typeof(KeywordCatalogSearchInterpreter))]
    public void InterpreterIsChosenFromConfiguration(string? apiKey, bool fake, Type expected)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                [ClaudeJsonClient.ApiKeySetting] = apiKey,
                ["FarmCart:FakeAi"] = fake.ToString(),
            })
            .Build();
        using var services = new ServiceCollection().AddLogging().AddFarmCart(configuration).BuildServiceProvider();

        Assert.IsType(expected, services.GetRequiredService<ICatalogSearchInterpreter>());
    }

    [Theory(DisplayName = "AI-4.5 Імітація розпізнає категорію, сертифікат, ціну й відстань")]
    [InlineData("дешевий сертифікований мед до 300 грн у межах 20 км", "honey", true, 300, 20, CatalogSort.PriceAsc)]
    [InlineData("cheap organic honey under 150 within 10 km", "honey", true, 150, 10, CatalogSort.PriceAsc)]
    [InlineData("мед до 20 км", "honey", false, null, 20, null)]
    public async Task KeywordInterpreterRecognizesFilters(string request, string category, bool certified, int? maxPrice, int? maxKm, CatalogSort? sort)
    {
        var intent = await new KeywordCatalogSearchInterpreter().InterpretAsync(new SmartSearchContext(request, DayOfWeek.Monday, []), CancellationToken.None);

        Assert.Equal(new SearchIntent(null, category, certified, null, maxPrice, maxKm, sort), intent);
    }

    [Fact(DisplayName = "AI-4.6 Вимкнений сервіс повідомляє про це")]
    public async Task UnavailableInterpreterThrows()
    {
        var error = await Assert.ThrowsAsync<DomainException>(() =>
            new UnavailableCatalogSearchInterpreter().InterpretAsync(Context, CancellationToken.None));

        Assert.Equal("smart_search_unavailable", error.Code);
    }
}
