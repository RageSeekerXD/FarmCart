import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { CYRILLIC, renderApp } from '../../test/render';
import { backend, server } from '../../test/server';

describe('UI-04 Кошик', () => {
  it('показує позиції й суму, після видалення сума перераховується', async () => {
    backend.putInCart(1, 10);
    backend.putInCart(2, 15);
    const { user } = await renderApp('/cart', { signedIn: true });

    expect(await screen.findByText('Морква')).toBeInTheDocument();
    expect(screen.getByTestId('cart-total')).toHaveTextContent(/430,00\s?₴/);

    await user.click(screen.getByRole('button', { name: 'Видалити з кошика: Картопля' }));

    await waitFor(() => expect(screen.getByTestId('cart-total')).toHaveTextContent(/160,00\s?₴/));
    expect(screen.queryByText('Картопля')).not.toBeInTheDocument();
    expect(await screen.findByText('Видалено: Картопля')).toBeInTheDocument();
  });

  it('порожній кошик веде до каталогу', async () => {
    const { user } = await renderApp('/cart', { signedIn: true });

    await user.click(await screen.findByRole('link', { name: 'Перейти до каталогу' }));

    expect(await screen.findByRole('heading', { name: 'Каталог' })).toBeInTheDocument();
  });

  it('англійською назви позицій і одиниці - англійські, кирилиці немає', async () => {
    backend.putInCart(3, 2);
    await renderApp('/cart', { signedIn: true, lang: 'en' });

    expect(await screen.findByText("Cow's milk")).toBeInTheDocument();
    expect(screen.getByText(/per l/)).toBeInTheDocument();
    expect(screen.getByTestId('cart-total')).toHaveTextContent('₴76.00');
    expect(CYRILLIC.test(document.body.textContent ?? '')).toBe(false);
  });

  it('збій завантаження кошика показує помилку з повтором', async () => {
    server.use(http.get('*/api/cart', () => HttpResponse.json({ error: 'cart_empty', message: '' }, { status: 400 }), { once: true }));
    const { user } = await renderApp('/cart', { signedIn: true });

    expect(await screen.findByRole('alert')).toHaveTextContent('Кошик порожній.');
    await user.click(screen.getByRole('button', { name: 'Спробувати ще раз' }));

    expect(await screen.findByText('Кошик порожній')).toBeInTheDocument();
  });
});
