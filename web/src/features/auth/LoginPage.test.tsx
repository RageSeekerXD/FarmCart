import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { session } from '../../api/client';
import { CYRILLIC, renderApp } from '../../test/render';
import { backend, TOKEN, user as userWith } from '../../test/server';

describe('UI-01 Вхід за номером телефону', () => {
  it('у режимі розробки показує код із кнопкою «Підставити» і впускає користувача', async () => {
    const { user } = await renderApp('/login');

    await user.clear(screen.getByLabelText(/Номер телефону/));
    await user.type(screen.getByLabelText(/Номер телефону/), '+380971234567');
    await user.click(screen.getByRole('button', { name: 'Отримати код' }));

    expect(await screen.findByText(/Ваш код — 123456/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Підставити' }));
    expect(screen.getByLabelText(/Код із SMS/)).toHaveValue('123456');
    await user.click(screen.getByRole('button', { name: 'Увійти' }));

    expect(await screen.findByRole('heading', { name: 'Каталог' })).toBeInTheDocument();
    expect(await screen.findByText(/Обліковий запис створено/)).toBeInTheDocument();
    expect(session.token).toBe(TOKEN);
    expect(screen.getByRole('button', { name: 'Вийти' })).toBeInTheDocument();
  });

  it('некоректний номер пояснюється українською', async () => {
    const { user } = await renderApp('/login');

    await user.type(screen.getByLabelText(/Номер телефону/), '12');
    await user.click(screen.getByRole('button', { name: 'Отримати код' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Вкажіть номер телефону у форматі +380XXXXXXXXX.');
  });

  it('хибний код пояснюється англійською без українського тексту сервера', async () => {
    const { user } = await renderApp('/login', { lang: 'en' });

    await user.clear(screen.getByLabelText(/Phone number/));
    await user.type(screen.getByLabelText(/Phone number/), '+380971234567');
    await user.click(screen.getByRole('button', { name: 'Get code' }));
    await user.type(await screen.findByLabelText(/Code from SMS/), '000000');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Wrong code. Check the SMS and try again.')).toBeInTheDocument();
    expect(CYRILLIC.test(document.body.textContent ?? '')).toBe(false);
    expect(session.token).toBeNull();
  });

  it('можна повернутися й змінити номер', async () => {
    const { user } = await renderApp('/login');

    await user.clear(screen.getByLabelText(/Номер телефону/));
    await user.type(screen.getByLabelText(/Номер телефону/), '+380971234567');
    await user.click(screen.getByRole('button', { name: 'Отримати код' }));
    await user.click(await screen.findByRole('button', { name: 'Змінити номер' }));

    expect(screen.getByLabelText(/Номер телефону/)).toHaveValue('+380971234567');
  });

  it('збережена сесія відновлюється, а вихід її стирає', async () => {
    const { user } = await renderApp('/', { signedIn: true });

    await user.click(await screen.findByRole('button', { name: 'Вийти' }));

    expect(await screen.findByRole('link', { name: 'Увійти' })).toBeInTheDocument();
    expect(session.token).toBeNull();
  });

  it('недійсна збережена сесія повертає користувача до гостьового режиму', async () => {
    session.token = 'stale-token';

    await renderApp('/');

    expect(await screen.findByRole('link', { name: 'Увійти' })).toBeInTheDocument();
    await waitFor(() => expect(session.token).toBeNull());
  });
});

describe('UI-01 Перемикач мови й ролі', () => {
  it('мова перемикається в шапці й зберігається', async () => {
    const { user } = await renderApp('/login');

    await user.click(screen.getByRole('button', { name: 'EN' }));

    expect(await screen.findByRole('heading', { name: 'Sign in with your phone number' })).toBeInTheDocument();
    expect(localStorage.getItem('farmcart.lang')).toBe('en');
    expect(CYRILLIC.test(document.body.textContent ?? '')).toBe(false);
  });

  it('користувач із кількома ролями перемикає роль і бачить її навігацію', async () => {
    backend.user = userWith('Buyer', 'Farmer');
    const { user } = await renderApp('/', { signedIn: true });

    await user.click(await screen.findByRole('combobox', { name: 'Роль' }));
    await user.click(await screen.findByRole('option', { name: 'Фермер' }));

    expect(await screen.findByRole('tab', { name: 'Мої товари' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Каталог' })).not.toBeInTheDocument();
    expect(localStorage.getItem('farmcart.role')).toBe('Farmer');
  });

  it('розділ іншої ролі недоступний, а гостя веде на вхід', async () => {
    const signedIn = await renderApp('/admin', { signedIn: true });
    expect(await screen.findByRole('heading', { name: 'Розділ недоступний для вашої ролі' })).toBeInTheDocument();
    signedIn.unmount();
    session.token = null;

    await renderApp('/cart');

    expect(await screen.findByRole('heading', { name: 'Вхід за номером телефону' })).toBeInTheDocument();
  });

  it('невідома адреса показує сторінку «не знайдено»', async () => {
    await renderApp('/nowhere');

    expect(screen.getByRole('heading', { name: 'Сторінку не знайдено' })).toBeInTheDocument();
  });
});

describe('тости й мова', () => {
  it('після перемикання мови тост попередньою мовою зникає', async () => {
    backend.putInCart(1, 1);
    const { user } = await renderApp('/cart', { signedIn: true });
    await user.click(await screen.findByRole('button', { name: 'Видалити з кошика: Морква' }));
    expect(await screen.findByText('Видалено: Морква')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'EN' }));

    await waitFor(() => expect(screen.queryByText('Видалено: Морква')).not.toBeInTheDocument());
    expect(CYRILLIC.test(document.body.textContent ?? '')).toBe(false);
  });
});
