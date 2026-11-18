import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, List, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, apiBlob } from '../../api/client';
import type { DocumentCheck, FarmDocument, FarmerProfile } from '../../api/types';
import { errorMessage, useLang } from '../../i18n';
import { formatDateTime } from '../../shared/dates';
import { useAiAvailable } from '../ai/useAi';
import { formatSize } from '../farmer/DocumentsDialog';

/** Вміст документа як адреса blob: - його можна показати в img чи iframe; адреса звільняється, щойно документ закрито. */
function useDocumentUrl(farmerId: number, document: FarmDocument | null) {
  const file = useQuery({
    queryKey: ['admin', 'document', farmerId, document?.id],
    queryFn: ({ signal }) => apiBlob(`/admin/farmers/${farmerId}/documents/${document!.id}`, signal),
    enabled: document !== null,
    staleTime: Infinity,
  });
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file.data || typeof URL.createObjectURL !== 'function') {
      return;
    }

    const next = URL.createObjectURL(file.data);
    setUrl(next);
    return () => {
      URL.revokeObjectURL(next);
      setUrl(null);
    };
  }, [file.data]);
  return { url, pending: file.isFetching, error: file.error };
}

/**
 * Попередня перевірка ШІ: документ надсилається зовнішньому сервісу лише після натискання кнопки.
 * Це підказка: рішення про верифікацію завжди приймає адміністратор.
 */
function DocumentAiCheck({ farmerId, document }: { farmerId: number; document: FarmDocument }) {
  const { t } = useTranslation();
  const { pick } = useLang();
  const [results, setResults] = useState<Record<number, DocumentCheck>>({});
  const check = useMutation({
    mutationFn: (documentId: number) => api<DocumentCheck>(`/admin/farmers/${farmerId}/documents/${documentId}/check`, { method: 'POST', body: {} }),
    onSuccess: (result, documentId) => setResults((current) => ({ ...current, [documentId]: result })),
  });
  const result = results[document.id];
  const facts: [string, string | null][] = result
    ? [
        [t('ai.documentKind'), result.kind ? pick(result.kind) : null],
        [t('ai.documentHolder'), result.holderName],
        [t('ai.documentNumber'), result.number],
        [t('ai.documentIssued'), result.issuedOn],
        [t('ai.documentValid'), result.validUntil],
      ]
    : [];

  return (
    <Box component="section" aria-label={t('ai.documentTitle')} aria-live="polite" sx={{ mt: 2, p: 1.5, border: 1, borderColor: 'divider', borderRadius: 2 }}>
      {!result && (
        <>
          <Button variant="outlined" startIcon={<AutoAwesomeIcon />} loading={check.isPending} onClick={() => check.mutate(document.id)}>
            {t('ai.documentCheck')}
          </Button>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            {t('ai.documentNotice')}
          </Typography>
        </>
      )}
      {check.isError && check.variables === document.id && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {errorMessage(check.error)}
        </Alert>
      )}
      {result && (
        <>
          <Typography component="h3" variant="subtitle2" sx={{ mb: 0.5 }}>
            {t('ai.documentTitle')}
          </Typography>
          <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 0.25 }}>
            {facts.map(([label, value]) => (
              <Box key={label} sx={{ display: 'contents' }}>
                <Typography component="dt" variant="body2" color="text.secondary">
                  {label}
                </Typography>
                <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: 'anywhere' }}>
                  {value ?? t('ai.documentUnreadable')}
                </Typography>
              </Box>
            ))}
          </Box>
          {result.concerns.length > 0 ? (
            <Alert severity="warning" sx={{ mt: 1 }}>
              <Box component="ul" sx={{ m: 0, pl: 2 }}>
                {result.concerns.map((concern) => (
                  <li key={concern.en}>{pick(concern)}</li>
                ))}
              </Box>
            </Alert>
          ) : (
            <Alert severity="success" sx={{ mt: 1 }}>
              {t('ai.documentNoConcerns')}
            </Alert>
          )}
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.75 }}>
            {t('ai.documentDecision')}
          </Typography>
        </>
      )}
    </Box>
  );
}

/**
 * Скани документів продавця під час верифікації: список ліворуч, перегляд праворуч - зображення як є, PDF у вбудованому
 * переглядачі браузера. Документи бачить лише адміністратор; браузер їх не кешує.
 */
export function DocumentsViewer({ farmer, onClose }: { farmer: FarmerProfile; onClose: () => void }) {
  const { t } = useTranslation();
  const { lang, pick } = useLang();
  const documents = useQuery({
    queryKey: ['admin', 'documents', farmer.id],
    queryFn: () => api<FarmDocument[]>(`/admin/farmers/${farmer.id}/documents`),
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = documents.data?.find((item) => item.id === selectedId) ?? documents.data?.[0] ?? null;
  const preview = useDocumentUrl(farmer.id, selected);
  const aiAvailable = useAiAvailable();

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md" aria-labelledby="farm-docs-title">
      <DialogTitle id="farm-docs-title">{t('admin.documentsTitle', { name: pick(farmer.name) })}</DialogTitle>
      <DialogContent>
        {documents.isPending && <CircularProgress aria-label={t('common.loading')} />}
        {documents.isError && <Alert severity="error">{errorMessage(documents.error)}</Alert>}
        {documents.data?.length === 0 && <Alert severity="warning">{t('admin.noDocuments')}</Alert>}
        {documents.data && documents.data.length > 0 && (
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '240px 1fr' }, alignItems: 'start' }}>
            <List dense aria-label={t('admin.documentsList')} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 0.5 }}>
              {documents.data.map((document) => (
                <ListItemButton key={document.id} selected={document.id === selected?.id} onClick={() => setSelectedId(document.id)} sx={{ borderRadius: 1.5 }}>
                  <ListItemIcon sx={{ minWidth: 34 }}>
                    <DescriptionOutlinedIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary={document.name} secondary={`${formatSize(document.size)} · ${formatDateTime(document.uploadedAt, lang)}`} />
                </ListItemButton>
              ))}
            </List>
            <Box
              role="region"
              aria-label={selected ? t('admin.documentPreview', { name: selected.name }) : undefined}
              sx={{ minHeight: 420, border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.default', display: 'grid', placeItems: 'center', overflow: 'hidden' }}
            >
              {preview.pending && <CircularProgress aria-label={t('common.loading')} />}
              {preview.error && <Alert severity="error">{errorMessage(preview.error)}</Alert>}
              {selected && preview.url && selected.contentType.startsWith('image/') && (
                <Box component="img" src={preview.url} alt={selected.name} sx={{ maxWidth: '100%', maxHeight: '70vh', display: 'block' }} />
              )}
              {selected && preview.url && selected.contentType === 'application/pdf' && (
                <Box component="iframe" src={preview.url} title={selected.name} sx={{ width: '100%', height: '70vh', border: 0 }} />
              )}
            </Box>
          </Box>
        )}
        {aiAvailable && selected && <DocumentAiCheck farmerId={farmer.id} document={selected} />}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {selected && preview.url && (
          <Button href={preview.url} target="_blank" rel="noopener noreferrer" endIcon={<OpenInNewIcon fontSize="small" />} sx={{ mr: 'auto' }}>
            {t('admin.openDocument')}
          </Button>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
          {documents.data ? t('admin.documentsCount', { count: documents.data.length }) : ''}
        </Typography>
        <Button onClick={onClose}>{t('common.close')}</Button>
      </DialogActions>
    </Dialog>
  );
}
