namespace FarmCart.Core;

/// <summary>
/// Сховище в пам'яті (проста конструкція XP: СКБД з'явиться, коли її вимагатиме історія користувача).
/// Сервіси змінюють стан лише під замком <see cref="Sync"/>, тому перевірка правила і зміна стану атомарні.
/// </summary>
public sealed class InMemoryStore
{
    private readonly Dictionary<Type, int> _sequences = new() { [typeof(Order)] = 1000 };

    public Lock Sync { get; } = new();

    public Dictionary<int, User> Users { get; } = [];

    public Dictionary<string, int> Sessions { get; } = [];

    public Dictionary<string, OtpState> Otps { get; } = [];

    public Dictionary<int, Farmer> Farmers { get; } = [];

    public Dictionary<int, Product> Products { get; } = [];

    public Dictionary<int, DeliverySlot> Slots { get; } = [];

    public Dictionary<string, PromoCode> PromoCodes { get; } = new(StringComparer.OrdinalIgnoreCase);

    public Dictionary<int, Cart> Carts { get; } = [];

    public Dictionary<int, Order> Orders { get; } = [];

    /// <summary>Ключі ідемпотентності оформлення: (покупець, Idempotency-Key) → замовлення.</summary>
    public Dictionary<(int BuyerId, string Key), int> OrderKeys { get; } = [];

    public Dictionary<int, Review> Reviews { get; } = [];

    public List<AuditEntry> Audit { get; } = [];

    public int NextId<T>() => _sequences[typeof(T)] = _sequences.GetValueOrDefault(typeof(T)) + 1;

    public User AddUser(string phone, string name = "", params Role[] roles)
    {
        var user = new User { Id = NextId<User>(), Phone = phone, Name = name };
        user.Roles.UnionWith(roles);
        Users.Add(user.Id, user);
        return user;
    }

    public Farmer FarmerOf(User user) =>
        Farmers.Values.FirstOrDefault(f => f.UserId == user.Id)
        ?? throw Fail.Forbidden("not_a_farmer", "Спочатку зареєструйтеся як продавець");

    public Cart CartOf(int buyerId) => Carts.TryGetValue(buyerId, out var cart) ? cart : Carts[buyerId] = new Cart();
}
