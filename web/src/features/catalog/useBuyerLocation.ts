import { useCallback, useState } from 'react';
import { LVIV_CENTER, type GeoPoint } from './filters';
import { placeOf, type PlaceName } from './places';

const LOCATION_KEY = 'farmcart.location';

/** Точка покупця; label - адреса, яку покупець обрав сам (без неї назву дає довідник місць). */
interface StoredPoint extends GeoPoint {
  label?: string;
}

function stored(): StoredPoint | null {
  try {
    const point = JSON.parse(localStorage.getItem(LOCATION_KEY) ?? 'null') as Partial<StoredPoint> | null;
    return point && typeof point.lat === 'number' && typeof point.lon === 'number'
      ? { lat: point.lat, lon: point.lon, ...(typeof point.label === 'string' && point.label ? { label: point.label } : {}) }
      : null;
  } catch {
    return null;
  }
}

function remember(point: StoredPoint | null) {
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
 * Точка покупця для відстаней і фільтра «до N км». Типово - центр Львова; власне місцезнаходження береться з браузера
 * лише на прохання користувача, або покупець обирає адресу з підказок. place - назва місця («Львів, Сихів» чи обрана
 * адреса), щоб було видно, від чого рахується відстань.
 */
export function useBuyerLocation() {
  const [mine, setMine] = useState<StoredPoint | null>(stored);
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

  /** Відлік від обраної адреси (підказка вулиці). */
  const choose = useCallback((point: GeoPoint, label: string) => {
    const next = { lat: point.lat, lon: point.lon, label };
    remember(next);
    setMine(next);
    setDenied(false);
  }, []);

  /** Повернутися до центру Львова. */
  const forget = useCallback(() => {
    remember(null);
    setMine(null);
  }, []);

  const place: PlaceName | null = mine ? (mine.label ? { name: { uk: mine.label, en: mine.label }, near: false } : placeOf(mine)) : null;
  const point: GeoPoint = mine ? { lat: mine.lat, lon: mine.lon } : LVIV_CENTER;
  return { point, isMine: mine !== null, place, denied, locating, locate, choose, forget };
}
