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

/// <summary>Керований ШІ: тести не звертаються до зовнішнього сервісу навіть за наявності ключа API.</summary>
public sealed class ScriptedFarmCartAi : IFarmCartAi
{
    public bool IsAvailable { get; set; } = true;

    public List<IReadOnlyList<ReviewForAi>> Summarized { get; } = [];

    public List<IReadOnlyList<ReviewForAi>> Moderated { get; } = [];

    public List<BasketBrief> Baskets { get; } = [];

    public List<DocumentForAi> Documents { get; } = [];

    public int Suggestions { get; private set; }

    public bool FailSummaries { get; set; }

    public ReviewSummary Summary { get; set; } = new(new LocalizedText("Смачно", "Tasty"), null);

    public ProductSuggestion Suggestion { get; set; } = new(new LocalizedText("Морква", "Carrots"), "vegetables", new LocalizedText("Свіжа морква", "Fresh carrots"));

    public Func<BasketBrief, BasketDraft> Basket { get; set; } = _ => new BasketDraft([], []);

    public Func<IReadOnlyList<ReviewForAi>, IReadOnlyList<ModerationAdvice>> Moderation { get; set; } = _ => [];

    public DocumentCheck Document { get; set; } = new(new LocalizedText("Сертифікат", "Certificate"), "Зелений Гай", "UA-1", "2026-01-01", "2027-01-01", []);

    public Task<ReviewSummary> SummarizeReviewsAsync(IReadOnlyList<ReviewForAi> reviews, CancellationToken cancellation)
    {
        Summarized.Add(reviews);
        return FailSummaries ? throw AiAssistantService.Failed() : Task.FromResult(Summary);
    }

    public Task<ProductSuggestion> SuggestProductAsync(ProductPhotoForAi photo, CancellationToken cancellation)
    {
        Suggestions++;
        return Task.FromResult(Suggestion);
    }

    public Task<BasketDraft> PlanBasketAsync(BasketBrief brief, CancellationToken cancellation)
    {
        Baskets.Add(brief);
        return Task.FromResult(Basket(brief));
    }

    public Task<IReadOnlyList<ModerationAdvice>> CheckReviewsAsync(IReadOnlyList<ReviewForAi> reviews, CancellationToken cancellation)
    {
        Moderated.Add(reviews);
        return Task.FromResult(Moderation(reviews));
    }

    public Task<DocumentCheck> CheckDocumentAsync(DocumentForAi document, CancellationToken cancellation)
    {
        Documents.Add(document);
        return Task.FromResult(Document);
    }
}

