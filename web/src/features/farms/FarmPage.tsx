import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InventoryOutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PlaceIcon from '@mui/icons-material/Place';
import DoNotDisturbOnOutlinedIcon from '@mui/icons-material/DoNotDisturbOnOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import VerifiedIcon from '@mui/icons-material/Verified';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  CircularProgress,
  Link,
  Paper,
  Rating,
  Skeleton,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Suspense, lazy, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import type { CatalogItem } from '../../api/types';
import { errorMessage, formatNumber, useLang } from '../../i18n';
import { EmptyState } from '../../shared/pages';
import { DEFAULT_FILTERS, toApiQuery } from '../catalog/filters';
import { useLocationText } from '../catalog/LocationLabel';
import { placeOf } from '../catalog/places';
import { ProductGrid, ProductGridSkeleton } from '../catalog/ProductGrid';
import { useBuyerLocation } from '../catalog/useBuyerLocation';
import { useFarms } from '../map/MapPage';
import { FarmReviews } from '../reviews/FarmReviews';

// Leaflet вантажиться лише тоді, коли сторінка ферми справді показує мапу.
const FarmMapView = lazy(() => import('../map/FarmMapView'));

/** Рядок «Сертифікати й перевірки»: значок, назва й пояснення; неотримане - сірим. */
function Credential({ icon, title, text, granted }: { icon: ReactNode; title: string; text: string; granted: boolean }) {
  return (
    <Box component="li" sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', opacity: granted ? 1 : 0.85 }}>
      <Box sx={{ color: granted ? 'success.main' : 'text.disabled', mt: 0.25, display: 'flex' }}>{icon}</Box>
      <Box>
        <Typography sx={{ fontWeight: 650 }}>{title}</Typography>
        <Typography variant="body2" color="text.secondary">
          {text}
        </Typography>
      </Box>
    </Box>
  );
}

