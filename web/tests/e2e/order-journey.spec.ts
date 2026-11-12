import { expect, test } from '@playwright/test';
import { PHONES, openAs, switchRole } from './steps';

test('покупець купує → фермер приймає й передає кур’єру → кур’єр вручає → покупець бачить статуси без перезавантаження', async ({ browser }) => {
  // Покупець: каталог, кошик, оформлення.
  const buyer = await openAs(browser, '+380970000101');
  await buyer.getByRole('searchbox', { name: 'Пошук товару' }).fill('Морква');
  await buyer.getByRole('button', { name: 'Додати в кошик: Морква' }).click();
  await expect(buyer.getByRole('link', { name: 'Товарів у кошику: 1' })).toBeVisible();
  await buyer.getByRole('link', { name: 'Товарів у кошику: 1' }).click();
  await buyer.getByRole('link', { name: 'Оформити замовлення' }).click();
  await buyer.getByLabel('Адреса доставки').fill('Львів, вул. Городоцька, 15, кв. 8');
  await buyer.getByRole('radio', { name: /вільних місць/ }).first().check();
  await buyer.getByRole('button', { name: /Замовити на/ }).click();

  const heading = buyer.getByRole('heading', { level: 1, name: /Замовлення №\d+/ });
  await expect(heading).toBeVisible();
  const orderNo = (await heading.innerText()).match(/\d+/)![0];
  const status = buyer.getByRole('status', { name: 'Статус замовлення' });
  await expect(status).toHaveText('Оформлено');
  const code = await buyer.getByTestId('delivery-code').innerText();
  expect(code).toMatch(/^\d{4}$/);

  // Фермер «Зелений Гай»: приймає, збирає, передає кур'єру. Сторінку покупця ніхто не перезавантажує.
  const farmer = await openAs(browser, PHONES.farmer);
  await switchRole(farmer, 'Фермер');
  const incoming = farmer.getByRole('listitem', { name: `Замовлення №${orderNo}` });
  await expect(incoming).toBeVisible();
  await expect(incoming).not.toContainText(code);
  await incoming.getByRole('button', { name: /^Прийняти/ }).click();
  await farmer.getByRole('dialog').getByRole('button', { name: 'Прийняти' }).click();
  await expect(status).toHaveText('Прийнято фермером');

  await incoming.getByRole('button', { name: /^Почати збирати/ }).click();
  await expect(status).toHaveText('Збирається');

  await incoming.getByRole('button', { name: /^Передати кур’єру/ }).click();
  const handover = farmer.getByRole('dialog');
  await handover.getByRole('combobox').click();
  await farmer.getByRole('option', { name: 'Андрій Шевчук' }).click();
  await handover.getByRole('button', { name: 'Передати кур’єру' }).click();
  await expect(status).toHaveText('В дорозі');

  // Кур'єр: бачить доставку й закриває її кодом, який назвав покупець.
  const courier = await openAs(browser, PHONES.courier);
  await switchRole(courier, "Кур'єр");
  const delivery = courier.getByRole('listitem', { name: `Доставка №${orderNo}` });
  await expect(delivery).toContainText('Ферма «Зелений Гай»');
  await delivery.getByLabel(`Код вручення: Доставка №${orderNo}`).fill(code);
  await delivery.getByRole('button', { name: 'Вручено' }).click();
  await expect(delivery).toBeHidden();

  // Покупець: статус «Доставлено» з'явився сам, код більше не показується, можна залишити відгук.
  await expect(status).toHaveText('Доставлено');
  await expect(buyer.getByTestId('delivery-code')).toBeHidden();
  await buyer.getByRole('radio', { name: 'Оцінка: 5 з 5' }).click();
  await buyer.getByRole('button', { name: 'Надіслати відгук' }).click();
  await expect(buyer.getByRole('region', { name: 'Ваш відгук' })).toBeVisible();
  await expect(buyer.getByRole('button', { name: /Сповіщення, нових: [1-9]/ })).toBeVisible();
});