/// <summary>AI-5…AI-9: підказки ШІ для покупців, фермерів і адміністраторів; рішення лишається за людиною.</summary>
public sealed class AiAssistantTests
{
    private static readonly byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3, 4];

    private static ByteArrayContent Photo(byte[] data, string type = "image/png") => new(data) { Headers = { ContentType = new(type) } };

    private static async Task<int> FarmerIdAsync(HttpClient farmer) => (await farmer.GetJson("/api/farmer/profile")).Id();

    private static int AddReview(FarmCartApp app, int farmerId, string? comment, int rating = 5)
    {
        lock (app.Store.Sync)
        {
            var id = app.Store.NextId<Review>();
            app.Store.Reviews.Add(id, new Review { Id = id, OrderId = 1000 + id, BuyerId = 1, FarmerId = farmerId, Rating = rating, Comment = comment, Author = "Оксана Д.", At = app.Clock.Now });
            return id;
        }
    }

    private static async Task<(HttpClient Farmer, int FarmerId)> FarmAsync(FarmCartApp app)
    {
        var farmer = await app.VerifiedFarmerAsync("+380671110001", "Ферма «Зелений Гай»");
        return (farmer, await FarmerIdAsync(farmer));
    }

    [Fact(DisplayName = "AI-5.1 Гість бачить підсумок відгуків; повторний перегляд не викликає ШІ, а зміна відгуків оновлює підсумок")]
    public async Task SummaryIsCachedUntilReviewsChange()
    {
        using var app = new FarmCartApp();
        var (_, farmerId) = await FarmAsync(app);
        var hidden = AddReview(app, farmerId, "Дуже смачно");
        AddReview(app, farmerId, "Свіже");
        AddReview(app, farmerId, "Швидка доставка");
        AddReview(app, farmerId, "Рекомендую");
        AddReview(app, farmerId, null);
        var guest = app.CreateClient();
        var admin = await app.AdminAsync();

        var first = await guest.GetJson($"/api/farmers/{farmerId}/reviews/summary");
        await guest.GetJson($"/api/farmers/{farmerId}/reviews/summary");
        (await admin.PostAsJsonAsync($"/api/admin/reviews/{hidden}/hide", new { reason = "Реклама" })).EnsureSuccessStatusCode();
        await guest.GetJson($"/api/farmers/{farmerId}/reviews/summary");

        Assert.Equal("Tasty", first.GetProperty("summary").GetProperty("likes").Str("en"));
        Assert.Equal(2, app.FarmCartAi.Summarized.Count);
        Assert.Equal(4, app.FarmCartAi.Summarized[0].Count);
        Assert.DoesNotContain(app.FarmCartAi.Summarized[1], review => review.Id == hidden);
    }

    [Fact(DisplayName = "AI-5.2 Менше трьох відгуків із текстом - підсумку немає й ШІ не викликається")]
    public async Task TooFewReviewsHaveNoSummary()
    {
        using var app = new FarmCartApp();
        var (_, farmerId) = await FarmAsync(app);
        AddReview(app, farmerId, "Смачно");
        AddReview(app, farmerId, "Свіже");
        AddReview(app, farmerId, "   ");

        var reply = await app.CreateClient().GetJson($"/api/farmers/{farmerId}/reviews/summary");

        Assert.Equal(JsonValueKind.Null, reply.GetProperty("summary").ValueKind);
        Assert.Empty(app.FarmCartAi.Summarized);
    }

    [Fact(DisplayName = "AI-5.3 Невдача ШІ не ламає сторінку, а повторна спроба - лише через 10 хвилин")]
    public async Task FailedSummaryIsRetriedLater()
    {
        using var app = new FarmCartApp();
        var (_, farmerId) = await FarmAsync(app);
        for (var i = 0; i < 3; i++)
        {
            AddReview(app, farmerId, $"Відгук {i}");
        }

        var guest = app.CreateClient();
        app.FarmCartAi.FailSummaries = true;

        var failed = await guest.GetJson($"/api/farmers/{farmerId}/reviews/summary");
        await guest.GetJson($"/api/farmers/{farmerId}/reviews/summary");
        var callsWhileWaiting = app.FarmCartAi.Summarized.Count;
        app.FarmCartAi.FailSummaries = false;
        app.Clock.Advance(TimeSpan.FromMinutes(10));
        var retried = await guest.GetJson($"/api/farmers/{farmerId}/reviews/summary");

        Assert.Equal(JsonValueKind.Null, failed.GetProperty("summary").ValueKind);
        Assert.Equal(1, callsWhileWaiting);
        Assert.Equal(JsonValueKind.Object, retried.GetProperty("summary").ValueKind);
    }

    [Fact(DisplayName = "AI-5.4 Підсумок товару будується з відгуків тих, хто купив саме цей товар")]
    public async Task ProductSummaryUsesItsBuyersReviews()
    {
        using var app = new FarmCartApp();
        var (farmer, apples, slot) = await Journeys.FarmWithApplesAsync(app);
        var (courier, courierId) = await Journeys.CourierAsync(app);
        for (var i = 0; i < 3; i++)
        {
            var buyer = await app.LoginAsync($"+38097123456{i}");
            var orderId = await Journeys.OrderAsync(buyer, apples, 1, slot);
            await Journeys.SendAsync(farmer, orderId, courierId);
            await Journeys.DeliverAsync(buyer, courier, orderId);
            (await buyer.PostAsJsonAsync($"/api/orders/{orderId}/review", new { rating = 5, comment = $"Смачні яблука {i}" })).EnsureSuccessStatusCode();
        }

        var reply = await app.CreateClient().GetJson($"/api/products/{apples}/reviews/summary");

        Assert.Equal("Смачно", reply.GetProperty("summary").GetProperty("likes").Str("uk"));
        Assert.Equal(3, app.FarmCartAi.Summarized.Single().Count);
    }

    [Fact(DisplayName = "AI-6.1 Верифікований фермер отримує чернетку товару за фото; невідома категорія відкидається")]
    public async Task FarmerGetsDraftFromPhoto()
    {
        using var app = new FarmCartApp();
        var (farmer, _) = await FarmAsync(app);
        app.FarmCartAi.Suggestion = new ProductSuggestion(new LocalizedText("Морква", "Carrots"), "cars", new LocalizedText("Опис", ""));

        var reply = await (await farmer.PostAsync("/api/farmer/products/suggestion", Photo(Png))).Json();

        Assert.True(reply.GetProperty("understood").GetBoolean());
        Assert.Equal("Carrots", reply.GetProperty("name").Str("en"));
        Assert.Equal(JsonValueKind.Null, reply.GetProperty("category").ValueKind);
        Assert.Equal(JsonValueKind.Null, reply.GetProperty("description").ValueKind);
    }

    [Fact(DisplayName = "AI-6.2 Фото без упізнаного товару не заповнює форму")]
    public async Task UnrecognizedPhotoIsReported()
    {
        using var app = new FarmCartApp();
        var (farmer, _) = await FarmAsync(app);
        app.FarmCartAi.Suggestion = new ProductSuggestion(null, null, null);

        var reply = await (await farmer.PostAsync("/api/farmer/products/suggestion", Photo(Png))).Json();

        Assert.False(reply.GetProperty("understood").GetBoolean());
    }

    [Fact(DisplayName = "AI-6.3 Не фото, завелике фото й покупець без ферми не доходять до ШІ")]
    public async Task InvalidDraftRequestsNeverReachAi()
    {
        using var app = new FarmCartApp();
        var (farmer, _) = await FarmAsync(app);
        var buyer = await app.LoginAsync("+380971234567");

        var notImage = await farmer.PostAsync("/api/farmer/products/suggestion", Photo([1, 2, 3]));
        var tooLarge = await farmer.PostAsync("/api/farmer/products/suggestion", Photo(new byte[FarmerService.PhotoMaxBytes + 1]));
        var byBuyer = await buyer.PostAsync("/api/farmer/products/suggestion", Photo(Png));

        Assert.Equal("photo_type_invalid", await notImage.ErrorCode());
        Assert.Equal("photo_too_large", await tooLarge.ErrorCode());
        Assert.Equal("not_a_farmer", await byBuyer.ErrorCode());
        Assert.Equal(0, app.FarmCartAi.Suggestions);
    }

    [Fact(DisplayName = "AI-6.4 Кількість чернеток на годину обмежена")]
    public async Task DraftsAreLimited()
    {
        using var app = new FarmCartApp();
        var (farmer, _) = await FarmAsync(app);
        for (var i = 0; i < AiAssistantService.SuggestionsPerHour; i++)
        {
            (await farmer.PostAsync("/api/farmer/products/suggestion", Photo(Png))).EnsureSuccessStatusCode();
        }

        var overLimit = await farmer.PostAsync("/api/farmer/products/suggestion", Photo(Png));

        Assert.Equal((HttpStatusCode.TooManyRequests, "ai_limit"), (overLimit.StatusCode, await overLimit.ErrorCode()));
    }

    [Fact(DisplayName = "AI-7.1 Кошик за рецептом містить лише наявні товари в межах залишку")]
    public async Task BasketUsesOnlyAvailableProducts()
    {
        using var app = new FarmCartApp();
        var (farmer, _) = await FarmAsync(app);
        var carrots = await farmer.PublishAsync("Морква", "vegetables", 16m, stock: 5);
        var potatoes = await farmer.PublishAsync("Картопля", "vegetables", 12m, stock: 50);
        var soldOut = await farmer.PublishAsync("Буряк", "vegetables", 14m, stock: 0);
        var buyer = await app.LoginAsync("+380971234567");
        app.FarmCartAi.Basket = _ => new BasketDraft(
            [new(carrots, 9), new(carrots, 1), new(potatoes, 2), new(soldOut, 1), new(9999, 1), new(potatoes, 0)],
            [" сметана ", "", "Сметана", new string('x', 61)]);

        var reply = await buyer.PostJson("/api/catalog/basket-plan", new { request = "  борщ на шістьох ", lang = "en" });

        var lines = reply.GetProperty("lines");
        Assert.Equal(2, lines.GetArrayLength());
        Assert.Equal((carrots, 5), (lines[0].GetProperty("item").GetProperty("productId").GetInt32(), lines[0].GetProperty("quantity").GetInt32()));
        Assert.Equal((potatoes, 2), (lines[1].GetProperty("item").GetProperty("productId").GetInt32(), lines[1].GetProperty("quantity").GetInt32()));
        Assert.Equal(["сметана"], reply.GetProperty("missing").EnumerateArray().Select(item => item.GetString()));
        var brief = app.FarmCartAi.Baskets.Single();
        Assert.Equal(("борщ на шістьох", "en"), (brief.Request, brief.Lang));
        Assert.Equal(["Carrots", "Potatoes"], brief.Products.Select(product => product.Name).Order());
        Assert.Empty((await buyer.GetJson("/api/cart")).GetProperty("lines").EnumerateArray());
    }

    [Theory(DisplayName = "AI-7.2 Порожній чи задовгий рецепт відхиляється")]
    [InlineData("   ")]
    [InlineData(null)]
    [InlineData("TOO_LONG")]
    public async Task InvalidBasketRequestIsRejected(string? request)
    {
        using var app = new FarmCartApp();
        var buyer = await app.LoginAsync("+380971234567");
        var text = request == "TOO_LONG" ? new string('б', AiAssistantService.RequestMaxLength + 1) : request;

        var response = await buyer.PostAsJsonAsync("/api/catalog/basket-plan", new { request = text });

        Assert.Equal((HttpStatusCode.BadRequest, "ai_invalid"), (response.StatusCode, await response.ErrorCode()));
        Assert.Empty(app.FarmCartAi.Baskets);
    }

    [Fact(DisplayName = "AI-7.3 Кошик за рецептом доступний лише після входу")]
    public async Task BasketNeedsSignIn()
    {
        using var app = new FarmCartApp();

        var response = await app.CreateClient().PostAsJsonAsync("/api/catalog/basket-plan", new { request = "борщ" });

        Assert.Equal("auth_required", await response.ErrorCode());
    }

    [Fact(DisplayName = "AI-8.1 Адміністратор бачить підозрілі відгуки, а перевірені вдруге до ШІ не йдуть")]
    public async Task ModerationFlagsReviewsOnce()
    {
        using var app = new FarmCartApp();
        var (_, farmerId) = await FarmAsync(app);
        var spam = AddReview(app, farmerId, "Купуйте на сайті example.com");
        var fine = AddReview(app, farmerId, "Морква була несмачна", rating: 2);
        AddReview(app, farmerId, null);
        var admin = await app.AdminAsync();
        app.FarmCartAi.Moderation = _ => [new ModerationAdvice(spam, "unknown", new LocalizedText("Реклама", "Advertising")), new ModerationAdvice(fine, "abuse", new LocalizedText("", ""))];

        var first = await (await admin.PostAsync("/api/admin/reviews/check", null)).Json();
        var second = await (await admin.PostAsync("/api/admin/reviews/check", null)).Json();

        var flagged = first.GetProperty("flagged");
        Assert.Equal(1, flagged.GetArrayLength());
        Assert.Equal((spam, "other"), (flagged[0].GetProperty("reviewId").GetInt32(), flagged[0].Str("category")));
        Assert.Equal(0, first.GetProperty("remaining").GetInt32());
        Assert.Equal(1, second.GetProperty("flagged").GetArrayLength());
        Assert.Equal(2, app.FarmCartAi.Moderated.Single().Count);
        var audit = await admin.GetJson("/api/admin/audit");
        Assert.Single(audit.EnumerateArray(), entry => entry.Str("action") == "review.ai_check");
    }

    [Fact(DisplayName = "AI-8.2 Перевірка йде партіями: залишок видно адміністратору")]
    public async Task ModerationWorksInBatches()
    {
        using var app = new FarmCartApp();
        var (_, farmerId) = await FarmAsync(app);
        for (var i = 0; i < AiAssistantService.ModerationBatch + 2; i++)
        {
            AddReview(app, farmerId, $"Відгук {i}");
        }

        var admin = await app.AdminAsync();

        var first = await (await admin.PostAsync("/api/admin/reviews/check", null)).Json();
        var second = await (await admin.PostAsync("/api/admin/reviews/check", null)).Json();

        Assert.Equal(2, first.GetProperty("remaining").GetInt32());
        Assert.Equal(0, second.GetProperty("remaining").GetInt32());
    }

    [Fact(DisplayName = "AI-8.3 Перевірка відгуків доступна лише адміністратору")]
    public async Task ModerationIsAdminOnly()
    {
        using var app = new FarmCartApp();
        var buyer = await app.LoginAsync("+380971234567");

        var response = await buyer.PostAsync("/api/admin/reviews/check", null);

        Assert.Equal((HttpStatusCode.Forbidden, "role_required"), (response.StatusCode, await response.ErrorCode()));
    }

    [Fact(DisplayName = "AI-9.1 Документ перевіряється на прохання адміністратора один раз і потрапляє в журнал аудиту")]
    public async Task DocumentIsCheckedOnceAndAudited()
    {
        using var app = new FarmCartApp();
        var (farmer, farmerId) = await FarmAsync(app);
        var upload = await farmer.PostAsync("/api/farmer/documents?name=Сертифікат.pdf", new ByteArrayContent([.. "%PDF-1.7\n"u8, 1, 2]) { Headers = { ContentType = new("application/pdf") } });
        var documentId = (await upload.Json()).Id();
        var admin = await app.AdminAsync();
        app.FarmCartAi.Document = new DocumentCheck(
            new LocalizedText("Сертифікат", "Certificate"),
            "  Зелений Гай ",
            new string('1', 121),
            "2026-01-01",
            null,
            [new LocalizedText("Строк дії минув", "Expired"), new LocalizedText("", "")]);

        Assert.Empty(app.FarmCartAi.Documents);
        var first = await (await admin.PostAsync($"/api/admin/farmers/{farmerId}/documents/{documentId}/check", null)).Json();
        await admin.PostAsync($"/api/admin/farmers/{farmerId}/documents/{documentId}/check", null);

        Assert.Equal("Зелений Гай", first.Str("holderName"));
        Assert.Equal(JsonValueKind.Null, first.GetProperty("number").ValueKind);
        Assert.Equal(1, first.GetProperty("concerns").GetArrayLength());
        var sent = app.FarmCartAi.Documents.Single();
        Assert.Equal(("application/pdf", "Ферма «Зелений Гай»"), (sent.ContentType, sent.FarmName.Uk));
        Assert.Equal(new DateOnly(2026, 10, 1), sent.Today);
        var audit = await admin.GetJson("/api/admin/audit");
        Assert.Single(audit.EnumerateArray(), entry => entry.Str("action") == "document.ai_check");
    }

    [Fact(DisplayName = "AI-9.2 Чужий документ, невідомий формат і не-адміністратор до ШІ не доходять")]
    public async Task InvalidDocumentChecksNeverReachAi()
    {
        using var app = new FarmCartApp();
        var (farmer, farmerId) = await FarmAsync(app);
        int textDocument;
        lock (app.Store.Sync)
        {
            textDocument = app.Store.NextId<FarmDocument>();
            app.Store.FarmDocuments.Add(textDocument, new FarmDocument(textDocument, farmerId, "note.txt", "text/plain", [1], app.Clock.Now));
        }

        var admin = await app.AdminAsync();

        var unsupported = await admin.PostAsync($"/api/admin/farmers/{farmerId}/documents/{textDocument}/check", null);
        var missing = await admin.PostAsync($"/api/admin/farmers/{farmerId}/documents/9999/check", null);
        var byFarmer = await farmer.PostAsync($"/api/admin/farmers/{farmerId}/documents/{textDocument}/check", null);

        Assert.Equal("ai_invalid", await unsupported.ErrorCode());
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
        Assert.Equal("role_required", await byFarmer.ErrorCode());
        Assert.Empty(app.FarmCartAi.Documents);
    }

    [Fact(DisplayName = "AI-10 Без ключа API підказки вимкнено: статус про це каже, сторінки працюють, дії дають зрозумілу помилку")]
    public async Task DisabledAiIsReported()
    {
        using var app = new FarmCartApp();
        var (farmer, farmerId) = await FarmAsync(app);
        var admin = await app.AdminAsync();
        var buyer = await app.LoginAsync("+380971234567");
        AddReview(app, farmerId, "Смачно");
        AddReview(app, farmerId, "Свіже");
        AddReview(app, farmerId, "Добре");
        var on = await app.CreateClient().GetJson("/api/ai/status");
        app.FarmCartAi.IsAvailable = false;

        var off = await app.CreateClient().GetJson("/api/ai/status");
        var summary = await app.CreateClient().GetJson($"/api/farmers/{farmerId}/reviews/summary");
        HttpResponseMessage[] actions =
        [
            await farmer.PostAsync("/api/farmer/products/suggestion", Photo(Png)),
            await buyer.PostAsJsonAsync("/api/catalog/basket-plan", new { request = "борщ" }),
            await admin.PostAsync("/api/admin/reviews/check", null),
            await admin.PostAsync($"/api/admin/farmers/{farmerId}/documents/1/check", null),
        ];

        Assert.True(on.GetProperty("available").GetBoolean());
        Assert.False(off.GetProperty("available").GetBoolean());
        Assert.Equal(JsonValueKind.Null, summary.GetProperty("summary").ValueKind);
        foreach (var action in actions)
        {
            Assert.Equal((HttpStatusCode.ServiceUnavailable, "ai_unavailable"), (action.StatusCode, await action.ErrorCode()));
        }
    }

    [Fact(DisplayName = "AI-11 Історію ферми можна перекласти тим самим сервісом перекладу")]
    public async Task FarmStoryCanBeTranslated()
    {
        using var app = new FarmCartApp();
        var (farmer, _) = await FarmAsync(app);

        var reply = await farmer.PostJson("/api/farmer/products/translation", new { items = new[] { new { field = "story", targetLang = "en", text = new string('і', FarmerService.StoryMaxLength) } } });
        var tooLong = await farmer.PostAsJsonAsync("/api/farmer/products/translation", new { items = new[] { new { field = "story", targetLang = "en", text = new string('і', FarmerService.StoryMaxLength + 1) } } });

        Assert.Equal("translated story", reply.GetProperty("items")[0].Str("text"));
        Assert.Equal("translation_invalid", await tooLong.ErrorCode());
    }
}

