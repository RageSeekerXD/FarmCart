import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PlaceIcon from '@mui/icons-material/Place';
import StarIcon from '@mui/icons-material/Star';
import VerifiedIcon from '@mui/icons-material/Verified';
import { Box, Button, Card, CardActions, CardContent, Chip, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { CatalogItem } from '../../api/types';
import { formatMoney, formatNumber, useLang } from '../../i18n';
import { categoryLook, LOW_STOCK } from './categoryLook';


interface Props {
  item: CatalogItem;
  adding: boolean;
  /** Скільки одиниць цього товару вже в кошику покупця (0 - немає). */
  inCart?: number;
  onAdd: (item: CatalogItem) => void;
}

export function ProductCard({ item, adding, inCart = 0, onAdd }: Props) {
  const { t } = useTranslation();
  const { lang, pick } = useLang();
  const name = pick(item.name);
  const look = categoryLook(item.category);
  const lowStock = item.stock > 0 && item.stock <= LOW_STOCK;

  return (
    <Card
      component="article"
      aria-label={name}
      elevation={1}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        position: 'relative',
        transition: 'box-shadow 160ms ease, transform 160ms ease',
        '&:hover': { boxShadow: 4, transform: 'translateY(-2px)' },
        '@media (prefers-reduced-motion: reduce)': { transition: 'none', '&:hover': { transform: 'none' } },
      }}
    >
      {item.photoUrl ? (
        <Box component="img" src={item.photoUrl} alt="" loading="lazy" sx={{ width: '100%', height: 150, objectFit: 'cover' }} />
      ) : (
        <Box aria-hidden sx={{ height: 150, display: 'grid', placeItems: 'center', fontSize: 64, background: look.tint }}>
          {look.icon}
        </Box>
      )}
      {item.certified && (
        <Chip
          size="small"
          color="success"
          icon={<VerifiedIcon />}
          label={t('catalog.organic')}
          sx={{ position: 'absolute', top: 10, left: 10, boxShadow: 1 }}
        />
      )}
      {inCart > 0 && (
        <Chip
          size="small"
          icon={<CheckCircleIcon />}
          label={t('catalog.inCart', { count: inCart })}
          sx={{ position: 'absolute', top: 116, right: 10, bgcolor: 'background.paper', boxShadow: 1, '& .MuiChip-icon': { color: 'primary.main' } }}
        />
      )}
      <CardContent sx={{ flex: 1, pb: 1, display: 'flex', flexDirection: 'column' }}>
        <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 650, lineHeight: 1.25 }}>
          {name}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {pick(item.farmerName)}
        </Typography>
        <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', mb: 1.5 }}>
          {item.distanceKm !== null && (
            <Chip size="small" variant="outlined" icon={<PlaceIcon />} label={t('catalog.kmAway', { km: formatNumber(item.distanceKm, lang) })} />
          )}
          {item.farmerRating !== null ? (
            <Chip
              size="small"
              variant="outlined"
              icon={<StarIcon sx={{ '&&': { color: '#f2a600' } }} />}
              label={formatNumber(item.farmerRating, lang)}
              aria-label={t('catalog.rating', { rating: formatNumber(item.farmerRating, lang) })}
            />
          ) : null}
        </Stack>
        <Box sx={{ mt: 'auto' }}>
          <Typography variant="h6" component="p" sx={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.2 }}>
            {formatMoney(item.price, lang)}{' '}
            <Typography component="span" variant="body2" color="text.secondary" sx={{ fontWeight: 400 }}>
              {t('catalog.perUnit', { unit: pick(item.unit) })}
            </Typography>
          </Typography>
          <Typography variant="caption" sx={{ color: lowStock ? 'warning.dark' : 'text.secondary', fontWeight: lowStock ? 600 : 400 }}>
            {lowStock ? t('catalog.lowStock', { count: item.stock }) : t('catalog.inStock', { count: item.stock })}
          </Typography>
        </Box>
      </CardContent>
      <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
        <Button
          fullWidth
          variant={inCart > 0 ? 'outlined' : 'contained'}
          startIcon={<AddShoppingCartIcon />}
          loading={adding}
          disabled={item.stock <= 0}
          onClick={() => onAdd(item)}
          aria-label={t('catalog.addNamedToCart', { name })}
        >
          {t('catalog.addToCart')}
        </Button>
      </CardActions>
    </Card>
  );
}
