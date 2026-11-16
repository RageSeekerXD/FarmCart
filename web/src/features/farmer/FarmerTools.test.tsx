import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '../../test/render';
import { backend } from '../../test/server';

async function asFarmer(route: string) {
  backend.asFarmer();
  localStorage.setItem('farmcart.role', 'Farmer');
  return renderApp(route, { signedIn: true });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Залишок прямо в списку товарів', () => {
  it('«+» і «−» змінюють залишок без форми товару', async () => {
    const { user } = await asFarmer('/farmer/products');

    const carrots = await screen.findByRole('listitem', { name: 'Морква' });
    await user.click(within(carrots).getByRole('button', { name: 'Збільшити залишок: Морква' }));
    expect(await within(carrots).findByRole('group', { name: 'Залишок: Морква, 201' })).toBeInTheDocument();
    await user.click(within(carrots).getByRole('button', { name: 'Зменшити залишок: Морква' }));

    await waitFor(() => expect(backend.stockChanges).toEqual([{ id: 1, delta: 1 }, { id: 1, delta: -1 }]));
  });

  it('перемикач «у продажу» ставить «немає в наявності» й повертає попередній залишок', async () => {
    const { user } = await asFarmer('/farmer/products');

    const carrots = await screen.findByRole('listitem', { name: 'Морква' });
    await user.click(within(carrots).getByRole('switch', { name: 'У продажу: Морква' }));
    expect(await within(carrots).findByText('Немає в наявності')).toBeInTheDocument();
    await user.click(within(carrots).getByRole('switch', { name: 'У продажу: Морква' }));

    expect(await within(carrots).findByRole('group', { name: 'Залишок: Морква, 200' })).toBeInTheDocument();
    expect(backend.stockChanges).toEqual([{ id: 1, delta: -200 }, { id: 1, delta: 200 }]);
  });
});

describe('Профіль ферми й документи', () => {
  it('історія ферми й дні доставки зберігаються', async () => {
    const { user } = await asFarmer('/farmer/products');

    await user.click(await screen.findByRole('button', { name: 'Профіль ферми' }));
    const dialog = await screen.findByRole('dialog', { name: 'Профіль ферми для покупців' });
    await user.type(within(dialog).getByLabelText('Історія ферми українською'), 'Ферма з 2009 року');
    await user.click(within(dialog).getByRole('button', { name: 'Зберегти' }));
    expect(within(dialog).getByText('Історію ферми потрібно обома мовами або жодною.')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Історія ферми англійською'), 'A farm since 2009');
    await user.click(within(dialog).getByRole('checkbox', { name: 'сб' }));
    await user.click(within(dialog).getByRole('button', { name: 'Зберегти' }));

    expect(await screen.findByText('Профіль ферми збережено')).toBeInTheDocument();
    expect(backend.farm).toMatchObject({ story: { uk: 'Ферма з 2009 року', en: 'A farm since 2009' }, deliveryDays: ['Saturday'] });
  });

  it('фермер завантажує скан документа для верифікації, а невідомий тип відхиляється ще до надсилання', async () => {
    backend.asFarmer(false);
    localStorage.setItem('farmcart.role', 'Farmer');
    const { user } = await renderApp('/farmer/products', { signedIn: true });

    await user.click(await screen.findByRole('button', { name: 'Документи (0)' }));
    const dialog = await screen.findByRole('dialog', { name: 'Документи для верифікації' });
    const input = dialog.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(['%PDF-1.7'], 'Сертифікат.pdf', { type: 'application/pdf' }));

    expect(await within(dialog).findByText('Сертифікат.pdf')).toBeInTheDocument();
    expect(backend.documents).toHaveLength(1);

    // Поле приймає лише PDF/JPEG/PNG, але файл можна перетягнути в обхід фільтра - тоді його відхиляє перевірка.
    fireEvent.change(input, { target: { files: [new File(['x'], 'photo.gif', { type: 'image/gif' })] } });
    expect(await screen.findByText('Завантажте документ у форматі PDF, JPEG або PNG.')).toBeInTheDocument();
    expect(backend.documents).toHaveLength(1);
  });
});

describe('Вхідні замовлення: контакти, під’їзд, коментар, накладна', () => {
  it('картка показує покупця з дзвінком, під’їзд і коментар; накладна друкується', async () => {
    backend.addOrder('Placed', { comment: 'Наріжте хліб скибками', addressDetails: { entrance: '2', floor: '3', intercom: '5К' } });
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const { user } = await asFarmer('/farmer/orders');

    const card = await screen.findByRole('listitem', { name: 'Замовлення №1001' });
    expect(within(card).getByText(/Наріжте хліб скибками/)).toBeInTheDocument();
    expect(within(card).getByText('під’їзд 2, поверх 3, домофон 5К')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Зателефонувати: Оксана Демченко, замовлення №1001' })).toHaveAttribute('href', 'tel:+380931112233');

    await user.click(within(card).getByRole('button', { name: 'Друкувати накладну до замовлення №1001' }));

    const slip = await screen.findByTestId('print-area');
    expect(slip).toHaveTextContent('Накладна до замовлення №1001');
    expect(slip).toHaveTextContent('Морква');
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
  });

  it('посилання зі сповіщення (?order=) показує й виділяє саме це замовлення', async () => {
    backend.addOrder('Delivered');
    backend.addOrder('Placed');
    await asFarmer('/farmer/orders?order=1001');

    const target = await screen.findByRole('listitem', { name: 'Замовлення №1001' });
    expect(target).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('listitem', { name: 'Замовлення №1002' })).not.toHaveAttribute('aria-current');
  });
});

describe('Лист збирання й аналітика', () => {
  it('лист збирання підсумовує товари слоту з усіх нових і прийнятих замовлень', async () => {
    backend.addOrder('Placed');
    backend.addOrder('Accepted');
    backend.addOrder('InTransit');
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const { user } = await asFarmer('/farmer/picking');

    const table = await screen.findByRole('table', { name: /Лист збирання на/ });
    const row = within(table).getByRole('row', { name: /Морква/ });
    expect(row).toHaveTextContent('20 × кг');
    expect(row).toHaveTextContent('№1001, №1002');

    await user.click(within(row).getByRole('checkbox', { name: 'Зібрано: Морква' }));
    expect(within(row).getByRole('checkbox', { name: 'Зібрано: Морква' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Друкувати' }));
    await waitFor(() => expect(print).toHaveBeenCalled());
  });

  it('аналітика: виторг, очікуване, середній чек, таблиця за днями й популярні товари', async () => {
    backend.addOrder('Delivered');
    backend.addOrder('Placed');
    backend.addOrder('Cancelled');
    const { user } = await asFarmer('/farmer/stats');

    expect(await screen.findByText('Виторг (доставлені)')).toBeInTheDocument();
    expect(screen.getByText('Скасовано й відхилено').nextSibling).toHaveTextContent('33 %');
    expect(screen.getAllByRole('img', { name: /замовлень: \d/ }).length).toBeGreaterThan(10);

    await user.click(screen.getByRole('button', { name: 'Таблицею' }));
    expect(screen.getByRole('table', { name: 'Замовлення за днями доставки' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Найпопулярніші товари' })).getByText('Морква')).toBeInTheDocument();
  });
});
