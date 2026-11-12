import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import { Alert, Box, Button, IconButton, Paper, Rating, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import type { Review } from '../../api/types';
import { errorMessage } from '../../i18n';
import { useToast } from '../../shared/Toast';

const STARS = [1, 2, 3, 4, 5] as const;

/** UI-07: відгук про фермера після вручення замовлення - оцінка від 1 до 5 і коментар; один відгук на замовлення. */
export function ReviewSection({ orderId }: { orderId: number }) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const key = ['order', orderId, 'review'] as const;
  const existing = useQuery({ queryKey: key, queryFn: () => api<{ review: Review | null }>(`/orders/${orderId}/review`) });
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [touched, setTouched] = useState(false);

  const send = useMutation({
    mutationFn: () => api<Review>(`/orders/${orderId}/review`, { method: 'POST', body: { rating, comment: comment.trim() || null } }),
    onSuccess: (review) => {
      queryClient.setQueryData(key, { review });
      void queryClient.invalidateQueries({ queryKey: ['catalog'] });
      void queryClient.invalidateQueries({ queryKey: ['farms'] });
      toast.show(t('review.thanks'));
    },
  });

  if (!existing.data) {
    return existing.isError ? <Alert severity="error">{errorMessage(existing.error)}</Alert> : null;
  }

  const review = existing.data.review;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (rating !== null) {
      send.mutate();
    }
  };

  return (
    <Paper component="section" aria-labelledby="order-review" sx={{ p: { xs: 1.5, sm: 2.5 } }}>
      <Typography id="order-review" component="h2" variant="h6" sx={{ mb: 1 }}>
        {t(review ? 'review.yours' : 'review.title')}
      </Typography>
      {review ? (
        <Stack spacing={1}>
          <Rating value={review.rating} readOnly aria-label={t('review.ratingValue', { rating: review.rating })} />
          {review.comment && <Typography>{review.comment}</Typography>}
        </Stack>
      ) : (
        <Stack component="form" spacing={1.5} onSubmit={submit} noValidate>
          <Typography id="review-rating-label" color="text.secondary">
            {t('review.ratingLabel')}
          </Typography>
          {/* Власні кнопки-зірки замість <Rating>: той у деяких середовищах віддавав NaN, і оцінка йшла на сервер порожньою. */}
          <Box role="radiogroup" aria-labelledby="review-rating-label" sx={{ display: 'flex' }}>
            {STARS.map((value) => (
              <IconButton
                key={value}
                role="radio"
                aria-checked={rating === value}
                aria-label={t('review.ratingValue', { rating: value })}
                onClick={() => setRating(value)}
                color={rating !== null && value <= rating ? 'secondary' : 'default'}
                size="large"
              >
                {rating !== null && value <= rating ? <StarIcon fontSize="large" /> : <StarBorderIcon fontSize="large" />}
              </IconButton>
            ))}
          </Box>
          {touched && rating === null && <Alert severity="error">{t('errors.rating_invalid')}</Alert>}
          <TextField
            label={t('review.comment')}
            multiline
            minRows={2}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            slotProps={{ htmlInput: { maxLength: 500 } }}
          />
          {send.isError && <Alert severity="error">{errorMessage(send.error)}</Alert>}
          <Button type="submit" variant="contained" loading={send.isPending} sx={{ alignSelf: 'flex-start' }}>
            {t('review.submit')}
          </Button>
        </Stack>
      )}
    </Paper>
  );
}
