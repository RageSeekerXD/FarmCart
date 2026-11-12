import { Alert, Box, Button, Chip, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import type { OrderStatus } from '../../api/types';
import { errorMessage, formatMoney, useLang } from '../../i18n';
import { formatSlot } from '../../shared/dates';
import { useOrders } from './orders';

const STATUS_COLOR: Record<OrderStatus, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  Placed: 'info',
  Accepted: 'info',
  Assembling: 'warning',
  InTransit: 'warning',
  Delivered: 'success',
  Rejected: 'error',
};

export function StatusChip({ status }: { status: OrderStatus }) {
  const { t } = useTranslation();
  return <Chip size="small" color={STATUS_COLOR[status]} label={t(`status.${status}`)} />;
}

/** UI-06: мої замовлення - від найновішого; статуси перечитуються самі, поки замовлення в роботі. */
export function OrdersPage() {
  const { t } = useTranslation();
  const { lang, pick } = useLang();
  const orders = useOrders();

  return (
    <Box sx={{ maxWidth: 760, mx: 'auto' }}>
      <Typography component="h1" variant="h4" sx={{ mb: 2, fontSize: { xs: '1.6rem', sm: '2.1rem' } }}>
        {t('orders.title')}
      </Typography>

      {orders.isPending && <CircularProgress aria-label={t('common.loading')} />}
      {orders.isError && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => void orders.refetch()}>
              {t('common.retry')}
            </Button>
          }
        >
          {errorMessage(orders.error)}
        </Alert>
      )}

      {orders.data?.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography sx={{ mb: 2 }}>{t('orders.empty')}</Typography>
          <Button component={RouterLink} to="/" variant="contained">
            {t('cart.goToCatalog')}
          </Button>
        </Paper>
      )}

      <Stack component="ul" spacing={1.5} sx={{ listStyle: 'none', p: 0, m: 0 }}>
        {orders.data?.map((order) => (
          <Paper component="li" key={order.id} sx={{ p: 2 }} aria-label={t('orders.number', { id: order.id })}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography component="h2" variant="h6" sx={{ mr: 'auto' }}>
                {t('orders.number', { id: order.id })}
              </Typography>
              <StatusChip status={order.status} />
            </Box>
            <Typography variant="body2" color="text.secondary">
              {order.lines.map((line) => `${pick(line.name)} × ${line.quantity}`).join(', ')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('orders.deliveryAt', { slot: formatSlot(order.slotStart, order.slotEnd, lang) })}
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
              <Typography sx={{ fontWeight: 600 }}>{formatMoney(order.total, lang)}</Typography>
              <Button component={RouterLink} to={`/orders/${order.id}`} size="small" aria-label={t('orders.trackNamed', { id: order.id })}>
                {t('orders.track')}
              </Button>
            </Box>
          </Paper>
        ))}
      </Stack>
    </Box>
  );
}
