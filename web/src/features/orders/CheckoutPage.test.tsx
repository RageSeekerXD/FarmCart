import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { CYRILLIC, renderApp } from '../../test/render';
import { backend, server } from '../../test/server';

async function openCheckout(lang: 'uk' | 'en' = 'uk') {
  backend.putInCart(1, 10);
  backend.putInCart(2, 15);
  const view = await renderApp('/checkout', { signedIn: true, lang });
  await screen.findByRole('heading', { name: lang === 'uk' ? 'Оформлення замовлення' : 'Checkout' });
  return view;
}

describe('UI-05 Оформлення замовлення', () => {
  it('оформлює замовлення з адресою, слотом і промокодом і відкриває трекер', async () => {
    const { user } = await openCheckout();

    await user.type(screen.getByLabelText(/Адреса доставки/), 'Львів, вул. Городоцька, 15');
    await user.click(screen.getAllByRole('radio', { name: /вільних місць: 3/ })[0]!);
    await user.type(screen.getByLabelText('Промокод'), 'farm10');
    await user.type(screen.getByLabelText(/Коментар/), 'Подзвоніть за 10 хвилин');
    await user.click(screen.getByRole('button', { name: /Замовити на 430,00/ }));

    expect(await screen.findByRole('heading', { name: 'Замовлення №1001' })).toBeInTheDocument();
    expect(await screen.findByText('Замовлення №1001 оформлено')).toBeInTheDocument();
    expect(screen.getByTestId('order-total')).toHaveTextContent(/387,00/);
    expect(screen.getByText(/Знижка за промокодом FARM10/)).toBeInTheDocument();
    expect(backend.checkouts).toHaveLength(1);
    expect(backend.checkouts[0]!.body).toEqual({
      address: 'Львів, вул. Городоцька, 15',
      slotId: 1,
      paymentMethod: 'Card',
      paymentToken: 'tok_visa',
      promoCode: 'FARM10',
      comment: 'Подзвоніть за 10 хвилин',
    });
    expect(backend.checkouts[0]!.key).toMatch(/\S{8,}/);
    expect(await screen.findByRole('link', { name: 'Товарів у кошику: 0' })).toBeInTheDocument();
  });

  it('поля для номера картки немає: оплата - лише токеном провайдера', async () => {
    await openCheckout();

    expect(screen.queryByLabelText(/номер картки/i)).not.toBeInTheDocument();
    expect(document.querySelector('input[autocomplete^="cc-"]')).toBeNull();
    expect(screen.getByText(/FarmCart отримує лише токен/)).toBeInTheDocument();
  });

  it('без адреси й слота запит не надсилається, а поля пояснюють, що заповнити', async () => {
    const { user } = await openCheckout();

    await user.click(screen.getByRole('button', { name: /Замовити на/ }));

    expect(screen.getByText('Вкажіть адресу доставки.')).toBeInTheDocument();
    expect(screen.getByText('Оберіть час доставки.')).toBeInTheDocument();
    expect(backend.checkouts).toHaveLength(0);
  });

  it('заповнений слот обрати не можна', async () => {
    await openCheckout();

    expect(screen.getByRole('radio', { name: /місць немає/ })).toBeDisabled();
  });

  it('відмова банку: замовлення не створено, повтор іде з тим самим Idempotency-Key', async () => {
    const { user } = await openCheckout();
    await user.type(screen.getByLabelText(/Адреса доставки/), 'Львів, вул. Городоцька, 15');
    await user.click(screen.getAllByRole('radio', { name: /вільних місць: 3/ })[0]!);
    await user.click(screen.getByRole('combobox', { name: /Картка \(пісочниця/ }));
    await user.click(await screen.findByRole('option', { name: /банк відхиляє оплату/ }));

    await user.click(screen.getByRole('button', { name: /Замовити на/ }));

    expect(await screen.findByText(/Банк відхилив оплату. Замовлення не створено, кошик збережено/)).toBeInTheDocument();
    expect(backend.orders).toHaveLength(0);

    await user.click(screen.getByRole('radio', { name: 'Google Pay' }));
    await user.click(screen.getByRole('button', { name: /Замовити на/ }));

    expect(await screen.findByRole('heading', { name: 'Замовлення №1001' })).toBeInTheDocument();
    expect(backend.checkouts.map((attempt) => attempt.body.paymentToken)).toEqual(['tok_declined', 'tok_googlepay']);
    expect(backend.checkouts[1]!.key).toBe(backend.checkouts[0]!.key);
  });

  it('готівка не потребує токена', async () => {
    const { user } = await openCheckout();
    await user.type(screen.getByLabelText(/Адреса доставки/), 'Львів, вул. Городоцька, 15');
    await user.click(screen.getAllByRole('radio', { name: /вільних місць: 3/ })[0]!);

    await user.click(screen.getByRole('radio', { name: 'Готівка при отриманні' }));
    expect(screen.queryByRole('combobox', { name: /Картка \(пісочниця/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Замовити на/ }));

    expect(await screen.findByText(/Готівка при отриманні · оплата при отриманні/)).toBeInTheDocument();
    expect(backend.checkouts[0]!.body).toMatchObject({ paymentMethod: 'Cash', paymentToken: null, promoCode: null, comment: null });
  });

  it('невідомий промокод пояснюється англійською, сторінка - без кирилиці', async () => {
    const { user } = await openCheckout('en');
    await user.type(screen.getByLabelText(/Delivery address/), '15 Horodotska St, Lviv');
    await user.click(screen.getAllByRole('radio', { name: /places left: 3/ })[0]!);
    await user.type(screen.getByLabelText('Promo code'), 'NOPE');

    await user.click(screen.getByRole('button', { name: /Place order for ₴430.00/ }));

    expect(await screen.findByText('This promo code does not exist.')).toBeInTheDocument();
    expect(screen.getByText('Carrots × 10')).toBeInTheDocument();
    expect(CYRILLIC.test(document.body.textContent ?? '')).toBe(false);
  });

  it('з порожнім кошиком оформлення веде до каталогу', async () => {
    await renderApp('/checkout', { signedIn: true });

    expect(await screen.findByText('Кошик порожній')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Перейти до каталогу' })).toBeInTheDocument();
  });

  it('без вільних слотів про це сказано', async () => {
    server.use(http.get('*/api/slots', () => HttpResponse.json([])));
    await openCheckout();

    expect(screen.getByText(/Вільних слотів доставки зараз немає/)).toBeInTheDocument();
  });

  it('з кошика кнопка «Оформити замовлення» веде на оформлення', async () => {
    backend.putInCart(1, 1);
    const { user } = await renderApp('/cart', { signedIn: true });

    await user.click(await screen.findByRole('link', { name: 'Оформити замовлення' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Оформлення замовлення' })).toBeInTheDocument());
  });
});
