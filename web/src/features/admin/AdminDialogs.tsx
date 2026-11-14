import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import type { FarmerProfile, Slot } from '../../api/types';
import { errorMessage, useLang } from '../../i18n';
import { formatSlot, localIso } from '../../shared/dates';
import { useToast } from '../../shared/Toast';

/** Після будь-якої дії адміністратора журнал аудиту застарів. */
function useAdminAction<T>(fn: (input: T) => Promise<unknown>, keys: readonly (readonly unknown[])[]) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const key of [...keys, ['admin', 'audit']]) {
        void queryClient.invalidateQueries({ queryKey: [...key] });
      }
    },
  });
}

/** Відхилення заявки продавця (п. 6 покращень): причина обов'язкова, її побачить фермер. */
export function RejectFarmerDialog({ farmer, onClose }: { farmer: FarmerProfile; onClose: () => void }) {
  const { t } = useTranslation();
  const { pick } = useLang();
  const toast = useToast();
  const reject = useAdminAction((reason: string) => api(`/admin/farmers/${farmer.id}/reject`, { method: 'POST', body: { reason } }), [['admin', 'pending']]);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const missing = reason.trim() === '';

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!missing) {
      reject.mutate(reason.trim(), {
        onSuccess: () => {
          toast.show(t('admin.rejectedNamed', { name: pick(farmer.name) }), 'info');
          onClose();
        },
      });
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" aria-labelledby="reject-farmer-title">
      <form onSubmit={submit} noValidate>
        <DialogTitle id="reject-farmer-title">{t('admin.rejectTitle', { name: pick(farmer.name) })}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {t('admin.rejectHint')}
            </Typography>
            <TextField
              label={t('admin.hideReason')}
              required
              autoFocus
              multiline
              minRows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              error={touched && missing}
              helperText={touched && missing ? t('errors.reason_required') : ' '}
            />
            {reject.isError && <Alert severity="error">{errorMessage(reject.error)}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" variant="contained" color="error" loading={reject.isPending}>
            {t('admin.reject')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

const pad = (value: number) => String(value).padStart(2, '0');
const dateOf = (iso: string) => {
  const date = new Date(iso);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const timeOf = (iso: string) => {
  const date = new Date(iso);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/**
 * Зміна слоту. Сервер не дозволить змінити час слоту, у якому вже є замовлення, чи зменшити ємність нижче
 * заброньованого - тож у такому слоті поля часу вимкнено одразу, з поясненням.
 */
export function SlotEditDialog({ slot, onClose }: { slot: Slot; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const booked = slot.capacity - slot.remaining;
  const update = useAdminAction(
    (body: { start: string; end: string; capacity: number }) => api(`/admin/slots/${slot.id}`, { method: 'PATCH', body }),
    [['slots']],
  );
  const [date, setDate] = useState(() => dateOf(slot.start));
  const [from, setFrom] = useState(() => timeOf(slot.start));
  const [to, setTo] = useState(() => timeOf(slot.end));
  const [capacity, setCapacity] = useState(String(slot.capacity));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    // Час слоту з бронюваннями не чіпаємо взагалі: надсилаємо його незмінним, як отримали від сервера.
    const times = booked > 0 ? { start: slot.start, end: slot.end } : { start: localIso(date, from), end: localIso(date, to) };
    update.mutate(
      { ...times, capacity: Number(capacity) },
      {
        onSuccess: () => {
          toast.show(t('admin.slotUpdated'));
          onClose();
        },
      },
    );
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" aria-labelledby="edit-slot-title">
      <form onSubmit={submit} noValidate>
        <DialogTitle id="edit-slot-title">{t('admin.editSlotTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {booked > 0 && <Alert severity="info">{t('admin.slotLockedHint', { count: booked })}</Alert>}
            <TextField label={t('admin.date')} type="date" value={date} disabled={booked > 0} onChange={(event) => setDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            <Stack direction="row" spacing={2}>
              <TextField fullWidth label={t('admin.from')} type="time" value={from} disabled={booked > 0} onChange={(event) => setFrom(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
              <TextField fullWidth label={t('admin.to')} type="time" value={to} disabled={booked > 0} onChange={(event) => setTo(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            </Stack>
            <TextField
              label={t('admin.capacity')}
              value={capacity}
              onChange={(event) => setCapacity(event.target.value.replace(/\D/g, ''))}
              helperText={booked > 0 ? t('admin.bookedOf', { booked, capacity: slot.capacity }) : ' '}
              slotProps={{ htmlInput: { inputMode: 'numeric' } }}
            />
            {update.isError && <Alert severity="error">{errorMessage(update.error)}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" variant="contained" loading={update.isPending} disabled={capacity === ''}>
            {t('common.save')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

/** Видалення порожнього слоту - з підтвердженням; слот із замовленнями сервер не видалить (slot_in_use). */
export function SlotDeleteDialog({ slot, onClose }: { slot: Slot; onClose: () => void }) {
  const { t } = useTranslation();
  const { lang } = useLang();
  const toast = useToast();
  const remove = useAdminAction(() => api(`/admin/slots/${slot.id}`, { method: 'DELETE' }), [['slots']]);

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" aria-labelledby="delete-slot-title">
      <DialogTitle id="delete-slot-title">{t('admin.deleteSlotTitle')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography>{formatSlot(slot.start, slot.end, lang)}</Typography>
          {remove.isError && <Alert severity="error">{errorMessage(remove.error)}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button
          variant="contained"
          color="error"
          loading={remove.isPending}
          onClick={() =>
            remove.mutate(undefined, {
              onSuccess: () => {
                toast.show(t('admin.slotDeleted'), 'info');
                onClose();
              },
            })
          }
        >
          {t('admin.deleteSlot')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
