import { alpha, Box, Button, CircularProgress, Paper, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, Navigate, useLocation } from 'react-router-dom';
import type { Role } from '../api/types';
import { useAuth } from '../features/auth/AuthContext';

/** Порожній стан: велика піктограма, пояснення й наступна дія замість голого рядка тексту. */
export function EmptyState({ icon, title, hint, action }: { icon: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <Paper sx={{ p: { xs: 3, sm: 5 }, textAlign: 'center' }}>
      <Box
        aria-hidden
        sx={{
          width: 72,
          height: 72,
          mx: 'auto',
          mb: 2,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          color: 'primary.main',
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
          '& svg': { fontSize: 36 },
        }}
      >
        {icon}
      </Box>
      <Typography component="p" variant="h6" sx={{ mb: hint ? 0.5 : 2 }}>
        {title}
      </Typography>
      {hint && (
        <Typography color="text.secondary" sx={{ mb: 2.5, maxWidth: 420, mx: 'auto' }}>
          {hint}
        </Typography>
      )}
      {action}
    </Paper>
  );
}

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
