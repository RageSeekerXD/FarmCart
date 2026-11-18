import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import PlaceIcon from '@mui/icons-material/Place';
import StarIcon from '@mui/icons-material/Star';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import VerifiedIcon from '@mui/icons-material/Verified';
import { Alert, Box, Breadcrumbs, Button, Chip, Link, Paper, Skeleton, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { api, ApiError } from '../../api/client';
import type { CatalogItem, LocalizedText } from '../../api/types';
import { errorMessage, formatMoney, formatNumber, useLang } from '../../i18n';
import { deliveryDaysText } from '../../shared/dates';
import { EmptyState } from '../../shared/pages';
import { useCartActions } from '../cart/useCartActions';
import { monthName } from '../farmer/ProductDialog';
import { useFarms } from '../map/MapPage';
import { FarmReviews, ReviewList, useProductReviews } from '../reviews/FarmReviews';
import { ReviewSummaryCard } from '../reviews/ReviewSummaryCard';
import { useReference } from './CatalogPage';
import { useFavorites } from './favorites';
import { CartControl, FavoriteButton, ProductMedia, StockLine } from './ProductCard';
import { RelatedProducts } from './RelatedProducts';
import { useBuyerLocation } from './useBuyerLocation';

/** Рядок «Склад і зберігання»: назва зліва, значення справа (на телефоні - одне під одним). */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box component="div" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '180px 1fr' }, gap: { xs: 0, sm: 2 }, py: 1, '& + &': { borderTop: 1, borderColor: 'divider' } }}>
      <Typography component="dt" variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
      <Typography component="dd" sx={{ m: 0 }}>
        {children}
      </Typography>
    </Box>
  );
}

export function useProduct(productId: number) {
  const { lang } = useLang();
  const location = useBuyerLocation();
  const query = new URLSearchParams({ lat: String(location.point.lat), lon: String(location.point.lon), lang });
  return useQuery({
    queryKey: ['product', productId, query.toString()],
    queryFn: () => api<CatalogItem>(`/catalog/${productId}?${query}`),
    enabled: Number.isInteger(productId) && productId > 0,
  });
}

/**
 * Сторінка товару: фото чи ілюстрація, ціна й кошик із залишком, опис, склад, термін придатності, умови зберігання,
 * сезон і дні доставки, коротко про ферму та відгуки покупців, які купували саме цей товар.
 */
