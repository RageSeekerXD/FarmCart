import CancelIcon from '@mui/icons-material/Cancel';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import PlaceIcon from '@mui/icons-material/Place';
import { Box, Button, Chip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { formatNumber, useLang } from '../../i18n';
import type { useBuyerLocation } from './useBuyerLocation';

/** Від якої точки рахується відстань: «Львів, Сихів», «Винники», «Стрий (околиці)» або координати. */
export function useLocationText(location: ReturnType<typeof useBuyerLocation>): string {
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

/**
 * Кнопка «Моє місцезнаходження» і підпис точки відліку поруч із нею. Після визначення місця підпис
 * називає район чи населений пункт, а хрестик повертає відлік від центру Львова.
 */
export function LocationControl({ location }: { location: ReturnType<typeof useBuyerLocation> }) {
  const { t } = useTranslation();
  const text = useLocationText(location);
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
      <Button size="small" startIcon={<MyLocationIcon />} onClick={location.locate} loading={location.locating} loadingPosition="start">
        {t('catalog.useMyLocation')}
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
    </Box>
  );
}
