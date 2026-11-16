import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CYRILLIC, renderApp } from '../../test/render';
import { backend } from '../../test/server';
import type { FarmMapViewProps } from '../map/FarmMapView';

// Картинку Leaflet автотести не перевіряють: замість неї - розмітка з тими самими властивостями.
vi.mock('../map/FarmMapView', () => ({
  default: ({ farms, label, youAreHere }: FarmMapViewProps) => (
    <div data-testid="map">
      <span>{youAreHere}</span>
      {farms.map((farm) => (
        <span key={farm.id}>
          {`marker: ${label(farm)} (${farm.lat}, ${farm.lon})`}
        </span>
      ))}
    </div>
  ),
}));

describe('Сторінка ферми', () => {
  it('показує рейтинг, сертифікати, розташування на мапі, усі товари ферми й відгуки', async () => {
    backend.addFarmReview(5, 'Найсолодша морква', 'Оксана Д.');
    await renderApp('/farms/1');

    expect(await screen.findByRole('heading', { level: 1, name: 'Ферма «Зелений Гай»' })).toBeInTheDocument();
    expect(screen.getByLabelText('Рейтинг ферми: 4,8 з 5')).toBeInTheDocument();
    expect(screen.getByText('Перевірений продавець')).toBeInTheDocument();
    expect(screen.getByText('Органічний сертифікат')).toBeInTheDocument();
    expect(screen.getByText('Винники')).toBeInTheDocument();
    expect(screen.getByText('До ферми 7,6 км')).toBeInTheDocument();

    const location = screen.getByRole('region', { name: 'Розташування ферми' });
    expect(await within(location).findByText('marker: Ферма «Зелений Гай» (49.816, 24.13)')).toBeInTheDocument();
    expect(within(location).getByRole('link', { name: /Відкрити на мапі/ })).toHaveAttribute('href', expect.stringContaining('mlat=49.816&mlon=24.13'));

    const goods = screen.getByRole('region', { name: /Товари ферми/ });
    expect(await within(goods).findByRole('article', { name: 'Морква' })).toBeInTheDocument();
    expect(within(goods).getByRole('article', { name: 'Картопля' })).toBeInTheDocument();
    expect(within(goods).queryByRole('article', { name: "Молоко коров'яче" })).not.toBeInTheDocument();
    // На сторінці ферми назва ферми на картках зайва.
    expect(within(goods).queryByRole('link', { name: /Сторінка ферми/ })).not.toBeInTheDocument();
    expect(backend.catalogRequests.at(-1)!.searchParams.get('farmerId')).toBe('1');

    expect(await screen.findByText('Найсолодша морква')).toBeInTheDocument();
  });

  it('ферма без органічного сертифіката й без відгуків так і підписана', async () => {
    await renderApp('/farms/2');

    expect(await screen.findByRole('heading', { level: 1, name: 'Сироварня «Карпатська бринза»' })).toBeInTheDocument();
    expect(screen.getByText('Без органічного сертифіката')).toBeInTheDocument();
    expect(screen.getAllByText('Ще без відгуків').length).toBeGreaterThan(0);
  });

  it('товар можна додати в кошик просто зі сторінки ферми', async () => {
    const { user } = await renderApp('/farms/1', { signedIn: true });

    await user.click(await screen.findByRole('button', { name: 'Додати в кошик: Морква' }));

    expect(await screen.findByRole('group', { name: 'У кошику: Морква, 1' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Товарів у кошику: 1' })).toBeInTheDocument();
  });

  it('гість після «У кошик» на сторінці ферми входить і повертається на неї ж', async () => {
    const { user } = await renderApp('/farms/1');

    await user.click(await screen.findByRole('button', { name: 'Додати в кошик: Морква' }));

    expect(await screen.findByRole('heading', { name: 'Вхід за номером телефону' })).toBeInTheDocument();
  });

  it('невідома чи неперевірена ферма - зрозуміле повідомлення й шлях до каталогу', async () => {
    const { user } = await renderApp('/farms/99');

    expect(await screen.findByText('Ферму не знайдено')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'До каталогу' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Каталог' })).toBeInTheDocument();
  });

  it('англійською на сторінці ферми немає кирилиці', async () => {
    await renderApp('/farms/1', { lang: 'en' });

    expect(await screen.findByRole('heading', { level: 1, name: 'Zelenyi Hai Farm' })).toBeInTheDocument();
    await screen.findByRole('article', { name: 'Carrots' });
    expect(screen.getByText('Organic certificate')).toBeInTheDocument();
    expect(CYRILLIC.test(document.body.textContent ?? '')).toBe(false);
  });
});

describe('Сторінка ферми: історія, дні доставки, увесь асортимент', () => {
  it('показує історію ферми й дні доставки; товари, яких немає, теж є - з позначкою', async () => {
    await renderApp('/farms/1');

    expect(await screen.findByText('Сімейна органічна ферма з 2009 року')).toBeInTheDocument();
    expect(screen.getByText('Доставка: вт, сб')).toBeInTheDocument();
    expect(await screen.findByRole('article', { name: 'Агрус' })).toBeInTheDocument();
    expect(backend.catalogRequests.at(-1)!.searchParams.get('includeSoldOut')).toBe('true');
  });
});
