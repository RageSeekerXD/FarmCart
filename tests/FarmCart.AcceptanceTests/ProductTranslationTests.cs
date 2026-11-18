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

/// <summary>Керований перекладач: тести не звертаються до зовнішнього сервісу навіть за наявності ключа API.</summary>
public sealed class ScriptedTranslator : IProductTranslator
{
    public bool IsAvailable { get; set; } = true;

    public List<ProductText> Received { get; } = [];

    public Func<ProductText, string> Translate { get; set; } = item => $"translated {item.Field}";

    public Task<IReadOnlyList<ProductText>> TranslateAsync(IReadOnlyList<ProductText> items, CancellationToken cancellation)
    {
        Received.AddRange(items);
        return Task.FromResult<IReadOnlyList<ProductText>>([.. items.Select(item => item with { Text = Translate(item) })]);
    }
}

/// <summary>AI-1: фермер заповнює поле товару однією мовою, а сервіс пропонує переклад іншою.</summary>
public sealed class ProductTranslationTests
{
    private const string Url = "/api/farmer/products/translation";

    private static object Item(string field = "name", string targetLang = "en", string text = "Мед липовий") =>
        new { field, targetLang, text };

    [Fact(DisplayName = "AI-1.1 Верифікований фермер отримує переклад кожного поля потрібною мовою")]
    public async Task VerifiedFarmerGetsTranslations()
    {
        using var app = new FarmCartApp();
        var farmer = await app.VerifiedFarmerAsync("+380671110001", "Ферма «Зелений Гай»");
        app.Translator.Translate = item => item.Field == "name" ? "Linden honey" : "Зберігати в прохолоді";

        var reply = await farmer.PostJson(Url, new { items = new[] { Item(), Item("storage", "uk", "Keep cool") } });

        var items = reply.GetProperty("items");
        Assert.Equal(("name", "en", "Linden honey"), (items[0].Str("field"), items[0].Str("targetLang"), items[0].Str("text")));
        Assert.Equal(("storage", "uk", "Зберігати в прохолоді"), (items[1].Str("field"), items[1].Str("targetLang"), items[1].Str("text")));
    }

    [Fact(DisplayName = "AI-1.2 Клієнт дізнається, чи ввімкнено переклад")]
    public async Task StatusShowsWhetherTranslationIsOn()
    {
        using var app = new FarmCartApp();
        var farmer = await app.VerifiedFarmerAsync("+380671110001", "Ферма «Зелений Гай»");

        var on = await farmer.GetJson(Url);
        app.Translator.IsAvailable = false;
        var off = await farmer.GetJson(Url);

        Assert.True(on.GetProperty("available").GetBoolean());
        Assert.False(off.GetProperty("available").GetBoolean());
    }

    [Fact(DisplayName = "AI-1.3 Вимкнений переклад дає зрозумілу помилку")]
    public async Task DisabledTranslationIsReported()
    {
        using var app = new FarmCartApp();
        var farmer = await app.VerifiedFarmerAsync("+380671110001", "Ферма «Зелений Гай»");
        app.Translator.IsAvailable = false;

        var response = await farmer.PostAsJsonAsync(Url, new { items = new[] { Item() } });

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Equal("translation_unavailable", await response.ErrorCode());
    }

    [Fact(DisplayName = "AI-1.4 Покупець і неверифікований продавець не можуть витрачати платний переклад")]
    public async Task OnlyVerifiedFarmersCanTranslate()
    {
        using var app = new FarmCartApp();
        var buyer = await app.LoginAsync("+380971234567");
        var pending = await app.LoginAsync("+380671110002");
        await pending.PostAsJsonAsync("/api/farmers", new { farmName = HttpJson.Bilingual("Морква"), lat = 49.8, lon = 24.0, certified = false });

        var byBuyer = await buyer.PostAsJsonAsync(Url, new { items = new[] { Item() } });
        var byPending = await pending.PostAsJsonAsync(Url, new { items = new[] { Item() } });

        Assert.Equal((HttpStatusCode.Forbidden, "not_a_farmer"), (byBuyer.StatusCode, await byBuyer.ErrorCode()));
        Assert.Equal((HttpStatusCode.Forbidden, "farmer_not_verified"), (byPending.StatusCode, await byPending.ErrorCode()));
        Assert.Empty(app.Translator.Received);
    }