/// <summary>REL: «Часто купують разом» рахується із замовлень і не потребує ШІ.</summary>
public sealed class BoughtTogetherTests
{
    private static async Task<int> OrderTogetherAsync(HttpClient buyer, int slot, params int[] products)
    {
        foreach (var product in products)
        {
            (await buyer.AddToCartAsync(product, 1)).EnsureSuccessStatusCode();
        }

        var response = await buyer.CheckoutAsync(slot);
        response.EnsureSuccessStatusCode();
        return (await response.Json()).Id();
    }

    [Fact(DisplayName = "REL-1 Спершу те, що купують разом найчастіше; без самого товару й того, чого немає")]
    public async Task MostFrequentCompanionsComeFirst()
    {
        using var app = new FarmCartApp();
        var (farmer, apples, _) = await Journeys.FarmWithApplesAsync(app);
        var carrots = await farmer.PublishAsync("Морква", "vegetables", 16m);
        var potatoes = await farmer.PublishAsync("Картопля", "vegetables", 12m);
        var beets = await farmer.PublishAsync("Буряк", "vegetables", 14m, stock: 2);
        var slot = await app.SlotAsync(capacity: 5);
        var first = await app.LoginAsync("+380971234561");
        var second = await app.LoginAsync("+380971234562");
        await OrderTogetherAsync(first, slot, apples, carrots, potatoes);
        await OrderTogetherAsync(second, slot, apples, potatoes, beets);
        await OrderTogetherAsync(await app.LoginAsync("+380971234563"), slot, beets);

        var related = await app.CreateClient().GetJson($"/api/catalog/related?ids={apples}");
        var forTwo = await app.CreateClient().GetJson($"/api/catalog/related?ids={apples},{potatoes},oops");

        Assert.Equal(["Картопля", "Морква"], related.Names());
        Assert.Equal(["Морква"], forTwo.Names());
    }

