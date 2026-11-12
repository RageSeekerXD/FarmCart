import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import { Alert, Box, Button, CircularProgress, Divider, IconButton, Paper, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import type { CartLine } from '../../api/types';
import { errorMessage, formatMoney, useLang } from '../../i18n';
import { useToast } from '../../shared/Toast';
import { useCart, useRemoveFromCart } from './useCart';

/** UI-04: кошик покупця - позиції, видалення й перерахунок суми. Далі - оформлення (UI-05). */
export function CartPage() {
  const { t } = useTranslation();
  const { lang, pick } = useLang();
  const toast = useToast();
  const cart = useCart();
  const remove = useRemoveFromCart();

  const removeLine = (line: CartLine) => {
    remove.mutate(line.productId, {
      onSuccess: () => toast.show(t('cart.removed', { name: pick(line.name) }), 'info'),
      onError: (error) => toast.show(errorMessage(error), 'error'),
    });
  };

  return (
    <Box sx={{ maxWidth: 760, mx: 'auto' }}>
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
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography sx={{ mb: 2 }}>{t('cart.empty')}</Typography>
          <Button component={RouterLink} to="/" variant="contained">
            {t('cart.goToCatalog')}
          </Button>
        </Paper>
      )}

      {cart.data && cart.data.lines.length > 0 && (
        <Paper sx={{ p: { xs: 1.5, sm: 2.5 } }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {t('cart.oneFarm')}
          </Typography>
          <Stack component="ul" divider={<Divider component="li" />} sx={{ listStyle: 'none', p: 0, m: 0 }}>
            {cart.data.lines.map((line) => (
              <Box
                component="li"
                key={line.productId}
                sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5, flexWrap: 'wrap' }}
              >
                <Box sx={{ flex: '1 1 180px', minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600 }}>{pick(line.name)}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatMoney(line.price, lang)} {t('catalog.perUnit', { unit: pick(line.unit) })}
                  </Typography>
                </Box>
                <Typography aria-label={`${t('cart.quantity')}: ${line.quantity}`} sx={{ minWidth: 48, textAlign: 'right' }}>
                  × {line.quantity}
                </Typography>
                <Typography sx={{ minWidth: 96, textAlign: 'right', fontWeight: 600 }}>{formatMoney(line.total, lang)}</Typography>
                <IconButton
                  aria-label={t('cart.remove', { name: pick(line.name) })}
                  onClick={() => removeLine(line)}
                  disabled={remove.isPending}
                >
                  <DeleteOutlineIcon />
                </IconButton>
              </Box>
            ))}
          </Stack>
          <Divider sx={{ my: 1.5 }} />
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
        </Paper>
      )}
    </Box>
  );
}
