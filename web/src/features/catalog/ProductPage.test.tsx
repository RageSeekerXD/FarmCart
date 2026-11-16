import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CYRILLIC, renderApp } from '../../test/render';
import { backend } from '../../test/server';

const review = (id: number, comment: string, author = 'Оксана Д.') => ({ id, orderId: 900 + id, rating: 5, comment, author, at: '2026-09-20T10:00:00+03:00' });

describe('Сторінка товару', () => {
  it('назва на картці каталогу веде на сторінку товару', async () => {
    const { user } = await renderApp('/');

    await user.click(await screen.findByRole('link', { name: 'Докладніше: Морква' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Морква' })).toBeInTheDocument();
  });

  it('показує ціну, опис, склад, термін придатності, умови зберігання, сезон і дні доставки', async () => {
    await renderApp('/products/1');

    expect(await screen.findByRole('heading', { level: 1, name: 'Морква' })).toBeInTheDocument();
    expect(screen.getByText('Солодка морква без гербіцидів')).toBeInTheDocument();
    const facts = screen.getByRole('region', { name: 'Склад і зберігання' });
    expect(within(facts).getByText('Морква сорту «Нантська»')).toBeInTheDocument();
    expect(within(facts).getByText('3 тижні')).toBeInTheDocument();
    expect(within(facts).getByText('У прохолодному темному місці')).toBeInTheDocument();
    expect(screen.getByText(/Доставка: вт, сб/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Сторінка ферми: Ферма «Зелений Гай»' })).toHaveAttribute('href', '/farms/1');
    expect(await screen.findByText('Сімейна органічна ферма з 2009 року')).toBeInTheDocument();
  });

  it('товар без складу чи умов зберігання так і підписаний', async () => {
    await renderApp('/products/2');

    const facts = await screen.findByRole('region', { name: 'Склад і зберігання' });
    expect(within(facts).getAllByText('фермер не вказав')).toHaveLength(3);
  });

  it('відгуки про сам товар; без них - відгуки про ферму', async () => {
    backend.productReviews[1] = [review(1, 'Морква хрустка й солодка')];
    backend.addFarmReview(4, 'Свіжі овочі', 'Ігор П.');
    await renderApp('/products/1');

    const reviews = await screen.findByRole('region', { name: 'Відгуки про товар' });
    expect(await within(reviews).findByText('Морква хрустка й солодка')).toBeInTheDocument();
    expect(within(reviews).queryByText('Свіжі овочі')).not.toBeInTheDocument();
  });

  it('товар без відгуків показує відгуки про ферму', async () => {
    backend.addFarmReview(4, 'Свіжі овочі', 'Ігор П.');
    await renderApp('/products/2');

    const reviews = await screen.findByRole('region', { name: 'Відгуки про товар' });
    expect(await within(reviews).findByText('Про цей товар ще немає відгуків.')).toBeInTheDocument();
    expect(await within(reviews).findByText('Свіжі овочі')).toBeInTheDocument();
  });

  it('кількість змінюється тут же, а залишок видно поруч', async () => {
    const { user } = await renderApp('/products/1', { signedIn: true });

    expect(await screen.findByText('В наявності: 200')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Додати в кошик: Морква' }));
    await user.click(await screen.findByRole('button', { name: 'Збільшити кількість: Морква' }));

    expect(await screen.findByRole('group', { name: 'У кошику: Морква, 2' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Товарів у кошику: 2' })).toBeInTheDocument();
  });

  it('товару немає в наявності - кнопка так і каже, додати не можна', async () => {
    await renderApp('/products/4');

    expect(await screen.findByRole('heading', { level: 1, name: 'Агрус' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Немає в наявності: Агрус' })).toBeDisabled();
  });

  it('невідомий товар - зрозуміле повідомлення', async () => {
    await renderApp('/products/999');

    expect(await screen.findByText('Товар не знайдено')).toBeInTheDocument();
  });

  it('англійською на сторінці товару немає кирилиці', async () => {
    await renderApp('/products/1', { lang: 'en' });

    expect(await screen.findByRole('heading', { level: 1, name: 'Carrots' })).toBeInTheDocument();
    expect(screen.getByText('Nantes carrots')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('A family organic farm since 2009')).toBeInTheDocument());
    expect(CYRILLIC.test(document.body.textContent ?? '')).toBe(false);
  });
});
