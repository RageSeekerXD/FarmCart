import { useCallback, useState } from 'react';
import { LVIV_CENTER, type GeoPoint } from './filters';

const LOCATION_KEY = 'farmcart.location';

function stored(): GeoPoint | null {
  try {
    const point = JSON.parse(localStorage.getItem(LOCATION_KEY) ?? 'null') as Partial<GeoPoint> | null;
    return point && typeof point.lat === 'number' && typeof point.lon === 'number' ? { lat: point.lat, lon: point.lon } : null;
  } catch {
    return null;
  }
}

/**
 * Точка покупця для відстаней і фільтра «до N км». Типово - центр Львова;
 * власне місцезнаходження береться з браузера лише на прохання користувача.
 */
export function useBuyerLocation() {
  const [mine, setMine] = useState<GeoPoint | null>(stored);
  const [denied, setDenied] = useState(false);

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setDenied(true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = { lat: position.coords.latitude, lon: position.coords.longitude };
        localStorage.setItem(LOCATION_KEY, JSON.stringify(point));
        setMine(point);
        setDenied(false);
      },
      () => setDenied(true),
      { timeout: 10_000 },
    );
  }, []);

  return { point: mine ?? LVIV_CENTER, isMine: mine !== null, denied, locate };
}
