using System.Text.RegularExpressions;

namespace FarmCart.Core;

public sealed record AuditEntry(int Id, DateTimeOffset At, int AdminId, string Action, string Target, string Details);

/// <summary>B-FR-12: журнал аудиту дій адміністратора.</summary>
public sealed class AuditLog(InMemoryStore store, IClock clock)
{
    public void Record(User admin, string action, string target, string details)
    {
        lock (store.Sync)
        {
            store.Audit.Add(new AuditEntry(store.NextId<AuditEntry>(), clock.Now, admin.Id, action, target, details));
        }
    }

    public IReadOnlyList<AuditEntry> Entries(User admin)
    {
        admin.Require(Role.Admin);
        lock (store.Sync)
        {
            return [.. store.Audit];
        }
    }
}

/// <summary>Дії адміністратора (B-FR-07, B-FR-12): кожна потрапляє до журналу аудиту.</summary>
public sealed partial class AdminService(InMemoryStore store, AuditLog audit, IClock clock)
{
    public Farmer VerifyFarmer(User admin, int farmerId)
    {
        admin.Require(Role.Admin);
        lock (store.Sync)
        {
            var farmer = store.Farmers.GetValueOrDefault(farmerId)
                ?? throw Fail.NotFound("farmer_not_found", $"Продавця #{farmerId} не знайдено");
            farmer.Verified = true;
            farmer.RejectionReason = null;
            audit.Record(admin, "farmer.verify", $"farmer#{farmer.Id}", $"Верифіковано продавця «{farmer.Name}»");
            return farmer;
        }
    }

    /// <summary>US-02a: продавці, які чекають на верифікацію.</summary>
    public IReadOnlyList<Farmer> PendingFarmers(User admin)
    {
        admin.Require(Role.Admin);
        lock (store.Sync)
        {
            return [.. store.Farmers.Values.Where(f => !f.Verified && f.RejectionReason is null).OrderBy(f => f.Id)];
        }
    }

    /// <summary>Заявку відхилено з причиною: продавець бачить її у своєму кабінеті й може подати заявку повторно.</summary>
    public Farmer RejectFarmer(User admin, int farmerId, string reason)
    {
        admin.Require(Role.Admin);
        if (string.IsNullOrWhiteSpace(reason))
        {
            throw Fail.Validation("reason_required", "Вкажіть причину відхилення заявки");
        }

        lock (store.Sync)
        {
            var farmer = store.Farmers.GetValueOrDefault(farmerId)
                ?? throw Fail.NotFound("farmer_not_found", $"Продавця #{farmerId} не знайдено");
            if (farmer.Verified)
            {
                throw Fail.Conflict("farmer_already_verified", $"Продавця «{farmer.Name}» уже верифіковано");
            }

            farmer.RejectionReason = reason.Trim();
            audit.Record(admin, "farmer.reject", $"farmer#{farmer.Id}", $"«{farmer.Name}»: {farmer.RejectionReason}");
            return farmer;
        }
    }

    public DeliverySlot AddDeliverySlot(User admin, DateTimeOffset start, DateTimeOffset end, int capacity)
    {
        admin.Require(Role.Admin);
        if (end <= start || capacity <= 0)
        {
            throw Fail.Validation("slot_invalid", "Слот має закінчуватися пізніше, ніж починається, і мати додатну ємність");
        }

        lock (store.Sync)
        {
            var slot = new DeliverySlot(store.NextId<DeliverySlot>(), start, end, capacity);
            store.Slots.Add(slot.Id, slot);
            audit.Record(admin, "slot.create", $"slot#{slot.Id}", $"{start:dd.MM HH:mm}-{end:HH:mm}, ємність {capacity}");
            return slot;
        }
    }

