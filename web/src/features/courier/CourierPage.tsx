import DirectionsIcon from '@mui/icons-material/Directions';
import { Alert, Box, Button, CircularProgress, Paper, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import type { DeliveryTask, Order } from '../../api/types';
import { errorMessage, formatMoney, useLang } from '../../i18n';
import { formatSlot } from '../../shared/dates';
import { useToast } from '../../shared/Toast';
import { POLL_MS } from '../orders/orders';

const DELIVERIES = ['courier', 'deliveries'] as const;

function DeliveryCard({ task }: { task: DeliveryTask }) {
  const { t } = useTranslation();
  const { lang, pick } = useLang();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const label = t('courier.delivery', { id: task.orderId });

  const confirm = useMutation({
    mutationFn: () => api<Order>(`/courier/deliveries/${task.orderId}/confirm`, { method: 'POST', body: { code: code.trim() } }),
    onSuccess: () => {
      queryClient.setQueryData<DeliveryTask[]>(DELIVERIES, (tasks) => tasks?.filter((item) => item.orderId !== task.orderId));
      toast.show(t('courier.delivered', { id: task.orderId }));
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    confirm.mutate();
  };

  return (
    <Paper component="li" aria-label={label} sx={{ p: 2 }}>
      <Typography component="h2" variant="h5" sx={{ mb: 0.5 }}>
        {label}
      </Typography>
      <Typography variant="h6" component="p" color="primary">
        {formatSlot(task.slotStart, task.slotEnd, lang)}
      </Typography>
      <Stack spacing={0.5} sx={{ my: 1.5, fontSize: '1.1rem' }}>
        <Typography sx={{ fontSize: 'inherit' }}>
          <strong>{t('courier.pickup')}:</strong> {pick(task.pickupFrom)}
        </Typography>
        <Typography sx={{ fontSize: 'inherit' }}>
          <strong>{t('courier.address')}:</strong> {task.address}
        </Typography>
        <Typography sx={{ fontSize: 'inherit' }}>
          <strong>{t('courier.items')}:</strong> {task.items}
        </Typography>
      </Stack>
      {task.amountToCollect > 0 ? (
        <Alert severity="warning" sx={{ mb: 1.5, fontSize: '1.05rem' }}>
          {t('courier.collect', { amount: formatMoney(task.amountToCollect, lang) })}
        </Alert>
      ) : (
        <Alert severity="success" sx={{ mb: 1.5 }}>
          {t('courier.prepaid')}
        </Alert>
      )}
      <Button
        component="a"
        href={task.routeUrl}
        target="_blank"
        rel="noopener noreferrer"
        variant="outlined"
        size="large"
        fullWidth
        startIcon={<DirectionsIcon />}
        sx={{ minHeight: 56, mb: 2 }}
      >
        {t('courier.route')}
      </Button>

      <Stack component="form" spacing={1.5} onSubmit={submit} noValidate>
        <TextField
          label={t('courier.code')}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
          helperText={t('courier.codeHint')}
          autoComplete="off"
          fullWidth
          slotProps={{
            htmlInput: { inputMode: 'numeric', maxLength: 4, style: { fontSize: '2rem', letterSpacing: '0.5em', textAlign: 'center' }, 'aria-label': `${t('courier.code')}: ${label}` },
          }}
        />
        {confirm.isError && <Alert severity="error">{errorMessage(confirm.error)}</Alert>}
        <Button type="submit" variant="contained" size="large" fullWidth disabled={code.length < 4} loading={confirm.isPending} sx={{ minHeight: 56, fontSize: '1.1rem' }}>
          {t('courier.confirm')}
        </Button>
      </Stack>
    </Paper>
  );
}

/** UI-10: доставки кур'єра - великі елементи для телефона, маршрут і вручення за кодом покупця. */
export function CourierPage() {
  const { t } = useTranslation();
  const deliveries = useQuery({
    queryKey: DELIVERIES,
    queryFn: () => api<DeliveryTask[]>('/courier/deliveries'),
    refetchInterval: POLL_MS,
  });

  return (
    <Box sx={{ maxWidth: 560, mx: 'auto' }}>
      <Typography component="h1" variant="h4" sx={{ mb: 2, fontSize: { xs: '1.6rem', sm: '2.1rem' } }}>
        {t('nav.deliveries')}
      </Typography>
      {deliveries.isPending && <CircularProgress aria-label={t('common.loading')} />}
      {deliveries.isError && <Alert severity="error">{errorMessage(deliveries.error)}</Alert>}
      {deliveries.data?.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography>{t('courier.empty')}</Typography>
        </Paper>
      )}
      <Stack component="ul" spacing={2} sx={{ listStyle: 'none', p: 0, m: 0 }}>
        {deliveries.data?.map((task) => <DeliveryCard key={task.orderId} task={task} />)}
      </Stack>
    </Box>
  );
}
