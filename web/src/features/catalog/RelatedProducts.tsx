import { Box, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import type { CatalogItem } from '../../api/types';
import { ProductGrid } from './ProductGrid';
import { useBuyerLocation } from './useBuyerLocation';

/** «Часто купують разом»: рахується із замовлень, без ШІ; якщо підказати нічого, блоку немає. */
export function RelatedProducts({ productIds }: { productIds: readonly number[] }) {
  const { t } = useTranslation();
  const headingId = useId();
  const { point } = useBuyerLocation();
  const ids = [...productIds].sort((a, b) => a - b).join(',');
  const query = new URLSearchParams({ ids, lat: String(point.lat), lon: String(point.lon) }).toString();
  const related = useQuery({
    queryKey: ['catalog', 'related', query],
    queryFn: () => api<CatalogItem[]>(`/catalog/related?${query}`),
    enabled: ids !== '',
    staleTime: 60_000,
  });

  if (!related.data?.length) {
    return null;
  }

  return (
    <Box component="section" aria-labelledby={headingId} sx={{ mt: 3 }}>
      <Typography id={headingId} component="h2" variant="h6" sx={{ mb: 1.5 }}>
        {t('catalog.boughtTogether')}
      </Typography>
      <ProductGrid items={related.data} />
    </Box>
  );
}
