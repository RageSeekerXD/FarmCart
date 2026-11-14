import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { PHONES, signIn } from './steps';

// Знімки ключових екранів обома мовами для docs/evidence/ui/screens. Це не перевірка, а збирання доказів,
// тому в звичайному прогоні пропускається: запуск - `npm run evidence` (EVIDENCE=1).
const DIR = path.resolve(import.meta.dirname, '../../../docs/evidence/ui/screens');
const LANGS = ['uk', 'en'] as const;

test.skip(!process.env.EVIDENCE, 'знімки екранів збираються лише командою npm run evidence');
test.use({ viewport: { width: 1280, height: 800 } });

async function shot(page: Page, name: string, lang: string) {
  await page.waitForLoadState('networkidle');
  // Тости закривають частину екрана й зникають самі - на знімку вони зайві.
  await page.locator('.MuiSnackbar-root').waitFor({ state: 'hidden', timeout: 7000 }).catch(() => {});
  await page.screenshot({ path: path.join(DIR, `${name}-${lang}.png`), fullPage: true });
}

async function setLangAndRole(page: Page, lang: string, role: string) {
  await page.evaluate(([language, active]) => {
    localStorage.setItem('farmcart.lang', language!);
    localStorage.setItem('farmcart.role', active!);
  }, [lang, role]);
}

for (const lang of LANGS) {
  test(`екрани покупця (${lang})`, async ({ page }) => {
    await page.goto('/login');
    await setLangAndRole(page, lang, 'Buyer');
    await page.reload();
    await shot(page, '01-login', lang);
    await setLangAndRole(page, 'uk', 'Buyer'); // кроки входу в steps.ts написано українською

    await signIn(page, PHONES.demoBuyer);
    await setLangAndRole(page, lang, 'Buyer');
    await page.goto('/');
    await expect(page.getByRole('article').first()).toBeVisible();
    await shot(page, '02-catalog', lang);

    await page.goto('/?category=dairy&sort=PriceAsc&maxKm=50');
    await expect(page.getByRole('article').first()).toBeVisible();
    await shot(page, '03-catalog-filters', lang);

    await page.goto('/map');
    await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible();
    await page.waitForTimeout(1500);
    await shot(page, '04-map', lang);

    await page.goto('/?q=кефір');
    await page.getByRole('article').first().getByRole('button').click();
    await page.goto('/cart');
    await expect(page.getByTestId('cart-total')).toBeVisible();
    await shot(page, '05-cart', lang);

    await page.goto('/checkout');
    await expect(page.getByRole('radio').first()).toBeVisible();
    await shot(page, '06-checkout', lang);

    await page.goto('/orders');
    await expect(page.locator('main ul > li')).toHaveCount(8);
    await shot(page, '07-orders', lang);

    await page.goto('/orders/1004');
    await expect(page.getByTestId('delivery-code')).toBeVisible();
    await shot(page, '08-order-tracker', lang);

    await page.goto('/orders/1005');
    await expect(page.getByTestId('order-total')).toBeVisible();
    await shot(page, '09-order-delivered-review', lang);

    await page.locator('[data-live]').click();
    await expect(page.getByRole('menu')).toBeVisible();
    await page.screenshot({ path: path.join(DIR, `10-notifications-${lang}.png`) });
  });

  test(`екрани фермера, кур’єра й адміністратора (${lang})`, async ({ browser }) => {
    const open = async (phone: string, role: string, route: string) => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();
      await signIn(page, phone);
      await setLangAndRole(page, lang, role);
      await page.goto(route);
      return page;
    };

    // Сироварня має доставлене замовлення з історії, пасіка - відхилене.
    const farmer = await open('+380671110002', 'Farmer', '/farmer/orders');
    await expect(farmer.locator('main ul > li').first()).toBeVisible();
    await shot(farmer, '11-farmer-orders', lang);
    await farmer.goto('/farmer/products');
    await expect(farmer.locator('main ul > li').first()).toBeVisible();
    await shot(farmer, '12-farmer-products', lang);
    await farmer.locator('main ul > li').first().getByRole('button').click();
    await expect(farmer.getByRole('dialog')).toBeVisible();
    await farmer.screenshot({ path: path.join(DIR, `13-farmer-product-form-${lang}.png`) });
    await farmer.context().close();

    const courier = await open(PHONES.courier, 'Courier', '/courier');
    await expect(courier.locator('main ul > li').first()).toBeVisible();
    await shot(courier, '14-courier', lang);
    await courier.context().close();

    const admin = await open('+380500000001', 'Admin', '/admin');
    await expect(admin.locator('main ul > li').first()).toBeVisible();
    await shot(admin, '15-admin-verification', lang);
    for (const [index, name] of ['16-admin-slots', '17-admin-promo', '18-admin-audit'].entries()) {
      await admin.getByRole('tab').nth(index + 1).click();
      await admin.waitForTimeout(400);
      await shot(admin, name, lang);
    }

    await admin.context().close();
  });

  test(`телефон 360 px і реєстрація господарства (${lang})`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 360, height: 740 } });
    const page = await context.newPage();
    await signIn(page, `+38097000036${lang === 'uk' ? 1 : 2}`);
    await setLangAndRole(page, lang, 'Buyer');
    await page.goto('/');
    await expect(page.getByRole('article').first()).toBeVisible();
    await page.screenshot({ path: path.join(DIR, `19-mobile-catalog-${lang}.png`) });
    await page.goto('/farmer/register');
    await expect(page.locator('.leaflet-container')).toBeVisible();
    await page.waitForTimeout(1500);
    await shot(page, '20-mobile-farm-registration', lang);
    await context.close();
  });
}
