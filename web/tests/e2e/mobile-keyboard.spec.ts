import { expect, test, type Page } from '@playwright/test';
import { PHONES, signIn, switchRole } from './steps';

/** Наскрізна вимога плану: адаптивність від 360 px - сторінка не має горизонтального прокручування. */
async function expectFits(page: Page, name: string) {
  await page.waitForLoadState('networkidle');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${name}: горизонтальне прокручування на ${overflow} px`).toBeLessThanOrEqual(0);
}

test.describe('ширина 360 px', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test('екрани покупця вміщуються без горизонтального прокручування', async ({ page }) => {
    await signIn(page, PHONES.demoBuyer);
    await expect(page.getByRole('article').first()).toBeVisible();
    await expectFits(page, 'каталог');

    await page.goto('/map');
    await expect(page.getByRole('region', { name: 'Список ферм' })).toBeVisible();
    await expectFits(page, 'мапа ферм');

    await page.goto('/?q=Кефір');
    await page.getByRole('button', { name: 'Додати в кошик: Кефір' }).click();
    await page.goto('/cart');
    await expect(page.getByTestId('cart-total')).toBeVisible();
    await expectFits(page, 'кошик');

    await page.goto('/checkout');
    await expect(page.getByRole('heading', { level: 1, name: 'Оформлення замовлення' })).toBeVisible();
    await expectFits(page, 'оформлення');

    await page.goto('/orders');
    await expect(page.getByRole('listitem', { name: /Замовлення №/ })).toHaveCount(6);
    await expectFits(page, 'мої замовлення');

    await page.getByRole('link', { name: /Відстежити замовлення/ }).first().click();
    await expect(page.getByRole('heading', { name: 'Хід замовлення' })).toBeVisible();
    await expectFits(page, 'трекер замовлення');

    await page.getByRole('button', { name: /Сповіщення, нових/ }).click();
    await expect(page.getByRole('menu', { name: 'Сповіщення' })).toBeVisible();
    await expectFits(page, 'список сповіщень');
  });

  test('екрани фермера, кур’єра й адміністратора вміщуються без горизонтального прокручування', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 360, height: 740 } });
    const page = await context.newPage();

    await signIn(page, PHONES.farmer);
    await switchRole(page, 'Фермер');
    await expect(page.getByRole('heading', { level: 1, name: 'Вхідні замовлення' })).toBeVisible();
    await expectFits(page, 'вхідні замовлення');
    await page.getByRole('tab', { name: 'Мої товари' }).click();
    await expect(page.getByRole('listitem', { name: 'Морква' })).toBeVisible();
    await expectFits(page, 'товари фермера');
    await page.getByRole('button', { name: 'Додати товар' }).click();
    await expect(page.getByRole('dialog', { name: 'Новий товар' })).toBeVisible();
    await expectFits(page, 'форма товару');
    await context.close();

    const courierContext = await browser.newContext({ viewport: { width: 360, height: 740 } });
    const courier = await courierContext.newPage();
    await signIn(courier, PHONES.courier);
    await switchRole(courier, "Кур'єр");
    await expect(courier.getByRole('listitem', { name: /Доставка №/ }).first()).toBeVisible();
    await expectFits(courier, 'доставки кур’єра');
    await courierContext.close();

    const adminContext = await browser.newContext({ viewport: { width: 360, height: 740 } });
    const admin = await adminContext.newPage();
    await signIn(admin, '+380500000001');
    await switchRole(admin, 'Адміністратор');
    await expect(admin.getByRole('listitem', { name: 'Еко-ферма «Сокільники»' })).toBeVisible();
    await expectFits(admin, 'верифікація');
    for (const section of ['Слоти доставки', 'Промокоди', 'Журнал аудиту']) {
      await admin.getByRole('tab', { name: section }).click();
      await expectFits(admin, section);
    }

    await adminContext.close();
  });

  test('новий покупець: форма реєстрації господарства вміщується', async ({ page }) => {
    await signIn(page, '+380970000360');
    await page.getByRole('tab', { name: 'Стати продавцем' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Реєстрація господарства' })).toBeVisible();
    await expect(page.locator('.leaflet-container')).toBeVisible();
    await expectFits(page, 'реєстрація господарства');
  });
});

test('клавіатурою без миші: вхід, перехід до вмісту, товар у кошик', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel('Номер телефону')).toBeFocused();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('+380970000777');
  await page.keyboard.press('Enter');

  // Після запиту коду фокус - у полі коду; підказка з кнопкою «Підставити» стоїть перед ним.
  await expect(page.getByLabel('Код із SMS')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Підставити' })).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Код із SMS')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Вийти' })).toBeVisible();

  // Перше, на що потрапляє Tab на сторінці, - посилання «Перейти до вмісту».
  await page.goto('/?q=Морква');
  await expect(page.getByRole('article', { name: 'Морква' })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Перейти до вмісту' })).toBeFocused();

  const add = page.getByRole('button', { name: 'Додати в кошик: Морква' });
  await add.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('link', { name: 'Товарів у кошику: 1' })).toBeVisible();
});

test('на 360 px шапка лишається в один рядок', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const page = await context.newPage();
  await signIn(page, PHONES.demoBuyer);
  const tops = await page.locator('header .MuiToolbar-root > *').evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().bottom)));
  expect(Math.max(...tops) - Math.min(...tops), 'елементи шапки перенеслися на другий рядок').toBeLessThan(24);
  await context.close();
});
