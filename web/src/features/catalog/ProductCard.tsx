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

export const productPath = (productId: number) => `/products/${productId}`;

/**
 * Зображення товару: фото фермера або ілюстрація саме цього виду товару на тлі кольору категорії.
 * Заповнює батьківський блок (position: relative із заданою висотою) - так однаково в картці й на сторінці товару.
 * Товар, якого немає в наявності, - знебарвлений.
 */
export function ProductMedia({ item }: { item: Pick<CatalogItem, 'photoUrl' | 'name' | 'category' | 'stock'> }) {
  const soldOut = { filter: item.stock === 0 ? 'grayscale(0.85)' : undefined, opacity: item.stock === 0 ? 0.75 : 1 };
  if (item.photoUrl) {
    return <Box component="img" src={item.photoUrl} alt="" loading="lazy" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', ...soldOut }} />;
  }

  return (
    <Box
      aria-hidden
      className="product-art"
      sx={{
        position: 'absolute',
        inset: 0,
        background: (theme) => artBackground(categoryLook(item.category).tint, theme.palette.mode),
        '& svg': { position: 'absolute', top: '9%', left: '9%', width: '82%', height: '82%', transition: `transform 500ms ${EASE_SPRING}`, ...soldOut },
      }}
    >
      <ProductArt art={artFor(item.name, item.category)} />
    </Box>
  );
}

interface CartControlProps {
  item: CatalogItem;
  /** Скільки одиниць цього товару вже в кошику (0 - немає): тоді замість «У кошик» - лічильник «− N +». */
  quantity: number;
  /** Кошик зберігає зміну цього товару. */
  busy: boolean;
  onAdd: (item: CatalogItem) => void;
  onQuantity: (item: CatalogItem, quantity: number) => void;
  size?: 'medium' | 'large';
}

/**
 * «У кошик», а після додавання - лічильник «− N + · сума»: кількість змінюється тут же, з одиниці товар прибирається.
 * Товар, якого немає в наявності, додати не можна - кнопка так і каже.
 */
