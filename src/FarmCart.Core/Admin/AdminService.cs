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
            return [.. store.Farmers.Values.Where(f => !f.Verified).OrderBy(f => f.Id)];
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
