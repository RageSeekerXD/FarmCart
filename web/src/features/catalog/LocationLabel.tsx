import CancelIcon from '@mui/icons-material/Cancel';
import EditLocationAltOutlinedIcon from '@mui/icons-material/EditLocationAltOutlined';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import PlaceIcon from '@mui/icons-material/Place';
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatNumber, useLang } from '../../i18n';
import { AddressAutocomplete } from '../../shared/AddressAutocomplete';
import type { AddressSuggestion } from '../../shared/geocode';
import type { useBuyerLocation } from './useBuyerLocation';

type BuyerLocation = ReturnType<typeof useBuyerLocation>;

/** Від якої точки рахується відстань: «Львів, Сихів», обрана адреса, «Стрий (околиці)» або координати. */
export function useLocationText(location: BuyerLocation): string {
  const { t } = useTranslation();
  const { lang, pick } = useLang();
  if (!location.isMine) {
    return t('catalog.locationLviv');
  }

  if (!location.place) {
    const coordinates = `${formatNumber(location.point.lat, lang, 3)}°, ${formatNumber(location.point.lon, lang, 3)}°`;
    return t('catalog.distanceFrom', { place: coordinates });
  }

  const place = pick(location.place.name);
  return t('catalog.distanceFrom', { place: location.place.near ? t('catalog.placeArea', { place }) : place });
}

/** Вибір точки відліку за адресою: вулиця з підказок OpenStreetMap або визначення місця одним натисканням. */
function ChooseAddressDialog({ location, onClose }: { location: BuyerLocation; onClose: () => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const pick = (suggestion: AddressSuggestion) => {
    location.choose({ lat: suggestion.lat, lon: suggestion.lon }, suggestion.label);
    onClose();
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="choose-address-title">
      <DialogTitle id="choose-address-title">{t('catalog.chooseAddressTitle')}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('catalog.chooseAddressHint')}
        </Typography>
        <AddressAutocomplete value={text} onChange={setText} onPick={pick} label={t('catalog.street')} autoFocus helperText={t('address.osmCredit')} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Button
          startIcon={<MyLocationIcon />}
          onClick={() => {
            location.locate();
            onClose();
          }}
          sx={{ mr: 'auto' }}
        >
          {t('catalog.useMyLocation')}
        </Button>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * «Моє місцезнаходження», «Вказати адресу» й підпис точки відліку поруч. Після вибору підпис називає район, місто
 * або обрану вулицю, а хрестик повертає відлік від центру Львова.
 */
export function LocationControl({ location }: { location: BuyerLocation }) {
  const { t } = useTranslation();
  const text = useLocationText(location);
  const [choosing, setChoosing] = useState(false);
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
      <Button size="small" startIcon={<MyLocationIcon />} onClick={location.locate} loading={location.locating} loadingPosition="start">
        {t('catalog.useMyLocation')}
      </Button>
      <Button size="small" startIcon={<EditLocationAltOutlinedIcon />} onClick={() => setChoosing(true)}>
        {t('catalog.chooseAddress')}
      </Button>
      <Chip
        aria-live="polite"
        icon={<PlaceIcon />}
        label={text}
        color={location.isMine ? 'primary' : 'default'}
        variant="outlined"
        onDelete={location.isMine ? location.forget : undefined}
        deleteIcon={<CancelIcon aria-label={t('catalog.locationReset')} />}
        sx={{ fontWeight: 600, maxWidth: '100%', '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }}
      />
      {choosing && <ChooseAddressDialog location={location} onClose={() => setChoosing(false)} />}
    </Box>
  );
}
