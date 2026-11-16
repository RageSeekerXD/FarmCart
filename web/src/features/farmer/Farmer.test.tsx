import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderApp } from '../../test/render';
import { backend } from '../../test/server';
import type { LocationPickerProps } from './LocationPicker';

// Мапу Leaflet автотести не перевіряють: замість неї кнопка, що «клацає» по точці.
vi.mock('./LocationPicker', () => ({
  default: ({ value, onChange }: LocationPickerProps) => (
    <button type="button" data-testid="picker" data-lat={value.lat} onClick={() => onChange({ lat: 49.9, lon: 23.96 })}>
      pick point
    </button>
  ),
}));

async function asFarmer(route: string, { verified = true, lang = 'uk' as 'uk' | 'en' } = {}) {
  backend.asFarmer(verified);
  localStorage.setItem('farmcart.role', 'Farmer');
  return renderApp(route, { signedIn: true, lang });
}

describe('UI-08 Реєстрація господарства', () => {
  it('покупець бачить «Стати продавцем», реєструє господарство двома мовами з точкою на мапі й потрапляє в кабінет', async () => {
    const { user } = await renderApp('/', { signedIn: true });

    await user.click(await screen.findByRole('tab', { name: 'Стати продавцем' }));
    await user.type(await screen.findByLabelText(/Назва господарства українською/), 'Ферма «Сонях»');
    await user.type(screen.getByLabelText(/Назва господарства англійською/), 'Soniakh Farm');
    await user.click(await screen.findByTestId('picker'));
    await user.click(screen.getByRole('checkbox', { name: 'Маю органічний сертифікат' }));
    await user.click(screen.getByRole('button', { name: 'Подати заявку' }));

    expect(await screen.findByRole('heading', { name: 'Мої товари' })).toBeInTheDocument();
    expect(backend.registrations).toEqual([{ farmName: { uk: 'Ферма «Сонях»', en: 'Soniakh Farm' }, lat: 49.9, lon: 23.96, certified: true, documents: null }]);
    expect(await screen.findByText('Очікує верифікації')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Додати товар' })).toBeDisabled();
    expect(screen.getByText(/Адміністратор ще перевіряє вашу заявку/)).toBeInTheDocument();
    expect(localStorage.getItem('farmcart.role')).toBe('Farmer');
  });

  it('без англійської назви чи з хибними координатами заявка не надсилається', async () => {
    const { user } = await renderApp('/farmer/register', { signedIn: true });

    await user.type(await screen.findByLabelText(/Назва господарства українською/), 'Ферма');
    await user.clear(screen.getByLabelText(/Широта/));
    await user.type(screen.getByLabelText(/Широта/), '95');
    await user.click(screen.getByRole('button', { name: 'Подати заявку' }));

    expect(screen.getByText('Вкажіть назву цією мовою.')).toBeInTheDocument();
    expect(screen.getByText('Некоректні координати.')).toBeInTheDocument();
    expect(backend.registrations).toHaveLength(0);
  });

  it('координати можна ввести вручну з комою', async () => {
    const { user } = await renderApp('/farmer/register', { signedIn: true });

    await user.type(await screen.findByLabelText(/Назва господарства українською/), 'Ферма');
    await user.type(screen.getByLabelText(/Назва господарства англійською/), 'Farm');
    await user.clear(screen.getByLabelText(/Широта/));
    await user.type(screen.getByLabelText(/Широта/), '49,5');
    await user.click(screen.getByRole('button', { name: 'Подати заявку' }));

    await waitFor(() => expect(backend.registrations[0]).toMatchObject({ lat: 49.5, lon: 24.0315, certified: false }));
  });
});

describe('UI-08 Товари фермера', () => {
  it('показує господарство й товари з обома назвами, сезоном і залишком', async () => {
    await asFarmer('/farmer/products');

    const carrots = await screen.findByRole('listitem', { name: 'Морква' });
    const strawberries = screen.getByRole('listitem', { name: 'Полуниця' });

    expect(screen.getByText('Верифіковано')).toBeInTheDocument();
    expect(within(carrots).getByText('Carrots')).toBeInTheDocument();
    expect(within(carrots).getByText(/Овочі · цілий рік/)).toBeInTheDocument();
    expect(within(strawberries).getByText(/трав\.?, черв\.?, лип\.?/)).toBeInTheDocument();
    expect(within(strawberries).getByText('Немає в наявності')).toBeInTheDocument();
  });

  it('новий товар: назви двома мовами, категорія й одиниця зі списків, сезон місяцями', async () => {
    const { user } = await asFarmer('/farmer/products');

    await user.click(await screen.findByRole('button', { name: 'Додати товар' }));
    const dialog = await screen.findByRole('dialog', { name: 'Новий товар' });
    await user.type(within(dialog).getByLabelText(/Назва товару українською/), 'Мед липовий');
    await user.type(within(dialog).getByLabelText(/Назва товару англійською/), 'Linden honey');
    await user.click(within(dialog).getByRole('combobox', { name: /Категорія/ }));
    await user.click(await screen.findByRole('option', { name: 'Мед' }));
    await user.click(within(dialog).getByRole('combobox', { name: /Одиниця продажу/ }));
    await user.click(await screen.findByRole('option', { name: 'л' }));
    await user.type(within(dialog).getByLabelText(/Ціна за одиницю/), '290,5');
    await user.type(within(dialog).getByLabelText(/Залишок/), '20');
    await user.click(within(dialog).getByRole('button', { name: /лип/ }));
    await user.click(within(dialog).getByRole('button', { name: /черв/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Зберегти' }));

    expect(await screen.findByText('Збережено: Мед липовий')).toBeInTheDocument();
    expect(await screen.findByRole('listitem', { name: 'Мед липовий' })).toBeInTheDocument();
    expect(backend.productRequests).toEqual([
      { method: 'POST', id: null, body: { name: { uk: 'Мед липовий', en: 'Linden honey' }, category: 'honey', unit: 'l', price: 290.5, stock: 20, seasonMonths: [6, 7], description: { uk: '', en: '' }, composition: { uk: '', en: '' }, shelfLife: { uk: '', en: '' }, storage: { uk: '', en: '' } } },
    ]);
  });

  it('порожня форма підказує, що заповнити, і нічого не надсилає', async () => {
    const { user } = await asFarmer('/farmer/products');

    await user.click(await screen.findByRole('button', { name: 'Додати товар' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Зберегти' }));

    expect(within(dialog).getAllByText('Вкажіть назву цією мовою.')).toHaveLength(2);
    expect(within(dialog).getAllByText('Оберіть значення зі списку.')).toHaveLength(2);
    expect(within(dialog).getByText('Ціна має бути більшою за нуль.')).toBeInTheDocument();
    expect(backend.productRequests).toHaveLength(0);
  });

  it('зміна товару надсилає назву, ціну, залишок і сезон; категорія й одиниця незмінні', async () => {
    const { user } = await asFarmer('/farmer/products');

    await user.click(await screen.findByRole('button', { name: 'Змінити товар: Полуниця' }));
    const dialog = await screen.findByRole('dialog', { name: 'Зміна товару' });
    expect(within(dialog).getByRole('combobox', { name: /Категорія/ })).toHaveAttribute('aria-disabled', 'true');
    expect(within(dialog).getByRole('button', { name: /черв/ })).toHaveAttribute('aria-pressed', 'true');
    await user.clear(within(dialog).getByLabelText(/Залишок/));
    await user.type(within(dialog).getByLabelText(/Залишок/), '40');
    await user.click(within(dialog).getByRole('button', { name: /лип/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Зберегти' }));

    await waitFor(() =>
      expect(backend.productRequests).toEqual([
        { method: 'PATCH', id: 4, body: { name: { uk: 'Полуниця', en: 'Strawberries' }, price: 95, stock: 40, seasonMonths: [5, 6], description: { uk: '', en: '' }, composition: { uk: '', en: '' }, shelfLife: { uk: '', en: '' }, storage: { uk: '', en: '' } } },
      ]),
    );
    expect(await within(await screen.findByRole('listitem', { name: 'Полуниця' })).findByRole('group', { name: 'Залишок: Полуниця, 40' })).toBeInTheDocument();
  });

  it('помилка сервера показується у формі мовою інтерфейсу, форму можна скасувати', async () => {
    const { user } = await asFarmer('/farmer/products', { lang: 'en' });

    await user.click(await screen.findByRole('button', { name: 'Edit product: Carrots' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit product' });
    await user.clear(within(dialog).getByLabelText(/Price per unit/));
    await user.type(within(dialog).getByLabelText(/Price per unit/), '99999');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await within(dialog).findByText('The price must be greater than zero.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('UI-09 Вхідні замовлення фермера', () => {
  it('приймає замовлення з нестачею: сума зменшується, статус змінюється', async () => {
    backend.addOrder('Placed');
    const { user } = await asFarmer('/farmer/orders');

    await user.click(await screen.findByRole('button', { name: 'Прийняти: Замовлення №1001' }));
    const dialog = await screen.findByRole('dialog', { name: 'Прийняти замовлення №1001' });
    await user.type(within(dialog).getByLabelText('Бракує: Морква (замовлено 10)'), '2');
    await user.click(within(dialog).getByRole('button', { name: 'Прийняти' }));

    const card = await screen.findByRole('listitem', { name: 'Замовлення №1001' });
    await waitFor(() => expect(within(card).getByText('Прийнято фермером')).toBeInTheDocument());
    expect(within(card).getByText('Морква — 8 × кг')).toBeInTheDocument();
    expect(within(card).getByText(/128,00/)).toBeInTheDocument();
    expect(backend.actions).toEqual([{ orderId: 1001, kind: 'accept', body: { shortages: [{ productId: 1, quantity: 2 }] } }]);
    expect(within(card).queryByText('4821')).not.toBeInTheDocument();
  });

  it('нестача, більша за замовлену кількість, не надсилається', async () => {
    backend.addOrder('Placed');
    const { user } = await asFarmer('/farmer/orders');

    await user.click(await screen.findByRole('button', { name: 'Прийняти: Замовлення №1001' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Бракує: Морква/), '11');
    await user.click(within(dialog).getByRole('button', { name: 'Прийняти' }));

    expect(within(dialog).getByText('Нестача — ціле число від 0 до замовленої кількості.')).toBeInTheDocument();
    expect(backend.actions).toHaveLength(0);
  });

  it('відхиляє замовлення лише з причиною', async () => {
    backend.addOrder('Placed');
    const { user } = await asFarmer('/farmer/orders');

    await user.click(await screen.findByRole('button', { name: 'Відхилити: Замовлення №1001' }));
    const dialog = await screen.findByRole('dialog', { name: 'Відхилити замовлення №1001' });
    await user.click(within(dialog).getByRole('button', { name: 'Відхилити' }));
    expect(within(dialog).getByText('Вкажіть причину.')).toBeInTheDocument();
    expect(backend.actions).toHaveLength(0);

    await user.type(within(dialog).getByLabelText(/Причина відхилення/), 'Морква закінчилася');
    await user.click(within(dialog).getByRole('button', { name: 'Відхилити' }));

    await waitFor(() => expect(within(screen.getByRole('listitem', { name: 'Замовлення №1001' })).getByText('Відхилено')).toBeInTheDocument());
    expect(backend.actions).toEqual([{ orderId: 1001, kind: 'reject', body: { reason: 'Морква закінчилася' } }]);
  });

  it('збирає замовлення й передає його обраному кур’єру', async () => {
    backend.addOrder('Accepted');
    const { user } = await asFarmer('/farmer/orders');

    await user.click(await screen.findByRole('button', { name: 'Почати збирати: Замовлення №1001' }));
    await user.click(await screen.findByRole('button', { name: 'Передати кур’єру: Замовлення №1001' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('combobox', { name: /Кур’єр/ }));
    await user.click(await screen.findByRole('option', { name: 'Андрій Шевчук' }));
    await user.click(within(dialog).getByRole('button', { name: 'Передати кур’єру' }));

    await waitFor(() => expect(within(screen.getByRole('listitem', { name: 'Замовлення №1001' })).getByText('В дорозі')).toBeInTheDocument());
    expect(backend.actions.map((action) => [action.kind, action.body])).toEqual([
      ['assemble', {}],
      ['handover', { courierId: 2 }],
    ]);
  });

  it('фільтр за групою: нові окремо від завершених, з лічильниками', async () => {
    backend.addOrder('Placed');
    backend.addOrder('Delivered');
    const { user } = await asFarmer('/farmer/orders');
    await screen.findByRole('listitem', { name: 'Замовлення №1001' });
    expect(screen.getByRole('button', { name: 'Усі · 2', pressed: true })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Нові · 1' }));
    expect(screen.getByRole('listitem', { name: 'Замовлення №1001' })).toBeInTheDocument();
    expect(screen.queryByRole('listitem', { name: 'Замовлення №1002' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Завершені · 1' }));
    expect(screen.getByRole('listitem', { name: 'Замовлення №1002' })).toBeInTheDocument();
    expect(screen.queryByRole('listitem', { name: 'Замовлення №1001' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'У роботі · 0' }));
    expect(screen.getByText('У цій групі замовлень немає.')).toBeInTheDocument();
  });

  it('нове замовлення з’являється саме, без перезавантаження', async () => {
    await asFarmer('/farmer/orders');
    expect(await screen.findByText(/Замовлень ще немає/)).toBeInTheDocument();

    backend.addOrder('Placed');

    expect(await screen.findByRole('listitem', { name: 'Замовлення №1001' }, { timeout: 8000 })).toBeInTheDocument();
  }, 12_000);

  it('англійською рядки замовлення й дії - англійські', async () => {
    backend.addOrder('Placed', { address: '15 Horodotska St' });
    await asFarmer('/farmer/orders', { lang: 'en' });

    const card = await screen.findByRole('listitem', { name: 'Order No. 1001' });

    expect(within(card).getByText('Carrots — 10 × kg')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Accept: Order No. 1001' })).toBeInTheDocument();
  });

  it('покупцю кабінет продавця недоступний', async () => {
    await renderApp('/farmer/orders', { signedIn: true });

    expect(await screen.findByRole('heading', { name: 'Розділ недоступний для вашої ролі' })).toBeInTheDocument();
  });
});

describe('Опис товару', () => {
  it('опис однією мовою не зберігається; обома - потрапляє в товар', async () => {
    const { user } = await asFarmer('/farmer/products');
    await user.click(await screen.findByRole('button', { name: 'Додати товар' }));
    const dialog = await screen.findByRole('dialog', { name: 'Новий товар' });
    await user.type(within(dialog).getByLabelText(/Назва товару українською/), 'Мед липовий');
    await user.type(within(dialog).getByLabelText(/Назва товару англійською/), 'Linden honey');
    await user.click(within(dialog).getByRole('combobox', { name: /Категорія/ }));
    await user.click(await screen.findByRole('option', { name: 'Мед' }));
    await user.click(within(dialog).getByRole('combobox', { name: /Одиниця продажу/ }));
    await user.click(await screen.findByRole('option', { name: 'л' }));
    await user.type(within(dialog).getByLabelText(/Ціна за одиницю/), '290');
    await user.type(within(dialog).getByLabelText(/Залишок/), '20');
    await user.type(within(dialog).getByLabelText('Опис українською'), 'Світлий липовий мед');
    await user.click(within(dialog).getByRole('button', { name: 'Зберегти' }));

    expect(within(dialog).getByText('Опис потрібен обома мовами або жодною.')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Опис англійською'), 'Light linden honey');
    await user.click(within(dialog).getByRole('button', { name: 'Зберегти' }));

    expect(await screen.findByText('Збережено: Мед липовий')).toBeInTheDocument();
    expect(backend.farmProducts.at(-1)!.description).toEqual({ uk: 'Світлий липовий мед', en: 'Light linden honey' });
  });
});

describe('Відхилена заявка продавця', () => {
  it('фермер бачить причину відхилення й подає заявку повторно', async () => {
    backend.asFarmer(false);
    backend.farm = { ...backend.farm!, rejectionReason: 'Немає документів' };
    localStorage.setItem('farmcart.role', 'Farmer');
    const { user } = await renderApp('/farmer/products', { signedIn: true });

    expect(await screen.findByText('Адміністратор відхилив заявку. Причина: Немає документів')).toBeInTheDocument();
    expect(screen.getByText('Заявку відхилено')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Подати повторно' }));

    expect(await screen.findByText('Заявку подано повторно - чекайте на перевірку')).toBeInTheDocument();
    expect(await screen.findByText('Очікує верифікації')).toBeInTheDocument();
  });
});

describe('Фото товару', () => {
  it('фото додають файлом; завелике не надсилається; фото можна прибрати', async () => {
    const { user } = await asFarmer('/farmer/products');
    const row = await screen.findByRole('listitem', { name: 'Морква' });
    const input = row.querySelector<HTMLInputElement>('input[type="file"]')!;

    const tooLarge = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'big.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [tooLarge] } });
    expect(await screen.findByText('Фото завелике: не більше 2 МБ.')).toBeInTheDocument();
    expect(backend.photoUploads).toHaveLength(0);

    fireEvent.change(input, { target: { files: [new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'carrots.png', { type: 'image/png' })] } });

    expect(await screen.findByText('Фото збережено: Морква')).toBeInTheDocument();
    expect(backend.photoUploads).toEqual([{ id: 1, type: 'image/png', bytes: 4 }]);
    await user.click(await within(row).findByRole('button', { name: 'Прибрати фото: Морква' }));
    expect(await screen.findByText('Фото прибрано: Морква')).toBeInTheDocument();
    await waitFor(() => expect(within(screen.getByRole('listitem', { name: 'Морква' })).queryByRole('button', { name: 'Прибрати фото: Морква' })).not.toBeInTheDocument());
  });
});
