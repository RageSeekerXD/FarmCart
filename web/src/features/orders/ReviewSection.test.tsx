import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../../test/render';
import { backend } from '../../test/server';

describe('UI-07 Відгук після вручення', () => {
  it('покупець оцінює фермера після доставки; форма змінюється на його відгук', async () => {
    backend.addOrder('Delivered');
    const { user } = await renderApp('/orders/1001', { signedIn: true });

    const section = await screen.findByRole('region', { name: 'Оцініть фермера' });
    await user.click(within(section).getByRole('radio', { name: 'Оцінка: 5 з 5' }));
    await user.type(within(section).getByLabelText('Коментар'), 'Морква солодка');
    await user.click(within(section).getByRole('button', { name: 'Надіслати відгук' }));

    expect(await screen.findByText('Дякуємо за відгук!')).toBeInTheDocument();
    const mine = await screen.findByRole('region', { name: 'Ваш відгук' });
    expect(within(mine).getByText('Морква солодка')).toBeInTheDocument();
    expect(within(mine).getByRole('img', { name: 'Оцінка: 5 з 5' })).toBeInTheDocument();
    expect(backend.reviews).toEqual([expect.objectContaining({ orderId: 1001, rating: 5, comment: 'Морква солодка' })]);
  });

  it('без оцінки відгук не надсилається', async () => {
    backend.addOrder('Delivered');
    const { user } = await renderApp('/orders/1001', { signedIn: true });

    await user.click(await screen.findByRole('button', { name: 'Надіслати відгук' }));

    expect(await screen.findByText('Поставте оцінку від 1 до 5.')).toBeInTheDocument();
    expect(backend.reviews).toHaveLength(0);
  });

  it('уже залишений відгук показується замість форми', async () => {
    backend.addOrder('Delivered');
    backend.reviews = [{ id: 1, orderId: 1001, rating: 4, comment: null, author: 'Оксана Д.', at: '2026-10-01T16:00:00+03:00' }];
    await renderApp('/orders/1001', { signedIn: true, lang: 'en' });

    const mine = await screen.findByRole('region', { name: 'Your review' });

    expect(within(mine).getByRole('img', { name: 'Rating: 4 out of 5' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send review' })).not.toBeInTheDocument();
  });

  it('до вручення форми відгуку немає', async () => {
    backend.addOrder('InTransit');
    await renderApp('/orders/1001', { signedIn: true });

    await screen.findByRole('heading', { name: 'Хід замовлення' });

    await waitFor(() => expect(screen.queryByRole('region', { name: 'Оцініть фермера' })).not.toBeInTheDocument());
  });
});
