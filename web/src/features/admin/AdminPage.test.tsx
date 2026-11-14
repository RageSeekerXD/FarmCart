import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../../test/render';
import { backend, farmProfile, user as userWith } from '../../test/server';

async function asAdmin(lang: 'uk' | 'en' = 'uk') {
  backend.user = userWith('Buyer', 'Admin');
  localStorage.setItem('farmcart.role', 'Admin');
  return renderApp('/admin', { signedIn: true, lang });
}

const sokilnyky = { ...farmProfile, id: 4, name: { uk: 'Еко-ферма «Сокільники»', en: 'Sokilnyky Eco Farm' }, verified: false };

describe('UI-11 Верифікація продавців', () => {
  it('черга заявок: адміністратор верифікує господарство, і воно зникає з черги', async () => {
    backend.pendingFarmers = [sokilnyky, { ...sokilnyky, id: 11, name: { uk: 'Пасіка «Золотий вулик»', en: 'Zolotyi Vulyk Apiary' }, certified: false }];
    const { user } = await asAdmin();

    const card = await screen.findByRole('listitem', { name: 'Еко-ферма «Сокільники»' });
    expect(within(card).getByText('Sokilnyky Eco Farm')).toBeInTheDocument();
    expect(within(card).getByText('Органічний сертифікат')).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Верифікувати: Еко-ферма «Сокільники»' }));

    expect(await screen.findByText('Верифіковано: Еко-ферма «Сокільники»')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('listitem', { name: 'Еко-ферма «Сокільники»' })).not.toBeInTheDocument());
    expect(screen.getByRole('listitem', { name: 'Пасіка «Золотий вулик»' })).toBeInTheDocument();
  });

  it('порожня черга так і називається', async () => {
    await asAdmin();

    expect(await screen.findByText('Заявок на верифікацію немає.')).toBeInTheDocument();
  });

  it('не-адміністратор бачить відмову сервера мовою інтерфейсу', async () => {
    backend.user = userWith('Buyer', 'Admin');
    localStorage.setItem('farmcart.role', 'Admin');
    const view = await renderApp('/admin', { signedIn: true, lang: 'en' });
    await screen.findByText('No applications awaiting verification.');
    view.unmount();

    backend.user = { ...userWith('Buyer', 'Admin'), roles: ['Buyer'] };
    await renderApp('/admin', { signedIn: true, lang: 'en' });

    expect(await screen.findByRole('heading', { name: 'This section is not available for your role' })).toBeInTheDocument();
  });
});

describe('UI-11 Слоти доставки', () => {
  it('показує майбутні слоти й додає новий', async () => {
    const { user } = await asAdmin();

    await user.click(await screen.findByRole('tab', { name: 'Слоти доставки' }));
    const upcoming = await screen.findByRole('list', { name: 'Майбутні слоти' });
    expect(within(upcoming).getAllByRole('listitem')).toHaveLength(2);

    const form = screen.getByRole('form', { name: 'Новий слот доставки' });
    await user.clear(within(form).getByLabelText(/Місць/));
    await user.type(within(form).getByLabelText(/Місць/), '5');
    await user.click(within(form).getByRole('button', { name: 'Додати' }));

    expect(await screen.findByText('Слот доставки додано')).toBeInTheDocument();
    const request = backend.adminRequests[0]!;
    expect(request.path).toBe('slots');
    expect(request.body.capacity).toBe(5);
    expect(new Date(String(request.body.end)).getTime() - new Date(String(request.body.start)).getTime()).toBe(2 * 3600 * 1000);
  });

  it('слот, що закінчується раніше, ніж починається, відхиляється з поясненням', async () => {
    const { user } = await asAdmin();
    await user.click(await screen.findByRole('tab', { name: 'Слоти доставки' }));
    const form = await screen.findByRole('form', { name: 'Новий слот доставки' });

    await user.clear(within(form).getByLabelText(/Кінець/));
    await user.type(within(form).getByLabelText(/Кінець/), '09:00');
    await user.click(within(form).getByRole('button', { name: 'Додати' }));

    expect(await within(form).findByRole('alert')).toHaveTextContent('Слот має закінчуватися пізніше, ніж починається');
  });
});

