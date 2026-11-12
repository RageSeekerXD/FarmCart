import { Box, Button, CircularProgress, Paper, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, Navigate, useLocation } from 'react-router-dom';
import type { Role } from '../api/types';
import { useAuth } from '../features/auth/AuthContext';

function Message({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Paper sx={{ p: 4, textAlign: 'center', maxWidth: 560, mx: 'auto', mt: 4 }}>
      <Typography component="h1" variant="h5" gutterBottom>
        {title}
      </Typography>
      {children}
    </Paper>
  );
}

function ToCatalog() {
  const { t } = useTranslation();
  return (
    <Button component={RouterLink} to="/" variant="contained" sx={{ mt: 2 }}>
      {t('common.toCatalog')}
    </Button>
  );
}

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <Message title={t('common.notFoundTitle')}>
      <ToCatalog />
    </Message>
  );
}

/** Маршрут за роллю: гість іде на вхід і повертається назад, інша роль бачить пояснення. */
export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { t } = useTranslation();
  const auth = useAuth();
  const location = useLocation();

  if (auth.loading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
        <CircularProgress aria-label={t('common.loading')} />
      </Box>
    );
  }

  if (!auth.user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (auth.role !== role) {
    return (
      <Message title={t('common.forbiddenTitle')}>
        <ToCatalog />
      </Message>
    );
  }

  return children;
}
