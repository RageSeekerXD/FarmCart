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

describe('Скасування замовлення покупцем', () => {
  it('скасоване замовлення закінчується після «оформлено»', () => {
    const steps = timeline(backend.addOrder('Cancelled'));

    expect(steps.map((step) => [step.status, step.state])).toEqual([
      ['Placed', 'done'],
      ['Cancelled', 'current'],
    ]);
  });

  it('з трекера: підтвердження з сумою повернення, далі статус «Скасовано», тост і без коду вручення', async () => {
    backend.addOrder('Placed');
    const { user } = await renderApp('/orders/1001', { signedIn: true });

    await user.click(await screen.findByRole('button', { name: 'Скасувати замовлення №1001' }));
    const dialog = await screen.findByRole('dialog', { name: 'Скасувати замовлення №1001?' });
    expect(dialog).toHaveTextContent(/Кошти 160,00\s?₴ повернуться автоматично/);
    expect(dialog).toHaveTextContent('Скасування не можна відмінити.');
    await user.click(within(dialog).getByRole('button', { name: 'Так, скасувати' }));

    await waitFor(() => expect(screen.getByRole('status', { name: 'Статус замовлення' })).toHaveTextContent('Скасовано'));
    expect(await screen.findByText('Замовлення №1001 скасовано')).toBeInTheDocument();
    expect(screen.getByText(/Ви скасували це замовлення\. Повернено: 160,00/)).toBeInTheDocument();
    expect(screen.queryByTestId('delivery-code')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Скасувати замовлення №1001' })).not.toBeInTheDocument();
  });

  it('фермер щойно прийняв: діалог пояснює, чому не можна, а трекер показує новий статус', async () => {
    backend.addOrder('Placed');
    const { user } = await renderApp('/orders/1001', { signedIn: true });
    await user.click(await screen.findByRole('button', { name: 'Скасувати замовлення №1001' }));
    const dialog = await screen.findByRole('dialog');

    backend.moveOrder(1001, 'Accepted');
    await user.click(within(dialog).getByRole('button', { name: 'Так, скасувати' }));

    expect(await within(dialog).findByText('Фермер уже прийняв замовлення - скасувати його не можна.')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Так, скасувати' })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Ні, залишити' }));

    await waitFor(() => expect(screen.getByRole('status', { name: 'Статус замовлення' })).toHaveTextContent('Прийнято фермером'));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Скасувати замовлення №1001' })).not.toBeInTheDocument());
  });

  it('після прийняття фермером кнопки скасування немає', async () => {
    backend.addOrder('Accepted');
    await renderApp('/orders/1001', { signedIn: true });

    expect(await screen.findByRole('status', { name: 'Статус замовлення' })).toHaveTextContent('Прийнято фермером');
    expect(screen.queryByRole('button', { name: /Скасувати замовлення/ })).not.toBeInTheDocument();
  });

  it('зі списку: «Ні, залишити» нічого не змінює, «Так, скасувати» змінює статус картки', async () => {
    backend.addOrder('Delivered');
    backend.addOrder('Placed');
    const { user } = await renderApp('/orders', { signedIn: true });

    const placed = await screen.findByRole('listitem', { name: 'Замовлення №1002' });
    expect(within(screen.getByRole('listitem', { name: 'Замовлення №1001' })).queryByRole('button', { name: /Скасувати/ })).not.toBeInTheDocument();

    await user.click(within(placed).getByRole('button', { name: 'Скасувати замовлення №1002' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Ні, залишити' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(within(placed).getByText('Оформлено')).toBeInTheDocument();

    await user.click(within(placed).getByRole('button', { name: 'Скасувати замовлення №1002' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Так, скасувати' }));

    await waitFor(() => expect(within(screen.getByRole('listitem', { name: 'Замовлення №1002' })).getByText('Скасовано')).toBeInTheDocument());
  });

  it('готівкове замовлення: у підтвердженні сказано, що повертати нічого', async () => {
    backend.addOrder('Placed', { paymentMethod: 'Cash', paymentStatus: 'PayOnDelivery', paidAmount: 0 });
    const { user } = await renderApp('/orders/1001', { signedIn: true });

    await user.click(await screen.findByRole('button', { name: 'Скасувати замовлення №1001' }));

    expect(await screen.findByRole('dialog')).toHaveTextContent('Оплату ще не стягнуто - повертати нічого не треба.');
  });
});

describe('Замовити знову', () => {
  it('завершене замовлення повторюється в кошик; кнопки немає в замовлення в роботі', async () => {
    backend.addOrder('Placed');
    backend.addOrder('Delivered');
    const { user } = await renderApp('/orders', { signedIn: true });

    const active = await screen.findByRole('listitem', { name: 'Замовлення №1001' });
    expect(within(active).queryByRole('button', { name: /Замовити знову/ })).not.toBeInTheDocument();
    await user.click(within(screen.getByRole('listitem', { name: 'Замовлення №1002' })).getByRole('button', { name: 'Замовити знову: №1002' }));

    expect(await screen.findByText('Товари замовлення додано в кошик')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Товарів у кошику: 10' })).toBeInTheDocument();
  });

  it('чого бракує на складі - тост каже, скільки вдалося додати', async () => {
    backend.addOrder('Delivered');
    backend.stock[1] = 4;
    const { user } = await renderApp('/orders/1001', { signedIn: true });

    await user.click(await screen.findByRole('button', { name: 'Замовити знову: №1001' }));

    const toast = (await screen.findByText('Додано не все')).closest<HTMLElement>('[role="alert"]')!;
    expect(toast).toHaveTextContent('Морква - додано 4 з 10');
    expect(await screen.findByRole('link', { name: 'Товарів у кошику: 4' })).toBeInTheDocument();
  });
});

describe('Невдала доставка: перенесення покупцем', () => {
  it('таймлайн: шлях до «в дорозі», далі «не вручено», «доставлено» ще попереду', () => {
    const steps = timeline(backend.addOrder('DeliveryFailed'));

    expect(steps.map((step) => [step.status, step.state])).toEqual([
      ['Placed', 'done'],
      ['Accepted', 'done'],
      ['Assembling', 'done'],
      ['InTransit', 'done'],
      ['DeliveryFailed', 'current'],
      ['Delivered', 'upcoming'],
    ]);
  });

  it('покупець бачить причину й переносить доставку на інший слот', async () => {
    backend.addOrder('DeliveryFailed');
    const { user } = await renderApp('/orders/1001', { signedIn: true });

    expect(await screen.findByText('Кур\'єр не зміг вручити замовлення')).toBeInTheDocument();
    expect(screen.getByText(/Покупця не було вдома/)).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Статус замовлення' })).toHaveTextContent('Не вручено');
    expect(screen.getByRole('button', { name: 'Перенести доставку' })).toBeDisabled();
    expect(await screen.findByRole('radio', { name: /місць немає/ })).toBeDisabled();

    await user.click(screen.getByRole('radio', { name: /вільних місць: 3/ }));
    await user.click(screen.getByRole('button', { name: 'Перенести доставку' }));

    expect(await screen.findByText(/Доставку перенесено/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('status', { name: 'Статус замовлення' })).toHaveTextContent('В дорозі'));
    expect(screen.queryByRole('button', { name: 'Перенести доставку' })).not.toBeInTheDocument();
  });
});
