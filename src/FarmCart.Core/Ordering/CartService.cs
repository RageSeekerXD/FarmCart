namespace FarmCart.Core;

public sealed record CartLineView(
    int ProductId,
    LocalizedText Name,
    LocalizedText Unit,
    string? PhotoUrl,
    decimal Price,
    int Quantity,
    decimal Total,
    int FarmerId,
    LocalizedText FarmerName);

/// <summary>Позиція минулого замовлення, яку не вдалося повторити повністю: скільки просили й скільки додано.</summary>
public sealed record ReorderShortfall(LocalizedText Name, int Requested, int Added);

/// <summary>Результат «Замовити знову»: оновлений кошик і позиції, яких бракує.</summary>
public sealed record ReorderResult(CartView Cart, IReadOnlyList<ReorderShortfall> Shortfalls);

/// <summary>Кошик; FarmerId - ферма, якщо всі товари від однієї (інакше null: при оформленні буде кілька замовлень).</summary>
public sealed record CartView(int? FarmerId, IReadOnlyList<CartLineView> Lines, decimal Total);

/// <summary>US-05 (B-FR-03): кошик покупця. Товари різних ферм можна класти разом (п. 8 покращень).</summary>
public sealed class CartService(InMemoryStore store)
{
    public CartView Get(User buyer)
    {
        lock (store.Sync)
        {
            return View(store.CartOf(buyer.Id));
        }
    }

    public CartView Add(User buyer, int productId, int quantity)
    {
        if (quantity <= 0)
        {
            throw Fail.Validation("quantity_invalid", "Кількість має бути більшою за нуль");
        }

        lock (store.Sync)
        {
            var product = store.Products.GetValueOrDefault(productId)
                ?? throw Fail.NotFound("product_not_found", $"Товар #{productId} не знайдено");
            var cart = store.CartOf(buyer.Id);
            var wanted = cart.Quantities.GetValueOrDefault(productId) + quantity;
            if (wanted > product.Stock)
            {
                throw Fail.Conflict("out_of_stock", $"Недостатньо «{product.Name}»: доступно {product.Stock}");
            }

            cart.Quantities[productId] = wanted;
            return View(cart);
        }
    }

    /// <summary>
    /// «Замовити знову» (п. 4 покращень): позиції минулого замовлення додаються до кошика в тій самій кількості,
    /// але не більше, ніж є на складі зараз; чого бракує - повертається списком, щоб покупець знав.
    /// </summary>
    public ReorderResult Reorder(User buyer, int orderId)
    {
        lock (store.Sync)
        {
            var order = store.BuyerOrder(buyer, orderId);
            var cart = store.CartOf(buyer.Id);
            var shortfalls = new List<ReorderShortfall>();
            foreach (var line in order.Lines)
            {
                var product = store.Products.GetValueOrDefault(line.ProductId);
                var available = product is null ? 0 : Math.Max(0, product.Stock - cart.Quantities.GetValueOrDefault(line.ProductId));
                var added = Math.Min(line.Quantity, available);
                if (added > 0)
                {
                    cart.Quantities[line.ProductId] = cart.Quantities.GetValueOrDefault(line.ProductId) + added;
                }

                if (added < line.Quantity)
                {
                    shortfalls.Add(new ReorderShortfall(line.Name, line.Quantity, added));
                }
            }

            return new ReorderResult(View(cart), shortfalls);
        }
    }

    public CartView Remove(User buyer, int productId)
    {
        lock (store.Sync)
        {
            var cart = store.CartOf(buyer.Id);
            cart.Quantities.Remove(productId);
            return View(cart);
        }
    }

    private CartView View(Cart cart)
    {
        var lines = cart.Quantities
            .Select(item => (Product: store.Products[item.Key], Quantity: item.Value))
            .Select(x => new CartLineView(
                x.Product.Id,
                x.Product.Name,
                x.Product.Unit,
                x.Product.PhotoUrl,
                x.Product.Price,
                x.Quantity,
                x.Product.Price * x.Quantity,
                x.Product.FarmerId,
                store.Farmers[x.Product.FarmerId].Name))
            .ToList();
        var farms = lines.Select(line => line.FarmerId).Distinct().ToList();
        return new CartView(farms.Count == 1 ? farms[0] : null, lines, lines.Sum(line => line.Total));
    }
}