    public static TheoryData<string> InvalidRequests => new()
    {
        """{ "items": [] }""",
        """{ }""",
        """{ "items": [{ "field": "price", "targetLang": "en", "text": "10" }] }""",
        """{ "items": [{ "field": "name", "targetLang": "de", "text": "Мед" }] }""",
        """{ "items": [{ "field": "name", "targetLang": "en", "text": "   " }] }""",
        """{ "items": [{ "field": "name", "targetLang": "en" }] }""",
        """{ "items": [{ "field": "name", "targetLang": "en", "text": "Мед" }, { "field": "name", "targetLang": "uk", "text": "Honey" }] }""",
    };

    [Theory(DisplayName = "AI-1.5 Некоректний запит відхиляється без звернення до сервісу перекладу")]
    [MemberData(nameof(InvalidRequests))]
    public async Task InvalidRequestsNeverReachTheTranslator(string body)
    {
        using var app = new FarmCartApp();
        var farmer = await app.VerifiedFarmerAsync("+380671110001", "Ферма «Зелений Гай»");

        var response = await farmer.PostAsync(Url, new StringContent(body, Encoding.UTF8, "application/json"));

        Assert.Equal((HttpStatusCode.BadRequest, "translation_invalid"), (response.StatusCode, await response.ErrorCode()));
        Assert.Empty(app.Translator.Received);
    }

    [Fact(DisplayName = "AI-1.6 Задовгий текст відхиляється за межами довжини поля")]
    public async Task TextOverTheFieldLimitIsRejected()
    {
        using var app = new FarmCartApp();
        var farmer = await app.VerifiedFarmerAsync("+380671110001", "Ферма «Зелений Гай»");

        var response = await farmer.PostAsJsonAsync(Url, new { items = new[] { Item(text: new string('м', ProductTranslationService.NameMaxLength + 1)) } });

        Assert.Equal("translation_invalid", await response.ErrorCode());
    }

    [Theory(DisplayName = "AI-1.7 Порожній чи задовгий переклад не потрапляє у форму")]
    [InlineData("   ")]
    [InlineData(null)]
    public async Task UnusableTranslationIsRejected(string? translated)
    {
        using var app = new FarmCartApp();
        var farmer = await app.VerifiedFarmerAsync("+380671110001", "Ферма «Зелений Гай»");
        app.Translator.Translate = _ => translated ?? new string('x', ProductTranslationService.NameMaxLength + 1);

        var response = await farmer.PostAsJsonAsync(Url, new { items = new[] { Item() } });

        Assert.Equal((HttpStatusCode.ServiceUnavailable, "translation_failed"), (response.StatusCode, await response.ErrorCode()));
    }

    [Fact(DisplayName = "AI-1.8 Кількість перекладів на годину обмежена для кожного фермера окремо")]
    public async Task TranslationsAreLimitedPerFarmerPerHour()
    {
        using var app = new FarmCartApp();
        var farmer = await app.VerifiedFarmerAsync("+380671110001", "Ферма «Зелений Гай»");
        var other = await app.VerifiedFarmerAsync("+380671110002", "Сироварня «Карпатська бринза»");
        for (var i = 0; i < ProductTranslationService.RequestsPerHour; i++)
        {
            await farmer.PostJson(Url, new { items = new[] { Item() } });
        }

        var overLimit = await farmer.PostAsJsonAsync(Url, new { items = new[] { Item() } });
        var otherFarmer = await other.PostAsJsonAsync(Url, new { items = new[] { Item() } });
        app.Clock.Advance(TimeSpan.FromHours(1));
        var nextHour = await farmer.PostAsJsonAsync(Url, new { items = new[] { Item() } });

        Assert.Equal((HttpStatusCode.TooManyRequests, "translation_limit"), (overLimit.StatusCode, await overLimit.ErrorCode()));
        Assert.Equal(HttpStatusCode.OK, otherFarmer.StatusCode);
        Assert.Equal(HttpStatusCode.OK, nextHour.StatusCode);
    }
}

/// <summary>AI-2: звернення до Claude перевіряється на підставній HTTP-відповіді, без мережі й без витрат.</summary>
public sealed class ClaudeProductTranslatorTests
{
    private static readonly ProductText[] Items = [new("name", "en", "Мед липовий"), new("storage", "uk", "Keep at +2…+6 °C")];

    private sealed class StubHandler(HttpStatusCode status, string body) : HttpMessageHandler
    {
        public string? Sent { get; private set; }

        public int Calls { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Calls++;
            Sent = await request.Content!.ReadAsStringAsync(cancellationToken);
            return new HttpResponseMessage(status) { Content = new StringContent(body, Encoding.UTF8, "application/json") };
        }
    }