export function ProductPage() {
  const { t } = useTranslation();
  const { lang, pick } = useLang();
  const productId = Number(useParams().id);
  const product = useProduct(productId);
  const reviews = useProductReviews(productId);
  const reference = useReference();
  const cart = useCartActions();
  const favorites = useFavorites();

  if (product.isPending) {
    return (
      <Box aria-label={t('common.loading')} sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: '5fr 7fr' } }}>
        <Skeleton variant="rounded" height={380} />
        <Box>
          <Skeleton width="60%" height={48} />
          <Skeleton width="40%" />
          <Skeleton width="30%" height={40} sx={{ mt: 2 }} />
        </Box>
      </Box>
    );
  }

  if (product.isError) {
    return product.error instanceof ApiError && product.error.status === 404 ? (
      <EmptyState
        icon={<Inventory2OutlinedIcon />}
        title={t('product.notFound')}
        action={
          <Button component={RouterLink} to="/" variant="contained">
            {t('common.toCatalog')}
          </Button>
        }
      />
    ) : (
      <Alert severity="error">{errorMessage(product.error)}</Alert>
    );
  }

  const item = product.data;
  const name = pick(item.name);
  const category = reference.data?.categories.find((entry) => entry.code === item.category);
  const season = item.seasonMonths.length === 0 ? t('farm.allYear') : item.seasonMonths.map((month) => monthName(month, lang)).join(', ');
  const deliveryDays = item.farmerDeliveryDays.length === 0 ? t('product.everyDay') : deliveryDaysText(item.farmerDeliveryDays, lang);
  const facts: [string, LocalizedText | null][] = [
    [t('product.composition'), item.composition],
    [t('product.shelfLife'), item.shelfLife],
    [t('product.storage'), item.storage],
  ];

  return (
    <Box>
      <Breadcrumbs aria-label={t('farmPage.breadcrumbs')} sx={{ mb: 1.5 }}>
        <Link component={RouterLink} to="/" underline="hover" color="inherit">
          {t('catalog.title')}
        </Link>
        {category && (
          <Link component={RouterLink} to={`/?category=${category.code}`} underline="hover" color="inherit">
            {pick(category.title)}
          </Link>
        )}
        <Typography color="text.primary" sx={{ fontWeight: 500 }}>
          {name}
        </Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: '5fr 7fr' }, alignItems: 'start', mb: 3 }}>
        <Paper elevation={1} sx={{ position: 'relative', overflow: 'hidden', aspectRatio: '1 / 1', maxHeight: 520 }}>
          <ProductMedia item={item} />
          {item.certified && (
            <Chip color="success" icon={<VerifiedIcon />} label={t('catalog.organic')} sx={{ position: 'absolute', top: 12, left: 12, boxShadow: 1, fontWeight: 600 }} />
          )}
          <FavoriteButton
            item={item}
            favorite={favorites.ids.has(item.productId)}
            onToggle={(product) => favorites.toggle(product.productId)}
            sx={{ position: 'absolute', top: 10, right: 10 }}
          />
        </Paper>

        <Box>
          <Typography component="h1" variant="h4" sx={{ fontSize: { xs: '1.6rem', sm: '2.1rem' } }}>
            {name}
          </Typography>
          <Link
            component={RouterLink}
            to={`/farms/${item.farmerId}`}
            underline="hover"
            aria-label={t('catalog.farmPageNamed', { name: pick(item.farmerName) })}
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontWeight: 600, mt: 1.5, mb: 1.5 }}
          >
            <StorefrontOutlinedIcon fontSize="small" />
            {pick(item.farmerName)}
          </Link>
          <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap', mb: 2 }}>
            {item.distanceKm !== null && <Chip size="small" variant="outlined" icon={<PlaceIcon />} label={t('catalog.kmAway', { km: formatNumber(item.distanceKm, lang) })} />}
            <Chip
              size="small"
              variant="outlined"
              icon={<StarIcon sx={{ '&&': { color: '#f2a600' } }} />}
              label={item.farmerRating !== null ? `${formatNumber(item.farmerRating, lang)} · ${t('reviews.count', { count: item.farmerReviewCount })}` : t('catalog.noRating')}
            />
            <Chip size="small" variant="outlined" icon={<EventAvailableOutlinedIcon />} label={`${t('catalog.season')}: ${season}`} />
            <Chip size="small" variant="outlined" icon={<LocalShippingOutlinedIcon />} label={`${t('product.deliveryDays')}: ${deliveryDays}`} />
          </Stack>

          <Typography component="p" sx={{ fontSize: '1.8rem', fontWeight: 800, lineHeight: 1.2 }}>
            {formatMoney(item.price, lang)}{' '}
            <Typography component="span" color="text.secondary" sx={{ fontWeight: 400, fontSize: '1rem' }}>
              {t('catalog.perUnit', { unit: pick(item.unit) })}
            </Typography>
          </Typography>
          <Box sx={{ mb: 1.5 }}>
            {item.stock > 0 ? <StockLine stock={item.stock} quantity={Math.max(1, cart.quantityOf(item.productId))} /> : null}
          </Box>
          {!item.inSeason && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {t('product.outOfSeason', { season })}
            </Alert>
          )}
          <Box sx={{ maxWidth: 380, mb: 3 }}>
            <CartControl
              item={item.inSeason ? item : { ...item, stock: 0 }}
              quantity={cart.quantityOf(item.productId)}
              busy={cart.isBusy(item.productId)}
              onAdd={(product) => cart.add(product)}
              onQuantity={cart.setQuantity}
              size="large"
            />
          </Box>

          {item.description && (
            <Typography sx={{ mb: 2.5, whiteSpace: 'pre-line', maxWidth: '70ch' }} lang={lang}>
              {pick(item.description)}
            </Typography>
          )}

          <Paper variant="outlined" component="section" aria-labelledby="product-facts" sx={{ px: 2, py: 1 }}>
            <Typography id="product-facts" component="h2" variant="subtitle1" sx={{ pt: 0.5 }}>
              {t('product.facts')}
            </Typography>
            <Box component="dl" sx={{ m: 0 }}>
              {facts.map(([label, value]) => (
                <Fact key={label} label={label}>
                  {value ? pick(value) : <Box component="span" sx={{ color: 'text.secondary' }}>{t('product.notSpecified')}</Box>}
                </Fact>
              ))}
              <Fact label={t('catalog.season')}>{season}</Fact>
            </Box>
          </Paper>
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: '7fr 5fr' }, alignItems: 'start' }}>
        <Paper component="section" elevation={1} aria-labelledby="product-reviews" sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography id="product-reviews" component="h2" variant="h6" sx={{ mb: 1.5 }}>
            {t('product.reviews')}
          </Typography>
          <ReviewSummaryCard path={`/products/${productId}/reviews/summary`} />
          <ReviewList reviews={reviews} limit={5} empty={t('product.noReviews')} />
          {/* Про товар ще ніхто не писав - покупець бачить хоча б відгуки про саму ферму. */}
          {reviews.data?.length === 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography component="h3" variant="subtitle2" sx={{ mb: 1 }}>
                {t('product.farmReviews', { name: pick(item.farmerName) })}
              </Typography>
              <FarmReviews farmerId={item.farmerId} limit={3} />
            </Box>
          )}
        </Paper>

        <FarmAbout item={item} deliveryDays={deliveryDays} />
      </Box>

      <RelatedProducts productIds={[item.productId]} />
    </Box>
  );
}

/** Коротко про ферму: історія, дні доставки й посилання на сторінку ферми. */
function FarmAbout({ item, deliveryDays }: { item: CatalogItem; deliveryDays: string }) {
  const { t } = useTranslation();
  const { pick } = useLang();
  const farms = useFarms(null);
  const story = farms.data?.find((farm) => farm.id === item.farmerId)?.story;
  return (
    <Paper component="section" elevation={1} aria-labelledby="product-farm" sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography id="product-farm" component="h2" variant="h6" sx={{ mb: 1 }}>
        {t('product.aboutFarm')}
      </Typography>
      <Typography sx={{ fontWeight: 650 }}>{pick(item.farmerName)}</Typography>
      {story && (
        <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
          {pick(story)}
        </Typography>
      )}
      <Typography variant="body2" sx={{ mt: 1.5 }}>
        <strong>{t('product.deliveryDays')}:</strong> {deliveryDays}
      </Typography>
      <Button component={RouterLink} to={`/farms/${item.farmerId}`} variant="outlined" startIcon={<StorefrontOutlinedIcon />} sx={{ mt: 2 }}>
        {t('product.toFarm')}
      </Button>
    </Paper>
  );
}
