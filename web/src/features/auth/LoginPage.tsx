import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import type { CodeResponse, SessionResponse } from '../../api/types';
import { errorMessage } from '../../i18n';
import { EASE_OUT, EASE_SPRING, fadeUp, float, popIn } from '../../shared/motion';
import { useToast } from '../../shared/Toast';
import { ROLE_HOME, useAuth } from './AuthContext';
import { DemoAccountButtons } from './DemoAccounts';

/** Продукти розкладено по краях вітрини (праворуч і внизу), щоб вони не накривали текст ліворуч. */
const PRODUCE = [
  { icon: '🥕', top: '7%', left: '52%', delay: 0 },
  { icon: '🍎', top: '18%', left: '82%', delay: 600 },
  { icon: '🥖', top: '42%', left: '86%', delay: 900 },
  { icon: '🧀', top: '64%', left: '80%', delay: 1200 },
  { icon: '🍓', top: '84%', left: '64%', delay: 1500 },
  { icon: '🍯', top: '86%', left: '30%', delay: 300 },
];

const FEATURES = ['feature1', 'feature2', 'feature3'] as const;

/** Вітрина поруч із формою входу (лише на широкому екрані): назва, гасло, три переваги й «плаваючі» продукти. */
function Hero() {
  const { t } = useTranslation();
  return (
    <Box
      aria-hidden
      sx={(theme) => ({
        display: { xs: 'none', md: 'flex' },
        position: 'relative',
        overflow: 'hidden',
        flexDirection: 'column',
        justifyContent: 'center',
        p: 5,
        borderRadius: 4,
        color: '#fff',
        minHeight: 460,
        background: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.12) 1px, transparent 0) 0 0 / 20px 20px, ${theme.brand.gradient}`,
        boxShadow: 4,
        animation: `${fadeUp} 600ms ${EASE_OUT} backwards`,
      })}
    >
      {PRODUCE.map((item) => (
        <Box
          key={item.icon}
          component="span"
          sx={{
            position: 'absolute',
            top: item.top,
            left: item.left,
            fontSize: 40,
            opacity: 0.9,
            filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.2))',
            animation: `${popIn} 500ms ${EASE_SPRING} ${item.delay / 3}ms backwards, ${float} ${5 + item.delay / 600}s ease-in-out ${item.delay}ms infinite`,
          }}
        >
          {item.icon}
        </Box>
      ))}
      <Box sx={{ position: 'relative', maxWidth: 360 }}>
        <Typography sx={{ fontSize: 56, lineHeight: 1, mb: 1.5 }}>🧺</Typography>
        <Typography variant="h4" component="p" sx={{ fontWeight: 800, mb: 1 }}>
          {t('app.name')}
        </Typography>
        <Typography sx={{ opacity: 0.92, mb: 3, fontSize: '1.1rem' }}>{t('app.tagline')}</Typography>
        <Stack spacing={1.25}>
          {FEATURES.map((key, index) => (
            <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1, animation: `${fadeUp} 500ms ${EASE_OUT} ${300 + index * 120}ms backwards` }}>
              <CheckCircleRoundedIcon sx={{ color: 'secondary.main' }} />
              <Typography sx={{ fontWeight: 500 }}>{t(`auth.${key}`)}</Typography>
            </Box>
          ))}
        </Stack>
      </Box>
    </Box>
  );
}

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
    <Box
      sx={{
        display: 'grid',
        gap: 3,
        gridTemplateColumns: { xs: 'minmax(0, 440px)', md: 'minmax(0, 1fr) 440px' },
        justifyContent: 'center',
        alignItems: 'center',
        maxWidth: 980,
        mx: 'auto',
        pt: { xs: 1, sm: 4 },
      }}
    >
      <Hero />
      <Paper sx={{ p: { xs: 2.5, sm: 4 }, width: '100%', boxShadow: 4 }}>
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