/** Сторінка ферми: хто продає, чим підтверджено якість, де ферма на мапі, увесь її асортимент і відгуки. */
export function FarmPage() {
  const { t } = useTranslation();
  const { lang, pick } = useLang();
  const theme = useTheme();
  const farmerId = Number(useParams().id);
  const valid = Number.isInteger(farmerId) && farmerId > 0;
  const location = useBuyerLocation();
  const from = useLocationText(location);
  const farms = useFarms(location.point);
  const farm = farms.data?.find((item) => item.id === farmerId);

  const query = toApiQuery({ ...DEFAULT_FILTERS, farmerId }, location.point, lang);
  const products = useQuery({
    queryKey: ['catalog', query],
    queryFn: ({ signal }) => api<CatalogItem[]>(`/catalog?${query}`, { signal }),
    enabled: valid && farm !== undefined,
  });

  if (farms.isError) {
    return (
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
    );
  }

  if (farms.isPending) {
    return (
      <Box aria-label={t('common.loading')}>
        <Skeleton width="40%" height={48} />
        <Skeleton variant="rounded" height={220} sx={{ mt: 2 }} />
      </Box>
    );
  }

  if (!farm) {
    return (
      <EmptyState
        icon={<StorefrontOutlinedIcon />}
        title={t('farmPage.notFound')}
        hint={t('farmPage.notFoundHint')}
        action={
          <Button component={RouterLink} to="/" variant="contained">
            {t('common.toCatalog')}
          </Button>
        }
      />
    );
  }

  const name = pick(farm.name);
  const place = placeOf({ lat: farm.lat, lon: farm.lon });
  const placeName = place ? (place.near ? t('catalog.placeArea', { place: pick(place.name) }) : pick(place.name)) : null;
  const osm = `https://www.openstreetmap.org/?mlat=${farm.lat}&mlon=${farm.lon}#map=13/${farm.lat}/${farm.lon}`;

  return (
    <Box>
      <Breadcrumbs aria-label={t('farmPage.breadcrumbs')} sx={{ mb: 1.5 }}>
        <Link component={RouterLink} to="/" underline="hover" color="inherit">
          {t('catalog.title')}
        </Link>
        <Typography color="text.primary" sx={{ fontWeight: 500 }}>
          {name}
        </Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '7fr 5fr' }, mb: 3 }}>
        <Paper elevation={1} sx={{ p: { xs: 2, sm: 3 } }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
            <Box
              aria-hidden
              sx={{ width: 64, height: 64, flexShrink: 0, borderRadius: 3, display: 'grid', placeItems: 'center', color: '#fff', background: theme.brand.gradient, '& svg': { fontSize: 34 } }}
            >
              <StorefrontOutlinedIcon />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography component="h1" variant="h4" sx={{ fontSize: { xs: '1.5rem', sm: '2rem' } }}>
                {name}
              </Typography>
              {farm.rating !== null ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                  <Rating value={farm.rating} precision={0.1} readOnly size="small" aria-label={t('catalog.rating', { rating: formatNumber(farm.rating, lang) })} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {formatNumber(farm.rating, lang)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    · {t('reviews.count', { count: farm.reviewCount })}
                  </Typography>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {t('catalog.noRating')}
                </Typography>
              )}
            </Box>
          </Box>

          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mb: 2.5 }}>
            {placeName && <Chip icon={<PlaceIcon />} label={placeName} variant="outlined" />}
            {farm.distanceKm !== null && (
              <Chip variant="outlined" label={t('farmPage.distance', { km: formatNumber(farm.distanceKm, lang) })} title={from} />
            )}
            <Chip icon={<InventoryOutlinedIcon />} variant="outlined" label={t('map.products', { count: farm.productCount })} />
          </Stack>

          <Typography component="h2" variant="subtitle1" sx={{ mb: 1 }}>
            {t('farmPage.credentials')}
          </Typography>
          <Stack component="ul" spacing={1.5} sx={{ listStyle: 'none', p: 0, m: 0 }}>
            <Credential icon={<VerifiedUserIcon />} granted title={t('farmPage.verifiedTitle')} text={t('farmPage.verifiedText')} />
            <Credential
              icon={farm.certified ? <VerifiedIcon /> : <DoNotDisturbOnOutlinedIcon />}
              granted={farm.certified}
              title={t(farm.certified ? 'farmPage.organicTitle' : 'farmPage.noOrganicTitle')}
              text={t(farm.certified ? 'farmPage.organicText' : 'farmPage.noOrganicText')}
            />
            <Credential icon={<CheckCircleIcon />} granted title={t('farmPage.directTitle')} text={t('farmPage.directText')} />
          </Stack>
        </Paper>

        <Paper component="section" elevation={1} aria-label={t('farmPage.location')} sx={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 300 }}>
          <Box sx={{ flex: 1, minHeight: 240, position: 'relative', zIndex: 0 }}>
            <Suspense
              fallback={
                <Box sx={{ height: '100%', display: 'grid', placeItems: 'center' }}>
                  <CircularProgress aria-label={t('common.loading')} />
                </Box>
              }
            >
              <FarmMapView
                center={location.point}
                farms={[farm]}
                radiusKm={null}
                // Без обраної ферми мапа не центрується на ній, а вміщує і ферму, і точку відліку покупця.
                selectedId={null}
                onSelect={() => undefined}
                label={() => name}
                youAreHere={t(location.isMine ? 'map.you' : 'map.lvivCentre')}
              />
            </Suspense>
          </Box>
          <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="body2" color="text.secondary" sx={{ mr: 'auto' }}>
              {from}
            </Typography>
            <Button size="small" href={osm} target="_blank" rel="noopener noreferrer" endIcon={<OpenInNewIcon fontSize="small" />}>
              {t('farmPage.openMap')}
            </Button>
          </Box>
        </Paper>
      </Box>

      <Box component="section" aria-labelledby="farm-products" sx={{ mb: 3 }}>
        <Typography id="farm-products" component="h2" variant="h5" sx={{ mb: 1.5 }}>
          {t('farmPage.products')}
          {products.data && (
            <Typography component="span" color="text.secondary" sx={{ ml: 1, fontWeight: 500, fontSize: '1rem' }}>
              {products.data.length}
            </Typography>
          )}
        </Typography>
        {products.isPending && <ProductGridSkeleton count={4} />}
        {products.isError && <Alert severity="error">{errorMessage(products.error)}</Alert>}
        {products.data?.length === 0 && <EmptyState icon={<InventoryOutlinedIcon />} title={t('farmPage.noProducts')} />}
        {products.data && <ProductGrid items={products.data} showFarm={false} />}
      </Box>

      <Paper component="section" elevation={1} aria-labelledby="farm-reviews" sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography id="farm-reviews" component="h2" variant="h5" sx={{ mb: 1.5 }}>
          {t('reviews.title')}
        </Typography>
        <FarmReviews farmerId={farm.id} limit={5} />
      </Paper>
    </Box>
  );
}
