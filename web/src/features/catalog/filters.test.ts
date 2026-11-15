import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS, LVIV_CENTER, activeFilterCount, parseFilters, toApiQuery, toSearchParams, withoutFilters } from './filters';

describe('фільтри каталогу', () => {
  it('порожній рядок адреси дає типові фільтри: сортування «спершу популярні»', () => {
    expect(parseFilters(new URLSearchParams())).toEqual(DEFAULT_FILTERS);
    expect(DEFAULT_FILTERS.sort).toBe('Popular');
  });

  it('фільтри читаються з рядка адреси й записуються назад без втрат', () => {
    const params = new URLSearchParams('q=мед&category=honey&certified=true&minPrice=100&maxPrice=300&sort=PriceAsc&maxKm=20&farmerId=3&favorites=true');

    const filters = parseFilters(params);

    expect(filters).toEqual({ q: 'мед', category: 'honey', certified: true, minPrice: '100', maxPrice: '300', sort: 'PriceAsc', maxKm: 20, farmerId: 3, favorites: true });
    expect(toSearchParams(filters).toString()).toBe(params.toString());
  });

  it('старі посилання з сортуванням за назвою працюють', () => {
    expect(parseFilters(new URLSearchParams('sort=Name')).sort).toBe('Name');
    expect(toSearchParams({ ...DEFAULT_FILTERS, sort: 'Name' }).toString()).toBe('sort=Name');
  });

  it('некоректні значення ігноруються', () => {
    const filters = parseFilters(new URLSearchParams('sort=Random&maxKm=7&minPrice=abc&maxPrice=-5&certified=yes&farmerId=x&favorites=1'));

    expect(filters).toEqual(DEFAULT_FILTERS);
  });

  it('ціна з комою перетворюється на число з крапкою', () => {
    expect(parseFilters(new URLSearchParams('minPrice=12,5')).minPrice).toBe('12.5');
  });

  it('типові значення не потрапляють у рядок адреси', () => {
    expect(toSearchParams(DEFAULT_FILTERS).toString()).toBe('');
    expect(toSearchParams({ ...DEFAULT_FILTERS, q: '   ' }).toString()).toBe('');
  });

  it('запит до API завжди містить сортування, точку покупця й мову, а обране не надсилається', () => {
    const query = new URLSearchParams(toApiQuery({ ...DEFAULT_FILTERS, q: ' carrots ', maxKm: 10, favorites: true }, LVIV_CENTER, 'en'));

    expect(Object.fromEntries(query)).toEqual({ q: 'carrots', sort: 'Popular', maxKm: '10', lat: '49.8419', lon: '24.0315', lang: 'en' });
  });

  it('лічильник активних фільтрів не враховує сортування, а враховує обране', () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, sort: 'Rating', certified: true, category: 'dairy' })).toBe(2);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, favorites: true })).toBe(1);
  });

  it('«Скинути фільтри» прибирає фільтри, але лишає обране сортування', () => {
    const reset = withoutFilters({ ...DEFAULT_FILTERS, sort: 'PriceAsc', category: 'dairy', maxKm: 5, favorites: true });

    expect(reset).toEqual({ ...DEFAULT_FILTERS, sort: 'PriceAsc' });
  });
});
