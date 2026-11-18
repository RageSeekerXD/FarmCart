import type { CatalogSort, DayOfWeek, Lang, SmartSearchResult } from '../../api/types';

/** Фільтри каталогу (UI-02). Зберігаються в рядку адреси, тож пошуком можна поділитися посиланням. */
export interface CatalogFilters {
  q: string;
  category: string;
  certified: boolean;
  minPrice: string;
  maxPrice: string;
  sort: CatalogSort;
  maxKm: number | null;
  /** Товари однієї ферми: старі посилання з мапи ферм (тепер вона веде на сторінку ферми). */
  farmerId: number | null;
  /** Лише обрані товари покупця; фільтрується в браузері, бо обране зберігається там же. */
  favorites: boolean;
  /** Показати й товари, яких зараз немає в наявності (типово - лише ті, що є). */
  soldOut: boolean;
  /** Бажаний день доставки: лише ферми, що возять цього дня (або щодня). */
  day: DayOfWeek | null;
}

export interface GeoPoint {
  lat: number;
  lon: number;
}

export const LVIV_CENTER: GeoPoint = { lat: 49.8419, lon: 24.0315 };
/** Типово - популярні товари: алфавітний порядок покупцеві нічого не підказує. */
export const DEFAULT_SORT: CatalogSort = 'Popular';
export const SORTS: readonly CatalogSort[] = ['Popular', 'Distance', 'Rating', 'PriceAsc', 'PriceDesc', 'Name'];
export const DISTANCES_KM: readonly number[] = [5, 10, 20, 50];
/** Дні тижня від понеділка. */
export const WEEK: readonly DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const DEFAULT_FILTERS: CatalogFilters = {
  q: '',
  category: '',
  certified: false,
  minPrice: '',
  maxPrice: '',
  sort: DEFAULT_SORT,
  maxKm: null,
  farmerId: null,
  favorites: false,
  soldOut: false,
  day: null,
};

function price(value: string | null): string {
  const text = (value ?? '').trim().replace(',', '.');
  return text !== '' && Number.isFinite(Number(text)) && Number(text) >= 0 ? text : '';
}

export function parseFilters(params: URLSearchParams): CatalogFilters {
  const sort = params.get('sort') as CatalogSort | null;
  const maxKm = Number(params.get('maxKm'));
  const farmerId = Number(params.get('farmerId'));
  const day = params.get('day') as DayOfWeek | null;
  return {
    q: params.get('q') ?? '',
    category: params.get('category') ?? '',
    certified: params.get('certified') === 'true',
    minPrice: price(params.get('minPrice')),
    maxPrice: price(params.get('maxPrice')),
    sort: sort && SORTS.includes(sort) ? sort : DEFAULT_SORT,
    maxKm: DISTANCES_KM.includes(maxKm) ? maxKm : null,
    farmerId: Number.isInteger(farmerId) && farmerId > 0 ? farmerId : null,
    favorites: params.get('favorites') === 'true',
    soldOut: params.get('soldOut') === 'true',
    day: day && WEEK.includes(day) ? day : null,
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
  if (filters.sort !== DEFAULT_SORT) params.set('sort', filters.sort);
  if (filters.maxKm !== null) params.set('maxKm', String(filters.maxKm));
  if (filters.farmerId !== null) params.set('farmerId', String(filters.farmerId));
  if (filters.favorites) params.set('favorites', 'true');
  if (filters.soldOut) params.set('soldOut', 'true');
  if (filters.day) params.set('day', filters.day);
  return params;
}

/**
 * Запит до GET /api/catalog: точка покупця передається завжди, щоб картка показувала відстань до ферми;
 * сортування - теж завжди (типове сортування сервера інше). Обране фільтрується в браузері.
 */
export function toApiQuery(filters: CatalogFilters, from: GeoPoint, lang: Lang): string {
  const params = new URLSearchParams();
  const page = toSearchParams({ ...filters, q: filters.q.trim(), favorites: false, soldOut: false, day: null });
  page.forEach((value, key) => params.set(key, value));
  if (filters.soldOut) params.set('includeSoldOut', 'true');
  if (filters.day) params.set('deliveryDay', filters.day);
  params.set('sort', filters.sort);
  params.set('lat', String(from.lat));
  params.set('lon', String(from.lon));
  params.set('lang', lang);
  return params.toString();
}

/** Скільки фільтрів обрано (сортування - не фільтр). */
export function activeFilterCount(filters: CatalogFilters): number {
  return [...toSearchParams({ ...filters, sort: DEFAULT_SORT }).keys()].length;
}

/** Фільтри скинуто, а обране сортування лишається. */
export function withoutFilters(filters: CatalogFilters): CatalogFilters {
  return { ...DEFAULT_FILTERS, sort: filters.sort };
}

/** Новий розумний пошук замінює попередні фільтри; сортування змінюється, лише якщо покупець про нього просив. */
export function filtersFromSmartSearch(result: SmartSearchResult, current: CatalogFilters): CatalogFilters {
  return {
    ...withoutFilters(current),
    q: result.text ?? '',
    category: result.category ?? '',
    certified: result.certified,
    minPrice: result.minPrice === null ? '' : String(result.minPrice),
    maxPrice: result.maxPrice === null ? '' : String(result.maxPrice),
    maxKm: result.maxKm,
    sort: result.sort ?? current.sort,
    day: result.deliveryDay,
  };
}
