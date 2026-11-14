import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Order } from '../../api/types';
import { errorMessage, formatMoney, useLang } from '../../i18n';
import { useToast } from '../../shared/Toast';
import { canCancel, useCancelOrder } from './orders';

interface Props {
  order: Pick<Order, 'id' | 'status' | 'paymentStatus' | 'paidAmount' | 'refundedAmount'>;
  /** «compact» - текстова кнопка для картки в списку; за замовчуванням - помітна кнопка трекера. */
  compact?: boolean;
}

/**
 * Скасування замовлення покупцем: кнопка видна, лише поки фермер не прийняв замовлення,
 * і завжди веде через підтвердження - з сумою, що повернеться, і попередженням, що дію не відмінити.
 */
export function CancelOrderButton({ order, compact = false }: Props) {
  const { t } = useTranslation();
  const { lang } = useLang();
  const toast = useToast();
  const cancel = useCancelOrder();
  const [open, setOpen] = useState(false);

  if (!canCancel(order.status) && !open) {
    return null;
  }

  const refund = order.paidAmount - order.refundedAmount;
  const close = () => {
    setOpen(false);
    cancel.reset();
  };

  const confirm = () =>
    cancel.mutate(order.id, {
      onSuccess: () => {
        setOpen(false);
        toast.show(t('orders.cancelled', { id: order.id }), 'info');
      },
    });

  return (
    <>
      <Button
        color="error"
        variant={compact ? 'text' : 'outlined'}
        size={compact ? 'small' : 'medium'}
        startIcon={<CancelOutlinedIcon />}
        aria-label={t('orders.cancelNamed', { id: order.id })}
        onClick={() => setOpen(true)}
      >
        {t('orders.cancel')}
      </Button>
      <Dialog open={open} onClose={cancel.isPending ? undefined : close} fullWidth maxWidth="xs" aria-labelledby={`cancel-order-${order.id}`}>
        <DialogTitle id={`cancel-order-${order.id}`}>{t('orders.cancelTitle', { id: order.id })}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5}>
            <Typography>{t('orders.cancelBody')}</Typography>
            <Typography sx={{ fontWeight: 600 }}>
              {refund > 0 ? t('orders.cancelRefund', { amount: formatMoney(refund, lang) }) : t('orders.cancelCash')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('orders.cancelFinal')}
            </Typography>
            {cancel.isError && <Alert severity="error">{errorMessage(cancel.error)}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={close} disabled={cancel.isPending}>
            {t('orders.keep')}
          </Button>
          {/* Після відмови (фермер щойно прийняв) повторювати марно - лишається тільки «залишити». */}
          {!cancel.isError && (
            <Button variant="contained" color="error" loading={cancel.isPending} onClick={confirm}>
              {t('orders.confirmCancel')}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}
