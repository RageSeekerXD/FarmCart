namespace FarmCart.Core;

public sealed class Review
{
    public required int Id { get; init; }

    public required int OrderId { get; init; }

    public required int BuyerId { get; init; }

    public required int FarmerId { get; init; }

    public required int Rating { get; init; }

    public string? Comment { get; init; }

    /// <summary>Підпис автора для інших покупців: ім'я й ініціал прізвища («Оксана Д.»), без телефону й повного прізвища.</summary>
    public string Author { get; init; } = "";

    public required DateTimeOffset At { get; init; }

    public bool Hidden { get; set; }

    /// <summary>Причина, з якою адміністратор приховав відгук (B-FR-12); null - відгук видимий.</summary>
    public string? HiddenReason { get; set; }
}

/// <summary>Відгук у черзі модерації разом із назвою господарства, про яке його залишено.</summary>
public sealed record ModerationItem(Review Review, LocalizedText FarmName);

/// <summary>US-10 (B-FR-06): відгуки про фермера після доставки; модерація адміністратором (B-FR-12).</summary>
public sealed class ReviewService(InMemoryStore store, AuditLog audit, IClock clock)
{
    public Review Add(User buyer, int orderId, int rating, string? comment)
    {
        if (rating is < 1 or > 5)
        {
            throw Fail.Validation("rating_invalid", "Оцінка має бути від 1 до 5");
        }

        lock (store.Sync)
        {
            var order = store.BuyerOrder(buyer, orderId);
            if (order.Status != OrderStatus.Delivered)
            {
                throw Fail.Conflict("not_delivered", "Відгук можна залишити лише після доставки замовлення");
            }

            if (store.Reviews.Values.Any(r => r.OrderId == orderId))
            {
                throw Fail.Conflict("already_reviewed", "Відгук на це замовлення вже залишено");
            }

            var review = new Review
            {
                Id = store.NextId<Review>(),
                OrderId = orderId,
                BuyerId = buyer.Id,
                FarmerId = order.FarmerId,
                Rating = rating,
                Comment = comment?.Trim(),
                Author = ShortName(buyer.Name),
                At = clock.Now,
            };
            store.Reviews.Add(review.Id, review);
            Recalculate(order.FarmerId);
            return review;
        }
    }

    /// <summary>Відгук покупця на власне замовлення або null: за ним клієнт вирішує, чи показувати форму відгуку.</summary>
    public Review? ForOrder(User buyer, int orderId)
    {
        lock (store.Sync)
        {
            var order = store.BuyerOrder(buyer, orderId);
            return store.Reviews.Values.FirstOrDefault(r => r.OrderId == order.Id);
        }
    }

    public IReadOnlyList<Review> ForFarmer(int farmerId)
    {
        lock (store.Sync)
        {
            return [.. store.Reviews.Values.Where(r => r.FarmerId == farmerId && !r.Hidden).OrderByDescending(r => r.Id)];
        }
    }

    /// <summary>Відгуки покупців, у чиєму замовленні був цей товар: справжні враження саме про нього, а не лише про ферму.</summary>
    public IReadOnlyList<Review> ForProduct(int productId)
    {
        lock (store.Sync)
        {
            return [.. store.Reviews.Values
                .Where(r => !r.Hidden && store.Orders.GetValueOrDefault(r.OrderId)?.Lines.Any(line => line.ProductId == productId) == true)
                .OrderByDescending(r => r.Id)];
        }
    }

    public Review Hide(User admin, int reviewId, string reason)
    {
        admin.Require(Role.Admin);
        if (string.IsNullOrWhiteSpace(reason))
        {
            throw Fail.Validation("reason_required", "Вкажіть причину модерації");
        }

        lock (store.Sync)
        {
            var review = store.Reviews.GetValueOrDefault(reviewId)
                ?? throw Fail.NotFound("review_not_found", $"Відгук #{reviewId} не знайдено");
            review.Hidden = true;
            review.HiddenReason = reason.Trim();
            Recalculate(review.FarmerId);
            audit.Record(admin, "review.hide", $"review#{review.Id}", review.HiddenReason);
            return review;
        }
    }

    /// <summary>Модерація: усі відгуки, зокрема приховані, від найновішого - адміністратор бачить і те, що вже прибрав.</summary>
    public IReadOnlyList<ModerationItem> ForModeration(User admin)
    {
        admin.Require(Role.Admin);
        lock (store.Sync)
        {
            return [.. store.Reviews.Values.OrderByDescending(r => r.Id).Select(r => new ModerationItem(r, store.Farmers[r.FarmerId].Name))];
        }
    }

    /// <summary>Помилково прихований відгук знову видимий і знову враховується в рейтингу ферми.</summary>
    public Review Restore(User admin, int reviewId)
    {
        admin.Require(Role.Admin);
        lock (store.Sync)
        {
            var review = store.Reviews.GetValueOrDefault(reviewId)
                ?? throw Fail.NotFound("review_not_found", $"Відгук #{reviewId} не знайдено");
            if (!review.Hidden)
            {
                return review;
            }

            review.Hidden = false;
            review.HiddenReason = null;
            Recalculate(review.FarmerId);
            audit.Record(admin, "review.restore", $"review#{review.Id}", "Відгук знову видимий");
            return review;
        }
    }

    /// <summary>«Оксана Демченко» → «Оксана Д.»; одне слово лишається як є; без імені - порожньо (клієнт пише «Покупець»).</summary>
    public static string ShortName(string? name)
    {
        var parts = (name ?? "").Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return parts.Length switch
        {
            0 => "",
            1 => parts[0],
            _ => $"{parts[0]} {parts[1][0]}.",
        };
    }

    /// <summary>Середня оцінка видимих відгуків оновлюється одразу (вимога B-FR-06: не пізніше ніж за 1 хв).</summary>
    private void Recalculate(int farmerId)
    {
        var farmer = store.Farmers[farmerId];
        var ratings = store.Reviews.Values.Where(r => r.FarmerId == farmerId && !r.Hidden).Select(r => r.Rating).ToList();
        farmer.ReviewCount = ratings.Count;
        farmer.Rating = ratings.Count == 0 ? null : Math.Round(ratings.Average(), 2);
    }
}
