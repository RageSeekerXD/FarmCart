import CancelIcon from '@mui/icons-material/Cancel';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import SearchIcon from '@mui/icons-material/Search';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControlLabel,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import type { CatalogItem, CatalogSort, ReferenceData } from '../../api/types';
import { errorMessage, useLang } from '../../i18n';
import { useToast } from '../../shared/Toast';
import { useAuth } from '../auth/AuthContext';
import { useAddToCart } from '../cart/useCart';
import {
  DEFAULT_FILTERS,
  DISTANCES_KM,
  SORTS,
  activeFilterCount,
  parseFilters,
  toApiQuery,
  toSearchParams,
  type CatalogFilters,
} from './filters';
import { ProductCard } from './ProductCard';
import { useBuyerLocation } from './useBuyerLocation';

const SORT_LABEL: Record<CatalogSort, string> = {
  Name: 'catalog.sortName',
  PriceAsc: 'catalog.sortPriceAsc',
  PriceDesc: 'catalog.sortPriceDesc',
  Distance: 'catalog.sortDistance',
  Rating: 'catalog.sortRating',
};

/** UI-02: каталог із фільтрами за категорією, сертифікатом, ціною, відстанню та сортуванням. */
export function CatalogPage() {
  const { t } = useTranslation();
  const { lang, pick } = useLang();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filters = parseFilters(params);
  const location = useBuyerLocation();
  const [addingId, setAddingId] = useState<number | null>(null);

  const reference = useQuery({
    queryKey: ['reference'],
    queryFn: () => api<ReferenceData>('/reference'),
    staleTime: Infinity,
  });

  const query = toApiQuery(filters, location.point, lang);
  const catalog = useQuery({
    queryKey: ['catalog', query],
    queryFn: ({ signal }) => api<CatalogItem[]>(`/catalog?${query}`, { signal }),
    placeholderData: keepPreviousData,
  });

  const items = catalog.data ?? [];
  const addToCart = useAddToCart();

  const change = (patch: Partial<CatalogFilters>) => {
    setParams(toSearchParams({ ...filters, ...patch }), { replace: true });
  };

  const add = (item: CatalogItem) => {
    if (!user) {
      toast.show(t('catalog.loginToBuy'), 'info');
      void navigate('/login', { state: { from: '/' } });
      return;
    }

    setAddingId(item.productId);
    addToCart.mutate(
      { productId: item.productId, quantity: 1 },
      {
        onSuccess: () => toast.show(t('catalog.added', { name: pick(item.name) })),
        onError: (error) => toast.show(errorMessage(error), 'error'),
        onSettled: () => setAddingId(null),
      },
    );
  };

  return (
    <Box>
      <Typography component="h1" variant="h4" sx={{ mb: 2, fontSize: { xs: '1.6rem', sm: '2.1rem' } }}>
        {t('catalog.title')}
      </Typography>

      <Paper component="section" aria-label={t('catalog.filters')} sx={{ p: 2, mb: 2 }}>
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
            alignItems: 'start',
          }}
        >
          <TextField
            label={t('catalog.search')}
            type="search"
            size="small"
            value={filters.q}
            onChange={(event) => change({ q: event.target.value })}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ gridColumn: { md: 'span 2' } }}
          />
          <TextField
            select
            label={t('catalog.category')}
            size="small"
            value={filters.category}
            onChange={(event) => change({ category: event.target.value })}
            slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
          >
            <MenuItem value="">{t('catalog.allCategories')}</MenuItem>
            {(reference.data?.categories ?? []).map((category) => (
              <MenuItem key={category.code} value={category.code}>
                {pick(category.title)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label={t('catalog.sort')}
            size="small"
            value={filters.sort}
            onChange={(event) => change({ sort: event.target.value as CatalogSort })}
          >
            {SORTS.map((sort) => (
              <MenuItem key={sort} value={sort}>
                {t(SORT_LABEL[sort])}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={t('catalog.minPrice')}
            size="small"
            value={filters.minPrice}
            onChange={(event) => change({ minPrice: event.target.value })}
            slotProps={{ htmlInput: { inputMode: 'decimal' } }}
          />
          <TextField
            label={t('catalog.maxPrice')}
            size="small"
            value={filters.maxPrice}
            onChange={(event) => change({ maxPrice: event.target.value })}
            slotProps={{ htmlInput: { inputMode: 'decimal' } }}
          />
          <TextField
            select
            label={t('catalog.distance')}
            size="small"
            value={filters.maxKm ?? ''}
            onChange={(event) => change({ maxKm: event.target.value === '' ? null : Number(event.target.value) })}
            slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
            helperText={t(location.isMine ? 'catalog.locationMine' : 'catalog.locationLviv')}
          >
            <MenuItem value="">{t('catalog.anyDistance')}</MenuItem>
            {DISTANCES_KM.map((km) => (
              <MenuItem key={km} value={km}>
                {t('catalog.withinKm', { km })}
              </MenuItem>
            ))}
          </TextField>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <FormControlLabel
              control={<Checkbox checked={filters.certified} onChange={(event) => change({ certified: event.target.checked })} />}
              label={t('catalog.certified')}
            />
          </Box>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
          <Button size="small" startIcon={<MyLocationIcon />} onClick={location.locate}>
            {t('catalog.useMyLocation')}
          </Button>
          <Button size="small" disabled={activeFilterCount(filters) === 0 && filters.sort === 'Name'} onClick={() => setParams(toSearchParams(DEFAULT_FILTERS), { replace: true })}>
            {t('catalog.reset')}
          </Button>
          {filters.farmerId !== null && (
            <Chip
              color="primary"
              label={t('catalog.oneFarm', { name: items[0] ? pick(items[0].farmerName) : `#${filters.farmerId}` })}
              onDelete={() => change({ farmerId: null })}
              deleteIcon={<CancelIcon aria-label={t('catalog.allFarms')} />}
            />
          )}
        </Box>
        {location.denied && (
          <Alert severity="warning" sx={{ mt: 1.5 }}>
            {t('catalog.locationDenied')}
          </Alert>
        )}
      </Paper>

      <Box sx={{ height: 4, mb: 1 }}>{catalog.isFetching && <LinearProgress aria-label={t('common.loading')} />}</Box>

      {catalog.isError ? (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => void catalog.refetch()}>
              {t('common.retry')}
            </Button>
          }
        >
          {errorMessage(catalog.error)}
        </Alert>
      ) : (
        <>
          {catalog.isSuccess && (
            <Typography role="status" color="text.secondary" sx={{ mb: 1.5 }}>
              {items.length > 0 ? t('catalog.found', { count: items.length }) : t('catalog.empty')}
            </Typography>
          )}
          <Box
            component="ul"
            sx={{
              listStyle: 'none',
              p: 0,
              m: 0,
              display: 'grid',
              gap: 2,
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 230px), 1fr))',
            }}
          >
            {items.map((item) => (
              <Box component="li" key={item.productId}>
                <ProductCard item={item} adding={addingId === item.productId} onAdd={add} />
              </Box>
            ))}
          </Box>
        </>
      )}
    </Box>
  );
}
