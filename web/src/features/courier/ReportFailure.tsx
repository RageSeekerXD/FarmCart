import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Radio, RadioGroup, Stack, TextField } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import type { DeliveryTask } from '../../api/types';
import { errorMessage } from '../../i18n';
import { useToast } from '../../shared/Toast';

const PROBLEMS = ['BuyerAbsent', 'AddressNotFound', 'Other'] as const;
type Problem = (typeof PROBLEMS)[number];

/**
 * Кур'єр фіксує, що вручити не вдалося (п. 7 покращень): причина зі списку, для «іншої» - короткий коментар.
 * Доставка зникає зі списку кур'єра й повернеться, щойно покупець обере новий час.
 */
export function ReportFailureButton({ task, deliveriesKey }: { task: DeliveryTask; deliveriesKey: readonly unknown[] }) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState<Problem>('BuyerAbsent');
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const noteMissing = problem === 'Other' && note.trim() === '';

  const report = useMutation({
    mutationFn: () =>
      api(`/courier/deliveries/${task.orderId}/fail`, { method: 'POST', body: { problem, note: note.trim() || null } }),
    onSuccess: () => {
      queryClient.setQueryData<DeliveryTask[]>(deliveriesKey, (tasks) => tasks?.filter((item) => item.orderId !== task.orderId));
      toast.show(t('courier.failed', { id: task.orderId }), 'info');
      setOpen(false);
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!noteMissing) {
      report.mutate();
    }
  };

  return (
    <>
      <Button color="warning" variant="text" startIcon={<ReportProblemOutlinedIcon />} onClick={() => setOpen(true)} fullWidth sx={{ minHeight: 48 }}>
        {t('courier.reportFailure')}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs" aria-labelledby={`fail-${task.orderId}`}>
        <form onSubmit={submit} noValidate>
          <DialogTitle id={`fail-${task.orderId}`}>{t('courier.failTitle', { id: task.orderId })}</DialogTitle>
          <DialogContent>
            <Stack spacing={1.5}>
              <RadioGroup aria-label={t('courier.failReason')} value={problem} onChange={(event) => setProblem(event.target.value as Problem)}>
                {PROBLEMS.map((item) => (
                  <FormControlLabel key={item} value={item} control={<Radio />} label={t(`orders.problem.${item}`)} />
                ))}
              </RadioGroup>
              <TextField
                label={t('courier.failNote')}
                multiline
                minRows={2}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                required={problem === 'Other'}
                error={touched && noteMissing}
                helperText={touched && noteMissing ? t('errors.note_required') : t('courier.failNoteHint')}
                slotProps={{ htmlInput: { maxLength: 300 } }}
              />
              {report.isError && <Alert severity="error">{errorMessage(report.error)}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" variant="contained" color="warning" loading={report.isPending}>
              {t('courier.failConfirm')}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}
