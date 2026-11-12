import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import RemoveIcon from '@mui/icons-material/Remove';
import ShoppingBasketOutlinedIcon from '@mui/icons-material/ShoppingBasketOutlined';
import StorefrontIcon from '@mui/icons-material/Storefront';
import { Alert, Box, Button, CircularProgress, Divider, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import type { CartLine } from '../../api/types';
import { errorMessage, formatMoney, useLang } from '../../i18n';
import { EmptyState } from '../../shared/pages';
import { useToast } from '../../shared/Toast';
import { cartCount, useCart, useChangeQuantity, useRemoveFromCart } from './useCart';

/**
 * Позиції в порядку першої появи на екрані. Зменшення кількості сервер виконує як «прибрати й додати знову»,
 * і позиція переїхала б у кінець списку просто під курсором; тут вона лишається на своєму місці.
 */
function useStableOrder(lines: readonly CartLine[]): CartLine[] {
  const [seen, setSeen] = useState<readonly number[]>([]);
  const ids = lines.map((line) => line.productId);
  const missing = ids.filter((id) => !seen.includes(id));
  if (missing.length > 0) {
    setSeen([...seen, ...missing]);
  }

  const order = [...seen, ...missing];
  return [...lines].sort((a, b) => order.indexOf(a.productId) - order.indexOf(b.productId));
}

/** UI-04: кошик покупця - позиції, зміна кількості, видалення й перерахунок суми. Далі - оформлення (UI-05). */
export function CartPage() {
  const { t } = useTranslation();
  const { lang, pick } = useLang();
  const toast = useToast();
  const cart = useCart();
  const remove = useRemoveFromCart();
  const change = useChangeQuantity();
  const busy = remove.isPending || change.isPending;
  const lines = useStableOrder(cart.data?.lines ?? []);

  const removeLine = (line: CartLine) => {
    remove.mutate(line.productId, {
      onSuccess: () => toast.show(t('cart.removed', { name: pick(line.name) }), 'info'),
      onError: (error) => toast.show(errorMessage(error), 'error'),
    });
  };

  const setQuantity = (line: CartLine, to: number) => {
    if (to <= 0) {
      removeLine(line);
      return;
    }

    change.mutate({ productId: line.productId, from: line.quantity, to }, { onError: (error) => toast.show(errorMessage(error), 'error') });
  };

  return (
    <Box sx={{ maxWidth: 1040, mx: 'auto' }}>
      <Typography component="h1" variant="h4" sx={{ mb: 2, fontSize: { xs: '1.6rem', sm: '2.1rem' } }}>
        {t('cart.title')}
      </Typography>

      {cart.isPending && <CircularProgress aria-label={t('common.loading')} />}
      {cart.isError && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => void cart.refetch()}>
              {t('common.retry')}
            </Button>
          }
        >
          {errorMessage(cart.error)}
        </Alert>
      )}

      {cart.data && cart.data.lines.length === 0 && (
        <EmptyState
          icon={<ShoppingBasketOutlinedIcon />}
          title={t('cart.empty')}
          hint={t('cart.emptyHint')}
          action={
            <Button component={RouterLink} to="/" variant="contained" size="large">
              {t('cart.goToCatalog')}
            </Button>
          }
        />
      )}

      {cart.data && cart.data.lines.length > 0 && (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 320px' }, alignItems: 'start' }}>
          <Paper elevation={1} sx={{ p: { xs: 1.5, sm: 2.5 } }}>
            <Alert severity="info" icon={<StorefrontIcon fontSize="inherit" />} sx={{ mb: 1 }}>
              {t('cart.oneFarm')}
            </Alert>
            <Stack component="ul" divider={<Divider component="li" aria-hidden />} sx={{ listStyle: 'none', p: 0, m: 0 }}>
              {lines.map((line) => {
                const name = pick(line.name);
                return (
                  <Box component="li" key={line.productId} sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 }, py: 1.5, flexWrap: 'wrap' }}>
                    <Box sx={{ flex: '1 1 180px', minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600 }}>{name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {formatMoney(line.price, lang)} {t('catalog.perUnit', { unit: pick(line.unit) })}
                      </Typography>
                    </Box>
                    <Box
                      role="group"
                      aria-label={`${t('cart.quantity')}: ${line.quantity}`}
                      sx={{ display: 'inline-flex', alignItems: 'center', border: 1, borderColor: 'divider', borderRadius: 5 }}
                    >
                      <IconButton size="small" aria-label={t('cart.decrease', { name })} disabled={busy} onClick={() => setQuantity(line, line.quantity - 1)}>
                        <RemoveIcon fontSize="small" />
                      </IconButton>
                      <Typography aria-hidden sx={{ minWidth: 32, textAlign: 'center', fontWeight: 600 }}>
                        {line.quantity}
                      </Typography>
                      <IconButton size="small" aria-label={t('cart.increase', { name })} disabled={busy} onClick={() => setQuantity(line, line.quantity + 1)}>
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </Box>
                    <Typography sx={{ minWidth: 90, textAlign: 'right', fontWeight: 600 }}>{formatMoney(line.total, lang)}</Typography>
                    <Tooltip title={t('cart.remove', { name })}>
                      <IconButton aria-label={t('cart.remove', { name })} onClick={() => removeLine(line)} disabled={busy}>
                        <DeleteOutlineIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                );
              })}
            </Stack>
          </Paper>

          <Paper elevation={1} component="aside" sx={{ p: { xs: 2, sm: 2.5 }, position: { md: 'sticky' }, top: { md: 128 } }}>
            <Typography color="text.secondary" sx={{ mb: 1 }}>
              {t('cart.items', { count: cartCount(cart.data) })}
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 2 }}>
              <Typography variant="h6" component="p">
                {t('cart.total')}
              </Typography>
              <Typography variant="h5" component="p" data-testid="cart-total">
                {formatMoney(cart.data.total, lang)}
              </Typography>
            </Box>
            <Button component={RouterLink} to="/checkout" variant="contained" size="large" fullWidth>
              {t('cart.checkout')}
            </Button>
            <Button component={RouterLink} to="/" startIcon={<ArrowBackIcon />} fullWidth sx={{ mt: 1 }}>
              {t('cart.continue')}
            </Button>
          </Paper>
        </Box>
      )}
    </Box>
  );
}
