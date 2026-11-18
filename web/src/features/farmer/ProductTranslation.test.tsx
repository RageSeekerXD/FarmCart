import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../../test/render';
import { backend } from '../../test/server';
import { missingTranslations } from './ProductDialog';

const empty = { uk: '', en: '' };

async function openNewProduct(available = true) {
  backend.asFarmer();
  backend.translationAvailable = available;
  localStorage.setItem('farmcart.role', 'Farmer');
  const { user } = await renderApp('/farmer/products', { signedIn: true, lang: 'uk' });
  await user.click(await screen.findByRole('button', { name: 'Додати товар' }));
  return { user, dialog: await screen.findByRole('dialog', { name: 'Новий товар' }) };
}

async function fill(user: ReturnType<typeof userEvent.setup>, field: HTMLElement, text: string) {
  await user.click(field);
  await user.paste(text);
}

describe('missingTranslations', () => {
  it('бере лише поля, заповнені однією мовою, у потрібному напрямку', () => {
    expect(
      missingTranslations({
        name: { uk: ' Мед ', en: '' },
        description: { uk: '', en: 'Sweet' },
        composition: { uk: 'Мед', en: 'Honey' },
        shelfLife: empty,
        storage: { uk: '   ', en: '' },
      }),
    ).toEqual([
      { field: 'name', targetLang: 'en', text: 'Мед' },
      { field: 'description', targetLang: 'uk', text: 'Sweet' },
    ]);
  });
});

describe('AI-1 Переклад у формі товару', () => {
  it('без налаштованого сервісу кнопки перекладу немає', async () => {
    const { dialog } = await openNewProduct(false);

    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Зберегти' })).toBeInTheDocument());
    expect(within(dialog).queryByRole('button', { name: 'Перекласти' })).not.toBeInTheDocument();
  });

  it('кнопка неактивна, доки немає поля, заповненого однією мовою', async () => {
    const { user, dialog } = await openNewProduct();
    const translate = await within(dialog).findByRole('button', { name: 'Перекласти' });

    expect(translate).toBeDisabled();
    await fill(user, within(dialog).getByLabelText(/Назва товару українською/), 'Мед липовий');

    expect(translate).toBeEnabled();
  });

  it('заповнює порожні поля, не змінює введений текст і просить перевірити переклад', async () => {
    const { user, dialog } = await openNewProduct();
    await fill(user, within(dialog).getByLabelText(/Назва товару українською/), 'Мед липовий');
    await fill(user, within(dialog).getByLabelText(/Склад \(англійською\)/), 'Linden honey');
    await fill(user, within(dialog).getByLabelText(/Термін придатності \(українською\)/), '2 роки');
    await fill(user, within(dialog).getByLabelText(/Термін придатності \(англійською\)/), 'Two years');

    await user.click(await within(dialog).findByRole('button', { name: 'Перекласти' }));

    expect(await within(dialog).findByText(/Переклав ШІ\. Перевірте текст/)).toBeInTheDocument();
    expect(backend.translationRequests).toEqual([
      [
        { field: 'name', targetLang: 'en', text: 'Мед липовий' },
        { field: 'composition', targetLang: 'uk', text: 'Linden honey' },
      ],
    ]);
    expect(within(dialog).getByLabelText(/Назва товару англійською/)).toHaveValue('en: Мед липовий');
    expect(within(dialog).getByLabelText(/Склад \(українською\)/)).toHaveValue('uk: Linden honey');
    expect(within(dialog).getByLabelText(/Термін придатності \(англійською\)/)).toHaveValue('Two years');
    expect(backend.productRequests).toHaveLength(0);
  });

  it('показує зрозумілу помилку, а форму лишає без змін', async () => {
    const { user, dialog } = await openNewProduct();
    backend.translationError = 'translation_failed';
    await fill(user, within(dialog).getByLabelText(/Назва товару українською/), 'Мед липовий');

    await user.click(await within(dialog).findByRole('button', { name: 'Перекласти' }));

    expect(await within(dialog).findByText(/Не вдалося перекласти текст/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Назва товару англійською/)).toHaveValue('');
  });
});
