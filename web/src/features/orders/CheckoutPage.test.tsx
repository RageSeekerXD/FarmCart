import { screen, waitFor, within } from '@testing-library/react';
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
    expect(screen.getByText('Дякуємо за замовлення!')).toBeInTheDocument();
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
      details: null,
      lat: null,
      lon: null,
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

describe('Оформлення кошика кількох ферм', () => {
  it('підсумок показує ферми; після оформлення - список з усіма замовленнями', async () => {
    backend.putInCart(1, 10);
    backend.putInCart(3, 2);
    const { user } = await renderApp('/checkout', { signedIn: true });
    await screen.findByRole('heading', { name: 'Оформлення замовлення' });

    const summary = screen.getByRole('complementary', { name: 'Ваше замовлення' });
    expect(within(summary).getByText('Ферма «Зелений Гай»')).toBeInTheDocument();
    expect(within(summary).getByText('Сироварня «Карпатська бринза»')).toBeInTheDocument();
    expect(within(summary).getByText(/замовлень: 2/)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Адреса доставки/), 'Львів, вул. Городоцька, 15');
    await user.click(screen.getAllByRole('radio', { name: /вільних місць: 3/ })[0]!);
    await user.click(screen.getByRole('button', { name: /Замовити на 236,00/ }));

    expect(await screen.findByText('Оформлено замовлення №1001, №1002')).toBeInTheDocument();
    expect(await screen.findByText(/Оформлено замовлень: 2/)).toBeInTheDocument();
    expect(await screen.findByRole('listitem', { name: 'Замовлення №1002' })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'Замовлення №1001' })).toBeInTheDocument();
  });
});

describe('Запам’ятовані адреси доставки', () => {
  it('після оформлення адреса запам’ятовується й наступного разу підставлена; нещодавні - одним натисканням', async () => {
    localStorage.setItem('farmcart.addresses.7', JSON.stringify(['Львів, вул. Зелена, 1']));
    const { user } = await openCheckout();

    expect(screen.getByLabelText(/Адреса доставки/)).toHaveValue('Львів, вул. Зелена, 1');
    await user.clear(screen.getByLabelText(/Адреса доставки/));
    await user.type(screen.getByLabelText(/Адреса доставки/), 'Львів, вул. Городоцька, 15');
    expect(screen.getByRole('button', { name: 'Львів, вул. Зелена, 1', pressed: false })).toBeInTheDocument();
    await user.click(screen.getAllByRole('radio', { name: /вільних місць: 3/ })[0]!);
    await user.click(screen.getByRole('button', { name: /Замовити на/ }));

    await screen.findByRole('heading', { name: 'Замовлення №1001' });
    expect(JSON.parse(localStorage.getItem('farmcart.addresses.7')!)).toEqual(['Львів, вул. Городоцька, 15', 'Львів, вул. Зелена, 1']);
  });

  it('нещодавня адреса підставляється натисканням', async () => {
    localStorage.setItem('farmcart.addresses.7', JSON.stringify(['Львів, вул. Зелена, 1', 'Винники, вул. Галицька, 3']));
    const { user } = await openCheckout();

    await user.click(screen.getByRole('button', { name: 'Винники, вул. Галицька, 3' }));

    expect(screen.getByLabelText(/Адреса доставки/)).toHaveValue('Винники, вул. Галицька, 3');
    expect(screen.getByRole('button', { name: 'Винники, вул. Галицька, 3', pressed: true })).toBeInTheDocument();
  });
});

describe('Адреса з підказками, під’їзд, поверх і домофон', () => {
  it('підказка адреси дає точку на мапі; під’їзд, поверх і домофон ідуть кур’єрові', async () => {
    const { user } = await openCheckout();

    await user.type(screen.getByLabelText(/Адреса доставки/), 'Личаківська 24');
    await user.click(await screen.findByRole('option', { name: 'вулиця Личаківська, 24, Личаківський район, Львів' }));
    await user.type(screen.getByLabelText('Під’їзд'), '2');
    await user.type(screen.getByLabelText('Поверх'), '3');
    await user.type(screen.getByLabelText('Домофон'), '5К');
    await user.click(screen.getAllByRole('radio', { name: /вільних місць: 3/ })[0]!);
    await user.click(screen.getByRole('button', { name: /Замовити на/ }));

    await waitFor(() => expect(backend.checkouts).toHaveLength(1));
    expect(backend.checkouts[0]!.body).toMatchObject({
      address: 'вулиця Личаківська, 24, Личаківський район, Львів',
      details: { entrance: '2', floor: '3', intercom: '5К' },
      lat: 49.8378,
      lon: 24.0468,
    });
  });

  it('нещодавня адреса повертає свій під’їзд, поверх і домофон', async () => {
    localStorage.setItem('farmcart.addresses.7', JSON.stringify(['Львів, вул. Зелена, 1', 'Винники, вул. Галицька, 3']));
    localStorage.setItem('farmcart.addressExtras.7', JSON.stringify({ 'Винники, вул. Галицька, 3': { details: { entrance: '1', floor: '4', intercom: '12' }, lat: 49.81, lon: 24.13 } }));
    const { user } = await openCheckout();

    expect(screen.getByLabelText('Під’їзд')).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Винники, вул. Галицька, 3' }));

    expect(screen.getByLabelText('Під’їзд')).toHaveValue('1');
    expect(screen.getByLabelText('Поверх')).toHaveValue('4');
    expect(screen.getByLabelText('Домофон')).toHaveValue('12');
  });
});