describe('UI-11 Промокоди', () => {
  it('створює промокод і показує його; дубль відхиляється', async () => {
    const { user } = await asAdmin();
    await user.click(await screen.findByRole('tab', { name: 'Промокоди' }));
    const form = await screen.findByRole('form', { name: 'Новий промокод' });
    expect(await within(screen.getByRole('list', { name: 'Промокоди' })).findByText('FARM10')).toBeInTheDocument();

    await user.type(within(form).getByLabelText(/Код/), 'autumn15');
    await user.clear(within(form).getByLabelText(/Знижка/));
    await user.type(within(form).getByLabelText(/Знижка/), '15');
    await user.click(within(form).getByRole('button', { name: 'Додати' }));

    expect(await screen.findByText('Промокод AUTUMN15 створено')).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Промокоди' });
    expect(await within(list).findByText('AUTUMN15')).toBeInTheDocument();
    expect(within(list).getByText(/−15 % від 300,00/)).toBeInTheDocument();
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(backend.adminRequests[0]!.body).toMatchObject({ code: 'AUTUMN15', percent: 15, minTotal: 300 });

    await user.type(within(form).getByLabelText(/Код/), 'FARM10');
    await user.click(within(form).getByRole('button', { name: 'Додати' }));

    expect(await within(form).findByRole('alert')).toHaveTextContent('Такий промокод уже існує.');
  });
});

describe('UI-11 Журнал аудиту', () => {
  it('показує дії від найновішої; назва дії - мовою інтерфейсу', async () => {
    backend.record('farmer.verify', 'farmer#4', 'Верифіковано продавця «Еко-ферма «Сокільники»»');
    backend.record('promo.create', 'promo#AUTUMN15', '15 %');
    backend.record('custom.action', 'x#1', '-');
    const { user } = await asAdmin('en');

    await user.click(await screen.findByRole('tab', { name: 'Audit log' }));
    const entries = await screen.findAllByRole('listitem');

    expect(entries.map((entry) => entry.textContent)).toEqual([
      expect.stringContaining('custom.action'),
      expect.stringContaining('Promo code created · promo#AUTUMN15'),
      expect.stringContaining('Seller verified · farmer#4'),
    ]);
    expect(within(entries[1]!).getByText(/administrator #1/)).toBeInTheDocument();
  });

  it('після верифікації запис одразу з’являється в журналі', async () => {
    backend.pendingFarmers = [sokilnyky];
    const { user } = await asAdmin();

    await user.click(await screen.findByRole('button', { name: /Верифікувати: Еко-ферма/ }));
    await screen.findByText(/Верифіковано: Еко-ферма/);
    await user.click(screen.getByRole('tab', { name: 'Журнал аудиту' }));

    expect(await screen.findByText(/Верифікація продавця/)).toBeInTheDocument();
  });

  it('порожній журнал так і називається', async () => {
    const { user } = await asAdmin();

    await user.click(await screen.findByRole('tab', { name: 'Журнал аудиту' }));

    expect(await screen.findByText('Журнал порожній.')).toBeInTheDocument();
  });
});

describe('Модерація відгуків', () => {
  it('адміністратор бачить усі відгуки, приховує з причиною й повертає', async () => {
    backend.addFarmReview(5, 'Чудова ферма');
    const spam = backend.addFarmReview(1, 'Купуйте в іншому магазині!', 'Тролль');
    const { user } = await asAdmin();
    await user.click(await screen.findByRole('tab', { name: 'Відгуки' }));

    const card = await screen.findByRole('listitem', { name: `Відгук #${spam.id}` });
    await user.click(within(card).getByRole('button', { name: `Приховати відгук #${spam.id}` }));
    const dialog = await screen.findByRole('dialog', { name: 'Приховати відгук?' });
    await user.click(within(dialog).getByRole('button', { name: 'Приховати' }));
    expect(within(dialog).getByText('Вкажіть причину.')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/Причина/), 'Реклама конкурента');
    await user.click(within(dialog).getByRole('button', { name: 'Приховати' }));

    expect(await screen.findByText('Відгук приховано')).toBeInTheDocument();
    await waitFor(() => expect(within(screen.getByRole('listitem', { name: `Відгук #${spam.id}` })).getByText('Причина: Реклама конкурента')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: `Показати знову відгук #${spam.id}` }));
    expect(await screen.findByText('Відгук знову видимий')).toBeInTheDocument();
    await waitFor(() => expect(within(screen.getByRole('listitem', { name: `Відгук #${spam.id}` })).queryByText('Приховано')).not.toBeInTheDocument());
  });
});