export function CartControl({ item, quantity, busy, onAdd, onQuantity, size = 'medium' }: CartControlProps) {
  const { t } = useTranslation();
  const { lang, pick } = useLang();
  const name = pick(item.name);
  const height = size === 'large' ? 48 : 38;

  if (quantity <= 0) {
    return (
      <Button
        fullWidth
        variant="contained"
        size={size}
        startIcon={item.stock > 0 ? <AddShoppingCartIcon /> : undefined}
        loading={busy}
        disabled={item.stock <= 0}
        onClick={() => onAdd(item)}
        aria-label={item.stock > 0 ? t('catalog.addNamedToCart', { name }) : t('catalog.soldOutNamed', { name })}
        sx={{ minHeight: height }}
      >
        {item.stock > 0 ? t('catalog.addToCart') : t('catalog.soldOut')}
      </Button>
    );
  }

  const last = quantity === 1;
  return (
    <Box
      role="group"
      aria-label={t('catalog.inCartNamed', { name, count: quantity })}
      sx={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        minHeight: height,
        borderRadius: '10px',
        border: 2,
        borderColor: 'primary.main',
        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
        animation: `${popIn} 320ms ${EASE_SPRING} backwards`,
        '& .MuiIconButton-root': { color: 'primary.main', borderRadius: '8px' },
      }}
    >
      <IconButton size={size === 'large' ? 'medium' : 'small'} aria-label={t(last ? 'cart.remove' : 'cart.decrease', { name })} disabled={busy} onClick={() => onQuantity(item, quantity - 1)}>
        {last ? <DeleteOutlineIcon fontSize="small" /> : <RemoveIcon fontSize="small" />}
      </IconButton>
      <Box sx={{ flex: 1, textAlign: 'center', lineHeight: 1.1, opacity: busy ? 0.6 : 1, transition: 'opacity 160ms ease' }}>
        <Typography key={quantity} component="span" aria-hidden sx={{ display: 'inline-block', fontWeight: 800, fontSize: size === 'large' ? '1.2rem' : '1.05rem', animation: `${popIn} 260ms ${EASE_SPRING}` }}>
          {quantity}
        </Typography>
        <Typography component="span" aria-hidden variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
          {' · '}
          {formatMoney(item.price * quantity, lang)}
        </Typography>
      </Box>
      <IconButton
        size={size === 'large' ? 'medium' : 'small'}
        aria-label={t('cart.increase', { name })}
        disabled={busy || quantity >= item.stock}
        onClick={() => onQuantity(item, quantity + 1)}
      >
        <AddIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

/**
 * Рядок залишку під ціною. Товару мало - помаранчеве «Лишилося лише N»; товар уже в кошику - скільки ще є
 * (лічильник не дасть узяти більше); інакше рядок порожній, але місце під нього лишається, щоб картки в рядку були рівні.
 */
export function StockLine({ stock, quantity }: { stock: number; quantity: number }) {
  const { t } = useTranslation();
  const low = stock > 0 && stock <= LOW_STOCK;
  return (
    <Typography
      variant="body2"
      sx={{
        minHeight: '1.5em',
        display: 'flex',
        alignItems: 'center',
        gap: 0.25,
        fontWeight: low ? 700 : 500,
        fontSize: '0.8125rem',
        color: (theme) => (low ? LOW_STOCK_COLOR[theme.palette.mode] : 'text.secondary'),
      }}
    >
      {low && (
        <>
          <WhatshotOutlinedIcon sx={{ fontSize: 16 }} />
          {t('catalog.lowStock', { count: stock })}
        </>
      )}
      {!low && quantity > 0 && t('catalog.inStock', { count: stock })}
    </Typography>
  );
}

/** «Сердечко»: зберегти товар в обраному. */
export function FavoriteButton({ item, favorite, onToggle, sx }: { item: CatalogItem; favorite: boolean; onToggle: (item: CatalogItem) => void; sx?: object }) {
  const { t } = useTranslation();
  const { pick } = useLang();
  const name = pick(item.name);
  return (
    <Tooltip title={t(favorite ? 'catalog.inFavorites' : 'catalog.toFavorites')}>
      <IconButton
        size="small"
        aria-pressed={favorite}
        aria-label={t(favorite ? 'catalog.favoriteRemove' : 'catalog.favoriteAdd', { name })}
        onClick={() => onToggle(item)}
        sx={{
          bgcolor: 'background.paper',
          boxShadow: 1,
          color: favorite ? '#e53935' : 'text.secondary',
          '&:hover': { bgcolor: 'background.paper', color: '#e53935' },
          ...sx,
        }}
      >
        {favorite ? <FavoriteIcon key="on" fontSize="small" sx={{ animation: `${popIn} 360ms ${EASE_SPRING}` }} /> : <FavoriteBorderIcon key="off" fontSize="small" />}
      </IconButton>
    </Tooltip>
  );
}

interface Props extends Omit<CartControlProps, 'size'> {
  favorite: boolean;
  onToggleFavorite: (item: CatalogItem) => void;
  /** Назва ферми з посиланням на її сторінку; на сторінці самої ферми не потрібна. */
  showFarm?: boolean;
}

export function ProductCard({ item, quantity, busy, favorite, onAdd, onQuantity, onToggleFavorite, showFarm = true }: Props) {
  const { t } = useTranslation();
  const { lang, pick } = useLang();
  const name = pick(item.name);
  const page = productPath(item.productId);

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
        {/* Зображення веде на сторінку товару мишею; з клавіатури туди веде назва (зображення не дублює її в порядку Tab). */}
        <Box component={RouterLink} to={page} tabIndex={-1} aria-hidden sx={{ position: 'absolute', inset: 0 }}>
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
        {item.stock === 0 && (
          <Chip size="small" label={t('catalog.soldOut')} sx={{ position: 'absolute', bottom: 12, left: 12, bgcolor: 'background.paper', boxShadow: 1, fontWeight: 600 }} />
        )}
        <FavoriteButton item={item} favorite={favorite} onToggle={onToggleFavorite} sx={{ position: 'absolute', top: 8, right: 8 }} />
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
          <Link component={RouterLink} to={page} color="inherit" underline="hover" aria-label={t('catalog.details', { name })}>
            {name}
          </Link>
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
          <StockLine stock={item.stock} quantity={quantity} />
        </Box>
      </CardContent>
      <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
        <CartControl item={item} quantity={quantity} busy={busy} onAdd={onAdd} onQuantity={onQuantity} />
      </CardActions>
    </Card>
  );
}
