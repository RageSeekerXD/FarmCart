import CancelIcon from '@mui/icons-material/Cancel';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SearchIcon from '@mui/icons-material/Search';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import TuneIcon from '@mui/icons-material/Tune';
import {
  Alert,
  Badge,
  Box,
  Button,
  Checkbox,
  Chip,
  Collapse,
  FormControlLabel,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Paper,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import type { CatalogItem, CatalogSort, DayOfWeek, ReferenceData } from '../../api/types';
import { errorMessage, useLang } from '../../i18n';
import { dayName } from '../../shared/dates';
import { EASE_SPRING, popIn } from '../../shared/motion';
import { EmptyState } from '../../shared/pages';
import { CategoryPills } from './CategoryPills';
import { useFavorites } from './favorites';
import { DISTANCES_KM, SORTS, WEEK, activeFilterCount, parseFilters, toApiQuery, toSearchParams, withoutFilters, type CatalogFilters } from './filters';
import { LocationControl } from './LocationLabel';
import { ProductGrid, ProductGridSkeleton } from './ProductGrid';
import { useBuyerLocation } from './useBuyerLocation';

const SORT_LABEL: Record<CatalogSort, string> = {
  Popular: 'catalog.sortPopular',
  Name: 'catalog.sortName',
  PriceAsc: 'catalog.sortPriceAsc',
  PriceDesc: 'catalog.sortPriceDesc',
  Distance: 'catalog.sortDistance',
  Rating: 'catalog.sortRating',
};

export function useReference() {
  return useQuery({
    queryKey: ['reference'],
    queryFn: () => api<ReferenceData>('/reference'),
    staleTime: Infinity,
  });
}

/** UI-02: каталог - категорії «пігулками», пошук, фільтри, сортування й товари з кошиком на картці. */
export function CatalogPage() {
  const { t } = useTranslation();
  const { lang, pick } = useLang();
  const [params, setParams] = useSearchParams();
  const filters = parseFilters(params);
  const location = useBuyerLocation();
  const favorites = useFavorites();
  const reference = useReference();

  const query = toApiQuery(filters, location.point, lang);
  const catalog = useQuery({
    queryKey: ['catalog', query],
    queryFn: ({ signal }) => api<CatalogItem[]>(`/catalog?${query}`, { signal }),
    placeholderData: keepPreviousData,
  });

  const found = catalog.data ?? [];
  const items = filters.favorites ? found.filter((item) => favorites.ids.has(item.productId)) : found;

  // На телефоні рідше вживані фільтри (ціна, відстань, сертифікат) згорнуто: товари видно одразу, без прокручування форми.
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down('sm'));
  const [moreOpen, setMoreOpen] = useState(false);
  const secondaryCount = [filters.minPrice, filters.maxPrice, filters.maxKm, filters.day, filters.certified || null, filters.soldOut || null].filter(
    (value) => value !== '' && value !== null,
  ).length;
  const filterCount = activeFilterCount(filters);

  const change = (patch: Partial<CatalogFilters>) => {
    setParams(toSearchParams({ ...filters, ...patch }), { replace: true });
  };
  const reset = () => setParams(toSearchParams(withoutFilters(filters)), { replace: true });

  return (
    <Box>
      <Typography component="h1" variant="h4" sx={{ fontSize: { xs: '1.6rem', sm: '2.1rem' } }}>
        {t('catalog.title')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 1.5 }}>
        {t('catalog.subtitle')}
      </Typography>

      <CategoryPills
        categories={reference.data?.categories ?? []}
        value={filters.category}
        onChange={(category) => change({ category })}
        favorites={{ active: filters.favorites, count: favorites.ids.size, onToggle: () => change({ favorites: !filters.favorites }) }}
      />

      <Paper component="section" elevation={1} aria-label={t('catalog.filters')} sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr', md: '3fr 1fr' }, alignItems: 'start' }}>
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
          />
          <TextField select label={t('catalog.sort')} size="small" value={filters.sort} onChange={(event) => change({ sort: event.target.value as CatalogSort })}>
            {SORTS.map((sort) => (
              <MenuItem key={sort} value={sort}>
                {t(SORT_LABEL[sort])}
              </MenuItem>
            ))}
          </TextField>
        </Box>
        {compact && (
          <Button
            size="small"
            startIcon={
              <Badge color="primary" badgeContent={secondaryCount} variant="standard">
                <TuneIcon />
              </Badge>
            }
            aria-expanded={moreOpen}
            aria-controls="catalog-more-filters"
            onClick={() => setMoreOpen((open) => !open)}
            sx={{ mt: 1 }}
          >
            {t('catalog.moreFilters')}
          </Button>
        )}
        <Collapse in={!compact || moreOpen} id="catalog-more-filters">
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              pt: 2,
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
              alignItems: 'center',
            }}
          >
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
            >
              <MenuItem value="">{t('catalog.anyDistance')}</MenuItem>
              {DISTANCES_KM.map((km) => (
                <MenuItem key={km} value={km}>
                  {t('catalog.withinKm', { km })}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label={t('catalog.deliveryDay')}
              size="small"
              value={filters.day ?? ''}
              onChange={(event) => change({ day: event.target.value === '' ? null : (event.target.value as DayOfWeek) })}
              slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
            >
              <MenuItem value="">{t('catalog.anyDay')}</MenuItem>
              {WEEK.map((day) => (
                <MenuItem key={day} value={day}>
                  {dayName(day, lang)}
                </MenuItem>
              ))}
            </TextField>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 3, pt: 1 }}>
            <FormControlLabel
              control={<Checkbox checked={filters.certified} onChange={(event) => change({ certified: event.target.checked })} />}
              label={t('catalog.certified')}
            />
            <FormControlLabel
              control={<Checkbox checked={!filters.soldOut} onChange={(event) => change({ soldOut: !event.target.checked })} />}
              label={t('catalog.inStockOnly')}
            />
          </Box>
        </Collapse>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mt: 1.5 }}>
          <LocationControl location={location} />
          {filters.farmerId !== null && (
            <Chip
              color="primary"
              label={t('catalog.oneFarm', { name: found[0] ? pick(found[0].farmerName) : `#${filters.farmerId}` })}
              onDelete={() => change({ farmerId: null })}
              deleteIcon={<CancelIcon aria-label={t('catalog.allFarms')} />}
            />
          )}
          {/* «Скинути фільтри» з'являється, лише коли є що скидати, і виділена акцентним кольором. */}
          {filterCount > 0 && (
            <Button
              variant="contained"
              color="secondary"
              size="small"
              startIcon={<RestartAltIcon />}
              onClick={reset}
              sx={{ ml: 'auto', color: '#3d2a00', animation: `${popIn} 280ms ${EASE_SPRING} backwards` }}
            >
              {t('catalog.reset')}
              <Box component="span" aria-hidden sx={{ ml: 1, px: 0.75, minWidth: 20, borderRadius: 5, bgcolor: 'rgba(0,0,0,0.12)', fontSize: '0.75rem', lineHeight: '20px' }}>
                {filterCount}
              </Box>
            </Button>
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
          {catalog.isSuccess && items.length > 0 && (
            <Typography role="status" color="text.secondary" sx={{ mb: 1.5, fontWeight: 500 }}>
              {t('catalog.found', { count: items.length })}
            </Typography>
          )}
          {catalog.isSuccess && items.length === 0 && (
            <Box role="status">
              {filters.favorites && favorites.ids.size === 0 ? (
                <EmptyState
                  icon={<FavoriteBorderIcon />}
                  title={t('catalog.noFavorites')}
                  hint={t('catalog.noFavoritesHint')}
                  action={
                    <Button variant="outlined" onClick={() => change({ favorites: false })}>
                      {t('catalog.showAll')}
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={<SearchOffIcon />}
                  title={t('catalog.empty')}
                  hint={t('catalog.emptyHint')}
                  action={
                    filterCount > 0 && (
                      <Button variant="outlined" onClick={reset}>
                        {t('catalog.reset')}
                      </Button>
                    )
                  }
                />
              )}
            </Box>
          )}
          {catalog.isPending && <ProductGridSkeleton />}
          <ProductGrid items={items} />
        </>
      )}
    </Box>
  );
}
