import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { CYRILLIC, renderApp } from '../../test/render';
import { backend, server } from '../../test/server';

const lastRequest = () => backend.catalogRequests.at(-1)!.searchParams;

describe('UI-02 Каталог з фільтрами', () => {
  it('показує товари українською з ціною, фермою, відстанню й сертифікатом', async () => {
    await renderApp('/');

    const carrots = await screen.findByRole('article', { name: 'Морква' });

    expect(within(carrots).getByText('Ферма «Зелений Гай»')).toBeInTheDocument();
    expect(within(carrots).getByText(/16,00\s?₴/)).toBeInTheDocument();
    expect(within(carrots).getByText('за кг')).toBeInTheDocument();
    expect(within(carrots).getByText('7,6 км')).toBeInTheDocument();
    expect(within(carrots).getByText('Органічний сертифікат')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Знайдено товарів: 3');
    expect(lastRequest().get('lang')).toBe('uk');
  });

  it('в англійському режимі на сторінці немає кирилиці', async () => {
    await renderApp('/', { lang: 'en' });

    const milk = await screen.findByRole('article', { name: "Cow's milk" });

    expect(within(milk).getByText('Karpatska Bryndza Creamery')).toBeInTheDocument();
    expect(within(milk).getByText('per l')).toBeInTheDocument();
    expect(within(milk).getByText('₴38.00')).toBeInTheDocument();
    expect(lastRequest().get('lang')).toBe('en');
    expect(CYRILLIC.test(document.body.textContent ?? '')).toBe(false);
  });

  it('категорії беруться з довідника мовою інтерфейсу й фільтрують каталог за кодом', async () => {
    const { user } = await renderApp('/', { lang: 'en' });
    await screen.findByRole('article', { name: 'Carrots' });

    await user.click(screen.getByRole('combobox', { name: 'Category' }));
    await user.click(await screen.findByRole('option', { name: 'Dairy' }));

    await waitFor(() => expect(screen.queryByRole('article', { name: 'Carrots' })).not.toBeInTheDocument());
    expect(screen.getByRole('article', { name: "Cow's milk" })).toBeInTheDocument();
    expect(lastRequest().get('category')).toBe('dairy');
  });

  it('пошук, сертифікат, ціна, відстань і сортування потрапляють у запит', async () => {
    const { user } = await renderApp('/');
    await screen.findByRole('article', { name: 'Морква' });

    await user.type(screen.getByRole('searchbox', { name: 'Пошук товару' }), 'мор');
    await user.click(screen.getByRole('checkbox', { name: 'Лише з органічним сертифікатом' }));
    await user.type(screen.getByLabelText('Ціна до, ₴'), '17');
    await user.click(screen.getByRole('combobox', { name: 'Відстань до ферми' }));
    await user.click(await screen.findByRole('option', { name: 'до 10 км' }));
    await user.click(screen.getByRole('combobox', { name: 'Сортування' }));
    await user.click(await screen.findByRole('option', { name: 'Спершу найближчі' }));

    await waitFor(() =>
      expect(Object.fromEntries(lastRequest())).toEqual({
        q: 'мор',
        certified: 'true',
        maxPrice: '17',
        maxKm: '10',
        sort: 'Distance',
        lat: '49.8419',
        lon: '24.0315',
        lang: 'uk',
      }),
    );
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Знайдено товарів: 1'));
  });

  it('фільтри відновлюються з адреси сторінки, а «Скинути» повертає все', async () => {
    const { user } = await renderApp('/?category=dairy&minPrice=30');

    expect(await screen.findByRole('article', { name: /Молоко/ })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Морква' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Ціна від, ₴')).toHaveValue('30');

    await user.click(screen.getByRole('button', { name: 'Скинути фільтри' }));

    expect(await screen.findByRole('article', { name: 'Морква' })).toBeInTheDocument();
  });

  it('порожній результат пояснюється', async () => {
    await renderApp('/?q=ананас');

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('За цими умовами нічого не знайдено'));
  });

  it('помилка валідації сервера показується мовою інтерфейсу', async () => {
    await renderApp('/?minPrice=50&maxPrice=10', { lang: 'en' });

    expect(await screen.findByRole('alert')).toHaveTextContent('The minimum price is higher than the maximum.');
  });

  it('після збою сервера каталог можна завантажити ще раз', async () => {
    server.use(http.get('*/api/catalog', () => new HttpResponse(null, { status: 500 }), { once: true }));
    server.use(http.get('*/api/catalog', () => new HttpResponse(null, { status: 500 }), { once: true }));
    const { user } = await renderApp('/');

    expect(await screen.findByRole('alert', {}, { timeout: 4000 })).toHaveTextContent('На сервері сталася помилка');
    await user.click(screen.getByRole('button', { name: 'Спробувати ще раз' }));

    expect(await screen.findByRole('article', { name: 'Морква' })).toBeInTheDocument();
  });

  it('гостя кнопка «У кошик» веде на вхід', async () => {
    const { user } = await renderApp('/');

    await user.click(await screen.findByRole('button', { name: 'Додати в кошик: Морква' }));

    expect(await screen.findByRole('heading', { name: 'Вхід за номером телефону' })).toBeInTheDocument();
  });

  it('покупець додає товар у кошик і бачить лічильник у шапці', async () => {
    const { user } = await renderApp('/', { signedIn: true });

    await user.click(await screen.findByRole('button', { name: 'Додати в кошик: Морква' }));

    expect(await screen.findByText('Додано в кошик: Морква')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Товарів у кошику: 1' })).toBeInTheDocument();
  });

  it('після додавання кнопка коротко показує «Додано», а тост веде до кошика', async () => {
    const { user } = await renderApp('/', { signedIn: true });

    await user.click(await screen.findByRole('button', { name: 'Додати в кошик: Морква' }));

    const carrots = screen.getByRole('article', { name: 'Морква' });
    expect(await within(carrots).findByRole('button', { name: 'Додати в кошик: Морква' })).toHaveTextContent('Додано');
    expect(within(carrots).getByText('У кошику: 1')).toBeInTheDocument();
    await waitFor(() => expect(within(carrots).getByRole('button', { name: 'Додати в кошик: Морква' })).toHaveTextContent('У кошик'), { timeout: 3000 });

    await user.click(screen.getByRole('button', { name: 'До кошика' }));
    expect(await screen.findByRole('heading', { name: 'Кошик' })).toBeInTheDocument();
  });

  it('товар іншого фермера не додається, причина - мовою інтерфейсу', async () => {
    backend.putInCart(1, 1);
    const { user } = await renderApp('/', { signedIn: true, lang: 'en' });

    await user.click(await screen.findByRole('button', { name: "Add to cart: Cow's milk" }));

    expect(await screen.findByText(/already has products from another farmer/)).toBeInTheDocument();
  });

  it('без доступу до геолокації відстань рахується від центру Львова', async () => {
    const { user } = await renderApp('/');
    await screen.findByRole('article', { name: 'Морква' });

    await user.click(screen.getByRole('button', { name: 'Моє місцезнаходження' }));

    expect(await screen.findByText(/Не вдалося визначити місцезнаходження/)).toBeInTheDocument();
    expect(lastRequest().get('lat')).toBe('49.8419');
  });

  it('власне місцезнаходження покупця передається в запит', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: (ok: PositionCallback) => ok({ coords: { latitude: 49.8, longitude: 24.1 } } as GeolocationPosition) },
    });
    const { user } = await renderApp('/');
    await screen.findByRole('article', { name: 'Морква' });

    await user.click(screen.getByRole('button', { name: 'Моє місцезнаходження' }));

    expect(await screen.findByText('Відстань рахується від вашого місця')).toBeInTheDocument();
    await waitFor(() => expect(lastRequest().get('lat')).toBe('49.8'));
    Reflect.deleteProperty(navigator, 'geolocation');
  });
});
