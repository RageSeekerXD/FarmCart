using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json.Nodes;

namespace FarmCart.Demo;

/// <summary>
/// Наскрізний сценарій релізу на демонстраційних даних сервера (режим розробки). Кожен крок протоколу - окремий метод;
/// HTTP-клієнт і вивід протоколу передаються ззовні, тож сценарій працює і проти запущеного сервера, і в приймальних тестах.
/// </summary>
public sealed class DemoScenario(HttpClient http, TextWriter output)
{
    private const string LvivCenter = "lat=49.8419&lon=24.0315";
    private const string Address = "Львів, вул. Городоцька, 15, кв. 8";

    /// <summary>Промокод демонстраційних даних: знижка 10 % на замовлення від 300 грн.</summary>
    private const string Promo = "FARM10";
    private const int PromoPercent = 10;
    private static readonly CultureInfo Uk = CultureInfo.GetCultureInfo("uk-UA");
    private static readonly object Curd = new { name = "Сир кисломолочний", category = "Молочні продукти", unit = "0,5 кг", price = 85m, stock = 20 };
    private readonly Protocol _protocol = new(output);

    public string Protocol => _protocol.Text;

    /// <summary>Проходить сценарій; повертає true, якщо всі очікування справдилися. Протокол доступний і після збою.</summary>
    public async Task<bool> RunAsync()
    {
        try
        {
            await RunStepsAsync();
        }
        catch (Exception error)
        {
            // Непередбачена відповідь (DEF-03: товару немає в каталозі) не повинна губити протокол попередніх кроків.
            _protocol.Abort(error);
        }

        _protocol.Summary();
        return _protocol.Failures == 0;
    }

    private async Task RunStepsAsync()
    {
        // Дата сервера, а не клієнта: сезонність каталогу визначає годинник сервера (сервер 1.0 часу не повідомляв).
        var serverTime = (await http.GetFromJsonAsync<JsonNode>("/api/health"))?["time"];
        var today = serverTime is null ? DateTimeOffset.Now : Moment(serverTime);
        _protocol.Title($"FarmCart - протокол роботи програми: сценарій релізу 1 ({today.ToString("dd.MM.yyyy HH:mm:ss", Uk)}, сервер {http.BaseAddress})");
        await CheckServerAsync();
        var admin = await SignInAsync("US-01. Адміністратор входить за одноразовим кодом із SMS", "Адміністратор", "+380500000001");
        var newcomer = await UnverifiedSellerIsRefusedAsync();
        await AdminVerifiesSellerAsync(admin, newcomer);
        var buyer = await BuyerRegistersAsync();
        await SearchVegetablesAsync(buyer);
        var (farmer, catalog) = await SeasonalCatalogAsync(buyer, today);
        var subtotal = await FillCartAsync(buyer, catalog);
        var slotId = await ChooseSlotAsync(buyer);
        await CardNumberIsRejectedAsync(buyer, slotId);
        await DeclinedPaymentKeepsCartAsync(buyer, slotId);
        var orderId = await CheckoutWithPromoAsync(buyer, slotId, subtotal);
        await FarmerSeesOrderAsync(farmer);
        await FarmerAcceptsWithShortageAsync(farmer, orderId, catalog, subtotal);
        await FarmerHandsOverAsync(farmer, orderId);
        var courier = await CourierSeesDeliveriesAsync();
        await CourierDeliversAsync(courier, buyer, orderId);
        await BuyerSeesNotificationsAsync(buyer);
        await BuyerReviewsFarmerAsync(buyer, orderId);
        await BeekeeperRejectsOrderAsync(buyer, slotId, catalog);
        await AdminReadsAuditAsync(admin);
        await BruteForceIsBlockedAsync();
    }

    private async Task CheckServerAsync()
    {
        _protocol.Step("Перевірка доступності сервера");
        var health = await NewActor("Клієнт").Get("/api/health");
        _protocol.Check(health["status"] == "ok", "сервер відповідає status=ok");
        _protocol.Detail($"Версія сервера: {health["version"]}");
    }

