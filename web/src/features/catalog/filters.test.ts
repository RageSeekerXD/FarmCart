import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS, LVIV_CENTER, activeFilterCount, parseFilters, toApiQuery, toSearchParams } from './filters';

describe('фільтри каталогу', () => {
  it('порожній рядок адреси дає типові фільтри', () => {
    expect(parseFilters(new URLSearchParams())).toEqual(DEFAULT_FILTERS);
  });

  it('фільтри читаються з рядка адреси й записуються назад без втрат', () => {
    const params = new URLSearchParams('q=мед&category=honey&certified=true&minPrice=100&maxPrice=300&sort=PriceAsc&maxKm=20&farmerId=3');

    const filters = parseFilters(params);

    expect(filters).toEqual({ q: 'мед', category: 'honey', certified: true, minPrice: '100', maxPrice: '300', sort: 'PriceAsc', maxKm: 20, farmerId: 3 });
    expect(toSearchParams(filters).toString()).toBe(params.toString());
  });

  it('некоректні значення ігноруються', () => {
    const filters = parseFilters(new URLSearchParams('sort=Random&maxKm=7&minPrice=abc&maxPrice=-5&certified=yes&farmerId=x'));

    expect(filters).toEqual(DEFAULT_FILTERS);
  });

  it('ціна з комою перетворюється на число з крапкою', () => {
    expect(parseFilters(new URLSearchParams('minPrice=12,5')).minPrice).toBe('12.5');
  });

  it('типові значення не потрапляють у рядок адреси', () => {
    expect(toSearchParams(DEFAULT_FILTERS).toString()).toBe('');
    expect(toSearchParams({ ...DEFAULT_FILTERS, q: '   ' }).toString()).toBe('');
  });

  it('запит до API завжди містить точку покупця й мову', () => {
    const query = new URLSearchParams(toApiQuery({ ...DEFAULT_FILTERS, q: ' carrots ', maxKm: 10, sort: 'Distance' }, LVIV_CENTER, 'en'));

    expect(Object.fromEntries(query)).toEqual({ q: 'carrots', sort: 'Distance', maxKm: '10', lat: '49.8419', lon: '24.0315', lang: 'en' });
  });

  it('лічильник активних фільтрів не враховує сортування', () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, sort: 'Rating', certified: true, category: 'dairy' })).toBe(2);
  });
});
