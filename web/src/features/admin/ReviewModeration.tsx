import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import RateReviewOutlinedIcon from '@mui/icons-material/RateReviewOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Rating,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import type { AdminReview, ReviewCheckResult } from '../../api/types';
import { errorMessage, useLang } from '../../i18n';
import { formatDateTime } from '../../shared/dates';
import { enter } from '../../shared/motion';
import { EmptyState } from '../../shared/pages';
import { useToast } from '../../shared/Toast';
import { useAiAvailable } from '../ai/useAi';

const QUEUE = ['admin', 'reviews'] as const;

/** Після модерації змінюються рейтинг ферми, її публічні відгуки й журнал аудиту. */
function useModerate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ review, reason }: { review: AdminReview; reason: string | null }) =>
      reason === null
        ? api<unknown>(`/admin/reviews/${review.id}/restore`, { method: 'POST', body: {} })
        : api<unknown>(`/admin/reviews/${review.id}/hide`, { method: 'POST', body: { reason } }),
    onSuccess: (_, { review }) => {
      for (const key of [QUEUE, ['admin', 'audit'], ['farm-reviews', review.farmerId], ['catalog'], ['farms']]) {
        void queryClient.invalidateQueries({ queryKey: [...key] });
      }
    },
  });
}

/** Причина обов'язкова (B-FR-12): вона потрапляє в журнал аудиту. */
function HideDialog({ review, suggestedReason, onClose }: { review: AdminReview; suggestedReason: string; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const moderate = useModerate();
  const [reason, setReason] = useState(suggestedReason);
  const [touched, setTouched] = useState(false);
  const missing = reason.trim() === '';

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (missing) {
      return;
    }

    moderate.mutate(
      { review, reason: reason.trim() },
      {
        onSuccess: () => {
          toast.show(t('admin.reviewHidden'), 'info');
          onClose();
        },
      },
    );
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" aria-labelledby="hide-review-title">
      <form onSubmit={submit} noValidate>
        <DialogTitle id="hide-review-title">{t('admin.hideTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {t('admin.hideHint')}
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
            {moderate.isError && <Alert severity="error">{errorMessage(moderate.error)}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" variant="contained" color="error" loading={moderate.isPending}>
            {t('admin.hide')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

/** Модерація відгуків (п. 2 покращень): усі відгуки, приховані - з причиною; приховати чи показати знову. */
export function ReviewModeration() {
  const { t } = useTranslation();
  const { lang, pick } = useLang();
  const toast = useToast();
  const reviews = useQuery({ queryKey: QUEUE, queryFn: () => api<AdminReview[]>('/admin/reviews') });
  const restore = useModerate();
  const [hiding, setHiding] = useState<AdminReview | null>(null);
  const aiAvailable = useAiAvailable();
  const check = useMutation({ mutationFn: () => api<ReviewCheckResult>('/admin/reviews/check', { method: 'POST', body: {} }) });
  const adviceFor = (review: AdminReview) => (review.hidden ? undefined : check.data?.flagged.find((advice) => advice.reviewId === review.id));

  if (reviews.isError) {
    return <Alert severity="error">{errorMessage(reviews.error)}</Alert>;
  }

  if (reviews.isPending) {
    return <CircularProgress aria-label={t('common.loading')} />;
  }

  if (reviews.data.length === 0) {
    return <EmptyState icon={<RateReviewOutlinedIcon />} title={t('admin.noReviews')} />;
  }

  return (
    <>
      {aiAvailable && (
        <Box aria-live="polite" sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
            <Button variant="outlined" startIcon={<AutoAwesomeIcon />} loading={check.isPending} onClick={() => check.mutate()}>
              {t('ai.moderationCheck')}
            </Button>
            <Typography variant="body2" color="text.secondary">
              {check.data
                ? `${t('ai.moderationResult', { count: check.data.flagged.length })}${check.data.remaining > 0 ? ` ${t('ai.moderationRemaining', { count: check.data.remaining })}` : ''}`
                : t('ai.moderationHint')}
            </Typography>
          </Box>
          {check.isError && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {errorMessage(check.error)}
            </Alert>
          )}
        </Box>
      )}
      <Stack component="ul" spacing={1.5} aria-label={t('admin.section.reviews')} sx={{ listStyle: 'none', p: 0, m: 0 }}>
        {reviews.data.map((review, index) => (
          <Paper
            component="li"
            key={review.id}
            elevation={1}
            aria-label={t('admin.reviewNamed', { id: review.id })}
            sx={{ p: 2, opacity: review.hidden ? 0.75 : 1, borderLeft: 3, borderLeftColor: review.hidden ? 'text.disabled' : 'primary.main', ...enter(index) }}
          >
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Rating value={review.rating} readOnly size="small" aria-label={t('reviews.stars', { rating: review.rating })} />
              <Typography sx={{ fontWeight: 600 }}>{pick(review.farmName)}</Typography>
              {review.hidden && <Chip size="small" icon={<VisibilityOffOutlinedIcon />} label={t('admin.hidden')} />}
              <Box sx={{ ml: 'auto' }}>
                {review.hidden ? (
                  <Button
                    size="small"
                    startIcon={<VisibilityOutlinedIcon />}
                    loading={restore.isPending && restore.variables?.review.id === review.id}
                    onClick={() =>
                      restore.mutate(
                        { review, reason: null },
                        {
                          onSuccess: () => toast.show(t('admin.reviewRestored'), 'success'),
                          onError: (error) => toast.show(errorMessage(error), 'error'),
                        },
                      )
                    }
                    aria-label={t('admin.restoreNamed', { id: review.id })}
                  >
                    {t('admin.restore')}
                  </Button>
                ) : (
                  <Button size="small" color="error" startIcon={<VisibilityOffOutlinedIcon />} onClick={() => setHiding(review)} aria-label={t('admin.hideNamed', { id: review.id })}>
                    {t('admin.hide')}
                  </Button>
                )}
              </Box>
            </Box>
            {review.comment && <Typography sx={{ overflowWrap: 'anywhere' }}>{review.comment}</Typography>}
            <Typography variant="caption" color="text.secondary">
              {review.author || t('reviews.anonymous')} · {formatDateTime(review.at, lang)} · {t('orders.number', { id: review.orderId })}
            </Typography>
            {review.hidden && review.hiddenReason && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {t('admin.hiddenBecause', { reason: review.hiddenReason })}
              </Typography>
            )}
            {adviceFor(review) && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                <strong>{t(`ai.category.${adviceFor(review)!.category}`)}:</strong> {pick(adviceFor(review)!.reason)}
              </Alert>
            )}
          </Paper>
        ))}
      </Stack>
      {hiding && (
        <HideDialog
          key={hiding.id}
          review={hiding}
          suggestedReason={adviceFor(hiding) ? pick(adviceFor(hiding)!.reason) : ''}
          onClose={() => setHiding(null)}
        />
      )}
    </>
  );
}