    private async Task<Actor> SignInAsync(string step, string name, string phone)
    {
        _protocol.Step(step);
        return await LoginAsync(name, phone);
    }

    private async Task<Actor> UnverifiedSellerIsRefusedAsync()
    {
        var newcomer = await SignInAsync("US-02. Продавець без верифікації намагається опублікувати товар", "Фермер Тарас", "+380671110004");
        var refused = await newcomer.Post("/api/farmer/products", Curd);
        _protocol.Check(refused.Status == 403, "публікацію відхилено зі статусом 403");
        return newcomer;
    }

    private async Task AdminVerifiesSellerAsync(Actor admin, Actor newcomer)
    {
        _protocol.Step("US-02. Адміністратор верифікує продавця, після чого той публікує товар");
        var pending = (await admin.Get("/api/admin/farmers/pending")).Items;
        var farm = pending.Single(f => f!["name"]!.ToString() == "Еко-ферма «Сокільники»")!;
        _protocol.Detail($"Очікує верифікації: продавець #{farm["id"]} {farm["name"]}");
        var verified = await admin.Post($"/api/admin/farmers/{farm["id"]}/verify");
        _protocol.Check(verified["verified"] == "true", "продавця верифіковано");
        var published = await newcomer.Post("/api/farmer/products", Curd);
        _protocol.Check(published.Status == 201, "товар опубліковано (201)");
        _protocol.Detail($"Опубліковано товар #{published["id"]} «{published["name"]}», {Uah(published["price"])} за {published["unit"]}");
    }

    private async Task<Actor> BuyerRegistersAsync()
    {
        _protocol.Step("US-01. Новий покупець реєструється за номером телефону (спершу вводить хибний код)");
        return await LoginAsync("Покупець Оксана", "+380971234567", tryWrongCodeFirst: true);
    }

    private async Task SearchVegetablesAsync(Actor buyer)
    {
        _protocol.Step("US-04. Пошук: сертифіковані овочі до 15 км від центру Львова, спершу дешевші");
        var vegetables = (await buyer.Get($"/api/catalog?category=Овочі&certified=true&{LvivCenter}&maxKm=15&sort=PriceAsc")).Items;
        foreach (var item in vegetables)
        {
            _protocol.Detail($"{item!["name"]} - {Uah(item["price"])}/{item["unit"]}, {item["farmerName"]}, {Number(item["distanceKm"])} км");
        }

        _protocol.Check(Names(vegetables).SequenceEqual(["Морква", "Картопля"]), "знайдено моркву й картоплю «Зеленого Гаю»");
    }

    /// <summary>
    /// Каталог порівнюється з сезонами, які фермер задав своїм товарам, для поточного місяця сервера.
    /// Очікування обчислюються з даних, тож крок не залежить від дати запуску (DEF-03).
    /// </summary>
    private async Task<(Actor Farmer, JsonArray Catalog)> SeasonalCatalogAsync(Actor buyer, DateTimeOffset today)
    {
        _protocol.Step($"US-03, US-04. Сезонність: каталог {Uk.DateTimeFormat.MonthGenitiveNames[today.Month - 1]} показує лише товари в сезоні");
        var farmer = await LoginAsync("Фермер Олена", "+380671110001");
        var own = (await farmer.Get("/api/farmer/products")).Items;
        var catalog = (await buyer.Get("/api/catalog")).Items;
        var shown = Names(catalog).ToHashSet();
        foreach (var product in own)
        {
            var name = product!["name"]!.ToString();
            var months = SeasonMonths(product);
            var inSeason = months.Count == 0 || months.Contains(today.Month);
            _protocol.Detail($"{name}: {SeasonText(months)} - {(shown.Contains(name) ? "у каталозі" : "поза сезоном, приховано")}");
            _protocol.Check(shown.Contains(name) == inSeason, $"«{name}» {(inSeason ? "є" : "немає")} у каталозі");
        }

        _protocol.Check(own.Any(p => !shown.Contains(p!["name"]!.ToString())), "щонайменше один сезонний товар приховано");
        _protocol.Detail($"Товарів у каталозі: {catalog.Count}; категорії: {string.Join(", ", catalog.Select(i => i!["category"]!.ToString()).Distinct())}");
        return (farmer, catalog);
    }

