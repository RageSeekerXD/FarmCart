import AddIcon from '@mui/icons-material/Add';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import PlaceIcon from '@mui/icons-material/Place';
import RemoveIcon from '@mui/icons-material/Remove';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import VerifiedIcon from '@mui/icons-material/Verified';
import WhatshotOutlinedIcon from '@mui/icons-material/WhatshotOutlined';
import { alpha, Box, Button, Card, CardActions, CardContent, Chip, IconButton, Link, Stack, Tooltip, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import type { CatalogItem } from '../../api/types';
import { formatMoney, formatNumber, useLang } from '../../i18n';
import { EASE_SPRING, popIn } from '../../shared/motion';
import { artFor } from './art/artFor';
import { ProductArt } from './art/ProductArt';
import { artBackground, categoryLook, LOW_STOCK } from './categoryLook';

/** Колір «Лишилося лише N»: помаранчевий з контрастом не нижче 4,5:1 на картці. */
export const LOW_STOCK_COLOR = { light: '#b45309', dark: '#ffb74d' } as const;

/** Висота зображення товару на картці. */
const MEDIA_HEIGHT = 168;

interface Props {
  item: CatalogItem;
  /** Скільки одиниць цього товару вже в кошику покупця (0 - немає): тоді замість «У кошик» - лічильник «− N +». */
  quantity: number;
  /** Кошик зберігає зміну цього товару. */
  busy: boolean;
  favorite: boolean;
  onAdd: (item: CatalogItem) => void;
  onQuantity: (item: CatalogItem, quantity: number) => void;
  onToggleFavorite: (item: CatalogItem) => void;
  /** Відкрити картку товару з описом і відгуками. */
  onOpen?: (item: CatalogItem) => void;
  /** Назва ферми з посиланням на її сторінку; на сторінці самої ферми не потрібна. */
  showFarm?: boolean;
}

/**
 * Зображення товару: фото фермера або ілюстрація саме цього виду товару на тлі кольору категорії.
 * Заповнює батьківський блок (position: relative із заданою висотою) - так однаково в картці й у діалозі.
 */
export function ProductMedia({ item }: { item: Pick<CatalogItem, 'photoUrl' | 'name' | 'category'> }) {
  if (item.photoUrl) {
    return <Box component="img" src={item.photoUrl} alt="" loading="lazy" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />;
  }

  return (
    <Box
      aria-hidden
      className="product-art"
      sx={{
        position: 'absolute',
        inset: 0,
        background: (theme) => artBackground(categoryLook(item.category).tint, theme.palette.mode),
        '& svg': { position: 'absolute', top: '9%', left: '9%', width: '82%', height: '82%', transition: `transform 500ms ${EASE_SPRING}` },
      }}
    >
      <ProductArt art={artFor(item.name, item.category)} />
    </Box>
  );
}

/** «− N +» на картці: кількість товару в кошику змінюється, не виходячи з каталогу. */
function QuantityStepper({ item, quantity, busy, onQuantity }: Pick<Props, 'item' | 'quantity' | 'busy' | 'onQuantity'>) {
  const { t } = useTranslation();
  const { lang, pick } = useLang();
  const name = pick(item.name);
  const last = quantity === 1;
  return (
    <Box
      role="group"
      aria-label={t('catalog.inCartNamed', { name, count: quantity })}
      sx={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        minHeight: 38,
        borderRadius: '10px',
        border: 2,
        borderColor: 'primary.main',
        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
        animation: `${popIn} 320ms ${EASE_SPRING} backwards`,
        '& .MuiIconButton-root': { color: 'primary.main', borderRadius: '8px' },
      }}
    >
      <IconButton size="small" aria-label={t(last ? 'cart.remove' : 'cart.decrease', { name })} disabled={busy} onClick={() => onQuantity(item, quantity - 1)}>
        {last ? <DeleteOutlineIcon fontSize="small" /> : <RemoveIcon fontSize="small" />}
      </IconButton>
      <Box sx={{ flex: 1, textAlign: 'center', lineHeight: 1.1, opacity: busy ? 0.6 : 1, transition: 'opacity 160ms ease' }}>
        <Typography
          key={quantity}
          component="span"
          aria-hidden
          sx={{ display: 'inline-block', fontWeight: 800, fontSize: '1.05rem', animation: `${popIn} 260ms ${EASE_SPRING}` }}
        >
          {quantity}
        </Typography>
        <Typography component="span" aria-hidden variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
          {' · '}
          {formatMoney(item.price * quantity, lang)}
        </Typography>
      </Box>
      <IconButton size="small" aria-label={t('cart.increase', { name })} disabled={busy || quantity >= item.stock} onClick={() => onQuantity(item, quantity + 1)}>
        <AddIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

export function ProductCard({ item, quantity, busy, favorite, onAdd, onQuantity, onToggleFavorite, onOpen, showFarm = true }: Props) {
  const { t } = useTranslation();
  const { lang, pick } = useLang();
  const name = pick(item.name);
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
        transition: 'box-shadow 160ms ease, transform 160ms ease',
        '&:hover': { boxShadow: 4, transform: 'translateY(-3px)' },
        '&:hover .product-art svg': { transform: 'scale(1.08) rotate(-3deg)' },
        '@media (prefers-reduced-motion: reduce)': { transition: 'none', '&:hover': { transform: 'none' } },
      }}
    >
      {/* Значки лежать усередині зображення з відступом 12 px і не виходять за край картки. */}
      <Box sx={{ position: 'relative', height: MEDIA_HEIGHT, overflow: 'hidden', flexShrink: 0 }}>
        <Box onClick={() => onOpen?.(item)} sx={{ position: 'absolute', inset: 0, cursor: onOpen ? 'pointer' : undefined }}>
          <ProductMedia item={item} />
        </Box>
        {item.certified && (
          <Chip
            size="small"
            color="success"
            icon={<VerifiedIcon />}
            label={t('catalog.organic')}
            sx={{ position: 'absolute', top: 12, left: 12, maxWidth: 'calc(100% - 72px)', boxShadow: 1, fontWeight: 600 }}
          />
        )}
        <Tooltip title={t(favorite ? 'catalog.inFavorites' : 'catalog.toFavorites')}>
          <IconButton
            size="small"
            aria-pressed={favorite}
            aria-label={t(favorite ? 'catalog.favoriteRemove' : 'catalog.favoriteAdd', { name })}
            onClick={() => onToggleFavorite(item)}
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              bgcolor: 'background.paper',
              boxShadow: 1,
              color: favorite ? '#e53935' : 'text.secondary',
              '&:hover': { bgcolor: 'background.paper', color: '#e53935' },
            }}
          >
            {favorite ? (
              <FavoriteIcon key="on" fontSize="small" sx={{ animation: `${popIn} 360ms ${EASE_SPRING}` }} />
            ) : (
              <FavoriteBorderIcon key="off" fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      </Box>

      <CardContent sx={{ flex: 1, pb: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Typography
          component="h2"
          variant="subtitle1"
          sx={{
            fontWeight: 650,
            lineHeight: 1.3,
            // Дві лінії під назву завжди: картки в рядку однакові, навіть якщо назва коротка.
            minHeight: '2.6em',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {onOpen ? (
            // Назва - кнопка картки товару: з клавіатури картка відкривається так само, як натисканням на фото.
            <Link
              component="button"
              type="button"
              color="inherit"
              underline="hover"
              onClick={() => onOpen(item)}
              aria-label={t('catalog.details', { name })}
              sx={{ font: 'inherit', textAlign: 'left', verticalAlign: 'baseline' }}
            >
              {name}
            </Link>
          ) : (
            name
          )}
        </Typography>
        {showFarm && (
          <Link
            component={RouterLink}
            to={`/farms/${item.farmerId}`}
            underline="hover"
            aria-label={t('catalog.farmPageNamed', { name: pick(item.farmerName) })}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.875rem', fontWeight: 500, minWidth: 0 }}
          >
            <StorefrontOutlinedIcon sx={{ fontSize: 16, flexShrink: 0 }} />
            <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {pick(item.farmerName)}
            </Box>
          </Link>
        )}
        <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', mt: 0.5, mb: 1 }}>
          {item.distanceKm !== null && (
            <Chip size="small" variant="outlined" icon={<PlaceIcon />} label={t('catalog.kmAway', { km: formatNumber(item.distanceKm, lang) })} />
          )}
          {/* Ферма без відгуків має нейтральний значок на тому ж місці: вміст карток у рядку не зсувається. */}
          {item.farmerRating !== null ? (
            <Chip
              size="small"
              variant="outlined"
              icon={<StarIcon sx={{ '&&': { color: '#f2a600' } }} />}
              label={formatNumber(item.farmerRating, lang)}
              aria-label={t('catalog.rating', { rating: formatNumber(item.farmerRating, lang) })}
            />
          ) : (
            <Chip size="small" variant="outlined" icon={<StarBorderIcon />} label={t('catalog.noRating')} sx={{ color: 'text.secondary' }} />
          )}
        </Stack>
        <Box sx={{ mt: 'auto' }}>
          <Typography variant="h6" component="p" sx={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.2 }}>
            {formatMoney(item.price, lang)}{' '}
            <Typography component="span" variant="body2" color="text.secondary" sx={{ fontWeight: 400 }}>
              {t('catalog.perUnit', { unit: pick(item.unit) })}
            </Typography>
          </Typography>
          {/* Залишок показується, лише коли товару мало; рядок резервується, щоб кнопки в рядку стояли рівно. */}
          <Typography
            variant="body2"
            sx={{
              minHeight: '1.5em',
              display: 'flex',
              alignItems: 'center',
              gap: 0.25,
              fontWeight: 700,
              fontSize: '0.8125rem',
              color: (theme) => LOW_STOCK_COLOR[theme.palette.mode],
            }}
          >
            {lowStock && (
              <>
                <WhatshotOutlinedIcon sx={{ fontSize: 16 }} />
                {t('catalog.lowStock', { count: item.stock })}
              </>
            )}
          </Typography>
        </Box>
      </CardContent>
      <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
        {quantity > 0 ? (
          <QuantityStepper item={item} quantity={quantity} busy={busy} onQuantity={onQuantity} />
        ) : (
          <Button
            fullWidth
            variant="contained"
            startIcon={<AddShoppingCartIcon />}
            loading={busy}
            disabled={item.stock <= 0}
            onClick={() => onAdd(item)}
            aria-label={t('catalog.addNamedToCart', { name })}
            sx={{ minHeight: 38 }}
          >
            {t('catalog.addToCart')}
          </Button>
        )}
      </CardActions>
    </Card>
  );
}
