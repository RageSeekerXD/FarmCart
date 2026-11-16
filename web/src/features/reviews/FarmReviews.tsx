import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Rating, Skeleton, Stack, Typography } from '@mui/material';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import type { Review } from '../../api/types';
import { errorMessage, useLang } from '../../i18n';
import { formatDateTime } from '../../shared/dates';
import { enter } from '../../shared/motion';

export function useFarmReviews(farmerId: number, enabled = true) {
  return useQuery({
    queryKey: ['farm-reviews', farmerId],
    queryFn: () => api<Review[]>(`/farmers/${farmerId}/reviews`),
    enabled,
    staleTime: 60_000,
  });
}

/** Відгуки покупців, у чиєму замовленні був цей товар. */
export function useProductReviews(productId: number) {
  return useQuery({
    queryKey: ['product-reviews', productId],
    queryFn: () => api<Review[]>(`/products/${productId}/reviews`),
    staleTime: 60_000,
  });
}

interface ListProps {
  reviews: UseQueryResult<Review[]>;
  /** Скільки відгуків показати одразу; решта - кнопкою «Показати всі». */
  limit?: number;
  /** Текст, коли відгуків немає. */
  empty?: string;
}

/**
 * Список відгуків: оцінка зірками, підпис автора («Оксана Д.»), дата й коментар.
 * Коментар - текст покупця, він не перекладається.
 */
export function ReviewList({ reviews, limit = 3, empty }: ListProps) {
  const { t } = useTranslation();
  const { lang } = useLang();
  const [all, setAll] = useState(false);

  if (reviews.isPending) {
    return (
      <Stack spacing={1} aria-label={t('common.loading')}>
        <Skeleton width="40%" />
        <Skeleton width="80%" />
      </Stack>
    );
  }

  if (reviews.isError) {
    return <Typography color="error">{errorMessage(reviews.error)}</Typography>;
  }

  if (reviews.data.length === 0) {
    return <Typography color="text.secondary">{empty ?? t('reviews.empty')}</Typography>;
  }

  const shown = all ? reviews.data : reviews.data.slice(0, limit);
  return (
    <Box>
      <Stack component="ul" divider={<Divider component="li" aria-hidden />} spacing={1.5} sx={{ listStyle: 'none', p: 0, m: 0 }}>
        {shown.map((review, index) => (
          <Box component="li" key={review.id} sx={enter(index, 40)}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
              <Rating value={review.rating} readOnly size="small" aria-label={t('reviews.stars', { rating: review.rating })} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {review.author || t('reviews.anonymous')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatDateTime(review.at, lang)}
              </Typography>
            </Box>
            {review.comment && (
              <Typography variant="body2" sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>
                {review.comment}
              </Typography>
            )}
          </Box>
        ))}
      </Stack>
      {!all && reviews.data.length > limit && (
        <Button size="small" onClick={() => setAll(true)} sx={{ mt: 1 }}>
          {t('reviews.showAll', { count: reviews.data.length })}
        </Button>
      )}
    </Box>
  );
}

/** Відгуки покупців про ферму (п. 1 покращень). */
export function FarmReviews({ farmerId, limit = 3 }: { farmerId: number; limit?: number }) {
  return <ReviewList reviews={useFarmReviews(farmerId)} limit={limit} />;
}

/** Відгуки ферми в діалозі - з мапи ферм. */
export function FarmReviewsDialog({ farmerId, farmName, onClose }: { farmerId: number; farmName: string; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="farm-reviews-title">
      <DialogTitle id="farm-reviews-title">{t('reviews.farmTitle', { name: farmName })}</DialogTitle>
      <DialogContent>
        <FarmReviews farmerId={farmerId} limit={10} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>{t('common.close')}</Button>
      </DialogActions>
    </Dialog>
  );
}
