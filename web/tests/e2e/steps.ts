import { expect, type Browser, type Page } from '@playwright/test';

/** Демонстраційні облікові записи сервера (src/FarmCart.Api/DemoData.cs). */
export const PHONES = {
  farmer: '+380671110001',
  courier: '+380631230001',
  demoBuyer: '+380931112233',
} as const;

export const CYRILLIC = /[Ѐ-ӿ]/;

/** Окремий користувач у власному вікні браузера: сесії покупця, фермера й кур'єра не змішуються. */
export async function openAs(browser: Browser, phone: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, phone);
  return page;
}

/** Вхід так, як його робить користувач у режимі розробки: номер, код із підказки, «Увійти». */
export async function signIn(page: Page, phone: string) {
  await page.goto('/login');
  await page.getByLabel('Номер телефону').fill(phone);
  await page.getByRole('button', { name: 'Отримати код' }).click();
  await page.getByRole('button', { name: 'Підставити' }).click();
  await page.getByRole('button', { name: 'Увійти' }).click();
  await expect(page.getByRole('button', { name: 'Вийти' })).toBeVisible();
}

export async function switchRole(page: Page, role: 'Фермер' | "Кур'єр" | 'Адміністратор') {
  await page.getByRole('combobox', { name: 'Роль' }).click();
  await page.getByRole('option', { name: role }).click();
}

/** Текст сторінки, який бачить користувач (без прихованих елементів). */
export async function visibleText(page: Page): Promise<string> {
  return page.locator('body').innerText();
}
