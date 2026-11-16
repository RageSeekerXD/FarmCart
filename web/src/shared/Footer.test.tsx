import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../test/render';
import { backend, user as userWith } from '../test/server';

describe('Підвал і сторінка умов', () => {
  it('підвал має доставку й зберігання, повернення, контакти підтримки й реєстрацію фермерів', async () => {
    await renderApp('/');
    const footer = screen.getByRole('contentinfo');

    for (const title of ['Доставка й зберігання', 'Повернення', 'Підтримка', 'Фермерам']) {
      expect(within(footer).getByRole('heading', { name: title })).toBeInTheDocument();
    }

    expect(within(footer).getByRole('link', { name: '+380 32 000 00 00' })).toHaveAttribute('href', 'tel:+380320000000');
    expect(within(footer).getByRole('link', { name: 'Стати продавцем' })).toHaveAttribute('href', '/farmer/register');
    expect(within(footer).getByRole('link', { name: 'Як повернути товар' })).toHaveAttribute('href', '/info#returns');
  });

  it('сторінка умов розписує доставку, повернення, підтримку й реєстрацію продавця', async () => {
    await renderApp('/info#returns');

    expect(await screen.findByRole('heading', { level: 1, name: 'Покупцям і фермерам' })).toBeInTheDocument();
    const main = screen.getByRole('main');
    const returns = within(main).getByRole('region', { name: 'Повернення' });
    expect(within(returns).getByText(/протягом 24 годин після доставки/)).toBeInTheDocument();
    expect(within(main).getByRole('region', { name: 'Доставка й зберігання' })).toHaveTextContent('+2…+6 °C');
  });
});

describe('Роль у шапці показується один раз', () => {
  it('з кількома ролями - лише перемикач ролей, без окремого значка', async () => {
    backend.user = userWith('Buyer', 'Courier');
    localStorage.setItem('farmcart.role', 'Courier');
    await renderApp('/courier', { signedIn: true });

    expect(await screen.findByRole('combobox', { name: 'Роль' })).toHaveTextContent("Кур'єр");
    expect(screen.getAllByText(/Кур'єр/)).toHaveLength(1);
  });

  it('з однією роллю перемикача немає, а значок ролі є', async () => {
    await renderApp('/', { signedIn: true });

    await screen.findByRole('button', { name: 'Вийти' });
    expect(screen.queryByRole('combobox', { name: 'Роль' })).not.toBeInTheDocument();
    expect(screen.getByText(/Покупець/)).toBeInTheDocument();
  });
});
