import { expect, test } from '@playwright/test';
import { PHONES, openAs, switchRole } from './steps';

test('покупець скасовує замовлення до прийняття → фермер бачить його скасованим', async ({ browser }) => {
  const buyer = await openAs(browser, '+380970000202');
  await buyer.getByRole('searchbox', { name: 'Пошук товару' }).fill('Морква');
  await buyer.getByRole('button', { name: 'Додати в кошик: Морква' }).click();
  await expect(buyer.getByRole('link', { name: 'Товарів у кошику: 1' })).toBeVisible();
  await buyer.goto('/checkout');
  await buyer.getByLabel('Адреса доставки').fill('Львів, вул. Городоцька, 15, кв. 8');
  await buyer.getByRole('radio', { name: /вільних місць/ }).first().check();
  await buyer.getByRole('button', { name: /Замовити на/ }).click();

  const heading = buyer.getByRole('heading', { level: 1, name: /Замовлення №\d+/ });
  await expect(heading).toBeVisible();
  const orderNo = /\d+/.exec(await heading.innerText())![0];

  await buyer.getByRole('button', { name: `Скасувати замовлення №${orderNo}` }).click();
  const dialog = buyer.getByRole('dialog', { name: `Скасувати замовлення №${orderNo}?` });
  await expect(dialog).toContainText('повернуться автоматично');
  await dialog.getByRole('button', { name: 'Так, скасувати' }).click();

  await expect(buyer.getByRole('status', { name: 'Статус замовлення' })).toHaveText('Скасовано');
  await expect(buyer.getByTestId('delivery-code')).toBeHidden();

  const farmer = await openAs(browser, PHONES.farmer);
  await switchRole(farmer, 'Фермер');
  await expect(farmer.getByRole('listitem', { name: `Замовлення №${orderNo}` }).getByText('Скасовано')).toBeVisible();
});
