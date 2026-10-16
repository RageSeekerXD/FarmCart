namespace FarmCart.Core;

public sealed record CartLineView(int ProductId, string Name, string Unit, decimal Price, int Quantity, decimal Total);

public sealed record CartView(int? FarmerId, IReadOnlyList<CartLineView> Lines, decimal Total);

/// <summary>US-05 (B-FR-03): кошик покупця.</summary>
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
            if (cart.FarmerId is { } farmerId && farmerId != product.FarmerId)
            {
                throw Fail.Conflict("cart_other_farmer", "У кошику вже є товари іншого фермера: оформіть замовлення або очистіть кошик");
            }

            var wanted = cart.Quantities.GetValueOrDefault(productId) + quantity;
            if (wanted > product.Stock)
            {
                throw Fail.Conflict("out_of_stock", $"Недостатньо «{product.Name}»: доступно {product.Stock}");
            }

            cart.FarmerId = product.FarmerId;
            cart.Quantities[productId] = wanted;
            return View(cart);
        }
    }

    public CartView Remove(User buyer, int productId)
    {
        lock (store.Sync)
        {
            var cart = store.CartOf(buyer.Id);
            cart.Quantities.Remove(productId);
            if (cart.Quantities.Count == 0)
            {
                cart.FarmerId = null;
            }

            return View(cart);
        }
    }

    private CartView View(Cart cart)
    {
        var lines = cart.Quantities
            .Select(item => (Product: store.Products[item.Key], Quantity: item.Value))
            .Select(x => new CartLineView(x.Product.Id, x.Product.Name, x.Product.Unit, x.Product.Price, x.Quantity, x.Product.Price * x.Quantity))
            .ToList();
        return new CartView(cart.FarmerId, lines, lines.Sum(line => line.Total));
    }
}
