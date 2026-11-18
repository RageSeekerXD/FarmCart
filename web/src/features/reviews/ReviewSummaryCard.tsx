import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { Box, Paper, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import type { ReviewSummaryReply } from '../../api/types';
import { useLang } from '../../i18n';
import { useAiAvailable } from '../ai/useAi';

/** Короткий підсумок відгуків від ШІ; якщо відгуків замало чи ШІ недоступний, картки просто немає. */
export function ReviewSummaryCard({ path }: { path: string }) {
  const { t } = useTranslation();
  const { pick, lang } = useLang();
  const available = useAiAvailable();
  const reply = useQuery({
    queryKey: ['review-summary', path],
    queryFn: () => api<ReviewSummaryReply>(path),
    enabled: available,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const summary = reply.data?.summary;
  if (!summary) {
    return null;
  }

  return (
    <Paper component="section" variant="outlined" aria-label={t('ai.summaryTitle')} sx={{ p: 1.5, mb: 2 }}>
      <Typography component="h3" variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
        <AutoAwesomeIcon fontSize="small" color="primary" aria-hidden />
        {t('ai.summaryTitle')}
      </Typography>
      <Box lang={lang}>
        {summary.likes && (
          <Typography variant="body2">
            <strong>{t('ai.summaryLikes')}</strong> {pick(summary.likes)}
          </Typography>
        )}
        {summary.complaints && (
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            <strong>{t('ai.summaryComplaints')}</strong> {pick(summary.complaints)}
          </Typography>
        )}
      </Box>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5 }}>
        {t('ai.summaryNote')}
      </Typography>
    </Paper>
  );
}
