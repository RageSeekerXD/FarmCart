import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { session } from '../../api/client';
import { CYRILLIC, renderApp } from '../../test/render';
import { backend, TOKEN, user as userWith } from '../../test/server';

const ACCOUNTS = [
  { phone: '+380931112233', role: 'Buyer' as const, title: { uk: 'Покупець з історією замовлень', en: 'Buyer with order history' } },
  { phone: '+380671110009', role: 'Farmer' as const, title: { uk: 'Фермер: пекарня «Житній колос»', en: 'Farmer: Zhytnii Kolos Bakery' } },
  { phone: '+380631230001', role: 'Courier' as const, title: { uk: 'Кур’єр з доставкою в дорозі', en: 'Courier with a delivery on the way' } },
  { phone: '+380500000001', role: 'Admin' as const, title: { uk: 'Адміністратор', en: 'Administrator' } },
];

describe('демонстраційні акаунти: показ усіх ролей', () => {
  it('на сторінці входу є кнопка на кожну роль; одне натискання відкриває екран цієї ролі', async () => {
    backend.demoAccounts = ACCOUNTS;
    backend.asFarmer();
    const { user } = await renderApp('/login');

    const section = await screen.findByRole('region', { name: 'Демонстраційні акаунти' });
    expect(within(section).getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Покупець · Покупець з історією замовлень',
      'Фермер · Фермер: пекарня «Житній колос»',
      'Кур’єр · Кур’єр з доставкою в дорозі'.replace('Кур’єр ·', "Кур'єр ·"),
      'Адміністратор · Адміністратор',
    ]);

    await user.click(within(section).getByRole('button', { name: /^Фермер/ }));

    expect(await screen.findByRole('heading', { name: 'Вхідні замовлення' })).toBeInTheDocument();
    expect(session.token).toBe(TOKEN);
    expect(localStorage.getItem('farmcart.role')).toBe('Farmer');
  });

  it('у шапці можна перейти в інший демо-акаунт без виходу', async () => {
    backend.demoAccounts = ACCOUNTS;
    const { user } = await renderApp('/', { signedIn: true });
    await screen.findByRole('article', { name: 'Морква' });

    backend.user = userWith('Buyer', 'Admin');
    await user.click(await screen.findByRole('button', { name: 'Змінити демо-акаунт' }));
    await user.click(await screen.findByRole('menuitem', { name: /Адміністратор/ }));

    expect(await screen.findByRole('heading', { name: 'Адміністрування' })).toBeInTheDocument();
    expect(localStorage.getItem('farmcart.role')).toBe('Admin');
  });

  it('поза демонстраційним режимом ні кнопок, ні перемикача немає', async () => {
    const view = await renderApp('/login');
    await screen.findByRole('heading', { name: 'Вхід за номером телефону' });
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Демонстраційні акаунти' })).not.toBeInTheDocument());
    view.unmount();

    await renderApp('/', { signedIn: true });
    await screen.findByRole('button', { name: 'Вийти' });

    expect(screen.queryByRole('button', { name: 'Змінити демо-акаунт' })).not.toBeInTheDocument();
  });

  it('англійською підписи акаунтів англійські; помилка входу показується', async () => {
    backend.demoAccounts = [{ ...ACCOUNTS[3]!, phone: 'bad-phone' }];
    const { user } = await renderApp('/login', { lang: 'en' });

    await user.click(await screen.findByRole('button', { name: 'Administrator · Administrator' }));

    expect(await screen.findByText('Enter the phone number as +380XXXXXXXXX.')).toBeInTheDocument();
    expect(CYRILLIC.test(document.body.textContent ?? '')).toBe(false);
  });
});