    /// <summary>
    /// Зміна слоту. Ємність не може стати меншою за вже заброньоване; час можна змінити, лише поки в слоті немає
    /// активних замовлень: покупці вже знають свій час доставки.
    /// </summary>
    public DeliverySlot UpdateDeliverySlot(User admin, int slotId, DateTimeOffset start, DateTimeOffset end, int capacity)
    {
        admin.Require(Role.Admin);
        if (end <= start || capacity <= 0)
        {
            throw Fail.Validation("slot_invalid", "Слот має закінчуватися пізніше, ніж починається, і мати додатну ємність");
        }

        lock (store.Sync)
        {
            var slot = Slot(slotId);
            var booked = store.Booked(slot.Id);
            if (capacity < booked)
            {
                throw Fail.Conflict("slot_capacity_below_booked", $"У слоті вже {booked} замовлень: ємність не може бути меншою");
            }

            if (booked > 0 && (start != slot.Start || end != slot.End))
            {
                throw Fail.Conflict("slot_in_use", "У слоті вже є замовлення: його час змінити не можна");
            }

            var updated = slot with { Start = start, End = end, Capacity = capacity };
            store.Slots[slot.Id] = updated;
            audit.Record(admin, "slot.update", $"slot#{slot.Id}", $"{start:dd.MM HH:mm}-{end:HH:mm}, ємність {capacity}");
            return updated;
        }
    }

    /// <summary>Порожній слот можна прибрати; слот із замовленнями - ні.</summary>
    public void DeleteDeliverySlot(User admin, int slotId)
    {
        admin.Require(Role.Admin);
        lock (store.Sync)
        {
            var slot = Slot(slotId);
            if (store.Booked(slot.Id) > 0)
            {
                throw Fail.Conflict("slot_in_use", "У слоті вже є замовлення: видалити його не можна");
            }

            store.Slots.Remove(slot.Id);
            audit.Record(admin, "slot.delete", $"slot#{slot.Id}", $"{slot.Start:dd.MM HH:mm}-{slot.End:HH:mm}");
        }
    }

    /// <summary>Вимкнений промокод більше не приймається; його можна знову ввімкнути.</summary>
    public PromoCode SetPromoActive(User admin, string code, bool active)
    {
        admin.Require(Role.Admin);
        lock (store.Sync)
        {
            var promo = store.PromoCodes.GetValueOrDefault((code ?? "").Trim())
                ?? throw Fail.NotFound("promo_unknown", $"Промокоду «{code}» не існує");
            if (promo.Active == active)
            {
                return promo;
            }

            var changed = promo with { Active = active };
            store.PromoCodes[promo.Code] = changed;
            audit.Record(admin, active ? "promo.activate" : "promo.deactivate", $"promo#{promo.Code}", active ? "Промокод знову діє" : "Промокод вимкнено");
            return changed;
        }
    }

    private DeliverySlot Slot(int slotId) =>
        store.Slots.GetValueOrDefault(slotId) ?? throw Fail.NotFound("slot_not_found", $"Слот доставки #{slotId} не знайдено");

    /// <summary>UI-11: усі промокоди для кабінету адміністратора - спершу ті, що діють довше.</summary>
    public IReadOnlyList<PromoCode> PromoCodes(User admin)
    {
        admin.Require(Role.Admin);
        lock (store.Sync)
        {
            return [.. store.PromoCodes.Values.OrderByDescending(p => p.ValidUntil).ThenBy(p => p.Code, StringComparer.Ordinal)];
        }
    }

    public PromoCode CreatePromoCode(User admin, string code, int percent, decimal minTotal, DateTimeOffset validUntil)
    {
        admin.Require(Role.Admin);
        var normalized = (code ?? "").Trim().ToUpperInvariant();
        if (!PromoFormat().IsMatch(normalized) || percent is < 1 or > 50 || minTotal < 0)
        {
            throw Fail.Validation("promo_invalid", "Промокод - 4-16 латинських літер чи цифр, знижка 1-50 %, мінімальна сума не від'ємна");
        }

        lock (store.Sync)
        {
            if (validUntil <= clock.Now)
            {
                throw Fail.Validation("promo_invalid", "Дата завершення дії промокоду має бути в майбутньому");
            }

            if (store.PromoCodes.ContainsKey(normalized))
            {
                throw Fail.Conflict("promo_exists", $"Промокод {normalized} уже існує");
            }

            var promo = new PromoCode(normalized, percent, minTotal, validUntil);
            store.PromoCodes.Add(promo.Code, promo);
            audit.Record(admin, "promo.create", $"promo#{promo.Code}", $"{percent} % від {Money.Format(minTotal)} до {validUntil:dd.MM.yyyy}");
            return promo;
        }
    }

    [GeneratedRegex("^[A-Z0-9]{4,16}$")]
    private static partial Regex PromoFormat();
}
