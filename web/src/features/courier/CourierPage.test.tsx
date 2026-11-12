import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CYRILLIC, renderApp } from '../../test/render';
import { backend, delivery, user as userWith } from '../../test/server';

async function asCourier(lang: 'uk' | 'en' = 'uk') {
  backend.user = userWith('Buyer', 'Courier');
  localStorage.setItem('farmcart.role', 'Courier');
  return renderApp('/courier', { signedIn: true, lang });
}

describe('UI-10 Мої доставки', () => {
  it('показує доставку з фермою, адресою й посиланням на маршрут', async () => {
    backend.deliveries = [delivery];
    await asCourier();

    const card = await screen.findByRole('listitem', { name: 'Доставка №1001' });

    expect(within(card).getByText('Ферма «Зелений Гай»')).toBeInTheDocument();
    expect(within(card).getByText('Львів, вул. Городоцька, 15')).toBeInTheDocument();
    expect(within(card).getByText('Замовлення оплачено')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Маршрут' })).toHaveAttribute('href', delivery.routeUrl);
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
    await user.type(code, '00a00');
    expect(code).toHaveValue('0000');
    await user.click(confirm);

    expect(await screen.findByText('Невірний код вручення. Уточніть код у покупця.')).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'Доставка №1001' })).toBeInTheDocument();

    await user.clear(code);
    await user.type(code, '4821');
    await user.click(confirm);

    expect(await screen.findByText('Замовлення №1001 вручено')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('listitem', { name: 'Доставка №1001' })).not.toBeInTheDocument());
    expect(screen.getByText('Активних доставок немає.')).toBeInTheDocument();
  });

  it('англійською ферма й підписи англійські; адреса покупця лишається як введено', async () => {
    backend.deliveries = [{ ...delivery, address: '15 Horodotska St, Lviv' }];
    await asCourier('en');

    const card = await screen.findByRole('listitem', { name: 'Delivery No. 1001' });

    expect(within(card).getByText('Zelenyi Hai Farm')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Delivered' })).toBeInTheDocument();
    expect(CYRILLIC.test(document.body.textContent ?? '')).toBe(false);
  });
});
