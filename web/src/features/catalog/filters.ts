import type { CatalogSort, Lang } from '../../api/types';

/** Фільтри каталогу (UI-02). Зберігаються в рядку адреси, тож пошуком можна поділитися посиланням. */
export interface CatalogFilters {
  q: string;
  category: string;
  certified: boolean;
  minPrice: string;
  maxPrice: string;
  sort: CatalogSort;
  maxKm: number | null;
  /** Товари однієї ферми: перехід із мапи ферм. */
  farmerId: number | null;
}

export interface GeoPoint {
  lat: number;
  lon: number;
}

export const LVIV_CENTER: GeoPoint = { lat: 49.8419, lon: 24.0315 };
export const SORTS: readonly CatalogSort[] = ['Name', 'PriceAsc', 'PriceDesc', 'Distance', 'Rating'];
export const DISTANCES_KM: readonly number[] = [5, 10, 20, 50];

export const DEFAULT_FILTERS: CatalogFilters = {
  q: '',
  category: '',
  certified: false,
  minPrice: '',
  maxPrice: '',
  sort: 'Name',
  maxKm: null,
  farmerId: null,
};

function price(value: string | null): string {
  const text = (value ?? '').trim().replace(',', '.');
  return text !== '' && Number.isFinite(Number(text)) && Number(text) >= 0 ? text : '';
}

export function parseFilters(params: URLSearchParams): CatalogFilters {
  const sort = params.get('sort') as CatalogSort | null;
  const maxKm = Number(params.get('maxKm'));
  const farmerId = Number(params.get('farmerId'));
  return {
    q: params.get('q') ?? '',
    category: params.get('category') ?? '',
    certified: params.get('certified') === 'true',
    minPrice: price(params.get('minPrice')),
    maxPrice: price(params.get('maxPrice')),
    sort: sort && SORTS.includes(sort) ? sort : 'Name',
    maxKm: DISTANCES_KM.includes(maxKm) ? maxKm : null,
    farmerId: Number.isInteger(farmerId) && farmerId > 0 ? farmerId : null,
  };
}

/** Рядок адреси сторінки: лише фільтри, що відрізняються від типових. */
export function toSearchParams(filters: CatalogFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set('q', filters.q);
  if (filters.category) params.set('category', filters.category);
  if (filters.certified) params.set('certified', 'true');
  if (price(filters.minPrice)) params.set('minPrice', price(filters.minPrice));
  if (price(filters.maxPrice)) params.set('maxPrice', price(filters.maxPrice));
  if (filters.sort !== 'Name') params.set('sort', filters.sort);
  if (filters.maxKm !== null) params.set('maxKm', String(filters.maxKm));
  if (filters.farmerId !== null) params.set('farmerId', String(filters.farmerId));
  return params;
}

/** Запит до GET /api/catalog: точка покупця передається завжди, щоб картка показувала відстань до ферми. */
export function toApiQuery(filters: CatalogFilters, from: GeoPoint, lang: Lang): string {
  const params = toSearchParams({ ...filters, q: filters.q.trim() });
  params.set('lat', String(from.lat));
  params.set('lon', String(from.lon));
  params.set('lang', lang);
  return params.toString();
}

export function activeFilterCount(filters: CatalogFilters): number {
  return [...toSearchParams({ ...filters, sort: 'Name' }).keys()].length;
}
