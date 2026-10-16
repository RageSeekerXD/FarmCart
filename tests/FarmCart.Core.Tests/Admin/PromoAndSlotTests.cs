namespace FarmCart.Core.Tests.Admin;

/// <summary>B-FR-12: промокоди та слоти доставки створює адміністратор, і кожна дія потрапляє до аудиту.</summary>
public sealed class PromoAndSlotTests
{
    private readonly TestWorld _world = new();
    private readonly User _admin;

    public PromoAndSlotTests() => _admin = _world.NewUser(Role.Admin);

    [Fact]
    public void CreatePromoCode_NormalizesCodeAndWritesAudit()
    {
        var promo = _world.Admin.CreatePromoCode(_admin, " osin15 ", 15, 500m, _world.Clock.Now.AddDays(30));

        Assert.Equal("OSIN15", promo.Code);
        Assert.Same(promo, _world.Store.PromoCodes["osin15"]);
        var entry = Assert.Single(_world.Audit.Entries(_admin));
        Assert.Equal(("promo.create", "promo#OSIN15"), (entry.Action, entry.Target));
    }

    [Theory]
    [InlineData("AB", 10, 0, 30)]
    [InlineData("ОСІНЬ15", 10, 0, 30)]
    [InlineData("FARM10", 0, 0, 30)]
    [InlineData("FARM10", 60, 0, 30)]
    [InlineData("FARM10", 10, -1, 30)]
    [InlineData("FARM10", 10, 0, -1)]
    public void CreatePromoCode_WithInvalidParameters_IsRejected(string code, int percent, int minTotal, int validDays)
    {
        var error = Assert.Throws<DomainException>(() =>
            _world.Admin.CreatePromoCode(_admin, code, percent, minTotal, _world.Clock.Now.AddDays(validDays)));

        Assert.Equal("promo_invalid", error.Code);
        Assert.Empty(_world.Store.Audit);
    }

    [Fact]
    public void CreatePromoCode_Duplicate_IsConflict()
    {
        _world.Admin.CreatePromoCode(_admin, "FARM10", 10, 300m, _world.Clock.Now.AddDays(30));

        var error = Assert.Throws<DomainException>(() => _world.Admin.CreatePromoCode(_admin, "farm10", 5, 0m, _world.Clock.Now.AddDays(5)));

        Assert.Equal("promo_exists", error.Code);
    }

    [Fact]
    public void CreatePromoCode_ByBuyer_IsForbidden() =>
        Assert.Equal(ErrorKind.Forbidden, Assert.Throws<DomainException>(() =>
            _world.Admin.CreatePromoCode(_world.NewUser(), "FARM10", 10, 0m, _world.Clock.Now.AddDays(1))).Kind);

    [Fact]
    public void AddDeliverySlot_CreatesSlotAndWritesAudit()
    {
        var start = _world.Clock.Now.AddDays(1);

        var slot = _world.Admin.AddDeliverySlot(_admin, start, start.AddHours(2), 3);

        Assert.Same(slot, _world.Store.Slots[slot.Id]);
        Assert.Equal("slot.create", Assert.Single(_world.Audit.Entries(_admin)).Action);
    }

    [Theory]
    [InlineData(2, 0)]
    [InlineData(-1, 3)]
    public void AddDeliverySlot_WithInvalidWindowOrCapacity_IsRejected(int hours, int capacity)
    {
        var start = _world.Clock.Now.AddDays(1);

        var error = Assert.Throws<DomainException>(() => _world.Admin.AddDeliverySlot(_admin, start, start.AddHours(hours), capacity));

        Assert.Equal("slot_invalid", error.Code);
    }
}
