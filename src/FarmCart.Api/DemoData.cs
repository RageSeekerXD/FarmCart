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
    private static readonly AddressDetails HistoryDetails = new("2", "3", "5К");
    private static readonly GeoPoint HistoryPoint = new(49.8378, 24.0468);

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
        var sokilnyky = Farm("+380671110004", "Тарас Мельник", "Еко-ферма «Сокільники»", "Sokilnyky Eco Farm", new GeoPoint(49.8000, 23.9800), certified: true, verified: false);
        var fields = Farm("+380671110005", "Петро Савчук", "Господарство «Щедрий лан»", "Shchedryi Lan Farmstead", new GeoPoint(49.8220, 23.9000), certified: false);
        var orchard = Farm("+380671110006", "Наталія Яворська", "Сад «Яворівські ягоди»", "Yavoriv Berry Orchard", new GeoPoint(49.9400, 23.3900), certified: true);
        var poultry = Farm("+380671110007", "Степан Гнатів", "Ферма «Курячий двір»", "Kuriachyi Dvir Poultry Farm", new GeoPoint(49.7850, 23.6450), certified: false);
        var smokehouse = Farm("+380671110008", "Василь Бойчук", "Господарство «Бойківська комора»", "Boikivska Komora Farmstead", new GeoPoint(49.2600, 23.8500), certified: true);
        var bakery = Farm("+380671110009", "Ірина Дмитрів", "Пекарня «Житній колос»", "Zhytnii Kolos Bakery", new GeoPoint(49.7900, 24.0600), certified: false);
        var goats = Farm("+380671110010", "Оксана Лесів", "Козина ферма «Біла кізка»", "Bila Kizka Goat Farm", new GeoPoint(50.0600, 23.9700), certified: true);
        var goldenHive = Farm("+380671110011", "Роман Кушнір", "Пасіка «Золотий вулик»", "Zolotyi Vulyk Apiary", new GeoPoint(49.5200, 23.9800), certified: false, verified: false);
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

        // Історія ферм і дні, коли вони возять замовлення (сторінка ферми, фільтр каталогу «День доставки»).
        Profile(green, "Сімейна органічна ферма у Винниках з 2009 року. Вирощуємо овочі й ягоди без хімічних добрив: сівозміна й власний компост.",
            "A family organic farm in Vynnyky since 2009. We grow vegetables and berries without chemical fertilisers, using crop rotation and our own compost.",
            DayOfWeek.Tuesday, DayOfWeek.Thursday, DayOfWeek.Saturday);
        Profile(cheese, "Рецепти бринзи в родині Гуцуляків передаються з 1950-х. Влітку вівці пасуться на полонинах Карпат, узимку - у долині під Брюховичами.",
            "The Hutsuliak family has passed down its bryndza recipes since the 1950s. In summer the sheep graze on Carpathian pastures, in winter in the valley near Briukhovychi.",
            DayOfWeek.Wednesday, DayOfWeek.Saturday);
        Profile(honey, "Кочова пасіка на 120 вуликів: навесні - акація, влітку - липа й гречка. Мед не нагріваємо й не фільтруємо під тиском.",
            "A migratory apiary with 120 hives: acacia in spring, linden and buckwheat in summer. We never heat our honey or pressure-filter it.",
            DayOfWeek.Friday, DayOfWeek.Saturday);
        Profile(fields, "Овочеве господарство під Львовом: 12 гектарів відкритого ґрунту й теплиці. Збираємо врожай у день доставки.",
            "A vegetable farm outside Lviv: 12 hectares of open fields and greenhouses. We harvest on the day of delivery.",
            DayOfWeek.Monday, DayOfWeek.Wednesday, DayOfWeek.Friday);
        Profile(orchard, "Сад біля Яворова: малина, лохина й старі сорти яблук. Ягоди морозимо в день збору, варення варимо невеликими партіями.",
            "An orchard near Yavoriv: raspberries, blueberries and heritage apples. Berries are frozen on the day they are picked; jam is made in small batches.",
            DayOfWeek.Tuesday, DayOfWeek.Friday);
        Profile(poultry, "Кури й перепілки на вільному вигулі; годуємо власним зерном без антибіотиків. Яйця збираємо щоранку.",
            "Free-range hens and quails fed on our own grain without antibiotics. Eggs are collected every morning.");
        Profile(smokehouse, "Ковбаси й сало за бойківськими рецептами: коптимо на вільховій трісці у власній коптильні в горах.",
            "Sausages and salo made to Boiko recipes, smoked over alder chips in our own smokehouse in the mountains.",
            DayOfWeek.Thursday, DayOfWeek.Saturday);
        Profile(bakery, "Пекарня на дров'яній печі: тісто на живій заквасці доходить 18 годин, печемо щоранку о п'ятій.",
            "A wood-fired bakery: our sourdough rises for 18 hours, and we bake every morning at five.");
        Profile(goats, "Тридцять кіз карпатської породи. Доїмо вручну, а кефір і сир робимо того ж дня.",
            "Thirty Carpathian goats, milked by hand; kefir and cheese are made the same day.",
            DayOfWeek.Tuesday, DayOfWeek.Thursday, DayOfWeek.Saturday);
        Profile(organic, "Сертифікована органічна ферма під Золочевом: понад 20 видів зелені й овочів, полив з власної свердловини.",
            "A certified organic farm near Zolochiv: more than 20 kinds of greens and vegetables, watered from our own well.",
            DayOfWeek.Wednesday, DayOfWeek.Saturday);

        // Склад, термін придатності й умови зберігання - для сторінки товару.
        Details("Бринза овеча", ("Овече молоко, сіль, сичужний фермент", "Sheep milk, salt, rennet"), ("30 діб", "30 days"), ("У розсолі при +2…+6 °C", "In brine at +2…+6 °C"));
        Details("Сир «Гірський»", ("Коров'яче молоко, закваска, сіль, сичужний фермент", "Cow's milk, starter culture, salt, rennet"), ("60 діб", "60 days"), ("При +4…+8 °C, загорнутим у пергамент", "At +4…+8 °C, wrapped in parchment"));
        Details("Масло вершкове", ("Вершки коров'ячі, жирність 82 %", "Cow's cream, 82% fat"), ("20 діб", "20 days"), ("При +2…+6 °C", "At +2…+6 °C"));
        Details("Кефір", ("Козине молоко, кефірна закваска", "Goat's milk, kefir culture"), ("7 діб", "7 days"), ("При +2…+6 °C", "At +2…+6 °C"));
        Details("Молоко козине", ("Козине молоко, пастеризоване", "Goat's milk, pasteurised"), ("5 діб", "5 days"), ("При +2…+6 °C", "At +2…+6 °C"));
        Details("Хліб житній", ("Житнє борошно, вода, закваска, сіль, кмин", "Rye flour, water, sourdough starter, salt, caraway"), ("5 діб", "5 days"), ("У лляному мішечку при кімнатній температурі", "In a linen bag at room temperature"));
        Details("Хліб пшеничний на заквасці", ("Пшеничне борошно, вода, закваска, сіль", "Wheat flour, water, sourdough starter, salt"), ("4 доби", "4 days"), ("У лляному мішечку при кімнатній температурі", "In a linen bag at room temperature"));
        Details("Паляниця", ("Пшеничне борошно, вода, дріжджі, сіль, цукор", "Wheat flour, water, yeast, salt, sugar"), ("3 доби", "3 days"), ("У хлібниці при кімнатній температурі", "In a bread bin at room temperature"));
        Details("Мед акацієвий", ("Натуральний акацієвий мед, 100 %", "Pure acacia honey, 100%"), ("24 місяці", "24 months"), ("У темному місці при +5…+20 °C, щільно закритим", "In a dark place at +5…+20 °C, tightly closed"));
        Details("Мед липовий", ("Натуральний липовий мед, 100 %", "Pure linden honey, 100%"), ("24 місяці", "24 months"), ("У темному місці при +5…+20 °C, щільно закритим", "In a dark place at +5…+20 °C, tightly closed"));
        Details("Мед гречаний", ("Натуральний гречаний мед, 100 %", "Pure buckwheat honey, 100%"), ("24 місяці", "24 months"), ("У темному місці при +5…+20 °C, щільно закритим", "In a dark place at +5…+20 °C, tightly closed"));
        Details("Ковбаса домашня", ("Свинина, яловичина, сіль, часник, чорний перець, натуральна оболонка", "Pork, beef, salt, garlic, black pepper, natural casing"), ("20 діб", "20 days"), ("При 0…+6 °C", "At 0…+6 °C"));
        Details("Сало копчене", ("Свиняче сало, сіль, часник, спеції", "Pork fatback, salt, garlic, spices"), ("30 діб", "30 days"), ("При 0…+4 °C, загорнутим у пергамент", "At 0…+4 °C, wrapped in parchment"));
        Details("Варення малинове", ("Малина, цукор", "Raspberries, sugar"), ("12 місяців", "12 months"), ("Після відкриття - у холодильнику до 30 діб", "Once opened, keep refrigerated for up to 30 days"));
        Details("Капуста квашена", ("Капуста білокачанна, морква, сіль", "White cabbage, carrots, salt"), ("60 діб", "60 days"), ("При +1…+4 °C", "At +1…+4 °C"));
        Details("Яйця курячі", ("Яйця курячі столові, категорія С0", "Table eggs, grade C0"), ("25 діб", "25 days"), ("У холодильнику, гострим кінцем донизу", "Refrigerated, pointed end down"));

        // Скани документів двох господарств, що чекають на верифікацію: адміністратор переглядає їх перед рішенням.
        Document(sokilnyky, "Органічний сертифікат", "Сертифікат органічного виробництва", "UA-BIO-129-2026");
        Document(sokilnyky, "Витяг з ЄДР", "Витяг з Єдиного державного реєстру", "1000 2026 0045 7731");
        Document(goldenHive, "Витяг з ЄДР", "Витяг з Єдиного державного реєстру", "1000 2026 0091 2210");

        var tomorrow = new DateTimeOffset(now.Date.AddDays(1), now.Offset);
        Slot(tomorrow.AddHours(10), capacity: 3);
        Slot(tomorrow.AddHours(12), capacity: 3);
        Slot(tomorrow.AddHours(18), capacity: 2);
        store.PromoCodes.Add("FARM10", new PromoCode("FARM10", 10, 300m, now.AddDays(30)));

        // Описи кількох товарів - для картки товару в каталозі (решта товарів опису не має, як і буває на ринку).
        Describe("Морква", "Солодка морква з піщаного ґрунту, вирощена без гербіцидів. Добра для соків і запікання.",
            "Sweet carrots from sandy soil, grown without herbicides. Great for juicing and roasting.");
        Describe("Хліб житній", "Житній хліб на заквасці, випечений зранку в печі на дровах. Зберігається до п'яти днів.",
            "Sourdough rye bread baked every morning in a wood-fired oven. Keeps for up to five days.");
        Describe("Бринза овеча", "Овеча бринза з полонин Карпат, витримана в розсолі три тижні.",
            "Sheep bryndza from Carpathian mountain pastures, aged in brine for three weeks.");
        Describe("Мед акацієвий", "Світлий акацієвий мед урожаю цього року. Довго не кристалізується.",
            "Light acacia honey from this year's harvest. Stays liquid for a long time.");
        Describe("Кефір", "Кефір із козячого молока на живій заквасці, без цукру й загусників.",
            "Goat milk kefir made with live cultures, no sugar or thickeners.");

        // Історія (BE-8): у демо-покупця по одному замовленню в кожному статусі, у кількох ферм є відгуки.
        // Слоти історії - післязавтра, тож сценарій demo.cmd і далі бере найближчий слот (завтра, 10:00).
        // «Зелений Гай» історії не має: сценарій перевіряє, що його рейтинг після першого відгуку дорівнює 5.
        var carts = services.GetRequiredService<CartService>();
        var orders = services.GetRequiredService<OrderService>();
        var fulfillment = services.GetRequiredService<FulfillmentService>();
        var deliveries = services.GetRequiredService<DeliveryService>();
        var reviews = services.GetRequiredService<ReviewService>();
        var morning = Slot(tomorrow.AddDays(1).AddHours(10), capacity: 6);
        var afternoon = Slot(tomorrow.AddDays(1).AddHours(14), capacity: 8);
        var demoBuyer = store.AddUser(DemoBuyerPhone, "Оксана Демченко");
        var regular = store.AddUser("+380931112234", "Ігор Петренко");
        var neighbour = store.AddUser("+380931112235", "Світлана Гнатюк");

        Buy(demoBuyer, "Хліб житній", 2, morning, comment: "Наріжте, будь ласка, один хліб скибками");
        fulfillment.Accept(poultry, Buy(demoBuyer, "Яйця курячі", 2, morning).Id);
        var assembling = Buy(demoBuyer, "Кефір", 2, morning);
        fulfillment.Accept(goats, assembling.Id);
        fulfillment.StartAssembling(goats, assembling.Id);
        var inTransit = Buy(demoBuyer, "Ковбаса домашня", 1, morning, PaymentMethod.Cash, "Подзвоніть за 10 хвилин до приїзду");
        fulfillment.Accept(smokehouse, inTransit.Id);
        fulfillment.StartAssembling(smokehouse, inTransit.Id);
        fulfillment.HandOver(smokehouse, inTransit.Id, courier.Id);
        Review(demoBuyer, cheese, "Бринза овеча", morning, 5, "Бринза свіжа, доставили вчасно");
        fulfillment.Reject(honey, Buy(demoBuyer, "Мед гречаний", 1, morning).Id, "Партія закінчилася, нова буде за тиждень");
        fulfillment.Cancel(demoBuyer, Buy(demoBuyer, "Варення малинове", 1, morning).Id);
        var notDelivered = Buy(demoBuyer, "Масло вершкове", 1, morning);
        fulfillment.Accept(cheese, notDelivered.Id);
        fulfillment.StartAssembling(cheese, notDelivered.Id);
        fulfillment.HandOver(cheese, notDelivered.Id, courier.Id);
        deliveries.ReportFailure(courier, notDelivered.Id, DeliveryProblem.BuyerAbsent, note: null);

        // Ще дві доставки того самого кур'єра: його мапа показує маршрут «забрати → віддати» з кількох точок.
        OnTheWay(regular, bakery, "Паляниця", afternoon, "Львів, вул. Наукова, 7а, кв. 12", new AddressDetails("1", "4", "12"), new GeoPoint(49.8135, 24.0257), PaymentMethod.Cash);
        OnTheWay(neighbour, poultry, "Яйця курячі", afternoon, "Львів, просп. Червоної Калини, 60, кв. 41", new AddressDetails("3", "7", "41"), new GeoPoint(49.7963, 24.0574), PaymentMethod.Card, "Залиште, будь ласка, біля дверей");

        Review(regular, bakery, "Хліб житній", afternoon, 5, "Найкращий житній хліб у Львові");
        Review(neighbour, bakery, "Паляниця", afternoon, 4, "Смачно, але хотілося б більшого вибору");
        Review(regular, poultry, "Яйця курячі", afternoon, 5, comment: null);
        Review(neighbour, goats, "Молоко козине", afternoon, 4, "Свіже молоко, акуратна упаковка");
        Review(regular, honey, "Мед акацієвий", afternoon, 5, "Ароматний мед");

        Order Buy(User buyer, string product, int quantity, DeliverySlot slot, PaymentMethod method = PaymentMethod.Card, string? comment = null) =>
            BuyAt(buyer, product, quantity, slot, HistoryAddress, HistoryDetails, HistoryPoint, method, comment);

        Order BuyAt(User buyer, string product, int quantity, DeliverySlot slot, string address, AddressDetails details, GeoPoint point, PaymentMethod method, string? comment)
        {
            carts.Add(buyer, store.Products.Values.Single(p => p.Name.Uk == product).Id, quantity);
            var token = method == PaymentMethod.Cash ? null : "tok_visa";
            return orders.PlaceOrder(buyer, new CheckoutRequest(address, slot.Id, method, token, Comment: comment, Details: details, Lat: point.Lat, Lon: point.Lon));
        }

        void OnTheWay(User buyer, User farmer, string product, DeliverySlot slot, string address, AddressDetails details, GeoPoint point, PaymentMethod method, string? comment = null)
        {
            var order = BuyAt(buyer, product, 1, slot, address, details, point, method, comment);
            fulfillment.Accept(farmer, order.Id);
            fulfillment.StartAssembling(farmer, order.Id);
            fulfillment.HandOver(farmer, order.Id, courier.Id);
        }

        void Profile(User farmer, string uk, string en, params DayOfWeek[] days) =>
            farmers.UpdateProfile(farmer, new FarmProfileChanges(new LocalizedText(uk, en), days));

        void Details(string nameUk, (string Uk, string En) composition, (string Uk, string En) shelfLife, (string Uk, string En) storage)
        {
            var product = store.Products.Values.Single(p => p.Name.Uk == nameUk);
            product.Composition = new LocalizedText(composition.Uk, composition.En);
            product.ShelfLife = new LocalizedText(shelfLife.Uk, shelfLife.En);
            product.Storage = new LocalizedText(storage.Uk, storage.En);
        }

        // Зразок скану - SVG: завантаження фермерами приймає лише PDF, JPEG і PNG, а демо-скани кладуться в сховище напряму.
        void Document(User farmer, string name, string title, string number)
        {
            var farm = store.FarmerOf(farmer);
            var svg = SampleScan(title, farm.Name.Uk, number, now);
            var id = store.NextId<FarmDocument>();
            store.FarmDocuments.Add(id, new FarmDocument(id, farm.Id, name, "image/svg+xml", System.Text.Encoding.UTF8.GetBytes(svg), now));
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

        void Describe(string nameUk, string uk, string en) =>
            store.Products.Values.Single(p => p.Name.Uk == nameUk).Description = new LocalizedText(uk, en);

        DeliverySlot Slot(DateTimeOffset start, int capacity)
        {
            var slot = new DeliverySlot(store.NextId<DeliverySlot>(), start, start.AddHours(2), capacity);
            store.Slots.Add(slot.Id, slot);
            return slot;
        }
    }

    /// <summary>
    /// Зразок скану документа для демонстрації верифікації: аркуш із назвою, господарством, номером і печаткою.
    /// Позначено «ЗРАЗОК», щоб його не сприйняли за справжній документ.
    /// </summary>
    private static string SampleScan(string title, string farm, string number, DateTimeOffset issued)
    {
        static string Escape(string text) => System.Security.SecurityElement.Escape(text);
        var date = issued.AddMonths(-3).ToString("dd.MM.yyyy", System.Globalization.CultureInfo.InvariantCulture);
        return $"""
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 595 842" width="595" height="842" font-family="Georgia, 'Times New Roman', serif">
              <rect width="595" height="842" fill="#fbf8f1"/>
              <rect x="28" y="28" width="539" height="786" fill="none" stroke="#3a6b35" stroke-width="3"/>
              <rect x="38" y="38" width="519" height="766" fill="none" stroke="#3a6b35" stroke-width="1"/>
              <text x="297" y="120" text-anchor="middle" font-size="16" fill="#555">УКРАЇНА</text>
              <text x="297" y="175" text-anchor="middle" font-size="26" font-weight="bold" fill="#1d2a1e">{Escape(title)}</text>
              <text x="297" y="215" text-anchor="middle" font-size="15" fill="#555">№ {Escape(number)}</text>
              <text x="80" y="300" font-size="16" fill="#1d2a1e">Видано: {Escape(farm)}</text>
              <text x="80" y="335" font-size="16" fill="#1d2a1e">Дата видачі: {date}</text>
              <text x="80" y="370" font-size="16" fill="#1d2a1e">Чинний до: {issued.AddYears(1).ToString("dd.MM.yyyy", System.Globalization.CultureInfo.InvariantCulture)}</text>
              <line x1="80" y1="430" x2="515" y2="430" stroke="#ccc"/>
              <line x1="80" y1="470" x2="515" y2="470" stroke="#ccc"/>
              <line x1="80" y1="510" x2="430" y2="510" stroke="#ccc"/>
              <circle cx="430" cy="680" r="62" fill="none" stroke="#2e5aa8" stroke-width="3" opacity="0.75"/>
              <circle cx="430" cy="680" r="50" fill="none" stroke="#2e5aa8" stroke-width="1.5" opacity="0.75"/>
              <text x="430" y="686" text-anchor="middle" font-size="14" fill="#2e5aa8" opacity="0.8">ПЕЧАТКА</text>
              <text x="80" y="700" font-size="14" fill="#555">Підпис уповноваженої особи ____________</text>
              <text x="297" y="520" text-anchor="middle" font-size="90" font-weight="bold" fill="#c62828" opacity="0.12" transform="rotate(-30 297 520)">ЗРАЗОК</text>
              <text x="297" y="790" text-anchor="middle" font-size="12" fill="#888">Демонстраційний документ FarmCart · Sample document</text>
            </svg>
            """;
    }
}
