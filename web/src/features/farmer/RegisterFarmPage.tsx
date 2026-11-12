import { Alert, Box, Button, Checkbox, CircularProgress, FormControlLabel, Paper, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Suspense, lazy, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import type { FarmRegistration, FarmerProfile } from '../../api/types';
import { errorMessage } from '../../i18n';
import { useToast } from '../../shared/Toast';
import { useAuth } from '../auth/AuthContext';
import { LVIV_CENTER, type GeoPoint } from '../catalog/filters';

const LocationPicker = lazy(() => import('./LocationPicker'));

const validPoint = (point: GeoPoint) =>
  Number.isFinite(point.lat) && Number.isFinite(point.lon) && Math.abs(point.lat) <= 90 && Math.abs(point.lon) <= 180;

/** UI-08: реєстрація господарства - назва двома мовами, точка на мапі, сертифікат. Далі заявку перевіряє адміністратор. */
export function RegisterFarmPage() {
  const { t } = useTranslation();
  const { roles, setRole } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [nameUk, setNameUk] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [lat, setLat] = useState(String(LVIV_CENTER.lat));
  const [lon, setLon] = useState(String(LVIV_CENTER.lon));
  const [certified, setCertified] = useState(false);
  const [documents, setDocuments] = useState('');
  const [touched, setTouched] = useState(false);

  const register = useMutation({
    mutationFn: (registration: FarmRegistration) => api<FarmerProfile>('/farmers', { method: 'POST', body: registration }),
    onSuccess: async (profile) => {
      queryClient.setQueryData(['farmer', 'profile'], profile);
      // Сервер додав користувачу роль фермера: перечитуємо профіль, щоб відкрився кабінет продавця.
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      setRole('Farmer');
      toast.show(t('farm.registered'));
      void navigate('/farmer/products', { replace: true });
    },
  });

  if (roles.includes('Farmer') && !register.isPending && !register.isSuccess) {
    return <Navigate to="/farmer/products" replace />;
  }

  const point = { lat: Number(lat.replace(',', '.')), lon: Number(lon.replace(',', '.')) };
  const pointOk = lat.trim() !== '' && lon.trim() !== '' && validPoint(point);
  const missing = { uk: nameUk.trim() === '', en: nameEn.trim() === '' };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (missing.uk || missing.en || !pointOk) {
      return;
    }

    register.mutate({
      farmName: { uk: nameUk.trim(), en: nameEn.trim() },
      lat: point.lat,
      lon: point.lon,
      certified,
      documents: documents.trim() || null,
    });
  };

  return (
    <Box component="form" onSubmit={submit} noValidate sx={{ maxWidth: 760, mx: 'auto' }}>
      <Typography component="h1" variant="h4" sx={{ mb: 1, fontSize: { xs: '1.6rem', sm: '2.1rem' } }}>
        {t('farm.registerTitle')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {t('farm.registerIntro')}
      </Typography>

      <Paper sx={{ p: { xs: 1.5, sm: 2.5 } }}>
        <Stack spacing={2}>
          <TextField
            label={t('farm.nameUk')}
            required
            fullWidth
            value={nameUk}
            onChange={(event) => setNameUk(event.target.value)}
            error={touched && missing.uk}
            helperText={touched && missing.uk ? t('farm.nameRequired') : ' '}
            slotProps={{ htmlInput: { lang: 'uk', maxLength: 80 } }}
          />
          <TextField
            label={t('farm.nameEn')}
            required
            fullWidth
            value={nameEn}
            onChange={(event) => setNameEn(event.target.value)}
            error={touched && missing.en}
            helperText={touched && missing.en ? t('farm.nameRequired') : t('farm.nameEnHint')}
            slotProps={{ htmlInput: { lang: 'en', maxLength: 80 } }}
          />

          <Box>
            <Typography id="farm-location" component="h2" variant="subtitle1" sx={{ fontWeight: 600 }}>
              {t('farm.location')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {t('farm.locationHint')}
            </Typography>
            <Box role="group" aria-labelledby="farm-location" sx={{ height: 300, borderRadius: 2, overflow: 'hidden', mb: 1.5, bgcolor: 'action.hover' }}>
              <Suspense
                fallback={
                  <Box sx={{ height: '100%', display: 'grid', placeItems: 'center' }}>
                    <CircularProgress aria-label={t('common.loading')} />
                  </Box>
                }
              >
                <LocationPicker
                  value={pointOk ? point : LVIV_CENTER}
                  onChange={(next) => {
                    setLat(String(next.lat));
                    setLon(String(next.lon));
                  }}
                />
              </Suspense>
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label={t('farm.lat')}
                required
                value={lat}
                onChange={(event) => setLat(event.target.value)}
                error={touched && !pointOk}
                helperText={touched && !pointOk ? t('errors.location_invalid') : ' '}
                slotProps={{ htmlInput: { inputMode: 'decimal' } }}
              />
              <TextField
                label={t('farm.lon')}
                required
                value={lon}
                onChange={(event) => setLon(event.target.value)}
                error={touched && !pointOk}
                slotProps={{ htmlInput: { inputMode: 'decimal' } }}
              />
            </Stack>
          </Box>

          <FormControlLabel
            control={<Checkbox checked={certified} onChange={(event) => setCertified(event.target.checked)} />}
            label={t('farm.certified')}
          />
          <TextField
            label={t('farm.documents')}
            fullWidth
            value={documents}
            onChange={(event) => setDocuments(event.target.value)}
            helperText={t('farm.documentsHint')}
          />

          {register.isError && <Alert severity="error">{errorMessage(register.error)}</Alert>}

          <Button type="submit" variant="contained" size="large" loading={register.isPending}>
            {t('farm.submit')}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
