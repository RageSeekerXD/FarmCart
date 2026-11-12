import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import { Alert, Box, Button, Chip, CircularProgress, LinearProgress, Paper, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import type { OrderStatus } from '../../api/types';
import { errorMessage, formatMoney, useLang } from '../../i18n';
import { formatSlot } from '../../shared/dates';
import { EmptyState } from '../../shared/pages';
import { ORDER_PATH, useOrders } from './orders';

const STATUS_COLOR: Record<OrderStatus, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  Placed: 'info',
  Accepted: 'info',
  Assembling: 'warning',
  InTransit: 'warning',
  Delivered: 'success',
  Rejected: 'error',
};

const PROGRESS_COLOR: Record<OrderStatus, 'primary' | 'warning' | 'success' | 'error'> = {
  Placed: 'primary',
  Accepted: 'primary',
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
        <EmptyState
          icon={<ReceiptLongOutlinedIcon />}
          title={t('orders.empty')}
          hint={t('orders.emptyHint')}
          action={
            <Button component={RouterLink} to="/" variant="contained">
              {t('cart.goToCatalog')}
            </Button>
          }
        />
      )}

      <Stack component="ul" spacing={1.5} sx={{ listStyle: 'none', p: 0, m: 0 }}>
        {orders.data?.map((order) => {
          // Відхилене замовлення далі не йде: смуга повна й червона, щоб не виглядала «застряглою».
          const step = order.status === 'Rejected' ? ORDER_PATH.length : ORDER_PATH.indexOf(order.status) + 1;
          return (
            <Paper
              component="li"
              key={order.id}
              elevation={1}
              sx={{ p: { xs: 2, sm: 2.5 }, transition: 'box-shadow 160ms ease', '&:hover': { boxShadow: 4 } }}
              aria-label={t('orders.number', { id: order.id })}
            >
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
              <LinearProgress
                variant="determinate"
                value={(step / ORDER_PATH.length) * 100}
                color={PROGRESS_COLOR[order.status]}
                aria-label={t('orders.progress', { step, total: ORDER_PATH.length })}
                sx={{ my: 1.5, height: 6 }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography sx={{ fontWeight: 700, fontSize: '1.05rem' }}>{formatMoney(order.total, lang)}</Typography>
                <Button
                  component={RouterLink}
                  to={`/orders/${order.id}`}
                  variant="outlined"
                  size="small"
                  endIcon={<ChevronRightIcon />}
                  aria-label={t('orders.trackNamed', { id: order.id })}
                >
                  {t('orders.track')}
                </Button>
              </Box>
            </Paper>
          );
        })}
      </Stack>
    </Box>
  );
}
