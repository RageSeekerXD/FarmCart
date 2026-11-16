import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, List, ListItem, ListItemIcon, ListItemText, Typography } from '@mui/material';
import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { errorMessage, useLang } from '../../i18n';
import { formatDateTime } from '../../shared/dates';
import { useToast } from '../../shared/Toast';
import { DOCUMENT_MAX_BYTES, DOCUMENT_TYPES, useFarmDocumentChange, useFarmDocuments } from './api';

export function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Документи для верифікації: скани органічного сертифіката, витягу з реєстру тощо. Адміністратор переглядає їх
 * перед рішенням, тож без них заявка довше чекає. Тип і розмір перевіряються ще до надсилання.
 */
export function DocumentsDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { lang } = useLang();
  const toast = useToast();
  const documents = useFarmDocuments();
  const change = useFarmDocumentChange();

  const upload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    if (!DOCUMENT_TYPES.includes(file.type)) {
      toast.show(t('errors.document_type_invalid'), 'error');
      return;
    }

    if (file.size > DOCUMENT_MAX_BYTES) {
      toast.show(t('errors.document_too_large'), 'error');
      return;
    }

    change.mutate({ file }, { onSuccess: () => toast.show(t('farm.documentUploaded', { name: file.name })), onError: (error) => toast.show(errorMessage(error), 'error') });
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="farm-documents-title">
      <DialogTitle id="farm-documents-title">{t('farm.documentsTitle')}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('farm.documentsHint')}
        </Typography>
        {documents.isPending && <CircularProgress size={24} aria-label={t('common.loading')} />}
        {documents.isError && <Alert severity="error">{errorMessage(documents.error)}</Alert>}
        {documents.data?.length === 0 && <Alert severity="warning">{t('farm.noDocuments')}</Alert>}
        {documents.data && documents.data.length > 0 && (
          <List dense aria-label={t('farm.documentsTitle')}>
            {documents.data.map((document) => (
              <ListItem
                key={document.id}
                secondaryAction={
                  <IconButton edge="end" aria-label={t('farm.documentRemove', { name: document.name })} disabled={change.isPending} onClick={() => change.mutate({ removeId: document.id })}>
                    <DeleteOutlineIcon />
                  </IconButton>
                }
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <DescriptionOutlinedIcon />
                </ListItemIcon>
                <ListItemText primary={document.name} secondary={`${formatSize(document.size)} · ${formatDateTime(document.uploadedAt, lang)}`} />
              </ListItem>
            ))}
          </List>
        )}
        <Box sx={{ mt: 2 }}>
          <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} loading={change.isPending}>
            {t('farm.documentUpload')}
            <input hidden type="file" accept={DOCUMENT_TYPES.join(',')} onChange={upload} />
          </Button>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            {t('farm.documentFormats')}
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>{t('common.close')}</Button>
      </DialogActions>
    </Dialog>
  );
}
