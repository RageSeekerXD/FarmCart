import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { CYRILLIC, renderApp } from '../../test/render';
import { backend, farms, server } from '../../test/server';
import { LVIV_CENTER } from '../catalog/filters';
import type { FarmMapViewProps } from './FarmMapView';
import { boundsOf, distanceKm, farmsWithin } from './geo';

// Картинку Leaflet автотести не перевіряють: замість неї - проста розмітка з тими самими властивостями.
vi.mock('./FarmMapView', () => ({
  default: ({ farms: shown, radiusKm, selectedId, onSelect, label, youAreHere }: FarmMapViewProps) => (
    <div data-testid="map" data-radius={radiusKm ?? 'all'} data-selected={selectedId ?? 'none'}>
      <span>{youAreHere}</span>
      {shown.map((farm) => (
        <button key={farm.id} type="button" onClick={() => onSelect(farm.id)}>
          marker: {label(farm)}
        </button>
      ))}
    </div>
  ),
}));

describe('геометрія мапи', () => {
  it('відстань рахується за гаверсинусом, як на сервері', () => {
    expect(distanceKm(LVIV_CENTER, { lat: 49.816, lon: 24.13 })).toBeCloseTo(7.6, 1);
    expect(distanceKm(LVIV_CENTER, LVIV_CENTER)).toBe(0);
  });

  it('ферми в радіусі впорядковано від найближчої; без радіуса - усі', () => {
    const shuffled = [farms[2]!, farms[0]!, farms[1]!];

    expect(farmsWithin(shuffled, 10).map((farm) => farm.id)).toEqual([1, 2]);
    expect(farmsWithin(shuffled, 5)).toEqual([]);
    expect(farmsWithin(shuffled, null).map((farm) => farm.id)).toEqual([1, 2, 6]);
  });

  it('ферми без відстані йдуть останніми й не потрапляють у радіус', () => {
    const unknown = { ...farms[0]!, id: 9, distanceKm: null };

    expect(farmsWithin([unknown, farms[1]!], null).map((farm) => farm.id)).toEqual([2, 9]);
    expect(farmsWithin([unknown], 50)).toEqual([]);
  });

  it('межі мапи охоплюють покупця, ферми й коло радіуса', () => {
    const [[south, west], [north, east]] = boundsOf(LVIV_CENTER, [farms[0]!, farms[2]!], null);
    expect([south, west, north, east]).toEqual([49.816, 23.39, 49.94, 24.13]);

    const [[circleSouth, circleWest], [circleNorth, circleEast]] = boundsOf(LVIV_CENTER, [], 50);
    expect(distanceKm(LVIV_CENTER, { lat: circleNorth, lon: LVIV_CENTER.lon })).toBeCloseTo(50, 0);
    expect(distanceKm(LVIV_CENTER, { lat: LVIV_CENTER.lat, lon: circleEast })).toBeCloseTo(50, 0);
    expect(circleSouth).toBeLessThan(LVIV_CENTER.lat);
    expect(circleWest).toBeLessThan(LVIV_CENTER.lon);
  });
});

