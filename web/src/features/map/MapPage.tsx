import MyLocationIcon from '@mui/icons-material/MyLocation';
import PlaceIcon from '@mui/icons-material/Place';
import StarIcon from '@mui/icons-material/Star';
import VerifiedIcon from '@mui/icons-material/Verified';
import { Alert, Box, Button, Chip, CircularProgress, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { api } from '../../api/client';
import type { FarmOnMap } from '../../api/types';
import { errorMessage, formatNumber, useLang } from '../../i18n';
import { DISTANCES_KM, type GeoPoint } from '../catalog/filters';
import { useBuyerLocation } from '../catalog/useBuyerLocation';
import { FarmReviewsDialog } from '../reviews/FarmReviews';
import { farmsWithin } from './geo';

// Leaflet завантажується лише на сторінці мапи: каталогу його ~150 КБ не потрібні.
const FarmMapView = lazy(() => import('./FarmMapView'));

export function useFarms(point: GeoPoint | null) {
  const query = point ? `?lat=${point.lat}&lon=${point.lon}` : '';
  return useQuery({
    queryKey: ['farms', query],
    queryFn: () => api<FarmOnMap[]>(`/farmers${query}`),
    staleTime: 60_000,
  });
}

/** UI-03: мапа ферм - маркери, коло радіуса, відстань у картці, список і мапа синхронні. */
export function MapPage() {
  const { t } = useTranslation();
  const { lang, pick } = useLang();
  const location = useBuyerLocation();
  const farms = useFarms(location.point);
  const [radiusKm, setRadiusKm] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [reviewsOf, setReviewsOf] = useState<{ id: number; name: string } | null>(null);
  const cards = useRef(new Map<number, HTMLElement>());

  const visible = farmsWithin(farms.data ?? [], radiusKm);
  const selected = visible.some((farm) => farm.id === selectedId) ? selectedId : null;

  useEffect(() => {
    if (selected !== null) {
      cards.current.get(selected)?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selected]);

  return (
    <Box>
      <Typography component="h1" variant="h4" sx={{ mb: 2, fontSize: { xs: '1.6rem', sm: '2.1rem' } }}>
        {t('map.title')}
      </Typography>

      <Paper sx={{ p: 2, mb: 2, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-start' }}>
        <TextField
          select
          label={t('map.radius')}
          size="small"
          value={radiusKm ?? ''}
          onChange={(event) => setRadiusKm(event.target.value === '' ? null : Number(event.target.value))}
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
          helperText={t(location.isMine ? 'catalog.locationMine' : 'catalog.locationLviv')}
          sx={{ minWidth: 220 }}
        >
          <MenuItem value="">{t('map.allFarms')}</MenuItem>
          {DISTANCES_KM.map((km) => (
            <MenuItem key={km} value={km}>
              {t('catalog.withinKm', { km })}
            </MenuItem>
          ))}
        </TextField>
        <Button startIcon={<MyLocationIcon />} onClick={location.locate}>
          {t('catalog.useMyLocation')}
        </Button>
        {location.denied && <Alert severity="warning">{t('catalog.locationDenied')}</Alert>}
      </Paper>

      {farms.isError && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => void farms.refetch()}>
              {t('common.retry')}
            </Button>
          }
        >
          {errorMessage(farms.error)}
        </Alert>
      )}

      {farms.isSuccess && (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '3fr 2fr' }, alignItems: 'start' }}>
          <Paper
            component="section"
            aria-label={t('map.mapLabel')}
            sx={{ height: { xs: 320, md: 520 }, overflow: 'hidden', position: { md: 'sticky' }, top: { md: 112 } }}
          >
            <Suspense
              fallback={
                <Box sx={{ height: '100%', display: 'grid', placeItems: 'center' }}>
                  <CircularProgress aria-label={t('common.loading')} />
                </Box>
              }
            >
              <FarmMapView
                center={location.point}
                farms={visible}
                radiusKm={radiusKm}
                selectedId={selected}
                onSelect={setSelectedId}
                label={(farm) => pick(farm.name)}
                youAreHere={t(location.isMine ? 'map.you' : 'map.lvivCentre')}
              />
            </Suspense>
          </Paper>

          <Box component="section" aria-label={t('map.listLabel')}>
            <Typography role="status" color="text.secondary" sx={{ mb: 1 }}>
              {visible.length > 0 ? t('map.found', { count: visible.length }) : t('map.empty')}
            </Typography>
            <Stack component="ul" spacing={1.5} sx={{ listStyle: 'none', p: 0, m: 0 }}>
              {visible.map((farm) => {
                const name = pick(farm.name);
                const active = farm.id === selected;
                return (
                  <Paper
                    component="li"
                    key={farm.id}
                    ref={(element: HTMLElement | null) => {
                      if (element) {
                        cards.current.set(farm.id, element);
                      } else {
                        cards.current.delete(farm.id);
                      }
                    }}
                    aria-current={active ? 'true' : undefined}
                    variant="outlined"
                    sx={{ p: 1.5, borderColor: active ? 'secondary.main' : 'divider', borderWidth: 2 }}
                  >
                    <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {name}
                    </Typography>
                    <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', my: 1 }}>
                      {farm.distanceKm !== null && (
                        <Chip size="small" variant="outlined" icon={<PlaceIcon />} label={t('catalog.kmAway', { km: formatNumber(farm.distanceKm, lang) })} />
                      )}
                      {farm.certified && <Chip size="small" color="success" variant="outlined" icon={<VerifiedIcon />} label={t('catalog.organic')} />}
                      {farm.rating !== null ? (
                        <Chip
                          size="small"
                          variant="outlined"
                          icon={<StarIcon />}
                          label={t('map.rating', { rating: formatNumber(farm.rating, lang), count: farm.reviewCount })}
                        />
                      ) : (
                        <Chip size="small" variant="outlined" label={t('catalog.noRating')} />
                      )}
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {t('map.products', { count: farm.productCount })}
                    </Typography>
                    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                      <Button size="small" variant={active ? 'contained' : 'outlined'} onClick={() => setSelectedId(farm.id)} aria-label={t('map.showNamed', { name })}>
                        {t('map.show')}
                      </Button>
                      <Button size="small" component={RouterLink} to={`/?farmerId=${farm.id}`} disabled={farm.productCount === 0} aria-label={t('map.productsOfNamed', { name })}>
                        {t('map.toProducts')}
                      </Button>
                      <Button size="small" onClick={() => setReviewsOf({ id: farm.id, name })} aria-label={t('reviews.farmTitle', { name })}>
                        {t('reviews.open', { count: farm.reviewCount })}
                      </Button>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          </Box>
        </Box>
      )}

      {farms.isPending && <CircularProgress aria-label={t('common.loading')} />}
      {reviewsOf && <FarmReviewsDialog farmerId={reviewsOf.id} farmName={reviewsOf.name} onClose={() => setReviewsOf(null)} />}
    </Box>
  );
}