    [Fact(DisplayName = "REL-3 Кошик із двох ферм - це одна покупка, хоч замовлень і два")]
    public async Task OneCheckoutAcrossFarmsCountsTogether()
    {
        using var app = new FarmCartApp();
        var (_, apples, slot) = await Journeys.FarmWithApplesAsync(app);
        var creamery = await app.VerifiedFarmerAsync("+380671110002", "Сироварня «Карпатська бринза»");
        var cheese = await creamery.PublishAsync("Бринза", "dairy", 165m);
        var buyer = await app.LoginAsync("+380971234561");

        await OrderTogetherAsync(buyer, slot, apples, cheese);

        Assert.Equal(["Бринза"], (await app.CreateClient().GetJson($"/api/catalog/related?ids={apples}")).Names());
    }

    [Fact(DisplayName = "REL-2 Скасоване замовлення не враховується; без товарів список порожній")]
    public async Task CancelledOrdersAreIgnored()
    {
        using var app = new FarmCartApp();
        var (farmer, apples, slot) = await Journeys.FarmWithApplesAsync(app);
        var carrots = await farmer.PublishAsync("Морква", "vegetables", 16m);
        var buyer = await app.LoginAsync("+380971234561");
        var orderId = await OrderTogetherAsync(buyer, slot, apples, carrots);
        (await buyer.PostAsJsonAsync($"/api/orders/{orderId}/cancel", new { })).EnsureSuccessStatusCode();

        Assert.Empty((await app.CreateClient().GetJson($"/api/catalog/related?ids={apples}")).EnumerateArray());
        Assert.Empty((await app.CreateClient().GetJson("/api/catalog/related")).EnumerateArray());
    }
}