    /// <summary>Повертає суму кошика - від неї сценарій обчислює очікувану знижку й повернення коштів.</summary>
    private async Task<decimal> FillCartAsync(Actor buyer, JsonArray catalog)
    {
        _protocol.Step("US-05. Кошик: товари одного фермера («покупки з одного прилавка»)");
        await buyer.Post("/api/cart/items", new { productId = ProductId(catalog, "Морква"), quantity = 10 });
        var cart = await buyer.Post("/api/cart/items", new { productId = ProductId(catalog, "Картопля"), quantity = 15 });
        _protocol.Detail($"У кошику {cart.Body!["lines"]!.AsArray().Count} позиції на {Uah(cart["total"])}");
        var otherFarm = await buyer.Post("/api/cart/items", new { productId = ProductId(catalog, "Бринза овеча"), quantity = 1 });
        _protocol.Check(otherFarm.Status == 409, "товар іншого фермера не додано (409)");
        return Amount(cart["total"]);
    }

    private async Task<int> ChooseSlotAsync(Actor buyer)
    {
        _protocol.Step("US-05. Вільні слоти доставки");
        var slots = (await buyer.Get("/api/slots")).Items;
        foreach (var slot in slots)
        {
            _protocol.Detail($"Слот #{slot!["id"]}: {Period(slot["start"], slot["end"])}, вільних місць {slot["remaining"]}");
        }

        return slots[0]!["id"]!.GetValue<int>();
    }

    private async Task CardNumberIsRejectedAsync(Actor buyer, int slotId)
    {
        _protocol.Step("US-06. Номер картки в запиті відхиляється ще до обробки (PCI DSS)");
        var withCard = await buyer.Post("/api/orders", new { address = Address, slotId, paymentMethod = "Card", paymentToken = "tok_visa", comment = "Спишіть з картки 4111 1111 1111 1111" });
        _protocol.Check(withCard.Status == 400 && withCard["error"] == "card_data_forbidden", "запит із номером картки відхилено");
    }

    private async Task DeclinedPaymentKeepsCartAsync(Actor buyer, int slotId)
    {
        _protocol.Step("US-06. Банк відхиляє оплату: замовлення не створюється, кошик зберігається");
        var declined = await buyer.Post("/api/orders", new { address = Address, slotId, paymentMethod = "Card", paymentToken = "tok_declined" });
        var cart = await buyer.Get("/api/cart");
        _protocol.Check(declined.Status == 402, "оплату відхилено (402)");
        _protocol.Check(cart.Body!["lines"]!.AsArray().Count == 2, "кошик зберігся");
        _protocol.Detail($"У кошику, як і раніше, {cart.Body!["lines"]!.AsArray().Count} позиції на {Uah(cart["total"])}");
    }

    private async Task<string> CheckoutWithPromoAsync(Actor buyer, int slotId, decimal subtotal)
    {
        _protocol.Step($"US-05, US-06. Оформлення з промокодом {Promo}, оплата карткою (лише токен провайдера)");
        var checkout = new { address = Address, slotId, paymentMethod = "Card", paymentToken = "tok_visa", promoCode = Promo, comment = "Подзвоніть за 10 хвилин" };
        var order = await buyer.Post("/api/orders", checkout, idempotencyKey: "demo-checkout-1");
        var orderId = order["id"];
        _protocol.Detail($"Замовлення №{orderId}: сума {Uah(order["subtotal"])}, знижка {Uah(order["discount"])}, до сплати {Uah(order["total"])}");
        _protocol.Detail($"Оплата: {order["paymentTitle"]} ({Uah(order["paidAmount"])}), статус: {order["statusTitle"]}, слот {Period(order["slotStart"], order["slotEnd"])}");
        var expected = WithPromo(subtotal);
        _protocol.Check(order.Status == 201 && Amount(order["total"]) == expected, $"створено замовлення на {Uah(expected)}");
        var retry = await buyer.Post("/api/orders", checkout, idempotencyKey: "demo-checkout-1");
        _protocol.Detail($"Повторний запит з тим самим Idempotency-Key повернув замовлення №{retry["id"]}");
        _protocol.Check(retry["id"] == orderId, "повтор не створив дубль");
        return orderId;
    }

