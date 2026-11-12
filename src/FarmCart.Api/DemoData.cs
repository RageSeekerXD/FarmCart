using FarmCart.Core;

namespace FarmCart.Api;

/// <summary>Демонстраційний акаунт: телефон, роль, заради якої його показують, і підпис двома мовами.</summary>
public sealed record DemoAccount(string Phone, Role Role, LocalizedText Title);

/// <summary>
/// Демонстраційні дані (режим розробки, BE-8): ферми Львівщини, товари семи категорій обома мовами,
/// слоти, промокод, кур'єр і адміністратор. Понад 60 % товарів цілорічні, тож каталог не порожній у жодному місяці.
/// </summary>
public static class DemoData
{
    /// <summary>Покупець з історією: по одному замовленню в кожному статусі.</summary>
    public const string DemoBuyerPhone = "+380931112233";
    /// <summary>
    /// Акаунти для показу всіх ролей: веб-клієнт у режимі розробки пропонує вхід одним натисканням.
    /// У кожного є що показати: історія замовлень, замовлення до прийняття, доставка в дорозі, черга верифікації.
    /// </summary>
    public static readonly IReadOnlyList<DemoAccount> Accounts =
    [
        new(DemoBuyerPhone, Role.Buyer, new("Покупець з історією замовлень", "Buyer with order history")),
        new("+380671110009", Role.Farmer, new("Фермер: пекарня «Житній колос»", "Farmer: Zhytnii Kolos Bakery")),
        new("+380631230001", Role.Courier, new("Кур'єр з доставкою в дорозі", "Courier with a delivery on the way")),
        new("+380500000001", Role.Admin, new("Адміністратор", "Administrator")),
    ];

    private const string HistoryAddress = "Львів, вул. Личаківська, 24, кв. 5";

