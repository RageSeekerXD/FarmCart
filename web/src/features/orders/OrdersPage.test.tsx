import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CYRILLIC, renderApp } from '../../test/render';
import { backend } from '../../test/server';
import { timeline } from './orders';

describe('таймлайн замовлення', () => {
  it('пройдені статуси мають час, поточний позначено, майбутні - без часу', () => {
    const order = backend.addOrder('Assembling');

    const steps = timeline(order);

    expect(steps.map((step) => [step.status, step.state])).toEqual([
      ['Placed', 'done'],
      ['Accepted', 'done'],
      ['Assembling', 'current'],
      ['InTransit', 'upcoming'],
      ['Delivered', 'upcoming'],
    ]);
    expect(steps.map((step) => step.at !== null)).toEqual([true, true, true, false, false]);
  });

  it('відхилене замовлення закінчується після «оформлено»', () => {
    const steps = timeline(backend.addOrder('Rejected'));

    expect(steps.map((step) => [step.status, step.state])).toEqual([
      ['Placed', 'done'],
      ['Rejected', 'current'],
    ]);
  });
});

describe('UI-06 Мої замовлення', () => {
  it('список показує замовлення від найновішого зі статусом і сумою', async () => {
    backend.addOrder('Delivered');
    backend.addOrder('InTransit');
    await renderApp('/orders', { signedIn: true });

    const newest = await screen.findByRole('listitem', { name: 'Замовлення №1002' });
    const oldest = screen.getByRole('listitem', { name: 'Замовлення №1001' });

    expect(within(newest).getByText('В дорозі')).toBeInTheDocument();
    expect(within(oldest).getByText('Доставлено')).toBeInTheDocument();
    expect(within(newest).getByText('Морква × 10')).toBeInTheDocument();
    expect(within(newest).getByText(/160,00/)).toBeInTheDocument();
    expect(newest.compareDocumentPosition(oldest) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('без замовлень пропонує каталог', async () => {
    await renderApp('/orders', { signedIn: true });

    expect(await screen.findByText('Замовлень ще немає')).toBeInTheDocument();
  });

  it('зі списку відкривається трекер замовлення', async () => {
    backend.addOrder('Accepted');
    const { user } = await renderApp('/orders', { signedIn: true });

    await user.click(await screen.findByRole('link', { name: 'Відстежити замовлення №1001' }));

    expect(await screen.findByRole('heading', { name: 'Хід замовлення' })).toBeInTheDocument();
  });
});

describe('UI-06 Трекер замовлення', () => {
  it('показує код вручення, таймлайн, склад і ферму', async () => {
    backend.addOrder('InTransit');
    await renderApp('/orders/1001', { signedIn: true });

    expect(await screen.findByTestId('delivery-code')).toHaveTextContent('4821');
    expect(screen.getByRole('status', { name: 'Статус замовлення' })).toHaveTextContent('В дорозі');
    expect(screen.getByText('Збирається')).toBeInTheDocument();
    expect(screen.getByText('Доставлено')).toBeInTheDocument();
    expect(screen.getByText(/Морква × 10/)).toBeInTheDocument();
    expect(await screen.findByText('Ферма «Зелений Гай»')).toBeInTheDocument();
    expect(screen.getByText('Львів, вул. Городоцька, 15')).toBeInTheDocument();
  });

  it('статус оновлюється без перезавантаження сторінки', async () => {
    backend.addOrder('Placed');
    await renderApp('/orders/1001', { signedIn: true });
    expect(await screen.findByRole('status', { name: 'Статус замовлення' })).toHaveTextContent('Оформлено');

    backend.moveOrder(1001, 'Accepted');

    await waitFor(() => expect(screen.getByRole('status', { name: 'Статус замовлення' })).toHaveTextContent('Прийнято фермером'), {
      timeout: 8000,
    });
  }, 12_000);

  it('після вручення код більше не показується', async () => {
    backend.addOrder('Delivered');
    await renderApp('/orders/1001', { signedIn: true });

    expect(await screen.findByRole('status', { name: 'Статус замовлення' })).toHaveTextContent('Доставлено');
    expect(screen.queryByTestId('delivery-code')).not.toBeInTheDocument();
  });

  it('відхилене замовлення показує причину фермера й повернення коштів', async () => {
    backend.addOrder('Rejected');
    await renderApp('/orders/1001', { signedIn: true });

    expect(await screen.findByRole('alert')).toHaveTextContent('Фермер відхилив замовлення. Кошти повертаються автоматично. Причина: Морква закінчилася');
    expect(screen.getByText(/кошти повернено/)).toBeInTheDocument();
    expect(screen.getByText('Повернено')).toBeInTheDocument();
    expect(screen.queryByTestId('delivery-code')).not.toBeInTheDocument();
  });

  it('англійською рядки замовлення й статуси - англійські; кирилиця лише в тексті користувача', async () => {
    backend.addOrder('Assembling', { address: '15 Horodotska St, Lviv' });
    await renderApp('/orders/1001', { signedIn: true, lang: 'en' });

    expect(await screen.findByText(/Carrots × 10/)).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Order status' })).toHaveTextContent('Being packed');
    expect(await screen.findByText('Zelenyi Hai Farm')).toBeInTheDocument();
    expect(screen.getByText(/Card · paid/)).toBeInTheDocument();
    expect(CYRILLIC.test(document.body.textContent ?? '')).toBe(false);
  });

  it('чужого чи неіснуючого замовлення немає', async () => {
    await renderApp('/orders/4242', { signedIn: true });

    expect(await screen.findByRole('alert')).toHaveTextContent('Замовлення не знайдено.');
  });

  it('некоректний номер у адресі не викликає запиту', async () => {
    await renderApp('/orders/abc', { signedIn: true });

    expect(await screen.findByRole('alert')).toHaveTextContent('Замовлення не знайдено.');
  });
});
