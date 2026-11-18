import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { Alert, Box, Button, TextField, Typography } from '@mui/material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import type { SmartSearchResult, SmartSearchStatus } from '../../api/types';
import { errorMessage } from '../../i18n';
import { useAuth } from '../auth/AuthContext';

const MAX_LENGTH = 200;

interface Props {
  /** Поточні фільтри в рядку адреси: підказка зникає, щойно покупець змінить підібрані фільтри. */
  current: string;
  /** Застосовує фільтри й повертає новий рядок адреси. */
  onResult: (result: SmartSearchResult) => string;
}

/** Пошук своїми словами: ШІ лише підбирає фільтри, а товари показує звичайний каталог. Кожен запит платний, тому - після входу. */
export function SmartSearch({ current, onResult }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [appliedTo, setAppliedTo] = useState<string | null>(null);

  const status = useQuery({
    queryKey: ['smart-search'],
    queryFn: () => api<SmartSearchStatus>('/catalog/smart-search'),
    enabled: user !== null,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const search = useMutation({
    mutationFn: (query: string) => api<SmartSearchResult>('/catalog/smart-search', { method: 'POST', body: { query } }),
    onSuccess: (result) => setAppliedTo(result.understood ? onResult(result) : null),
  });

  if (user === null || !status.data?.available) {
    return null;
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (text.trim() !== '') {
      search.mutate(text.trim());
    }
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Box component="form" role="search" onSubmit={submit} sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: '1fr auto' }, alignItems: 'start' }}>
        <TextField
          label={t('catalog.smartLabel')}
          placeholder={t('catalog.smartPlaceholder')}
          size="small"
          value={text}
          onChange={(event) => setText(event.target.value)}
          slotProps={{ htmlInput: { maxLength: MAX_LENGTH }, inputLabel: { shrink: true } }}
        />
        <Button type="submit" variant="contained" startIcon={<AutoAwesomeIcon />} disabled={text.trim() === ''} loading={search.isPending}>
          {t('catalog.smartSubmit')}
        </Button>
      </Box>
      <Box aria-live="polite">
        {search.isError && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {errorMessage(search.error)}
          </Alert>
        )}
        {search.isSuccess && !search.data.understood && (
          <Alert severity="info" sx={{ mt: 1 }}>
            {t('catalog.smartNotUnderstood')}
          </Alert>
        )}
        {search.isSuccess && search.data.understood && appliedTo === current && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            {t('catalog.smartApplied')}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
