import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import PlaceIcon from '@mui/icons-material/Place';
import StarIcon from '@mui/icons-material/Star';
import VerifiedIcon from '@mui/icons-material/Verified';
import { Box, Button, Card, CardActions, CardContent, Chip, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { CatalogItem } from '../../api/types';
import { formatMoney, formatNumber, useLang } from '../../i18n';

/** Запасна картинка за категорією, поки товар не має фото (план релізу, п. 0). */
const CATEGORY_ICON: Record<string, string> = {
  vegetables: '🥕',
  fruits: '🍎',
  berries: '🍓',
  dairy: '🧀',
  honey: '🍯',
  'meat-eggs': '🥚',
  bakery: '🥖',
};

interface Props {
  item: CatalogItem;
  adding: boolean;
  onAdd: (item: CatalogItem) => void;
}

export function ProductCard({ item, adding, onAdd }: Props) {
  const { t } = useTranslation();
  const { lang, pick } = useLang();
  const name = pick(item.name);

  return (
    <Card component="article" aria-label={name} sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {item.photoUrl ? (
        <Box component="img" src={item.photoUrl} alt="" loading="lazy" sx={{ width: '100%', height: 140, objectFit: 'cover' }} />
      ) : (
        <Box
          aria-hidden
          sx={{ height: 140, display: 'grid', placeItems: 'center', fontSize: 64, bgcolor: 'action.hover' }}
        >
          {CATEGORY_ICON[item.category] ?? '🧺'}
        </Box>
      )}
      <CardContent sx={{ flex: 1, pb: 1 }}>
        <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.25 }}>
          {name}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {pick(item.farmerName)}
        </Typography>
        <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', mb: 1 }}>
          {item.certified && <Chip size="small" color="success" variant="outlined" icon={<VerifiedIcon />} label={t('catalog.organic')} />}
          {item.distanceKm !== null && (
            <Chip size="small" variant="outlined" icon={<PlaceIcon />} label={t('catalog.kmAway', { km: formatNumber(item.distanceKm, lang) })} />
          )}
          {item.farmerRating !== null ? (
            <Chip
              size="small"
              variant="outlined"
              icon={<StarIcon />}
              label={formatNumber(item.farmerRating, lang)}
              aria-label={t('catalog.rating', { rating: formatNumber(item.farmerRating, lang) })}
            />
          ) : null}
        </Stack>
        <Typography variant="h6" component="p">
          {formatMoney(item.price, lang)}{' '}
          <Typography component="span" variant="body2" color="text.secondary">
            {t('catalog.perUnit', { unit: pick(item.unit) })}
          </Typography>
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('catalog.inStock', { count: item.stock })}
        </Typography>
      </CardContent>
      <CardActions sx={{ px: 2, pb: 2 }}>
        <Button
          fullWidth
          variant="contained"
          startIcon={<AddShoppingCartIcon />}
          loading={adding}
          onClick={() => onAdd(item)}
          aria-label={t('catalog.addNamedToCart', { name })}
        >
          {t('catalog.addToCart')}
        </Button>
      </CardActions>
    </Card>
  );
}