/// <summary>AI-12: звернення до Claude перевіряється на підставній HTTP-відповіді, без мережі й без витрат.</summary>
public sealed class ClaudeFarmCartAiTests
{
    private static readonly IReadOnlyList<ReviewForAi> Reviews = [new(7, 5, "Смачно"), new(8, 1, "Реклама example.com")];

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

    private static (ClaudeFarmCartAi Ai, StubHandler Handler) Ai(string reply, HttpStatusCode status = HttpStatusCode.OK)
    {
        var handler = new StubHandler(status, status == HttpStatusCode.OK ? Message(reply) : reply);
        var client = new AnthropicClient { ApiKey = "test-key", HttpClient = new HttpClient(handler), MaxRetries = 0 };
        return (new ClaudeFarmCartAi(new ClaudeJsonClient(client, NullLogger<ClaudeJsonClient>.Instance)), handler);
    }

    private static JsonElement FirstBlock(StubHandler handler) =>
        JsonDocument.Parse(handler.Sent!).RootElement.GetProperty("messages")[0].GetProperty("content")[0];

    [Fact(DisplayName = "AI-12.1 Підсумок відгуків розбирається обома мовами, а автори до сервісу не йдуть")]
    public async Task SummaryIsParsed()
    {
        var (ai, handler) = Ai("""{ "likes": { "uk": "Смачно", "en": "Tasty" }, "complaints": null }""");

        var summary = await ai.SummarizeReviewsAsync(Reviews, CancellationToken.None);

        Assert.Equal(new ReviewSummary(new LocalizedText("Смачно", "Tasty"), null), summary);
        Assert.Contains("Смачно", handler.Sent, StringComparison.Ordinal);
        Assert.DoesNotContain("author", handler.Sent, StringComparison.OrdinalIgnoreCase);
    }

