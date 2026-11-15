import { useCallback, useState } from 'react';
import { LVIV_CENTER, type GeoPoint } from './filters';
import { placeOf, type PlaceName } from './places';

const LOCATION_KEY = 'farmcart.location';

function stored(): GeoPoint | null {
  try {
    const point = JSON.parse(localStorage.getItem(LOCATION_KEY) ?? 'null') as Partial<GeoPoint> | null;
    return point && typeof point.lat === 'number' && typeof point.lon === 'number' ? { lat: point.lat, lon: point.lon } : null;
  } catch {
    return null;
  }
}

function remember(point: GeoPoint | null) {
  try {
    if (point) {
      localStorage.setItem(LOCATION_KEY, JSON.stringify(point));
    } else {
      localStorage.removeItem(LOCATION_KEY);
    }
  } catch {
    // Сховище недоступне: точка діє до перезавантаження сторінки.
  }
}

/**
 * Точка покупця для відстаней і фільтра «до N км». Типово - центр Львова;
 * власне місцезнаходження береться з браузера лише на прохання користувача.
 * place - назва визначеного місця («Львів, Сихів»), щоб покупець бачив, від чого рахується відстань.
 */
export function useBuyerLocation() {
  const [mine, setMine] = useState<GeoPoint | null>(stored);
  const [denied, setDenied] = useState(false);
  const [locating, setLocating] = useState(false);

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setDenied(true);
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = { lat: position.coords.latitude, lon: position.coords.longitude };
        remember(point);
        setMine(point);
        setDenied(false);
        setLocating(false);
      },
      () => {
        setDenied(true);
        setLocating(false);
      },
      { timeout: 10_000 },
    );
  }, []);

  /** Повернутися до центру Львова. */
  const forget = useCallback(() => {
    remember(null);
    setMine(null);
  }, []);

  const place: PlaceName | null = mine ? placeOf(mine) : null;
  return { point: mine ?? LVIV_CENTER, isMine: mine !== null, place, denied, locating, locate, forget };
}