    private async Task FarmerSeesOrderAsync(Actor farmer)
    {
        _protocol.Step("US-07. Фермер «Зелений Гай» бачить нове замовлення (без коду вручення)");
        var incoming = (await farmer.Get("/api/farmer/orders")).Items[0]!;
        _protocol.Detail($"Замовлення №{incoming["id"]}: {incoming["statusTitle"]}, позицій {incoming["lines"]!.AsArray().Count}, код вручення: {incoming["deliveryCode"]?.ToString() ?? "прихований"}");
        _protocol.Check(incoming["deliveryCode"] is null, "фермер не бачить коду вручення");
    }

    private async Task FarmerAcceptsWithShortageAsync(Actor farmer, string orderId, JsonArray catalog, decimal subtotal)
    {
        _protocol.Step("US-07. Фермер приймає замовлення частково: бракує 1 кг картоплі");
        const string Missing = "Картопля";
        var shortage = new { shortages = new[] { new { productId = ProductId(catalog, Missing), quantity = 1 } } };
        var accepted = await farmer.Post($"/api/farmer/orders/{orderId}/accept", shortage);
        _protocol.Detail($"Нова сума {Uah(accepted["total"])}, автоматично повернено покупцю {Uah(accepted["refundedAmount"])}");
        var expected = WithPromo(subtotal) - WithPromo(subtotal - Price(catalog, Missing));
        _protocol.Check(Amount(accepted["refundedAmount"]) == expected, $"повернено {Uah(expected)} за відсутню картоплю");
    }

    private async Task FarmerHandsOverAsync(Actor farmer, string orderId)
    {
        _protocol.Step("US-08. Фермер збирає замовлення й передає його кур'єру");
        await farmer.Post($"/api/farmer/orders/{orderId}/assemble");
        var courier = (await farmer.Get("/api/couriers")).Items[0]!;
        _protocol.Detail($"Доступний кур'єр: #{courier["id"]} {courier["name"]}");
        var handedOver = await farmer.Post($"/api/farmer/orders/{orderId}/handover", new { courierId = courier["id"]!.GetValue<int>() });
        _protocol.Check(handedOver["status"] == "InTransit", "замовлення в дорозі");
    }

    private async Task<Actor> CourierSeesDeliveriesAsync()
    {
        var courier = await SignInAsync("US-09. Кур'єр бачить свої доставки з маршрутом", "Кур'єр Андрій", "+380631230001");
        var task = (await courier.Get("/api/courier/deliveries")).Items[0]!;
        _protocol.Detail($"Доставка №{task["orderId"]}: {Period(task["slotStart"], task["slotEnd"])}, забрати: {task["pickupFrom"]}, адреса: {task["address"]}");
        _protocol.Detail($"Позицій: {task["items"]}, отримати готівкою: {Uah(task["amountToCollect"])}");
        _protocol.Detail($"Маршрут: {Uri.UnescapeDataString(task["routeUrl"]!.ToString())}");
        return courier;
    }

    private async Task CourierDeliversAsync(Actor courier, Actor buyer, string orderId)
    {
        _protocol.Step("US-09. Вручення: без правильного коду закрити доставку неможливо");
        var code = (await buyer.Get($"/api/orders/{orderId}"))["deliveryCode"];
        _protocol.Detail($"Покупець бачить у застосунку код вручення {code} і називає його кур'єру");
        var wrongCode = await courier.Post($"/api/courier/deliveries/{orderId}/confirm", new { code = code == "0000" ? "1111" : "0000" });
        _protocol.Check(wrongCode.Status == 400, "хибний код відхилено");
        var delivered = await courier.Post($"/api/courier/deliveries/{orderId}/confirm", new { code });
        _protocol.Check(delivered["status"] == "Delivered", "замовлення доставлено");
    }