    [Theory(DisplayName = "AI-12.2 Фото надсилається зображенням потрібного типу")]
    [InlineData("image/png")]
    [InlineData("image/jpeg")]
    [InlineData("image/webp")]
    public async Task PhotoIsSentAsImage(string type)
    {
        var (ai, handler) = Ai("""{ "name": { "uk": "Морква", "en": "Carrots" }, "category": "vegetables", "description": null }""");

        var suggestion = await ai.SuggestProductAsync(new ProductPhotoForAi(type, [1, 2, 3]), CancellationToken.None);

        Assert.Equal("vegetables", suggestion.Category);
        var block = FirstBlock(handler);
        Assert.Equal(("image", type, "AQID"), (block.Str("type"), block.GetProperty("source").Str("media_type"), block.GetProperty("source").Str("data")));
    }

    [Fact(DisplayName = "AI-12.3 Кошик за рецептом розбирається")]
    public async Task BasketIsParsed()
    {
        var (ai, handler) = Ai("""{ "lines": [{ "productId": 3, "quantity": 2 }], "missing": ["сіль"] }""");
        var brief = new BasketBrief("борщ", "uk", [new BasketOption(3, "Буряк", "кг", 14m, 10)]);

        var draft = await ai.PlanBasketAsync(brief, CancellationToken.None);

        Assert.Equal(new BasketIdea(3, 2), draft.Lines.Single());
        Assert.Equal("сіль", draft.Missing.Single());
        Assert.Contains("Буряк", handler.Sent, StringComparison.Ordinal);
    }

