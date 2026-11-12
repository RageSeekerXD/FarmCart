import type { FarmOnMap } from '../../api/types';
import type { GeoPoint } from '../catalog/filters';

const EARTH_RADIUS_KM = 6371;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Відстань між точками за формулою гаверсинуса - та сама, що й на сервері (GeoPoint.DistanceKmTo). */
export function distanceKm(from: GeoPoint, to: GeoPoint): number {
  const dLat = toRadians(to.lat - from.lat);
  const dLon = toRadians(to.lon - from.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Ферми в радіусі від покупця, від найближчої; без радіуса - усі. Ферми без відстані йдуть останніми. */
export function farmsWithin(farms: readonly FarmOnMap[], maxKm: number | null): FarmOnMap[] {
  return farms
    .filter((farm) => maxKm === null || (farm.distanceKm !== null && farm.distanceKm <= maxKm))
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) || a.id - b.id);
}

export type Bounds = [[number, number], [number, number]];

/** Прямокутник [[південь, захід], [північ, схід]], у який мапа вміщує покупця й ферми; з радіусом - і його коло. */
export function boundsOf(center: GeoPoint, farms: readonly FarmOnMap[], radiusKm: number | null): Bounds {
  const points: GeoPoint[] = [center, ...farms.map((farm) => ({ lat: farm.lat, lon: farm.lon }))];
  if (radiusKm !== null) {
    const dLat = radiusKm / 111.32;
    const dLon = radiusKm / (111.32 * Math.cos(toRadians(center.lat)));
    points.push({ lat: center.lat - dLat, lon: center.lon - dLon }, { lat: center.lat + dLat, lon: center.lon + dLon });
  }

  const lats = points.map((point) => point.lat);
  const lons = points.map((point) => point.lon);
  return [
    [Math.min(...lats), Math.min(...lons)],
    [Math.max(...lats), Math.max(...lons)],
  ];
}
