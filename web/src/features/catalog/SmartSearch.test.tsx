import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../../test/render';
import { backend } from '../../test/server';
import { DEFAULT_FILTERS, filtersFromSmartSearch } from './filters';

const LABEL = 'Опишіть, що шукаєте';
const SUBMIT = 'Знайти з ШІ';
const nothing = { understood: true, text: null, category: null, certified: false, minPrice: null, maxPrice: null, maxKm: null, sort: null, deliveryDay: null };
const lastRequest = () => backend.catalogRequests.at(-1)!.searchParams;

async function openCatalog() {
  backend.smartSearchAvailable = true;
  const { user } = await renderApp('/', { signedIn: true });
  const field = await screen.findByLabelText(LABEL);
  return { user, field };
}

describe('filtersFromSmartSearch', () => {
  it('переносить усі фільтри запиту', () => {
    const result = { ...nothing, text: 'мед', category: 'honey', certified: true, minPrice: 100, maxPrice: 300.5, maxKm: 20, sort: 'PriceAsc' as const, deliveryDay: 'Saturday' as const };

    expect(filtersFromSmartSearch(result, DEFAULT_FILTERS)).toEqual({
      ...DEFAULT_FILTERS,
      q: 'мед',
      category: 'honey',
      certified: true,
      minPrice: '100',
      maxPrice: '300.5',
      maxKm: 20,
      sort: 'PriceAsc',
      day: 'Saturday',
    });
  });

  it('прибирає попередні фільтри, але лишає сортування, якщо покупець про нього не просив', () => {
    const current = { ...DEFAULT_FILTERS, q: 'сир', certified: true, favorites: true, farmerId: 3, sort: 'Rating' as const };

    expect(filtersFromSmartSearch({ ...nothing, category: 'honey' }, current)).toEqual({ ...DEFAULT_FILTERS, category: 'honey', sort: 'Rating' });
  });
});

describe('AI-3 Розумний пошук у каталозі', () => {
  it('гість бачить лише звичайний пошук', async () => {
    backend.smartSearchAvailable = true;
    await renderApp('/');

    await screen.findByRole('article', { name: 'Морква' });

    expect(screen.queryByLabelText(LABEL)).not.toBeInTheDocument();
  });

  it('без налаштованого сервісу поля немає', async () => {
    await renderApp('/', { signedIn: true });

    await screen.findByRole('article', { name: 'Морква' });

    expect(screen.queryByLabelText(LABEL)).not.toBeInTheDocument();
  });

  it('застосовує підібрані фільтри до каталогу й пояснює, що їх можна змінити', async () => {
    const { user, field } = await openCatalog();
    expect(screen.getByRole('button', { name: SUBMIT })).toBeDisabled();

    await user.type(field, 'свіже молоко{Enter}');

    expect(await screen.findByText(/ШІ підібрав фільтри/)).toBeInTheDocument();
    await waitFor(() => expect(lastRequest().get('category')).toBe('dairy'));
    expect(backend.smartSearchRequests).toEqual(['свіже молоко']);
    expect(await screen.findByRole('article', { name: "Молоко коров'яче" })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('article', { name: 'Морква' })).not.toBeInTheDocument());
  });

  it('підказка зникає, коли покупець сам змінює фільтри', async () => {
    const { user, field } = await openCatalog();
    await user.type(field, 'молоко{Enter}');
    await screen.findByText(/ШІ підібрав фільтри/);

    await user.click(within(screen.getByRole('region', { name: 'Фільтри' })).getByRole('checkbox', { name: /сертифікат/i }));

    await waitFor(() => expect(screen.queryByText(/ШІ підібрав фільтри/)).not.toBeInTheDocument());
  });

  it('незрозумілий запит не змінює фільтри', async () => {
    const { user, field } = await openCatalog();
    backend.smartSearchResult = { ...nothing, understood: false };

    await user.type(field, 'яка погода{Enter}');

    expect(await screen.findByText(/ШІ не зміг підібрати фільтри/)).toBeInTheDocument();
    expect(lastRequest().has('category')).toBe(false);
  });

  it('показує зрозумілу помилку, а каталог лишає без змін', async () => {
    const { user, field } = await openCatalog();
    backend.smartSearchError = 'smart_search_failed';

    await user.type(field, 'мед{Enter}');

    expect(await screen.findByText(/Пошук із ШІ зараз не спрацював/)).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Морква' })).toBeInTheDocument();
  });
});
