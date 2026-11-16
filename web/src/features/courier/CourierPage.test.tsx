import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CYRILLIC, renderApp } from '../../test/render';
import { backend, delivery, user as userWith } from '../../test/server';

// Мапу маршруту (Leaflet) автотести не малюють: замість неї - список зупинок у тому самому порядку.
vi.mock('./RouteMap', () => ({
  default: ({ stops }: { stops: { kind: string; orderId: number }[] }) => <div data-testid="route-map">{stops.map((stop) => `${stop.kind}:${stop.orderId}`).join(' ')}</div>,
}));

/** Цифри коду вручення з усіх чотирьох клітинок. */
const codeValue = () =>
  within(screen.getByRole('group', { name: 'Клітинки коду вручення' }))
    .getAllByRole('textbox')
    .map((input) => (input as HTMLInputElement).value)
    .join('');

async function asCourier(lang: 'uk' | 'en' = 'uk') {
  backend.user = userWith('Buyer', 'Courier');
  localStorage.setItem('farmcart.role', 'Courier');
  return renderApp('/courier', { signedIn: true, lang });
}

describe('UI-10 Мої доставки', () => {
  it('показує доставку з фермою, адресою, під’їздом, коментарем і дзвінками фермеру й покупцю', async () => {
    backend.deliveries = [delivery];
    await asCourier();

    const card = await screen.findByRole('listitem', { name: 'Доставка №1001' });

    expect(within(card).getByText('Ферма «Зелений Гай»')).toBeInTheDocument();
    expect(within(card).getByText('Львів, вул. Городоцька, 15')).toBeInTheDocument();
    expect(within(card).getByText('під’їзд 2, поверх 3, домофон 5К')).toBeInTheDocument();
    expect(within(card).getByText(/Подзвоніть за 10 хвилин/)).toBeInTheDocument();
    expect(within(card).getByText('Замовлення оплачено')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Зателефонувати покупцю: Оксана Демченко' })).toHaveAttribute('href', 'tel:+380931112233');
    expect(within(card).getByRole('link', { name: 'Зателефонувати фермеру: Ферма «Зелений Гай»' })).toHaveAttribute('href', 'tel:+380671110001');
  });

  it('«Маршрут» пропонує навігатор: Google Maps, Waze чи Apple Maps - від ферми до покупця', async () => {
    backend.deliveries = [delivery];
    const { user } = await asCourier();
    const card = await screen.findByRole('listitem', { name: 'Доставка №1001' });

    await user.click(within(card).getByRole('button', { name: 'Маршрут' }));

    const menu = await screen.findByRole('menu', { name: 'Відкрити маршрут у' });
    expect(within(menu).getByRole('menuitem', { name: 'Google Maps' })).toHaveAttribute('href', expect.stringContaining('origin=49.816%2C24.13&destination=49.8378%2C24.0468'));
    expect(within(menu).getByRole('menuitem', { name: 'Waze' })).toHaveAttribute('href', expect.stringContaining('ll=49.8378%2C24.0468'));
    expect(within(menu).getByRole('menuitem', { name: 'Apple Maps' })).toHaveAttribute('href', expect.stringContaining('saddr=49.816%2C24.13'));
  });

  it('склад замовлення можна звірити позиція за позицією', async () => {
    backend.deliveries = [delivery];
    const { user } = await asCourier();
    const card = await screen.findByRole('listitem', { name: 'Доставка №1001' });

    await user.click(within(card).getByRole('button', { name: /Склад замовлення: 10 од\. · звірено 0 з 1/ }));
    await user.click(within(card).getByRole('checkbox', { name: 'Морква — 10 × кг' }));

    expect(within(card).getByRole('button', { name: /звірено 1 з 1/ })).toBeInTheDocument();
  });

  it('кілька доставок - одна мапа маршруту з порядком «забрати → віддати»', async () => {
    const second = { ...delivery, orderId: 1002, pickupLat: 49.79, pickupLon: 24.06, dropOffLat: 49.8, dropOffLon: 24.05, pickupFrom: { uk: 'Пекарня «Житній колос»', en: 'Zhytnii Kolos Bakery' } };
    backend.deliveries = [delivery, second];
    await asCourier();

    const route = await screen.findByRole('region', { name: 'Маршрут доставок' });
    const stops = within(within(route).getByRole('list', { name: 'Порядок зупинок' })).getAllByRole('listitem');

    expect(stops.map((stop) => stop.textContent)).toEqual([
      'Забрати №1001 - Ферма «Зелений Гай»',
      'Забрати №1002 - Пекарня «Житній колос»',
      'Віддати №1002 - Львів, вул. Городоцька, 15',
      'Віддати №1001 - Львів, вул. Городоцька, 15',
    ]);
    expect(within(route).getByRole('link', { name: /Увесь маршрут у Google Maps/ })).toHaveAttribute('href', expect.stringContaining('waypoints='));
  });

  it('готівку до отримання видно окремо', async () => {
    backend.deliveries = [{ ...delivery, amountToCollect: 160 }];
    await asCourier();

    expect(await screen.findByText(/Отримати готівкою: 160,00/)).toBeInTheDocument();
  });

  it('хибний код вручення не закриває доставку, правильний - закриває', async () => {
    backend.deliveries = [delivery];
    const { user } = await asCourier();
    const code = await screen.findByLabelText('Код вручення: Доставка №1001');
    const confirm = screen.getByRole('button', { name: 'Вручено' });

    expect(confirm).toBeDisabled();
    expect(code).toHaveAttribute('inputmode', 'numeric');
    // Чотири клітинки: після цифри курсор сам переходить далі, літери не вводяться.
    await user.type(code, '00a00');
    expect(codeValue()).toBe('0000');
    await user.click(confirm);

    expect(await screen.findByText('Невірний код вручення. Уточніть код у покупця.')).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'Доставка №1001' })).toBeInTheDocument();

    // Вставлений код розкладається по клітинках.
    await user.click(code);
    await user.paste('4821');
    expect(codeValue()).toBe('4821');
    await user.click(confirm);

    expect(await screen.findByText('Замовлення №1001 вручено')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('listitem', { name: 'Доставка №1001' })).not.toBeInTheDocument());
    expect(screen.getByText('Активних доставок немає.')).toBeInTheDocument();
  });

  it('англійською ферма й підписи англійські; адреса покупця лишається як введено', async () => {
    // Ім'я, адреса й коментар - те, що ввели люди; тут вони латиницею, щоб перевірити саме підписи інтерфейсу.
    backend.deliveries = [{ ...delivery, address: '15 Horodotska St, Lviv', buyerName: 'Oksana D.', farmerContact: 'Olena Koval', comment: 'Call ten minutes ahead', addressDetails: { entrance: '2', floor: '3', intercom: '5K' } }];
    await asCourier('en');

    const card = await screen.findByRole('listitem', { name: 'Delivery No. 1001' });

    expect(within(card).getByText('Zelenyi Hai Farm')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Delivered' })).toBeInTheDocument();
    expect(CYRILLIC.test(document.body.textContent ?? '')).toBe(false);
  });
});

