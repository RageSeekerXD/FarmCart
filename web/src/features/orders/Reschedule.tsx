import EventRepeatOutlinedIcon from '@mui/icons-material/EventRepeatOutlined';
import { alpha, Alert, AlertTitle, Box, Button, FormControlLabel, Paper, Radio, RadioGroup, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import type { Order, Slot } from '../../api/types';
import { errorMessage, useLang } from '../../i18n';
import { formatSlot } from '../../shared/dates';
import { enter } from '../../shared/motion';
import { useToast } from '../../shared/Toast';

/**
 * Невдала доставка (п. 7 покращень): покупець бачить, чому кур'єр не вручив замовлення, і обирає новий час.
 * Після перенесення замовлення знову «в дорозі» в того самого кур'єра.
 */
export function RescheduleDelivery({ order }: { order: Order }) {
  const { t } = useTranslation();
  const { lang } = useLang();
  const toast = useToast();
  const queryClient = useQueryClient();
  const slots = useQuery({ queryKey: ['slots'], queryFn: () => api<Slot[]>('/slots'), staleTime: 0 });
  const [slotId, setSlotId] = useState<number | null>(null);

  const reschedule = useMutation({
    mutationFn: (id: number) => api<Order>(`/orders/${order.id}/reschedule`, { method: 'POST', body: { slotId: id } }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['order', updated.id], updated);
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['slots'] });
      toast.show(t('orders.rescheduled', { slot: formatSlot(updated.slotStart, updated.slotEnd, lang) }));
    },
    onError: () => void slots.refetch(),
  });

  const problem = order.deliveryProblem ? t(`orders.problem.${order.deliveryProblem}`) : '';
  return (
    <Paper elevation={1} sx={{ p: { xs: 2, sm: 2.5 }, ...enter(0) }}>
      <Alert severity="warning" sx={{ mb: 2 }}>
        <AlertTitle>{t('orders.notDelivered')}</AlertTitle>
        {problem}
        {/* Коментар кур'єра - його власний текст, не перекладається. */}
        {order.deliveryProblemNote ? <span>: {order.deliveryProblemNote}</span> : null}. {t('orders.pickNewTime')}
      </Alert>
      <Typography id="reschedule-slot" sx={{ fontWeight: 600, mb: 1 }}>
        {t('orders.newTime')}
      </Typography>
      {slots.data && slots.data.length === 0 && <Alert severity="info">{t('checkout.noSlots')}</Alert>}
      <RadioGroup
        aria-labelledby="reschedule-slot"
        value={slotId ?? ''}
        onChange={(event) => setSlotId(Number(event.target.value))}
        sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 250px), 1fr))', mb: 2 }}
      >
        {(slots.data ?? []).map((slot) => {
          const full = slot.remaining <= 0;
          const selected = slotId === slot.id;
          return (
            <FormControlLabel
              key={slot.id}
              value={slot.id}
              control={<Radio size="small" />}
              disabled={full}
              label={
                <Box component="span" sx={{ display: 'block' }}>
                  <Typography component="span" sx={{ display: 'block', fontWeight: 600 }}>
                    {formatSlot(slot.start, slot.end, lang)}
                  </Typography>
                  <Typography component="span" variant="body2" color="text.secondary">
                    {full ? t('checkout.slotFull') : t('checkout.slotLeft', { count: slot.remaining })}
                  </Typography>
                </Box>
              }
              sx={(theme) => ({
                m: 0,
                px: 1.5,
                py: 1,
                border: 1,
                borderRadius: '12px',
                borderColor: selected ? 'primary.main' : 'divider',
                bgcolor: selected ? alpha(theme.palette.primary.main, 0.06) : 'transparent',
              })}
            />
          );
        })}
      </RadioGroup>
      {reschedule.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMessage(reschedule.error)}
        </Alert>
      )}
      <Button
        variant="contained"
        startIcon={<EventRepeatOutlinedIcon />}
        disabled={slotId === null}
        loading={reschedule.isPending}
        onClick={() => slotId !== null && reschedule.mutate(slotId)}
      >
        {t('orders.reschedule')}
      </Button>
    </Paper>
  );
}
