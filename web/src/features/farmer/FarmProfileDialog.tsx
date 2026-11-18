import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, FormHelperText, FormLabel, Stack, TextField } from '@mui/material';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { DayOfWeek, FarmerProfile } from '../../api/types';
import { errorMessage, useLang } from '../../i18n';
import { dayName } from '../../shared/dates';
import { WEEK } from '../catalog/filters';
import { useTranslateProduct, useTranslationStatus, useUpdateFarmProfile } from './api';
import { missingTranslations } from './ProductDialog';

/**
 * Профіль ферми для покупців: історія господарства обома мовами (сторінка ферми й товару) і дні, коли ферма возить
 * замовлення (фільтр каталогу «день доставки»). Жоден день не обрано - ферма возить щодня.
 */
export function FarmProfileDialog({ profile, onClose, onSaved }: { profile: FarmerProfile; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const { lang } = useLang();
  const save = useUpdateFarmProfile();
  const translationStatus = useTranslationStatus();
  const translate = useTranslateProduct();
  const [storyUk, setStoryUk] = useState(profile.story?.uk ?? '');
  const [storyEn, setStoryEn] = useState(profile.story?.en ?? '');
  const [days, setDays] = useState<DayOfWeek[]>(profile.deliveryDays);
  const [touched, setTouched] = useState(false);
  const incomplete = (storyUk.trim() === '') !== (storyEn.trim() === '');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (incomplete) {
      return;
    }

    save.mutate({ story: { uk: storyUk.trim(), en: storyEn.trim() }, deliveryDays: days }, { onSuccess: onSaved });
  };

  const toggle = (day: DayOfWeek) => setDays((current) => (current.includes(day) ? current.filter((item) => item !== day) : [...current, day]));

  const missing = missingTranslations({ story: { uk: storyUk, en: storyEn } });

  /** Переклад заповнює лише порожнє поле: поки сервер відповідав, фермер міг ввести текст сам. */
  const translateStory = () =>
    translate.mutate(missing, {
      onSuccess: ({ items }) =>
        items.forEach(({ targetLang, text }) => (targetLang === 'uk' ? setStoryUk : setStoryEn)((current) => (current.trim() === '' ? text : current))),
    });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="farm-profile-title">
      <form onSubmit={submit} noValidate>
        <DialogTitle id="farm-profile-title">{t('farm.profileTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label={t('farm.storyUk')}
              multiline
              minRows={3}
              value={storyUk}
              onChange={(event) => setStoryUk(event.target.value)}
              error={touched && incomplete && storyUk.trim() === ''}
              slotProps={{ htmlInput: { maxLength: 1200 } }}
            />
            <TextField
              label={t('farm.storyEn')}
              multiline
              minRows={3}
              value={storyEn}
              onChange={(event) => setStoryEn(event.target.value)}
              error={touched && incomplete && storyEn.trim() === ''}
              slotProps={{ htmlInput: { maxLength: 1200, lang: 'en' } }}
            />
            <FormHelperText error={touched && incomplete} sx={{ mt: '-8px !important', mx: 1.75 }}>
              {touched && incomplete ? t('errors.story_incomplete') : t('farm.storyHint')}
            </FormHelperText>
            <Box component="fieldset" sx={{ border: 0, p: 0, m: 0 }}>
              <FormLabel component="legend">{t('farm.deliveryDays')}</FormLabel>
              <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
                {WEEK.map((day) => (
                  <FormControlLabel key={day} control={<Checkbox checked={days.includes(day)} onChange={() => toggle(day)} />} label={dayName(day, lang, 'short')} />
                ))}
              </Box>
              <FormHelperText>{t('farm.deliveryDaysHint')}</FormHelperText>
            </Box>
            {save.isError && <Alert severity="error">{errorMessage(save.error)}</Alert>}
            {translate.isError && <Alert severity="error">{errorMessage(translate.error)}</Alert>}
            {translate.isSuccess && <Alert severity="info">{t('ai.storyReview')}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', rowGap: 1 }}>
          {translationStatus.data?.available && (
            <Button variant="outlined" onClick={translateStory} disabled={missing.length === 0} loading={translate.isPending} sx={{ mr: 'auto' }}>
              {t('farm.translate')}
            </Button>
          )}
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" variant="contained" loading={save.isPending}>
            {t('common.save')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