    [Fact(DisplayName = "AI-12.4 Порада модерації розбирається")]
    public async Task ModerationIsParsed()
    {
        var (ai, _) = Ai("""{ "flagged": [{ "reviewId": 8, "category": "spam", "reason": { "uk": "Реклама", "en": "Advertising" } }] }""");

        var advice = await ai.CheckReviewsAsync(Reviews, CancellationToken.None);

        Assert.Equal(new ModerationAdvice(8, "spam", new LocalizedText("Реклама", "Advertising")), advice.Single());
    }

    [Theory(DisplayName = "AI-12.5 Документ надсилається у своєму форматі; демонстраційний SVG - текстом")]
    [InlineData("application/pdf", "document")]
    [InlineData("image/png", "image")]
    [InlineData("image/svg+xml", "text")]
    public async Task DocumentIsSentInItsFormat(string type, string block)
    {
        var (ai, handler) = Ai("""{ "kind": null, "holderName": "Гай", "number": null, "issuedOn": null, "validUntil": null, "concerns": [{ "uk": "Сумнів", "en": "Concern" }] }""");
        var document = new DocumentForAi(new LocalizedText("Гай", "Hai"), type, "<svg/>"u8.ToArray(), new DateOnly(2026, 10, 1));

        var check = await ai.CheckDocumentAsync(document, CancellationToken.None);

        Assert.Equal("Гай", check.HolderName);
        Assert.Equal("Concern", check.Concerns.Single().En);
        Assert.Equal(block, FirstBlock(handler).Str("type"));
        Assert.Contains("2026-10-01", handler.Sent, StringComparison.Ordinal);
    }

