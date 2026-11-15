import { Box, Card, Skeleton } from '@mui/material';
import { useState } from 'react';
import type { CatalogItem } from '../../api/types';
import { enter } from '../../shared/motion';
import { useCartActions } from '../cart/useCartActions';
import { useFavorites } from './favorites';
import { ProductCard } from './ProductCard';
import { ProductDetails } from './ProductDetails';

export const PRODUCT_GRID = {
  listStyle: 'none',
  p: 0,
  m: 0,
  display: 'grid',
  gap: 2,
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 230px), 1fr))',
} as const;

/** Заглушка картки, поки товари вантажаться вперше: сітка не «стрибає», коли вони приходять. */
function ProductSkeleton() {
  return (
    <Card elevation={1} aria-hidden sx={{ height: '100%' }}>
      <Skeleton variant="rectangular" height={168} animation="wave" />
      <Box sx={{ p: 2 }}>
        <Skeleton width="70%" height={26} />
        <Skeleton width="50%" />
        <Skeleton width="40%" height={32} sx={{ mt: 1 }} />
        <Skeleton variant="rounded" height={38} sx={{ mt: 1.5 }} />
      </Box>
    </Card>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <Box component="ul" sx={PRODUCT_GRID}>
      {Array.from({ length: count }, (_, index) => (
        <Box component="li" key={index} sx={enter(index)}>
          <ProductSkeleton />
        </Box>
      ))}
    </Box>
  );
}

/**
 * Сітка товарів вітрини (каталог, сторінка ферми): кошик, обране й картка товару з описом.
 * showFarm=false - на сторінці ферми, де назва ферми на картках зайва.
 */
export function ProductGrid({ items, showFarm = true }: { items: readonly CatalogItem[]; showFarm?: boolean }) {
  const cart = useCartActions();
  const favorites = useFavorites();
  // Відкрита картка товару береться з поточного списку, тож після зміни фільтрів закривається сама.
  const [detailId, setDetailId] = useState<number | null>(null);
  const detail = items.find((item) => item.productId === detailId) ?? null;

  return (
    <>
      <Box component="ul" sx={PRODUCT_GRID}>
        {items.map((item, index) => (
          <Box component="li" key={item.productId} sx={enter(index)}>
            <ProductCard
              item={item}
              quantity={cart.quantityOf(item.productId)}
              busy={cart.isBusy(item.productId)}
              favorite={favorites.ids.has(item.productId)}
              onAdd={(product) => cart.add(product)}
              onQuantity={cart.setQuantity}
              onToggleFavorite={(product) => favorites.toggle(product.productId)}
              onOpen={(product) => setDetailId(product.productId)}
              showFarm={showFarm}
            />
          </Box>
        ))}
      </Box>

      {detail && (
        <ProductDetails
          key={detail.productId}
          item={detail}
          adding={cart.isBusy(detail.productId)}
          onClose={() => setDetailId(null)}
          onAdd={(item, quantity) => cart.add(item, quantity, () => setDetailId(null))}
        />
      )}
    </>
  );
}
