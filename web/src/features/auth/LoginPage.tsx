import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import type { CodeResponse, SessionResponse } from '../../api/types';
import { errorMessage } from '../../i18n';
import { useToast } from '../../shared/Toast';
import { ROLE_HOME, useAuth } from './AuthContext';
import { DemoAccountButtons } from './DemoAccounts';

/** UI-01: вхід за номером телефону з одноразовим кодом. У режимі розробки API повертає код (devCode). */
export function LoginPage() {
  const { t } = useTranslation();
  const { user, role, signIn } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const [phone, setPhone] = useState('+380');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState<CodeResponse | null>(null);

  const requestCode = useMutation({
    mutationFn: () => api<CodeResponse>('/auth/code', { method: 'POST', body: { phone: phone.trim() } }),
    onSuccess: (response) => {
      setSent(response);
      setCode('');
    },
  });

  const verify = useMutation({
    mutationFn: () => api<SessionResponse>('/auth/verify', { method: 'POST', body: { phone: phone.trim(), code: code.trim() } }),
    onSuccess: (response) => {
      signIn(response);
      toast.show(t(response.isNewUser ? 'auth.welcomeNew' : 'auth.welcomeBack'));
      void navigate(from ?? '/', { replace: true });
    },
  });

  if (user && !verify.isSuccess) {
    return <Navigate to={from ?? ROLE_HOME[role]} replace />;
  }

  const submitPhone = (event: FormEvent) => {
    event.preventDefault();
    verify.reset();
    requestCode.mutate();
  };

  const submitCode = (event: FormEvent) => {
    event.preventDefault();
    verify.mutate();
  };

  const error = sent ? verify.error : requestCode.error;

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', pt: { xs: 1, sm: 6 } }}>
      <Paper sx={{ p: { xs: 2.5, sm: 4 }, width: '100%', maxWidth: 440 }} elevation={2}>
        <Typography component="h1" variant="h5" gutterBottom>
          {t('auth.title')}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {t('auth.subtitle')}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errorMessage(error)}
          </Alert>
        )}

        {!sent ? (
          <Stack component="form" spacing={2} onSubmit={submitPhone} noValidate>
            <TextField
              label={t('auth.phone')}
              helperText={t('auth.phoneHint')}
              type="tel"
              autoComplete="tel"
              autoFocus
              required
              fullWidth
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
            <Button type="submit" variant="contained" size="large" loading={requestCode.isPending}>
              {t('auth.requestCode')}
            </Button>
          </Stack>
        ) : (
          <Stack component="form" spacing={2} onSubmit={submitCode} noValidate>
            <Typography>{t('auth.codeSentTo', { phone: phone.trim() })}</Typography>
            {sent.devCode && (
              <Alert
                severity="info"
                action={
                  <Button color="inherit" size="small" onClick={() => setCode(sent.devCode ?? '')}>
                    {t('auth.fillCode')}
                  </Button>
                }
              >
                {t('auth.devCode', { code: sent.devCode })}
              </Alert>
            )}
            <TextField
              label={t('auth.code')}
              autoComplete="one-time-code"
              autoFocus
              required
              fullWidth
              value={code}
              onChange={(event) => setCode(event.target.value)}
              slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 6 } }}
            />
            <Button type="submit" variant="contained" size="large" loading={verify.isPending} disabled={code.trim() === ''}>
              {t('auth.verify')}
            </Button>
            <Button
              onClick={() => {
                setSent(null);
                verify.reset();
              }}
            >
              {t('auth.changePhone')}
            </Button>
          </Stack>
        )}
        <DemoAccountButtons />
      </Paper>
    </Box>
  );
}