    private async Task BuyerSeesNotificationsAsync(Actor buyer)
    {
        _protocol.Step("US-08. Push-сповіщення покупця про кожну зміну статусу");
        foreach (var notification in (await buyer.Get("/api/me/notifications")).Items)
        {
            _protocol.Detail($"{Time(notification!["at"])} {notification["text"]}");
        }
    }

    private async Task BuyerReviewsFarmerAsync(Actor buyer, string orderId)
    {
        _protocol.Step("US-10. Покупець оцінює фермера; рейтинг у каталозі оновлюється одразу");
        var review = await buyer.Post($"/api/orders/{orderId}/review", new { rating = 5, comment = "Морква солодка, картопля як з городу" });
        _protocol.Check(review.Status == 201, "відгук збережено");
        var rated = (await buyer.Get("/api/catalog?q=Морква")).Items[0]!;
        _protocol.Detail($"Рейтинг продавця {rated["farmerName"]} у каталозі: {Number(rated["farmerRating"])} з 5");
        _protocol.Check(rated["farmerRating"]?.GetValue<double>() == 5.0, "рейтинг фермера 5");
    }

    private async Task BeekeeperRejectsOrderAsync(Actor buyer, int slotId, JsonArray catalog)
    {
        _protocol.Step("US-07. Друге замовлення: пасічниця відхиляє його, і кошти повертаються автоматично");
        await buyer.Post("/api/cart/items", new { productId = ProductId(catalog, "Мед липовий"), quantity = 1 });
        var order = await buyer.Post("/api/orders", new { address = Address, slotId, paymentMethod = "GooglePay", paymentToken = "tok_googlepay" });
        _protocol.Detail($"Замовлення №{order["id"]} на {Uah(order["total"])}, оплата: {order["paymentTitle"]} (Google Pay)");
        var beekeeper = await LoginAsync("Пасічниця Марія", "+380671110003");
        await beekeeper.Post($"/api/farmer/orders/{order["id"]}/reject", new { reason = "Мед закристалізувався, нова партія за тиждень" });
        var rejected = await buyer.Get($"/api/orders/{order["id"]}");
        _protocol.Detail($"Статус: {rejected["statusTitle"]} ({rejected["rejectionReason"]}), оплата: {rejected["paymentTitle"]}, повернено {Uah(rejected["refundedAmount"])}");
        _protocol.Check(rejected["paymentStatus"] == "Refunded", "кошти повернено автоматично");
    }

    private async Task AdminReadsAuditAsync(Actor admin)
    {
        _protocol.Step("B-FR-12. Журнал аудиту дій адміністратора");
        foreach (var entry in (await admin.Get("/api/admin/audit")).Items)
        {
            _protocol.Detail($"{Time(entry!["at"])} адміністратор #{entry["adminId"]}: {entry["action"]} {entry["target"]} - {entry["details"]}");
        }
    }

    private async Task BruteForceIsBlockedAsync()
    {
        _protocol.Step("US-01. Захист від підбору коду: після 5 хибних спроб вхід блокується на 15 хв");
        var intruder = NewActor("Зловмисник");
        const string Victim = "+380979999999";
        var victimCode = (await intruder.Post("/api/auth/code", new { phone = Victim }))["devCode"];
        var attempts = new List<int>();
        for (var i = 0; i < 5; i++)
        {
            attempts.Add((await intruder.Post("/api/auth/verify", new { phone = Victim, code = WrongCode(victimCode) })).Status);
        }

        _protocol.Check(attempts.SequenceEqual([400, 400, 400, 400, 429]), "п'ята хибна спроба блокує вхід (429)");
        var correctButLocked = await intruder.Post("/api/auth/verify", new { phone = Victim, code = victimCode });
        _protocol.Check(correctButLocked.Status == 429, "навіть правильний код не діє під час блокування");
    }

    private Actor NewActor(string name) => new(name, http, _protocol);