describe('Дії адміністратора: відхилення, слоти, промокоди', () => {
  it('заявку продавця відхиляють лише з причиною; вона зникає з черги', async () => {
    backend.pendingFarmers = [{ ...farmProfile, id: 10, name: { uk: 'Еко-ферма «Сокільники»', en: 'Sokilnyky Eco Farm' }, verified: false }];
    const { user } = await asAdmin();

    await user.click(await screen.findByRole('button', { name: 'Відхилити заявку: Еко-ферма «Сокільники»' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Відхилити' }));
    expect(within(dialog).getByText('Вкажіть причину.')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/Причина/), 'Немає документів');
    await user.click(within(dialog).getByRole('button', { name: 'Відхилити' }));

    expect(await screen.findByText('Заявку відхилено: Еко-ферма «Сокільники»')).toBeInTheDocument();
    expect(await screen.findByText('Заявок на верифікацію немає.')).toBeInTheDocument();
  });

  it('порожній слот змінюють і видаляють; у слоті із замовленнями час заблоковано, а кнопки видалення немає', async () => {
    const { user } = await asAdmin();
    await user.click(await screen.findByRole('tab', { name: 'Слоти доставки' }));
    const list = await screen.findByRole('list', { name: 'Майбутні слоти' });
    const [free, full] = within(list).getAllByRole('listitem');

    expect(within(full!).queryByRole('button', { name: /Видалити слот/ })).not.toBeInTheDocument();
    await user.click(within(full!).getByRole('button', { name: /Змінити слот/ }));
    const locked = await screen.findByRole('dialog', { name: 'Зміна слоту доставки' });
    expect(within(locked).getByLabelText('Дата')).toBeDisabled();
    await user.clear(within(locked).getByLabelText('Місць'));
    await user.type(within(locked).getByLabelText('Місць'), '1');
    await user.click(within(locked).getByRole('button', { name: 'Зберегти' }));
    expect(await within(locked).findByText('Ємність не може бути меншою за кількість уже заброньованих місць.')).toBeInTheDocument();
    await user.click(within(locked).getByRole('button', { name: 'Скасувати' }));

    await user.click(within(free!).getByRole('button', { name: /Змінити слот/ }));
    const editing = await screen.findByRole('dialog', { name: 'Зміна слоту доставки' });
    await user.clear(within(editing).getByLabelText('Місць'));
    await user.type(within(editing).getByLabelText('Місць'), '5');
    await user.click(within(editing).getByRole('button', { name: 'Зберегти' }));
    expect(await screen.findByText('Слот доставки змінено')).toBeInTheDocument();
    expect(backend.slotList[0]!.capacity).toBe(5);

    await user.click(within(screen.getAllByRole('listitem')[0]!).getByRole('button', { name: /Видалити слот/ }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Видалити слот доставки?' })).getByRole('button', { name: 'Видалити слот' }));
    expect(await screen.findByText('Слот доставки видалено')).toBeInTheDocument();
    await waitFor(() => expect(within(screen.getByRole('list', { name: 'Майбутні слоти' })).getAllByRole('listitem')).toHaveLength(1));
  });

  it('промокод вимикають і вмикають', async () => {
    const { user } = await asAdmin();
    await user.click(await screen.findByRole('tab', { name: 'Промокоди' }));

    await user.click(await screen.findByRole('button', { name: 'Вимкнути промокод FARM10' }));

    expect(await screen.findByText('Промокод FARM10 вимкнено')).toBeInTheDocument();
    expect(await within(screen.getByRole('list', { name: 'Промокоди' })).findByText('Вимкнено')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Увімкнути промокод FARM10' }));
    expect(await screen.findByText('Промокод FARM10 знову діє')).toBeInTheDocument();
  });
});
