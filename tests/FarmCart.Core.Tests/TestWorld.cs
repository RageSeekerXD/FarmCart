namespace FarmCart.Core.Tests;

/// <summary>Спільне тестове оточення: сховище, керований годинник і сервіси з тестовими двійниками.</summary>
public sealed class TestWorld
{
    public const string Address = "Львів, вул. Городоцька, 1";
    public static readonly GeoPoint LvivCenter = new(49.8419, 24.0315);
    public static readonly GeoPoint Vynnyky = new(49.8160, 24.1300);

    public TestWorld()
    {
        Notifier = new InMemoryNotifier(Clock);
        Auth = new AuthService(Store, Sms, Clock);
        Audit = new AuditLog(Store, Clock);
        Farmers = new FarmerService(Store);
        Admin = new AdminService(Store, Audit, Clock);
        Catalog = new CatalogService(Store, Clock);
        Carts = new CartService(Store);
        Orders = new OrderService(Store, Payments, Notifier, Clock);
        Workflow = new OrderWorkflow(Notifier, Clock);
        Fulfillment = new FulfillmentService(Store, Payments, Workflow);
        Deliveries = new DeliveryService(Store, Workflow);
        Reviews = new ReviewService(Store, Audit, Clock);
    }

    /// <summary>1 жовтня 2026 р., 09:00 за Києвом.</summary>
    public ManualClock Clock { get; } = new(new DateTimeOffset(2026, 10, 1, 9, 0, 0, TimeSpan.FromHours(3)));

    public InMemoryStore Store { get; } = new();

    public InMemorySmsGateway Sms { get; } = new();

    public SandboxPaymentGateway Payments { get; } = new();

    public InMemoryNotifier Notifier { get; }

    public AuthService Auth { get; }

    public AuditLog Audit { get; }

    public FarmerService Farmers { get; }

    public AdminService Admin { get; }

    public CatalogService Catalog { get; }

    public CartService Carts { get; }

    public OrderService Orders { get; }

    public OrderWorkflow Workflow { get; }

    public FulfillmentService Fulfillment { get; }

    public DeliveryService Deliveries { get; }

    public ReviewService Reviews { get; }

    public User NewUser(params Role[] roles) =>
        Store.AddUser($"+38067{Store.Users.Count + 1_000_000:D7}", "Тестовий користувач", roles);

    public (User User, Farmer Farmer) NewFarmer(string name = "Ферма «Зелений Гай»", GeoPoint? at = null, bool certified = false, bool verified = true)
    {
        var user = NewUser();
        var farmer = Farmers.Register(user, name, at ?? Vynnyky, certified, documents: null);
        farmer.Verified = verified;
        return (user, farmer);
    }

    public Product NewProduct(User farmerUser, string name = "Яблука", decimal price = 30m, int stock = 10, string category = "Фрукти", params int[] season) =>
        Farmers.AddProduct(farmerUser, new ProductDraft(name, category, "кг", price, stock, season));

    public DeliverySlot NewSlot(int capacity = 3, int hoursFromNow = 24)
    {
        var start = Clock.Now.AddHours(hoursFromNow);
        var slot = new DeliverySlot(Store.NextId<DeliverySlot>(), start, start.AddHours(2), capacity);
        Store.Slots.Add(slot.Id, slot);
        return slot;
    }

    public PromoCode NewPromo(string code = "FARM10", int percent = 10, decimal minTotal = 300m, int validDays = 30)
    {
        var promo = new PromoCode(code, percent, minTotal, Clock.Now.AddDays(validDays));
        Store.PromoCodes.Add(promo.Code, promo);
        return promo;
    }

    /// <summary>Кладе товар у кошик і оформлює замовлення (за замовчуванням - карткою tok_visa).</summary>
    public Order Buy(User buyer, Product product, int quantity, PaymentMethod method = PaymentMethod.Card, string? promo = null, DeliverySlot? slot = null) =>
        BuyMany(buyer, [(product, quantity)], method, promo, slot);

    public Order BuyMany(User buyer, (Product Product, int Quantity)[] items, PaymentMethod method = PaymentMethod.Card, string? promo = null, DeliverySlot? slot = null)
    {
        foreach (var (product, quantity) in items)
        {
            Carts.Add(buyer, product.Id, quantity);
        }

        var token = method == PaymentMethod.Cash ? null : "tok_visa";
        return Orders.PlaceOrder(buyer, new CheckoutRequest(Address, (slot ?? NewSlot()).Id, method, token, promo));
    }

    /// <summary>Проводить замовлення фермера до статусу «в дорозі» з указаним кур'єром.</summary>
    public Order SendWithCourier(User farmerUser, Order order, User courier)
    {
        Fulfillment.Accept(farmerUser, order.Id);
        Fulfillment.StartAssembling(farmerUser, order.Id);
        return Fulfillment.HandOver(farmerUser, order.Id, courier.Id);
    }

    /// <summary>Повний шлях замовлення: фермер приймає й передає кур'єру, кур'єр вручає за кодом.</summary>
    public Order Deliver(User farmerUser, Order order)
    {
        var courier = NewUser(Role.Courier);
        SendWithCourier(farmerUser, order, courier);
        return Deliveries.Confirm(courier, order.Id, order.DeliveryCode);
    }
}
