import DirectionsIcon from '@mui/icons-material/Directions';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import ScheduleIcon from '@mui/icons-material/Schedule';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import { alpha, Alert, Box, Button, Chip, CircularProgress, Paper, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import type { DeliveryTask, Order } from '../../api/types';
import { errorMessage, formatMoney, useLang } from '../../i18n';
import { formatSlot } from '../../shared/dates';
import { EmptyState } from '../../shared/pages';
import { useToast } from '../../shared/Toast';
import { POLL_MS } from '../orders/orders';

const DELIVERIES = ['courier', 'deliveries'] as const;

/** Рядок картки доставки: піктограма в кружечку, підпис дрібно, значення великим шрифтом - читається на ходу. */
function Detail({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box
        aria-hidden
        sx={{
          width: 40,
          height: 40,
          flexShrink: 0,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          color: 'primary.main',
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
          {label}
        </Typography>
        <Typography sx={{ fontSize: '1.1rem', fontWeight: 500, overflowWrap: 'anywhere' }}>{children}</Typography>
      </Box>
    </Box>
  );
}

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
    <Paper component="li" aria-label={label} elevation={1} sx={{ p: { xs: 2, sm: 2.5 } }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography component="h2" variant="h5" sx={{ mr: 'auto' }}>
          {label}
        </Typography>
        <Chip color="primary" icon={<ScheduleIcon />} label={formatSlot(task.slotStart, task.slotEnd, lang)} sx={{ fontWeight: 600, fontSize: '0.95rem' }} />
      </Box>
      <Stack spacing={1.5} sx={{ mb: 2 }}>
        <Detail icon={<StorefrontOutlinedIcon />} label={t('courier.pickup')}>
          {pick(task.pickupFrom)}
        </Detail>
        <Detail icon={<PlaceOutlinedIcon />} label={t('courier.address')}>
          {task.address}
        </Detail>
        <Detail icon={<Inventory2OutlinedIcon />} label={t('courier.items')}>
          {task.items}
        </Detail>
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
      <Typography component="h1" variant="h4" sx={{ mb: 1, fontSize: { xs: '1.6rem', sm: '2.1rem' } }}>
        {t('nav.deliveries')}
      </Typography>
      {deliveries.isPending && <CircularProgress aria-label={t('common.loading')} />}
      {deliveries.isError && <Alert severity="error">{errorMessage(deliveries.error)}</Alert>}
      {deliveries.data && deliveries.data.length > 0 && (
        <Typography color="text.secondary" sx={{ mb: 1.5, fontWeight: 500 }}>
          {t('courier.count', { count: deliveries.data.length })}
        </Typography>
      )}
      {deliveries.data?.length === 0 && <EmptyState icon={<LocalShippingOutlinedIcon />} title={t('courier.empty')} hint={t('courier.emptyHint')} />}
      <Stack component="ul" spacing={2} sx={{ listStyle: 'none', p: 0, m: 0 }}>
        {deliveries.data?.map((task) => <DeliveryCard key={task.orderId} task={task} />)}
      </Stack>
    </Box>
  );
}
