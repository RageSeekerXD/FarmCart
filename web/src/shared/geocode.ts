import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { Lang } from '../api/types';

/** Підказка адреси: підпис для покупця й точка на мапі. */
export interface AddressSuggestion {
  label: string;
  lat: number;
  lon: number;
}

/**
 * Підказки адрес - Photon (геокодер на даних OpenStreetMap, підтримує пошук під час набору).
 * Шукаємо в межах Львівщини й поруч зі Львовом; запит іде лише після трьох символів і паузи в наборі.
 */
export const PHOTON_URL = 'https://photon.komoot.io/api/';
const LVIV_REGION_BBOX = '22.6,48.7,25.6,50.7';
const MIN_LENGTH = 3;

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    locality?: string;
    city?: string;
    type?: string;
  };
}

function label(properties: NonNullable<PhotonFeature['properties']>): string {
  const place = properties.street ? [properties.street, properties.housenumber].filter(Boolean).join(', ') : properties.name;
  const area = properties.district ?? properties.locality;
  return [place, area !== place ? area : null, properties.city !== place ? properties.city : null].filter(Boolean).join(', ');
}

export async function suggestAddresses(text: string, lang: Lang, signal?: AbortSignal): Promise<AddressSuggestion[]> {
  const query = text.trim();
  if (query.length < MIN_LENGTH) {
    return [];
  }

  // Photon не має української локалізації назв; «default» - місцеві (українські) назви, «en» - англійські, де є.
  const params = new URLSearchParams({ q: query, limit: '6', lat: '49.8419', lon: '24.0315', bbox: LVIV_REGION_BBOX, lang: lang === 'en' ? 'en' : 'default' });
  const response = await fetch(`${PHOTON_URL}?${params}`, { signal });
  if (!response.ok) {
    return [];
  }

  const body = (await response.json()) as { features?: PhotonFeature[] };
  const seen = new Set<string>();
  return (body.features ?? []).flatMap((feature) => {
    const [lon, lat] = feature.geometry?.coordinates ?? [];
    const text = feature.properties ? label(feature.properties) : '';
    if (lat === undefined || lon === undefined || !text || seen.has(text)) {
      return [];
    }

    seen.add(text);
    return [{ label: text, lat, lon }];
  });
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/** Підказки для поля адреси; збій геокодера не заважає ввести адресу вручну. */
export function useAddressSuggestions(text: string, lang: Lang) {
  const query = useDebounced(text.trim(), 350);
  return useQuery({
    queryKey: ['geocode', lang, query],
    queryFn: ({ signal }) => suggestAddresses(query, lang, signal),
    enabled: query.length >= MIN_LENGTH,
    staleTime: 5 * 60_000,
    retry: false,
  });
}
