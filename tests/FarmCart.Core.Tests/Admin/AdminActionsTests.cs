namespace FarmCart.Core.Tests.Admin;

/// <summary>Дії адміністратора: відхилення заявки продавця, зміна й видалення слотів, вимкнення промокодів.</summary>
public sealed class AdminActionsTests
{
    private readonly TestWorld _world = new();
    private readonly User _admin;

    public AdminActionsTests()
    {
        _admin = _world.NewUser(Role.Admin);
    }

    [Fact]
    public void RejectFarmer_RemovesFromQueueAndFarmerCanReapply()
    {
        var (user, farmer) = _world.NewFarmer("Ферма «Сонях»", verified: false);

        _world.Admin.RejectFarmer(_admin, farmer.Id, " Немає документів ");
        var queueAfterReject = _world.Admin.PendingFarmers(_admin);
        _world.Farmers.Reapply(user);

        Assert.Empty(queueAfterReject);
        Assert.Equal([farmer.Id], _world.Admin.PendingFarmers(_admin).Select(f => f.Id));
        Assert.Null(farmer.RejectionReason);
        Assert.Equal(("farmer.reject", "«Ферма «Сонях»»: Немає документів"), (_world.Audit.Entries(_admin)[^1].Action, _world.Audit.Entries(_admin)[^1].Details));
    }

    [Fact]
    public void RejectFarmer_NeedsReasonAndNotAlreadyVerified()
    {
        var (_, verified) = _world.NewFarmer();
        var (_, pending) = _world.NewFarmer("Пасіка", verified: false);

        Assert.Equal("reason_required", Assert.Throws<DomainException>(() => _world.Admin.RejectFarmer(_admin, pending.Id, " ")).Code);
        Assert.Equal("farmer_already_verified", Assert.Throws<DomainException>(() => _world.Admin.RejectFarmer(_admin, verified.Id, "Помилка")).Code);
    }

    [Fact]
    public void Reapply_WithoutRejection_IsRefused()
    {
        var (user, _) = _world.NewFarmer(verified: false);

        Assert.Equal("not_rejected", Assert.Throws<DomainException>(() => _world.Farmers.Reapply(user)).Code);
    }

    [Fact]
    public void VerifyFarmer_ClearsEarlierRejection()
    {
        var (_, farmer) = _world.NewFarmer(verified: false);
        _world.Admin.RejectFarmer(_admin, farmer.Id, "Немає документів");

        _world.Admin.VerifyFarmer(_admin, farmer.Id);

        Assert.Equal((true, (string?)null), (farmer.Verified, farmer.RejectionReason));
    }

    [Fact]
    public void UpdateSlot_EmptySlot_ChangesTimeAndCapacity()
    {
        var slot = _world.NewSlot(capacity: 3);
        var start = slot.Start.AddHours(2);

        var updated = _world.Admin.UpdateDeliverySlot(_admin, slot.Id, start, start.AddHours(3), 5);

        Assert.Equal((start, start.AddHours(3), 5), (updated.Start, updated.End, updated.Capacity));
        Assert.Same(updated, _world.Store.Slots[slot.Id]);
        Assert.Equal("slot.update", _world.Audit.Entries(_admin)[^1].Action);
    }

    [Fact]
    public void UpdateSlot_WithOrders_KeepsTimeAndCannotShrinkBelowBooked()
    {
        var (farm, _) = _world.NewFarmer();
        var apples = _world.NewProduct(farm, stock: 50);
        var slot = _world.NewSlot(capacity: 3);
        _world.Buy(_world.NewUser(), apples, 1, slot: slot);
        _world.Buy(_world.NewUser(), apples, 1, slot: slot);

        var moved = Assert.Throws<DomainException>(() => _world.Admin.UpdateDeliverySlot(_admin, slot.Id, slot.Start.AddHours(1), slot.End.AddHours(1), 3));
        var shrunk = Assert.Throws<DomainException>(() => _world.Admin.UpdateDeliverySlot(_admin, slot.Id, slot.Start, slot.End, 1));
        var grown = _world.Admin.UpdateDeliverySlot(_admin, slot.Id, slot.Start, slot.End, 4);

        Assert.Equal(("slot_in_use", "slot_capacity_below_booked"), (moved.Code, shrunk.Code));
        Assert.Equal(2, _world.Orders.AvailableSlots().Single(s => s.Id == slot.Id).Remaining);
        Assert.Equal(4, grown.Capacity);
    }

    [Fact]
    public void DeleteSlot_OnlyWhenNothingIsBooked()
    {
        var (farm, _) = _world.NewFarmer();
        var apples = _world.NewProduct(farm, stock: 50);
        var busy = _world.NewSlot();
        var empty = _world.NewSlot(hoursFromNow: 30);
        var cancelled = _world.NewSlot(hoursFromNow: 36);
        var buyer = _world.NewUser();
        _world.Buy(buyer, apples, 1, slot: busy);
        _world.Fulfillment.Cancel(buyer, _world.Buy(buyer, apples, 1, slot: cancelled).Id);

        var error = Assert.Throws<DomainException>(() => _world.Admin.DeleteDeliverySlot(_admin, busy.Id));
        _world.Admin.DeleteDeliverySlot(_admin, empty.Id);
        _world.Admin.DeleteDeliverySlot(_admin, cancelled.Id);

        Assert.Equal("slot_in_use", error.Code);
        Assert.Equal([busy.Id], _world.Store.Slots.Keys);
    }

    [Fact]
    public void Promo_SwitchedOff_IsRefusedAtCheckoutAndCanBeSwitchedOn()
    {
        var (farm, _) = _world.NewFarmer();
        var apples = _world.NewProduct(farm, price: 50m, stock: 50);
        _world.NewPromo("FARM10", percent: 10, minTotal: 100m);
        var buyer = _world.NewUser();

        var off = _world.Admin.SetPromoActive(_admin, "farm10", active: false);
        var refused = Assert.Throws<DomainException>(() => _world.Buy(buyer, apples, 4, promo: "FARM10"));
        _world.Admin.SetPromoActive(_admin, "FARM10", active: true);
        var order = _world.Orders.PlaceOrder(buyer, new CheckoutRequest(TestWorld.Address, _world.NewSlot().Id, PaymentMethod.Card, "tok_visa", "FARM10"));

        Assert.False(off.Active);
        Assert.Equal("promo_inactive", refused.Code);
        Assert.Equal(10, order.DiscountPercent);
        Assert.Equal(["promo.deactivate", "promo.activate"], _world.Audit.Entries(_admin).Select(e => e.Action).TakeLast(2));
    }
}
