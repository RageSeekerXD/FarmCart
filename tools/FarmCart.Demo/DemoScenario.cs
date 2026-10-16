using System.Globalization;
using System.Text.Json.Nodes;

namespace FarmCart.Demo;

/// <summary>Наскрізний сценарій релізу 1.0 на демонстраційних даних сервера (режим розробки).</summary>
internal sealed class DemoScenario(Uri server)
{
    private const string LvivCenter = "lat=49.8419&lon=24.0315";
    private static readonly CultureInfo Uk = CultureInfo.GetCultureInfo("uk-UA");
    private readonly Protocol _protocol = new();
    private readonly HttpClient _http = new() { BaseAddress = server };

    public string Protocol => _protocol.Text;

    public async Task<bool> RunAsync()
    {
        _protocol.Title($"FarmCart - протокол роботи програми: сценарій релізу 1 ({DateTime.Now.ToString("dd.MM.yyyy HH:mm:ss", Uk)}, сервер {server})");

        _protocol.Step("Перевірка доступності сервера");
        var health = await NewActor("Клієнт").Get("/api/health");
        _protocol.Check(health["status"] == "ok", "сервер відповідає status=ok");
        _protocol.Detail($"Версія сервера: {health["version"]}");

        _protocol.Step("US-01. Адміністратор входить за одноразовим кодом із SMS");
        var admin = await LoginAsync("Адміністратор", "+380500000001");

        _protocol.Step("US-02. Продавець без верифікації намагається опублікувати товар");
        var newcomer = await LoginAsync("Фермер Тарас", "+380671110004");
        var curd = new { name = "Сир кисломолочний", category = "Молочні продукти", unit = "0,5 кг", price = 85m, stock = 20 };
        var refused = await newcomer.Post("/api/farmer/products", curd);
        _protocol.Check(refused.Status == 403, "публікацію відхилено зі статусом 403");

        _protocol.Step("US-02. Адміністратор верифікує продавця, після чого той публікує товар");
        var pending = (await admin.Get("/api/admin/farmers/pending")).Items;
        var farm = pending.Single(f => f!["name"]!.ToString() == "Еко-ферма «Сокільники»")!;
        _protocol.Detail($"Очікує верифікації: продавець #{farm["id"]} {farm["name"]}");
        var verified = await admin.Post($"/api/admin/farmers/{farm["id"]}/verify");
        _protocol.Check(verified["verified"] == "true", "продавця верифіковано");
        var published = await newcomer.Post("/api/farmer/products", curd);
        _protocol.Check(published.Status == 201, "товар опубліковано (201)");
        _protocol.Detail($"Опубліковано товар #{published["id"]} «{published["name"]}», {Uah(published["price"])} за {published["unit"]}");

        _protocol.Step("US-01. Новий покупець реєструється за номером телефону (спершу вводить хибний код)");
        var buyer = await LoginAsync("Покупець Оксана", "+380971234567", tryWrongCodeFirst: true);

        _protocol.Step("US-04. Пошук: сертифіковані овочі до 15 км від центру Львова, спершу дешевші");
        var vegetables = (await buyer.Get($"/api/catalog?category=Овочі&certified=true&{LvivCenter}&maxKm=15&sort=PriceAsc")).Items;
        foreach (var item in vegetables)
        {
            _protocol.Detail($"{item!["name"]} - {Uah(item["price"])}/{item["unit"]}, {item["farmerName"]}, {Number(item["distanceKm"])} км");
        }

        _protocol.Check(vegetables.Select(i => i!["name"]!.ToString()).SequenceEqual(["Морква", "Картопля молода"]), "знайдено моркву й картоплю «Зеленого Гаю»");

        _protocol.Step("US-04. Увесь каталог жовтня: позасезонна полуниця прихована");
        var catalog = (await buyer.Get("/api/catalog")).Items;
        _protocol.Detail($"Товарів у каталозі: {catalog.Count}; категорії: {string.Join(", ", catalog.Select(i => i!["category"]!.ToString()).Distinct())}");
        _protocol.Check(catalog.All(i => i!["name"]!.ToString() != "Полуниця"), "полуниці немає в жовтневому каталозі");
        int ProductId(string name) => catalog.Single(i => i!["name"]!.ToString() == name)!["productId"]!.GetValue<int>();

        _protocol.Step("US-05. Кошик: товари одного фермера («покупки з одного прилавка»)");
        await buyer.Post("/api/cart/items", new { productId = ProductId("Яблука «Голден»"), quantity = 5 });
        var cart = await buyer.Post("/api/cart/items", new { productId = ProductId("Картопля молода"), quantity = 15 });
        _protocol.Detail($"У кошику {cart.Body!["lines"]!.AsArray().Count} позиції на {Uah(cart["total"])}");
        var otherFarm = await buyer.Post("/api/cart/items", new { productId = ProductId("Бринза овеча"), quantity = 1 });
        _protocol.Check(otherFarm.Status == 409, "товар іншого фермера не додано (409)");

        _protocol.Step("US-05. Вільні слоти доставки");
        var slots = (await buyer.Get("/api/slots")).Items;
        foreach (var slot in slots)
        {
            _protocol.Detail($"Слот #{slot!["id"]}: {Period(slot["start"], slot["end"])}, вільних місць {slot["remaining"]}");
        }

        var slotId = slots[0]!["id"]!.GetValue<int>();
        var address = "Львів, вул. Городоцька, 15, кв. 8";

        _protocol.Step("US-06. Номер картки в запиті відхиляється ще до обробки (PCI DSS)");
        var withCard = await buyer.Post("/api/orders", new { address, slotId, paymentMethod = "Card", paymentToken = "tok_visa", comment = "Спишіть з картки 4111 1111 1111 1111" });
        _protocol.Check(withCard.Status == 400 && withCard["error"] == "card_data_forbidden", "запит із номером картки відхилено");

        _protocol.Step("US-06. Банк відхиляє оплату: замовлення не створюється, кошик зберігається");
        var declined = await buyer.Post("/api/orders", new { address, slotId, paymentMethod = "Card", paymentToken = "tok_declined" });
        var cartAfterDecline = await buyer.Get("/api/cart");
        _protocol.Check(declined.Status == 402, "оплату відхилено (402)");
        _protocol.Check(cartAfterDecline.Body!["lines"]!.AsArray().Count == 2, "кошик зберігся");
        _protocol.Detail($"У кошику, як і раніше, {cartAfterDecline.Body!["lines"]!.AsArray().Count} позиції на {Uah(cartAfterDecline["total"])}");

        _protocol.Step("US-05, US-06. Оформлення з промокодом FARM10, оплата карткою (лише токен провайдера)");
        var checkout = new { address, slotId, paymentMethod = "Card", paymentToken = "tok_visa", promoCode = "FARM10", comment = "Подзвоніть за 10 хвилин" };
        var order = await buyer.Post("/api/orders", checkout, idempotencyKey: "demo-checkout-1");
        var orderId = order["id"];
        _protocol.Detail($"Замовлення №{orderId}: сума {Uah(order["subtotal"])}, знижка {Uah(order["discount"])}, до сплати {Uah(order["total"])}");
        _protocol.Detail($"Оплата: {order["paymentTitle"]} ({Uah(order["paidAmount"])}), статус: {order["statusTitle"]}, слот {Period(order["slotStart"], order["slotEnd"])}");
        _protocol.Check(order.Status == 201 && Amount(order["total"]) == 387m, "створено замовлення на 387 грн");
        var retry = await buyer.Post("/api/orders", checkout, idempotencyKey: "demo-checkout-1");
        _protocol.Detail($"Повторний запит з тим самим Idempotency-Key повернув замовлення №{retry["id"]}");
        _protocol.Check(retry["id"] == orderId, "повтор не створив дубль");

        _protocol.Step("US-07. Фермер «Зелений Гай» бачить нове замовлення (без коду вручення)");
        var farmer = await LoginAsync("Фермер Олена", "+380671110001");
        var incoming = (await farmer.Get("/api/farmer/orders")).Items[0]!;
        _protocol.Detail($"Замовлення №{incoming["id"]}: {incoming["statusTitle"]}, позицій {incoming["lines"]!.AsArray().Count}, код вручення: {incoming["deliveryCode"]?.ToString() ?? "прихований"}");
        _protocol.Check(incoming["deliveryCode"] is null, "фермер не бачить коду вручення");

        _protocol.Step("US-07. Фермер приймає замовлення частково: бракує 1 кг картоплі");
        var shortage = new { shortages = new[] { new { productId = ProductId("Картопля молода"), quantity = 1 } } };
        var accepted = await farmer.Post($"/api/farmer/orders/{orderId}/accept", shortage);
        _protocol.Detail($"Нова сума {Uah(accepted["total"])}, автоматично повернено покупцю {Uah(accepted["refundedAmount"])}");
        _protocol.Check(Amount(accepted["refundedAmount"]) == 16.2m, "повернено 16,20 грн за відсутню картоплю");

        _protocol.Step("US-08. Фермер збирає замовлення й передає його кур'єру");
        await farmer.Post($"/api/farmer/orders/{orderId}/assemble");
        var courierInfo = (await farmer.Get("/api/couriers")).Items[0]!;
        _protocol.Detail($"Доступний кур'єр: #{courierInfo["id"]} {courierInfo["name"]}");
        var handedOver = await farmer.Post($"/api/farmer/orders/{orderId}/handover", new { courierId = courierInfo["id"]!.GetValue<int>() });
        _protocol.Check(handedOver["status"] == "InTransit", "замовлення в дорозі");

        _protocol.Step("US-09. Кур'єр бачить свої доставки з маршрутом");
        var courier = await LoginAsync("Кур'єр Андрій", "+380631230001");
        var task = (await courier.Get("/api/courier/deliveries")).Items[0]!;
        _protocol.Detail($"Доставка №{task["orderId"]}: {Period(task["slotStart"], task["slotEnd"])}, забрати: {task["pickupFrom"]}, адреса: {task["address"]}");
        _protocol.Detail($"Позицій: {task["items"]}, отримати готівкою: {Uah(task["amountToCollect"])}");
        _protocol.Detail($"Маршрут: {Uri.UnescapeDataString(task["routeUrl"]!.ToString())}");

        _protocol.Step("US-09. Вручення: без правильного коду закрити доставку неможливо");
        var code = (await buyer.Get($"/api/orders/{orderId}"))["deliveryCode"];
        _protocol.Detail($"Покупець бачить у застосунку код вручення {code} і називає його кур'єру");
        var wrongCode = await courier.Post($"/api/courier/deliveries/{orderId}/confirm", new { code = code == "0000" ? "1111" : "0000" });
        _protocol.Check(wrongCode.Status == 400, "хибний код відхилено");
        var delivered = await courier.Post($"/api/courier/deliveries/{orderId}/confirm", new { code });
        _protocol.Check(delivered["status"] == "Delivered", "замовлення доставлено");

        _protocol.Step("US-08. Push-сповіщення покупця про кожну зміну статусу");
        foreach (var notification in (await buyer.Get("/api/me/notifications")).Items)
        {
            _protocol.Detail($"{Time(notification!["at"])} {notification["text"]}");
        }

        _protocol.Step("US-10. Покупець оцінює фермера; рейтинг у каталозі оновлюється одразу");
        var review = await buyer.Post($"/api/orders/{orderId}/review", new { rating = 5, comment = "Яблука хрусткі, картопля як з городу" });
        _protocol.Check(review.Status == 201, "відгук збережено");
        var rated = (await buyer.Get("/api/catalog?q=Морква")).Items[0]!;
        _protocol.Detail($"Рейтинг продавця {rated["farmerName"]} у каталозі: {Number(rated["farmerRating"])} з 5");
        _protocol.Check(rated["farmerRating"]?.GetValue<double>() == 5.0, "рейтинг фермера 5");

        _protocol.Step("US-07. Друге замовлення: пасічниця відхиляє його, і кошти повертаються автоматично");
        await buyer.Post("/api/cart/items", new { productId = ProductId("Мед липовий"), quantity = 1 });
        var honeyOrder = await buyer.Post("/api/orders", new { address, slotId, paymentMethod = "GooglePay", paymentToken = "tok_googlepay" });
        _protocol.Detail($"Замовлення №{honeyOrder["id"]} на {Uah(honeyOrder["total"])}, оплата: {honeyOrder["paymentTitle"]} (Google Pay)");
        var beekeeper = await LoginAsync("Пасічниця Марія", "+380671110003");
        await beekeeper.Post($"/api/farmer/orders/{honeyOrder["id"]}/reject", new { reason = "Мед закристалізувався, нова партія за тиждень" });
        var rejected = await buyer.Get($"/api/orders/{honeyOrder["id"]}");
        _protocol.Detail($"Статус: {rejected["statusTitle"]} ({rejected["rejectionReason"]}), оплата: {rejected["paymentTitle"]}, повернено {Uah(rejected["refundedAmount"])}");
        _protocol.Check(rejected["paymentStatus"] == "Refunded", "кошти повернено автоматично");

        _protocol.Step("B-FR-12. Журнал аудиту дій адміністратора");
        foreach (var entry in (await admin.Get("/api/admin/audit")).Items)
        {
            _protocol.Detail($"{Time(entry!["at"])} адміністратор #{entry["adminId"]}: {entry["action"]} {entry["target"]} - {entry["details"]}");
        }

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

        _protocol.Summary();
        return _protocol.Failures == 0;
    }

    private Actor NewActor(string name) => new(name, _http, _protocol);

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

    private static string WrongCode(string code) =>
        ((int.Parse(code, CultureInfo.InvariantCulture) + 1) % 1_000_000).ToString("D6", CultureInfo.InvariantCulture);

    private static decimal Amount(object? value) => decimal.Parse(value?.ToString() ?? "0", CultureInfo.InvariantCulture);

    private static string Uah(object? value) => $"{Amount(value).ToString("N2", Uk)} грн";

    private static string Number(object? value) => Amount(value).ToString("0.0", Uk);

    private static string Period(object? start, object? end) =>
        $"{Moment(start).ToString("dd.MM HH:mm", Uk)}-{Moment(end).ToString("HH:mm", Uk)}";

    private static string Time(object? at) => Moment(at).ToString("HH:mm:ss", Uk);

    private static DateTimeOffset Moment(object? value) => DateTimeOffset.Parse(value!.ToString()!, CultureInfo.InvariantCulture);
}