    [Fact(DisplayName = "AI-12.6 Невдача сервісу стає зрозумілою помилкою")]
    public async Task FailureBecomesAiFailed()
    {
        var (ai, _) = Ai("""{ "type": "error", "error": { "type": "api_error", "message": "oops" } }""", HttpStatusCode.InternalServerError);

        var error = await Assert.ThrowsAsync<DomainException>(() => ai.CheckReviewsAsync(Reviews, CancellationToken.None));

        Assert.Equal((ErrorKind.Unavailable, "ai_failed"), (error.Kind, error.Code));
    }

    [Theory(DisplayName = "AI-12.7 Без ключа API ШІ вимкнено; з ключем працює Claude; у розробці можна ввімкнути імітацію")]
    [InlineData(null, false, typeof(UnavailableFarmCartAi))]
    [InlineData("test-key", false, typeof(ClaudeFarmCartAi))]
    [InlineData("test-key", true, typeof(FakeFarmCartAi))]
    public void AiIsChosenFromConfiguration(string? apiKey, bool fake, Type expected)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                [ClaudeJsonClient.ApiKeySetting] = apiKey,
                ["FarmCart:FakeAi"] = fake.ToString(),
            })
            .Build();
        using var services = new ServiceCollection().AddLogging().AddFarmCart(configuration).BuildServiceProvider();

        Assert.IsType(expected, services.GetRequiredService<IFarmCartAi>());
    }

    [Fact(DisplayName = "AI-12.8 Імітація дає передбачувані підказки без зовнішнього сервісу")]
    public async Task FakeAiGivesPredictableHints()
    {
        var ai = new FakeFarmCartAi();
        var brief = new BasketBrief("борщ", "en", [new BasketOption(1, "Beets", "kg", 14m, 5)]);

        var summary = await ai.SummarizeReviewsAsync(Reviews, CancellationToken.None);
        var suggestion = await ai.SuggestProductAsync(new ProductPhotoForAi("image/png", [1]), CancellationToken.None);
        var basket = await ai.PlanBasketAsync(brief, CancellationToken.None);
        var advice = await ai.CheckReviewsAsync(Reviews, CancellationToken.None);
        var document = await ai.CheckDocumentAsync(new DocumentForAi(new LocalizedText("Гай", "Hai"), "image/png", [1], new DateOnly(2026, 10, 1)), CancellationToken.None);

        Assert.NotNull(summary.Complaints);
        Assert.Equal("vegetables", suggestion.Category);
        Assert.Equal(new BasketIdea(1, 1), basket.Lines.Single());
        Assert.Equal(8, advice.Single().ReviewId);
        Assert.Equal("Гай", document.HolderName);
    }

    [Fact(DisplayName = "AI-12.9 Вимкнений ШІ на кожну дію повідомляє про це")]
    public async Task UnavailableAiThrows()
    {
        var ai = new UnavailableFarmCartAi();
        Func<Task>[] actions =
        [
            () => ai.SummarizeReviewsAsync(Reviews, CancellationToken.None),
            () => ai.SuggestProductAsync(new ProductPhotoForAi("image/png", [1]), CancellationToken.None),
            () => ai.PlanBasketAsync(new BasketBrief("борщ", "uk", []), CancellationToken.None),
            () => ai.CheckReviewsAsync(Reviews, CancellationToken.None),
            () => ai.CheckDocumentAsync(new DocumentForAi(new LocalizedText("Гай", "Hai"), "image/png", [1], new DateOnly(2026, 10, 1)), CancellationToken.None),
        ];

        foreach (var action in actions)
        {
            Assert.Equal("ai_unavailable", (await Assert.ThrowsAsync<DomainException>(action)).Code);
        }
    }
}