    public static void Seed(IServiceProvider services)
    {
        var store = services.GetRequiredService<InMemoryStore>();
        var farmers = services.GetRequiredService<FarmerService>();
        var now = services.GetRequiredService<IClock>().Now;

        store.AddUser("+380500000001", "Адміністратор FarmCart", Role.Admin);
        var courier = store.AddUser("+380631230001", "Андрій Шевчук", Role.Courier);

        var green = Farm("+380671110001", "Олена Коваль", "Ферма «Зелений Гай»", "Zelenyi Hai Farm", new GeoPoint(49.8160, 24.1300), certified: true);
        var cheese = Farm("+380671110002", "Іван Гуцуляк", "Сироварня «Карпатська бринза»", "Karpatska Bryndza Creamery", new GeoPoint(49.9000, 23.9600), certified: false);
        var honey = Farm("+380671110003", "Марія Бойко", "Пасіка «Медовий шлях»", "Medovyi Shliakh Apiary", new GeoPoint(49.7170, 23.9100), certified: true);
        Farm("+380671110004", "Тарас Мельник", "Еко-ферма «Сокільники»", "Sokilnyky Eco Farm", new GeoPoint(49.8000, 23.9800), certified: true, verified: false);
        var fields = Farm("+380671110005", "Петро Савчук", "Господарство «Щедрий лан»", "Shchedryi Lan Farmstead", new GeoPoint(49.8220, 23.9000), certified: false);
        var orchard = Farm("+380671110006", "Наталія Яворська", "Сад «Яворівські ягоди»", "Yavoriv Berry Orchard", new GeoPoint(49.9400, 23.3900), certified: true);
        var poultry = Farm("+380671110007", "Степан Гнатів", "Ферма «Курячий двір»", "Kuriachyi Dvir Poultry Farm", new GeoPoint(49.7850, 23.6450), certified: false);
        var smokehouse = Farm("+380671110008", "Василь Бойчук", "Господарство «Бойківська комора»", "Boikivska Komora Farmstead", new GeoPoint(49.2600, 23.8500), certified: true);
        var bakery = Farm("+380671110009", "Ірина Дмитрів", "Пекарня «Житній колос»", "Zhytnii Kolos Bakery", new GeoPoint(49.7900, 24.0600), certified: false);
        var goats = Farm("+380671110010", "Оксана Лесів", "Козина ферма «Біла кізка»", "Bila Kizka Goat Farm", new GeoPoint(50.0600, 23.9700), certified: true);
        Farm("+380671110011", "Роман Кушнір", "Пасіка «Золотий вулик»", "Zolotyi Vulyk Apiary", new GeoPoint(49.5200, 23.9800), certified: false, verified: false);
        var organic = Farm("+380671110012", "Галина Процик", "Органічна ферма «Добра земля»", "Dobra Zemlia Organic Farm", new GeoPoint(49.8070, 24.9000), certified: true);

        // Сценарій замовлення (demo.cmd) купує лише цілорічні товари, тож проходить у будь-який день року (DEF-03).
        // Сезонні яблука (серпень-березень) і полуниця (травень-липень) показують правило сезонності:
        // у кожному місяці щонайменше один із них поза сезоном і прихований у каталозі.
        // Єдині сертифіковані овочі в межах 15 км від центру Львова - морква й картопля «Зеленого Гаю» (крок US-04 сценарію).
        Product(green, "Яблука «Голден»", "Golden Delicious apples", "fruits", "kg", 32m, 150, 8, 9, 10, 11, 12, 1, 2, 3);
        Product(green, "Картопля", "Potatoes", "vegetables", "kg", 18m, 300);
        Product(green, "Морква", "Carrots", "vegetables", "kg", 16m, 200);
        Product(green, "Полуниця", "Strawberries", "berries", "basket-0.5kg", 95m, 40, 5, 6, 7);
        Product(green, "Груші «Конференція»", "Conference pears", "fruits", "kg", 45m, 80, 8, 9, 10, 11);

        Product(cheese, "Бринза овеча", "Sheep bryndza cheese", "dairy", "kg-0.5", 165m, 30);
        Product(cheese, "Молоко коров'яче", "Cow's milk", "dairy", "l", 38m, 60);
        Product(cheese, "Сир «Гірський»", "Hirskyi mountain cheese", "dairy", "kg-0.3", 210m, 25);
        Product(cheese, "Сметана домашня", "Homemade sour cream", "dairy", "jar-0.5l", 75m, 35);
        Product(cheese, "Масло вершкове", "Butter", "dairy", "kg-0.3", 140m, 20);

        Product(honey, "Мед липовий", "Linden honey", "honey", "l", 290m, 20);
        Product(honey, "Мед гречаний", "Buckwheat honey", "honey", "jar-0.5l", 170m, 15);
        Product(honey, "Мед акацієвий", "Acacia honey", "honey", "jar-0.5l", 190m, 18);
        Product(honey, "Мед у стільниках", "Comb honey", "honey", "kg-0.5", 240m, 0);

        Product(fields, "Буряк", "Beetroot", "vegetables", "kg", 15m, 180);
        Product(fields, "Капуста білокачанна", "White cabbage", "vegetables", "kg", 14m, 220);
        Product(fields, "Цибуля ріпчаста", "Onions", "vegetables", "kg", 20m, 160);
        Product(fields, "Часник", "Garlic", "vegetables", "kg-0.5", 60m, 50);
        Product(fields, "Огірки", "Cucumbers", "vegetables", "kg", 42m, 90, 5, 6, 7, 8, 9);
        Product(fields, "Помідори", "Tomatoes", "vegetables", "kg", 55m, 110, 6, 7, 8, 9, 10);
        Product(fields, "Кріп", "Dill", "vegetables", "bunch", 12m, 70);
        Product(fields, "Петрушка", "Parsley", "vegetables", "bunch", 12m, 70);

        Product(orchard, "Малина", "Raspberries", "berries", "basket-0.5kg", 110m, 45, 6, 7, 8);
        Product(orchard, "Лохина", "Blueberries", "berries", "basket-0.5kg", 150m, 30, 7, 8);
        Product(orchard, "Смородина чорна", "Blackcurrants", "berries", "basket-0.5kg", 85m, 25, 6, 7);
        Product(orchard, "Малина заморожена", "Frozen raspberries", "berries", "kg-0.5", 120m, 40);
        Product(orchard, "Варення малинове", "Raspberry jam", "berries", "jar-0.5l", 135m, 28);
        Product(orchard, "Яблука «Чемпіон»", "Champion apples", "fruits", "kg", 28m, 200, 9, 10, 11, 12, 1, 2, 3, 4);
        Product(orchard, "Сік яблучний", "Apple juice", "fruits", "l", 58m, 60);

        Product(poultry, "Яйця курячі", "Chicken eggs", "meat-eggs", "dozen-10", 62m, 80);
        Product(poultry, "Яйця перепелині", "Quail eggs", "meat-eggs", "dozen-10", 35m, 50);
        Product(poultry, "Курка домашня", "Free-range chicken", "meat-eggs", "kg", 145m, 30);
        Product(poultry, "Філе куряче", "Chicken fillet", "meat-eggs", "kg", 210m, 22);

        Product(smokehouse, "Ковбаса домашня", "Homemade sausage", "meat-eggs", "kg-0.5", 220m, 26);
        Product(smokehouse, "Сало копчене", "Smoked salo", "meat-eggs", "kg-0.5", 150m, 18);
        Product(smokehouse, "Свинина (ошийок)", "Pork neck", "meat-eggs", "kg", 260m, 15);

        Product(bakery, "Хліб житній", "Rye bread", "bakery", "loaf", 48m, 40);
        Product(bakery, "Хліб пшеничний на заквасці", "Wheat sourdough bread", "bakery", "loaf", 55m, 35);
        Product(bakery, "Паляниця", "Palianytsia bread", "bakery", "loaf", 42m, 30);
        Product(bakery, "Булочка з маком", "Poppy seed bun", "bakery", "pcs", 18m, 90);
        Product(bakery, "Пиріг з яблуками", "Apple pie", "bakery", "pcs", 160m, 0);

        Product(goats, "Молоко козине", "Goat's milk", "dairy", "l", 65m, 40);
        Product(goats, "Сир козиний", "Goat cheese", "dairy", "kg-0.3", 185m, 0);
        Product(goats, "Кефір", "Kefir", "dairy", "l", 42m, 45);

        Product(organic, "Картопля молода", "New potatoes", "vegetables", "kg", 35m, 120, 6, 7, 8);
        Product(organic, "Салат листовий", "Leaf lettuce", "vegetables", "pcs", 30m, 60);
        Product(organic, "Шпинат", "Spinach", "vegetables", "bunch", 28m, 45);
        Product(organic, "Перець солодкий", "Sweet peppers", "vegetables", "kg", 70m, 75, 7, 8, 9, 10);
        Product(organic, "Квасоля", "Beans", "vegetables", "kg-0.5", 48m, 65);
        Product(organic, "Капуста квашена", "Sauerkraut", "vegetables", "jar-0.5l", 52m, 38);

        var tomorrow = new DateTimeOffset(now.Date.AddDays(1), now.Offset);
        Slot(tomorrow.AddHours(10), capacity: 3);
        Slot(tomorrow.AddHours(12), capacity: 3);
        Slot(tomorrow.AddHours(18), capacity: 2);
        store.PromoCodes.Add("FARM10", new PromoCode("FARM10", 10, 300m, now.AddDays(30)));

        // Історія (BE-8): у демо-покупця по одному замовленню в кожному статусі, у кількох ферм є відгуки.
        // Слоти історії - післязавтра, тож сценарій demo.cmd і далі бере найближчий слот (завтра, 10:00).
        // «Зелений Гай» історії не має: сценарій перевіряє, що його рейтинг після першого відгуку дорівнює 5.
        var carts = services.GetRequiredService<CartService>();
        var orders = services.GetRequiredService<OrderService>();
        var fulfillment = services.GetRequiredService<FulfillmentService>();
        var deliveries = services.GetRequiredService<DeliveryService>();
        var reviews = services.GetRequiredService<ReviewService>();
        var morning = Slot(tomorrow.AddDays(1).AddHours(10), capacity: 6);
        var afternoon = Slot(tomorrow.AddDays(1).AddHours(14), capacity: 6);
        var demoBuyer = store.AddUser(DemoBuyerPhone, "Оксана Демченко");
        var regular = store.AddUser("+380931112234", "Ігор Петренко");
        var neighbour = store.AddUser("+380931112235", "Світлана Гнатюк");

        Buy(demoBuyer, "Хліб житній", 2, morning);
        fulfillment.Accept(poultry, Buy(demoBuyer, "Яйця курячі", 2, morning).Id);
        var assembling = Buy(demoBuyer, "Кефір", 2, morning);
        fulfillment.Accept(goats, assembling.Id);
        fulfillment.StartAssembling(goats, assembling.Id);
        var inTransit = Buy(demoBuyer, "Ковбаса домашня", 1, morning, PaymentMethod.Cash);
        fulfillment.Accept(smokehouse, inTransit.Id);
        fulfillment.StartAssembling(smokehouse, inTransit.Id);
        fulfillment.HandOver(smokehouse, inTransit.Id, courier.Id);
        Review(demoBuyer, cheese, "Бринза овеча", morning, 5, "Бринза свіжа, доставили вчасно");
        fulfillment.Reject(honey, Buy(demoBuyer, "Мед гречаний", 1, morning).Id, "Партія закінчилася, нова буде за тиждень");

        Review(regular, bakery, "Хліб житній", afternoon, 5, "Найкращий житній хліб у Львові");
        Review(neighbour, bakery, "Паляниця", afternoon, 4, "Смачно, але хотілося б більшого вибору");
        Review(regular, poultry, "Яйця курячі", afternoon, 5, comment: null);
        Review(neighbour, goats, "Молоко козине", afternoon, 4, "Свіже молоко, акуратна упаковка");
        Review(regular, honey, "Мед акацієвий", afternoon, 5, "Ароматний мед");

        Order Buy(User buyer, string product, int quantity, DeliverySlot slot, PaymentMethod method = PaymentMethod.Card)
        {
            carts.Add(buyer, store.Products.Values.Single(p => p.Name.Uk == product).Id, quantity);
            return orders.PlaceOrder(buyer, new CheckoutRequest(HistoryAddress, slot.Id, method, method == PaymentMethod.Cash ? null : "tok_visa"));
        }

        void Review(User buyer, User farmer, string product, DeliverySlot slot, int rating, string? comment)
        {
            var order = Buy(buyer, product, 1, slot);
            fulfillment.Accept(farmer, order.Id);
            fulfillment.StartAssembling(farmer, order.Id);
            fulfillment.HandOver(farmer, order.Id, courier.Id);
            deliveries.Confirm(courier, order.Id, order.DeliveryCode);
            reviews.Add(buyer, order.Id, rating, comment);
        }

        User Farm(string phone, string owner, string nameUk, string nameEn, GeoPoint location, bool certified, bool verified = true)
        {
            var user = store.AddUser(phone, owner);
            farmers.Register(user, new LocalizedText(nameUk, nameEn), location, certified, documents: $"docs/{phone}.pdf").Verified = verified;
            return user;
        }

        void Product(User farmer, string nameUk, string nameEn, string category, string unit, decimal price, int stock, params int[] season) =>
            farmers.AddProduct(farmer, new ProductDraft(new LocalizedText(nameUk, nameEn), category, unit, price, stock, season));

        DeliverySlot Slot(DateTimeOffset start, int capacity)
        {
            var slot = new DeliverySlot(store.NextId<DeliverySlot>(), start, start.AddHours(2), capacity);
            store.Slots.Add(slot.Id, slot);
            return slot;
        }
    }
}
