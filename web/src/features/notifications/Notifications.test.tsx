import { act, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CYRILLIC, renderApp } from '../../test/render';
import { backend, TOKEN, user as userWith } from '../../test/server';
import { hub } from '../../test/signalr';
import { notificationConfig } from './notifications';

const original = { ...notificationConfig };

beforeEach(() => {
  notificationConfig.fallbackPollMs = 150;
});

afterEach(() => {
  Object.assign(notificationConfig, original);
});

/** Сервер створив сповіщення й одразу надіслав подію хаба. */
function push(kind: string, orderId: number | null, params: Record<string, string> = {}) {
  const notification = backend.notify(kind, orderId, params);
  act(() => hub.emit('notification', notification));
}

describe('UI-12 Сповіщення в реальному часі', () => {
  it('дзвіночок показує кількість непрочитаних; відкриття списку позначає їх прочитаними', async () => {
    backend.notify('order.placed', 1001, { total: '160' });
    backend.notify('order.status', 1001, { status: 'Accepted' });
    const { user } = await renderApp('/', { signedIn: true });

    await user.click(await screen.findByRole('button', { name: 'Сповіщення, нових: 2' }));
    const list = await screen.findByRole('menu', { name: 'Сповіщення' });
    const items = within(list).getAllByRole('menuitem');

    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('Замовлення №1001: Прийнято фермером'),
      expect.stringMatching(/Замовлення №1001 оформлено на 160,00/),
    ]);

    await user.keyboard('{Escape}');

    expect(await screen.findByRole('button', { name: 'Сповіщення, нових: 0' })).toBeInTheDocument();
    expect(localStorage.getItem('farmcart.seen.7')).toBe('2');
  });

  it('підключається до хаба з токеном сесії', async () => {
    await renderApp('/', { signedIn: true });
    await screen.findByRole('button', { name: /Сповіщення, нових/ });

    expect(hub.current.url).toBe('/hubs/notifications');
    expect(hub.current.options.accessTokenFactory?.()).toBe(TOKEN);
    await waitFor(() => expect(screen.getByRole('button', { name: /Сповіщення, нових/ })).toHaveAttribute('data-live', 'true'));
  });

  it('гість сповіщень не має й до хаба не підключається', async () => {
    await renderApp('/');
    await screen.findByRole('article', { name: 'Морква' });

    expect(screen.queryByRole('button', { name: /Сповіщення/ })).not.toBeInTheDocument();
    expect(hub.connections).toHaveLength(0);
  });

  it('подія хаба показує тост, збільшує лічильник і одразу оновлює статус відкритого замовлення', async () => {
    backend.addOrder('Placed');
    backend.notify('order.placed', 1001, { total: '160' });
    await renderApp('/orders/1001', { signedIn: true });
    expect(await screen.findByRole('status', { name: 'Статус замовлення' })).toHaveTextContent('Оформлено');
    await screen.findByRole('button', { name: 'Сповіщення, нових: 1' });

    backend.moveOrder(1001, 'Accepted');
    push('order.status', 1001, { status: 'Accepted' });

    expect(await screen.findByRole('alert')).toHaveTextContent('Замовлення №1001: Прийнято фермером');
    expect(await screen.findByRole('button', { name: 'Сповіщення, нових: 2' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('status', { name: 'Статус замовлення' })).toHaveTextContent('Прийнято фермером'), { timeout: 2000 });
  });

  it('тост події має заголовок і кнопку «Відкрити», що веде до замовлення', async () => {
    backend.addOrder('Placed');
    const { user } = await renderApp('/', { signedIn: true });
    await screen.findByRole('button', { name: 'Сповіщення, нових: 0' });

    backend.moveOrder(1001, 'Accepted');
    push('order.status', 1001, { status: 'Accepted' });

    const toast = await screen.findByRole('alert');
    expect(toast).toHaveTextContent('Нове сповіщення');
    await user.click(within(toast).getByRole('button', { name: 'Відкрити' }));

    expect(await screen.findByRole('heading', { name: 'Замовлення №1001' })).toBeInTheDocument();
  });

  it('власне оформлення не дублюється тостом сповіщення, але лічильник росте', async () => {
    await renderApp('/', { signedIn: true });
    await screen.findByRole('button', { name: 'Сповіщення, нових: 0' });

    push('order.placed', 1001, { total: '160' });

    expect(await screen.findByRole('button', { name: 'Сповіщення, нових: 1' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('старі сповіщення при вході тостом не показуються', async () => {
    backend.notify('order.placed', 1001, { total: '160' });
    await renderApp('/', { signedIn: true });

    await screen.findByRole('button', { name: 'Сповіщення, нових: 1' });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('без хаба працює резервне опитування: сповіщення все одно з’являється', async () => {
    hub.failStart = true;
    const { user } = await renderApp('/', { signedIn: true });
    const bell = await screen.findByRole('button', { name: 'Сповіщення, нових: 0' });
    expect(bell).toHaveAttribute('data-live', 'false');

    backend.notify('order.status', 1001, { status: 'InTransit' });

    expect(await screen.findByRole('button', { name: 'Сповіщення, нових: 1' }, { timeout: 3000 })).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('Замовлення №1001: В дорозі');

    await user.click(screen.getByRole('button', { name: 'Сповіщення, нових: 1' }));
    expect(await screen.findByText(/Немає зв’язку в реальному часі/)).toBeInTheDocument();
  });

  it('після обриву й перепідключення стрічка перечитується', async () => {
    await renderApp('/', { signedIn: true });
    const bell = await screen.findByRole('button', { name: 'Сповіщення, нових: 0' });
    await waitFor(() => expect(bell).toHaveAttribute('data-live', 'true'));
    notificationConfig.fallbackPollMs = 60_000;

    act(() => hub.current.reconnecting());
    await waitFor(() => expect(bell).toHaveAttribute('data-live', 'false'));
    backend.notify('order.status', 1001, { status: 'Delivered' });
    act(() => hub.current.reconnected());

    expect(await screen.findByRole('button', { name: 'Сповіщення, нових: 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Сповіщення, нових/ })).toHaveAttribute('data-live', 'true');
  });

  it('фермер бачить нове замовлення одразу; сповіщення веде в кабінет продавця', async () => {
    backend.asFarmer();
    const { user } = await renderApp('/', { signedIn: true });
    await screen.findByRole('button', { name: 'Сповіщення, нових: 0' });

    backend.addOrder('Placed');
    push('order.new', 1001, { total: '160' });
    await user.click(await screen.findByRole('button', { name: 'Сповіщення, нових: 1' }));
    await user.click(await screen.findByRole('menuitem', { name: /Нове замовлення №1001 на 160,00/ }));

    expect(await screen.findByRole('heading', { name: 'Вхідні замовлення' })).toBeInTheDocument();
    expect(await screen.findByRole('listitem', { name: 'Замовлення №1001' })).toBeInTheDocument();
    expect(localStorage.getItem('farmcart.role')).toBe('Farmer');
  });

  it('кур’єр отримує нову доставку англійською без кирилиці', async () => {
    backend.user = userWith('Buyer', 'Courier');
    const { user } = await renderApp('/', { signedIn: true, lang: 'en' });
    await screen.findByRole('button', { name: 'Notifications, new: 0' });
    await screen.findByRole('article', { name: 'Carrots' });

    push('delivery.assigned', 1001);
    push('mystery.kind', null);

    expect(await screen.findByRole('button', { name: 'Notifications, new: 2' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Notifications, new: 2' }));
    const list = await screen.findByRole('menu', { name: 'Notifications' });
    expect(within(list).getByText('New delivery No. 1001')).toBeInTheDocument();
    expect(within(list).getByText('New event')).toBeInTheDocument();
    expect(CYRILLIC.test(document.body.textContent ?? '')).toBe(false);

    await user.click(within(list).getByText('New delivery No. 1001'));
    expect(await screen.findByRole('heading', { name: 'My deliveries' })).toBeInTheDocument();
  });

  it('порожня стрічка так і називається; вихід закриває з’єднання', async () => {
    const { user } = await renderApp('/', { signedIn: true });

    await user.click(await screen.findByRole('button', { name: 'Сповіщення, нових: 0' }));
    expect(await screen.findByText('Сповіщень ще немає')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    const connection = hub.current;
    await user.click(screen.getByRole('button', { name: 'Вийти' }));

    await waitFor(() => expect(connection.stopped).toBe(true));
    expect(screen.queryByRole('button', { name: /Сповіщення/ })).not.toBeInTheDocument();
  });
});
