namespace FarmCart.Core;

public sealed class Review
{
    public required int Id { get; init; }

    public required int OrderId { get; init; }

    public required int BuyerId { get; init; }

    public required int FarmerId { get; init; }

    public required int Rating { get; init; }

    public string? Comment { get; init; }

    public required DateTimeOffset At { get; init; }

    public bool Hidden { get; set; }
}

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
            var order = store.Orders.GetValueOrDefault(orderId);
            if (order is null || order.BuyerId != buyer.Id)
            {
                throw Fail.NotFound("order_not_found", $"Замовлення №{orderId} не знайдено");
            }

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
                At = clock.Now,
            };
            store.Reviews.Add(review.Id, review);
            Recalculate(order.FarmerId);
            return review;
        }
    }

    public IReadOnlyList<Review> ForFarmer(int farmerId)
    {
        lock (store.Sync)
        {
            return [.. store.Reviews.Values.Where(r => r.FarmerId == farmerId && !r.Hidden).OrderByDescending(r => r.Id)];
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
            Recalculate(review.FarmerId);
            audit.Record(admin, "review.hide", $"review#{review.Id}", reason.Trim());
            return review;
        }
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