describe('UI-03 Мапа ферм', () => {
  it('показує ферми з відстанню, сертифікатом і рейтингом у картці', async () => {
    await renderApp('/map');

    const list = await screen.findByRole('region', { name: 'Список ферм' });
    const cards = within(list).getAllByRole('listitem');

    expect(cards.map((card) => within(card).getByRole('heading').textContent)).toEqual([
      'Ферма «Зелений Гай»',
      'Сироварня «Карпатська бринза»',
      'Сад «Яворівські ягоди»',
    ]);
    expect(within(cards[0]!).getByText('7,6 км')).toBeInTheDocument();
    expect(within(cards[0]!).getByText('Органічний сертифікат')).toBeInTheDocument();
    expect(within(cards[0]!).getByText('4,8 з 5 · відгуків: 12')).toBeInTheDocument();
    expect(within(cards[1]!).getByText('Ще без відгуків')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Ферм: 3');
    expect(await screen.findByText('Центр Львова')).toBeInTheDocument();
  });

  it('радіус обмежує і список, і маркери', async () => {
    const { user } = await renderApp('/map');
    await screen.findByRole('button', { name: 'marker: Сад «Яворівські ягоди»' });

    await user.click(screen.getByRole('combobox', { name: 'Показати ферми' }));
    await user.click(await screen.findByRole('option', { name: 'до 10 км' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Ферм: 2'));
    expect(screen.queryByRole('button', { name: 'marker: Сад «Яворівські ягоди»' })).not.toBeInTheDocument();
    expect(screen.getByTestId('map')).toHaveAttribute('data-radius', '10');

    await user.click(screen.getByRole('combobox', { name: 'Показати ферми' }));
    await user.click(await screen.findByRole('option', { name: 'до 5 км' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('У цьому радіусі ферм немає'));
  });

  it('список і мапа синхронні: вибір у списку виділяє маркер, клік по маркеру - картку', async () => {
    const { user } = await renderApp('/map');

    await user.click(await screen.findByRole('button', { name: 'Показати на мапі: Сироварня «Карпатська бринза»' }));
    expect(screen.getByTestId('map')).toHaveAttribute('data-selected', '2');

    await user.click(screen.getByRole('button', { name: 'marker: Ферма «Зелений Гай»' }));

    const list = screen.getByRole('region', { name: 'Список ферм' });
    const current = within(list).getAllByRole('listitem').filter((card) => card.getAttribute('aria-current') === 'true');
    expect(current).toHaveLength(1);
    expect(within(current[0]!).getByRole('heading')).toHaveTextContent('Ферма «Зелений Гай»');
  });

  it('з картки ферми можна перейти на сторінку ферми з її товарами', async () => {
    const { user } = await renderApp('/map');

    await user.click(await screen.findByRole('link', { name: 'Сторінка ферми: Сироварня «Карпатська бринза»' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Сироварня «Карпатська бринза»' })).toBeInTheDocument();
    expect(await screen.findByRole('article', { name: /Молоко/ })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Морква' })).not.toBeInTheDocument();
    expect(backend.catalogRequests.at(-1)!.searchParams.get('farmerId')).toBe('2');
  });

  it('старе посилання «товари ферми» в каталозі працює, і фільтр ферми можна зняти', async () => {
    const { user } = await renderApp('/?farmerId=2');

    expect(await screen.findByText('Товари ферми: Сироварня «Карпатська бринза»')).toBeInTheDocument();
    await user.click(screen.getByLabelText('Показати товари всіх ферм'));

    expect(await screen.findByRole('article', { name: 'Морква' })).toBeInTheDocument();
  });

  it('англійською назви ферм і підписи - без кирилиці', async () => {
    await renderApp('/map', { lang: 'en' });

    expect(await screen.findByRole('heading', { name: 'Zelenyi Hai Farm' })).toBeInTheDocument();
    expect(await screen.findByText('Lviv city centre')).toBeInTheDocument();
    expect(screen.getByText('4.8 out of 5 · reviews: 12')).toBeInTheDocument();
    expect(CYRILLIC.test(document.body.textContent ?? '')).toBe(false);
  });

  it('збій завантаження ферм показує помилку з повтором', async () => {
    server.use(http.get('*/api/farmers', () => HttpResponse.json({ error: 'location_invalid', message: '' }, { status: 400 }), { once: true }));
    const { user } = await renderApp('/map');

    expect(await screen.findByRole('alert')).toHaveTextContent('Некоректні координати.');
    await user.click(screen.getByRole('button', { name: 'Спробувати ще раз' }));

    expect(await screen.findByRole('heading', { name: 'Ферма «Зелений Гай»' })).toBeInTheDocument();
  });
});

describe('Відгуки ферми на мапі', () => {
  it('кнопка «Відгуки» відкриває відгуки ферми; прихованих там немає', async () => {
    backend.addFarmReview(4, 'Свіжі овочі, привезли вчасно', 'Ігор П.');
    backend.addFarmReview(1, 'Спам', 'Тролль', true);
    const { user } = await renderApp('/map');

    await user.click(await screen.findByRole('button', { name: 'Відгуки: Ферма «Зелений Гай»' }));

    const dialog = await screen.findByRole('dialog', { name: 'Відгуки: Ферма «Зелений Гай»' });
    expect(await within(dialog).findByText('Свіжі овочі, привезли вчасно')).toBeInTheDocument();
    expect(within(dialog).queryByText('Спам')).not.toBeInTheDocument();
  });
});
