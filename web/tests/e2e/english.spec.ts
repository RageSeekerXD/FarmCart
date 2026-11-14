import { expect, test } from '@playwright/test';
import { CYRILLIC, PHONES, signIn, visibleText } from './steps';

test('англійською на сторінках каталогу, кошика й замовлень немає кирилиці', async ({ page }) => {
  await signIn(page, PHONES.demoBuyer);
  await page.getByRole('button', { name: 'EN' }).click();

  // Каталог: назви товарів, ферм, одиниць і категорій - англійські.
  await expect(page.getByRole('heading', { level: 1, name: 'Catalogue' })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Carrots' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Category' }).click();
  await expect(page.getByRole('option', { name: 'Dairy' })).toBeVisible();
  expect(await visibleText(page)).not.toMatch(CYRILLIC);
  await page.getByRole('option', { name: 'Dairy' }).click();
  await expect(page.getByRole('article', { name: 'Carrots' })).toBeHidden();
  await expect(page.getByRole('article', { name: 'Kefir' })).toBeVisible();
  expect(await visibleText(page)).not.toMatch(CYRILLIC);

  // Кошик.
  await page.getByRole('button', { name: 'Add to cart: Kefir' }).click();
  await page.getByRole('link', { name: /Items in cart: [1-9]/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Cart' })).toBeVisible();
  await expect(page.getByText('Kefir', { exact: true })).toBeVisible();
  expect(await visibleText(page)).not.toMatch(CYRILLIC);

  // Мої замовлення: вісім замовлень демо-покупця, по одному в кожному статусі.
  await page.getByRole('tab', { name: 'My orders' }).click();
  await expect(page.getByRole('listitem', { name: /Order No\./ })).toHaveCount(8);
  for (const status of ['Placed', 'Accepted by farmer', 'Being packed', 'On the way', 'Delivered', 'Rejected', 'Cancelled', 'Not delivered']) {
    await expect(page.getByText(status, { exact: true })).toBeVisible();
  }

  expect(await visibleText(page)).not.toMatch(CYRILLIC);
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');
});