describe('Невдала доставка', () => {
  it('кур’єр фіксує причину; «інша причина» без коментаря не надсилається; доставка зникає зі списку', async () => {
    backend.deliveries = [delivery];
    const { user } = await asCourier();
    const card = await screen.findByRole('listitem', { name: 'Доставка №1001' });

    await user.click(within(card).getByRole('button', { name: 'Не вдалося вручити' }));
    const dialog = await screen.findByRole('dialog', { name: 'Не вдалося вручити замовлення №1001' });
    await user.click(within(dialog).getByRole('radio', { name: 'Інша причина' }));
    await user.click(within(dialog).getByRole('button', { name: 'Зафіксувати' }));
    expect(within(dialog).getByText('Опишіть, що завадило вручити замовлення.')).toBeInTheDocument();
    expect(backend.actions).toHaveLength(0);

    await user.click(within(dialog).getByRole('radio', { name: 'Покупця не було вдома' }));
    await user.click(within(dialog).getByRole('button', { name: 'Зафіксувати' }));

    expect(await screen.findByText('Доставку №1001 позначено як не вручену')).toBeInTheDocument();
    expect(backend.actions).toEqual([{ orderId: 1001, kind: 'fail', body: { problem: 'BuyerAbsent', note: null } }]);
    expect(await screen.findByText('Активних доставок немає.')).toBeInTheDocument();
  });
});