    private static string Message(string text, string stopReason = "end_turn") => JsonSerializer.Serialize(new
    {
        id = "msg_test",
        type = "message",
        role = "assistant",
        model = ClaudeJsonClient.Model,
        content = new[] { new { type = "text", text } },
        stop_reason = stopReason,
        stop_sequence = (string?)null,
        usage = new { input_tokens = 10, output_tokens = 10 },
    });

    private static ClaudeProductTranslator Translator(StubHandler handler) => new(new ClaudeJsonClient(
        new AnthropicClient { ApiKey = "test-key", HttpClient = new HttpClient(handler), MaxRetries = 0 },
        NullLogger<ClaudeJsonClient>.Instance));

    [Fact(DisplayName = "AI-2.1 Переклади повертаються для своїх полів, а до сервісу йдуть лише тексти форми")]
    public async Task ReturnsTranslationsForTheirFields()
    {
        var reply = """{ "translations": [{ "field": "storage", "text": "Зберігати при +2…+6 °C" }, { "field": "name", "text": "Linden honey" }] }""";
        var handler = new StubHandler(HttpStatusCode.OK, Message(reply));

        var result = await Translator(handler).TranslateAsync(Items, CancellationToken.None);

        Assert.Equal([new ProductText("name", "en", "Linden honey"), new ProductText("storage", "uk", "Зберігати при +2…+6 °C")], result);
        using var sent = JsonDocument.Parse(handler.Sent!);
        Assert.Equal(ClaudeJsonClient.Model, sent.RootElement.GetProperty("model").GetString());
        Assert.Contains("Мед липовий", sent.RootElement.GetProperty("messages")[0].GetProperty("content").ToString(), StringComparison.Ordinal);
    }

    public static TheoryData<HttpStatusCode, string> FailedReplies => new()
    {
        { HttpStatusCode.OK, Message("це не JSON") },
        { HttpStatusCode.OK, Message("null") },
        { HttpStatusCode.OK, Message("{}", "refusal") },
        { HttpStatusCode.OK, Message("""{ "translations": [] """, "max_tokens") },
        { HttpStatusCode.Unauthorized, """{ "type": "error", "error": { "type": "authentication_error", "message": "invalid key" } }""" },
        { HttpStatusCode.TooManyRequests, """{ "type": "error", "error": { "type": "rate_limit_error", "message": "slow down" } }""" },
        { HttpStatusCode.InternalServerError, """{ "type": "error", "error": { "type": "api_error", "message": "oops" } }""" },
        { HttpStatusCode.BadRequest, """{ "type": "error", "error": { "type": "invalid_request_error", "message": "bad" } }""" },
    };

    [Theory(DisplayName = "AI-2.2 Будь-яка невдача сервісу стає зрозумілою помилкою перекладу")]
    [MemberData(nameof(FailedReplies))]
    public async Task FailuresBecomeTranslationFailed(HttpStatusCode status, string body)
    {
        var error = await Assert.ThrowsAsync<DomainException>(() =>
            Translator(new StubHandler(status, body)).TranslateAsync(Items, CancellationToken.None));

        Assert.Equal((ErrorKind.Unavailable, "translation_failed"), (error.Kind, error.Code));
    }

    [Theory(DisplayName = "AI-2.3 Без ключа API переклад вимкнено; з ключем працює Claude; у розробці можна ввімкнути імітацію")]
    [InlineData(null, false, typeof(UnavailableProductTranslator))]
    [InlineData("  ", false, typeof(UnavailableProductTranslator))]
    [InlineData("test-key", false, typeof(ClaudeProductTranslator))]
    [InlineData("test-key", true, typeof(EchoProductTranslator))]
    public void TranslatorIsChosenFromConfiguration(string? apiKey, bool fake, Type expected)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                [ClaudeJsonClient.ApiKeySetting] = apiKey,
                ["FarmCart:FakeAi"] = fake.ToString(),
            })
            .Build();
        using var services = new ServiceCollection().AddLogging().AddFarmCart(configuration).BuildServiceProvider();

        Assert.IsType(expected, services.GetRequiredService<IProductTranslator>());
    }

    [Fact(DisplayName = "AI-2.4 Імітація позначає мову перекладу й не виходить за межу довжини поля")]
    public async Task EchoTranslatorStaysWithinTheFieldLimit()
    {
        var text = new string('м', ProductTranslationService.NameMaxLength);

        var result = await new EchoProductTranslator().TranslateAsync([new ProductText("name", "en", text)], CancellationToken.None);

        Assert.StartsWith("[en] ", result[0].Text, StringComparison.Ordinal);
        Assert.Equal(ProductTranslationService.NameMaxLength, result[0].Text.Length);
    }
}
