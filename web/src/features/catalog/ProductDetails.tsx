import AddIcon from '@mui/icons-material/Add';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import CloseIcon from '@mui/icons-material/Close';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import PlaceIcon from '@mui/icons-material/Place';
import RemoveIcon from '@mui/icons-material/Remove';
import StarIcon from '@mui/icons-material/Star';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import VerifiedIcon from '@mui/icons-material/Verified';
import { Box, Button, Chip, Dialog, DialogContent, Divider, IconButton, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import type { CatalogItem } from '../../api/types';
import { formatMoney, formatNumber, useLang } from '../../i18n';
import { monthName } from '../farmer/ProductDialog';
import { FarmReviews } from '../reviews/FarmReviews';
import { LOW_STOCK } from './categoryLook';
import { LOW_STOCK_COLOR, ProductMedia } from './ProductCard';

interface Props {
  item: CatalogItem;
  adding: boolean;
  onClose: () => void;
  onAdd: (item: CatalogItem, quantity: number) => void;
}

/** Картка товару (п. 10 покращень): опис, сезон, ферма з відгуками й додавання в кошик потрібної кількості. */
export function ProductDetails({ item, adding, onClose, onAdd }: Props) {
  const { t } = useTranslation();
  const { lang, pick } = useLang();
  const [quantity, setQuantity] = useState(1);
  const name = pick(item.name);
  const maxQuantity = Math.max(1, item.stock);
  const season =
    item.seasonMonths.length === 0 ? t('farm.allYear') : item.seasonMonths.map((month) => monthName(month, lang)).join(', ');

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md" aria-labelledby="product-details-title">
      <IconButton aria-label={t('common.close')} onClick={onClose} sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1, bgcolor: 'background.paper', boxShadow: 1 }}>
        <CloseIcon />
      </IconButton>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '5fr 7fr' } }}>
        {/* Блок тягнеться на всю висоту рядка діалогу; зображення заповнює його. */}
        <Box sx={{ position: 'relative', minHeight: { xs: 220, md: 400 } }}>
          <ProductMedia item={item} />
        </Box>
        <DialogContent sx={{ p: { xs: 2.5, sm: 3 } }}>
          <Typography id="product-details-title" component="h2" variant="h5" sx={{ pr: 5 }}>
            {name}
          </Typography>
          <Button
            size="small"
            component={RouterLink}
            to={`/farms/${item.farmerId}`}
            startIcon={<StorefrontOutlinedIcon />}
            sx={{ ml: -1, mb: 1 }}
            aria-label={t('catalog.farmPageNamed', { name: pick(item.farmerName) })}
          >
            {pick(item.farmerName)}
          </Button>
          <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', mb: 2 }}>
            {item.certified && <Chip size="small" color="success" icon={<VerifiedIcon />} label={t('catalog.organic')} />}
            {item.distanceKm !== null && (
              <Chip size="small" variant="outlined" icon={<PlaceIcon />} label={t('catalog.kmAway', { km: formatNumber(item.distanceKm, lang) })} />
            )}
            {item.farmerRating !== null && (
              <Chip
                size="small"
                variant="outlined"
                icon={<StarIcon sx={{ '&&': { color: '#f2a600' } }} />}
                label={`${formatNumber(item.farmerRating, lang)} · ${t('reviews.count', { count: item.farmerReviewCount })}`}
              />
            )}
            <Chip size="small" variant="outlined" icon={<EventAvailableOutlinedIcon />} label={`${t('catalog.season')}: ${season}`} />
          </Stack>

          {item.description && (
            <Typography sx={{ mb: 2, whiteSpace: 'pre-line' }} lang={lang}>
              {pick(item.description)}
            </Typography>
          )}

          <Typography component="p" sx={{ fontSize: '1.6rem', fontWeight: 800, lineHeight: 1.2 }}>
            {formatMoney(item.price, lang)}{' '}
            <Typography component="span" color="text.secondary" sx={{ fontWeight: 400 }}>
              {t('catalog.perUnit', { unit: pick(item.unit) })}
            </Typography>
          </Typography>
          <Typography
            variant="body2"
            sx={{ mb: 2, fontWeight: item.stock <= LOW_STOCK ? 700 : 400, color: (theme) => (item.stock === 0 ? 'error.main' : item.stock <= LOW_STOCK ? LOW_STOCK_COLOR[theme.palette.mode] : 'text.secondary') }}
          >
            {item.stock === 0 ? t('farm.outOfStock') : item.stock <= LOW_STOCK ? t('catalog.lowStock', { count: item.stock }) : t('catalog.inStock', { count: item.stock })}
          </Typography>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <Box
              role="group"
              aria-label={`${t('cart.quantity')}: ${quantity}`}
              sx={{ display: 'inline-flex', alignItems: 'center', border: 1, borderColor: 'divider', borderRadius: 5 }}
            >
              <IconButton size="small" aria-label={t('catalog.less')} disabled={quantity <= 1} onClick={() => setQuantity((value) => value - 1)}>
                <RemoveIcon fontSize="small" />
              </IconButton>
              <Typography aria-hidden sx={{ minWidth: 32, textAlign: 'center', fontWeight: 700 }}>
                {quantity}
              </Typography>
              <IconButton size="small" aria-label={t('catalog.more')} disabled={quantity >= maxQuantity} onClick={() => setQuantity((value) => value + 1)}>
                <AddIcon fontSize="small" />
              </IconButton>
            </Box>
            <Button
              variant="contained"
              size="large"
              startIcon={<AddShoppingCartIcon />}
              loading={adding}
              disabled={item.stock <= 0}
              onClick={() => onAdd(item, quantity)}
              sx={{ flex: '1 1 180px' }}
            >
              {t('catalog.addQuantity', { count: quantity, total: formatMoney(item.price * quantity, lang) })}
            </Button>
          </Box>

          <Divider sx={{ mb: 2 }} />
          <Typography component="h3" variant="subtitle1" sx={{ mb: 1 }}>
            {t('reviews.title')}
          </Typography>
          <FarmReviews farmerId={item.farmerId} />
        </DialogContent>
      </Box>
    </Dialog>
  );
}
