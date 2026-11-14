import { screen, waitFor, within } from '@testing-library/react';
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

  it('кнопки «+» і «−» змінюють кількість, порядок позицій не стрибає', async () => {
    backend.putInCart(1, 10);
    backend.putInCart(2, 15);
    const { user } = await renderApp('/cart', { signedIn: true });
    await screen.findByText('Морква');

    await user.click(screen.getByRole('button', { name: 'Збільшити кількість: Морква' }));
    await waitFor(() => expect(screen.getByTestId('cart-total')).toHaveTextContent(/446,00\s?₴/));
    expect(screen.getByRole('group', { name: 'Кількість: 11' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Зменшити кількість: Морква' }));
    await waitFor(() => expect(screen.getByTestId('cart-total')).toHaveTextContent(/430,00\s?₴/));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Зменшити кількість: Морква' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Зменшити кількість: Морква' }));
    await waitFor(() => expect(screen.getByTestId('cart-total')).toHaveTextContent(/414,00\s?₴/));
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([expect.stringContaining('Морква'), expect.stringContaining('Картопля')]);
  });

  it('«−» на останній одиниці прибирає позицію', async () => {
    backend.putInCart(1, 1);
    const { user } = await renderApp('/cart', { signedIn: true });

    await user.click(await screen.findByRole('button', { name: 'Зменшити кількість: Морква' }));

    expect(await screen.findByText('Кошик порожній')).toBeInTheDocument();
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

describe('Кошик кількох ферм', () => {
  it('позиції згруповано за фермами з підсумком кожної й поясненням, що буде кілька замовлень', async () => {
    backend.putInCart(1, 10);
    backend.putInCart(3, 2);
    await renderApp('/cart', { signedIn: true });

    const green = await screen.findByRole('region', { name: 'Ферма «Зелений Гай»' });
    const cheese = screen.getByRole('region', { name: 'Сироварня «Карпатська бринза»' });
    expect(within(green).getByText('Морква')).toBeInTheDocument();
    expect(within(cheese).getByText("Молоко коров'яче")).toBeInTheDocument();
    // Підсумок ферми й сума рядка: у цій фермі одна позиція, тож суми однакові.
    expect(within(cheese).getAllByText(/76,00/)).toHaveLength(2);
    expect(screen.getByText(/ферм у кошику: 2/)).toBeInTheDocument();
    expect(screen.getByTestId('cart-total')).toHaveTextContent(/236,00/);
  });
});

describe('Відновлення видаленої позиції', () => {
  it('«Відновити» в тості повертає позицію з тією ж кількістю на те саме місце', async () => {
    backend.putInCart(1, 10);
    backend.putInCart(2, 15);
    const { user } = await renderApp('/cart', { signedIn: true });
    await screen.findByText('Морква');

    await user.click(screen.getByRole('button', { name: 'Видалити з кошика: Морква' }));
    // На сторінці кошика є ще й підказка-Alert, тож тост шукаємо за текстом.
    const toast = (await screen.findByText('Видалено: Морква')).closest<HTMLElement>('[role="alert"]')!;
    await user.click(within(toast).getByRole('button', { name: 'Відновити' }));

    await waitFor(() => expect(screen.getByTestId('cart-total')).toHaveTextContent(/430,00\s?₴/));
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([expect.stringContaining('Морква'), expect.stringContaining('Картопля')]);
  });
});