    private async Task<Actor> LoginAsync(string name, string phone, bool tryWrongCodeFirst = false)
    {
        var actor = NewActor(name);
        var requested = await actor.Post("/api/auth/code", new { phone });
        var code = requested["devCode"];
        _protocol.Detail($"SMS на {phone}: «FarmCart: код входу {code}» (режим розробки: код повертає API)");
        if (tryWrongCodeFirst)
        {
            var wrong = await actor.Post("/api/auth/verify", new { phone, code = WrongCode(code) });
            _protocol.Check(wrong.Status == 400, "хибний код відхилено");
        }

        var session = await actor.Post("/api/auth/verify", new { phone, code });
        actor.Token = session["token"];
        var user = session.Body!["user"]!;
        var displayName = user["name"]?.ToString();
        var who = string.IsNullOrEmpty(displayName) ? "" : $" ({displayName})";
        var roles = string.Join(", ", user["roles"]!.AsArray().Select(r => r!.ToString()));
        var isNew = session["isNewUser"] == "true" ? "; створено новий обліковий запис" : "";
        _protocol.Detail($"Сесію відкрито: користувач #{user["id"]}{who}, ролі: {roles}{isNew}");
        _protocol.Check(session.Ok, $"{name} увійшов у систему");
        return actor;
    }

    /// <summary>Сума до сплати з промокодом - за тим самим правилом округлення, що й на сервері.</summary>
    private static decimal WithPromo(decimal subtotal) =>
        subtotal - Math.Round(subtotal * PromoPercent / 100m, 2, MidpointRounding.AwayFromZero);

    private static IEnumerable<string> Names(JsonArray items) => items.Select(i => i!["name"]!.ToString());

    private static List<int> SeasonMonths(JsonNode product) => [.. product["seasonMonths"]!.AsArray().Select(m => m!.GetValue<int>())];

    /// <summary>Сезон словами: «цілий рік», «травень-липень», «серпень-березень» (сезон може переходити через новий рік).</summary>
    private static string SeasonText(List<int> months)
    {
        if (months.Count is 0 or 12)
        {
            return "цілий рік";
        }

        static int Next(int month) => (month % 12) + 1;
        var first = months.First(m => !months.Contains(m == 1 ? 12 : m - 1));
        var last = first;
        while (months.Contains(Next(last)))
        {
            last = Next(last);
        }

        var name = Uk.DateTimeFormat.MonthNames;
        var range = first == last ? name[first - 1] : $"{name[first - 1]}-{name[last - 1]}";
        return $"сезон {(months.Count == ((last - first + 12) % 12) + 1 ? range : string.Join(", ", months.Order().Select(m => name[m - 1])))}";
    }

    private static JsonNode Item(JsonArray catalog, string name) =>
        catalog.SingleOrDefault(i => i!["name"]!.ToString() == name) ?? throw new InvalidOperationException($"Товару «{name}» немає в каталозі");

    private static int ProductId(JsonArray catalog, string name) => Item(catalog, name)["productId"]!.GetValue<int>();

    private static decimal Price(JsonArray catalog, string name) => Amount(Item(catalog, name)["price"]);

    private static string WrongCode(string code) =>
        ((int.Parse(code, CultureInfo.InvariantCulture) + 1) % 1_000_000).ToString("D6", CultureInfo.InvariantCulture);

    private static decimal Amount(object? value) => decimal.Parse(value?.ToString() ?? "0", CultureInfo.InvariantCulture);

    private static string Uah(object? value) => Uah(Amount(value));

    private static string Uah(decimal amount) => $"{amount.ToString("N2", Uk)} грн";

    private static string Number(object? value) => Amount(value).ToString("0.0", Uk);

    private static string Period(object? start, object? end) =>
        $"{Moment(start).ToString("dd.MM HH:mm", Uk)}-{Moment(end).ToString("HH:mm", Uk)}";

    private static string Time(object? at) => Moment(at).ToString("HH:mm:ss", Uk);

    private static DateTimeOffset Moment(object? value) => DateTimeOffset.Parse(value!.ToString()!, CultureInfo.InvariantCulture);
}
