import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { CYRILLIC, renderApp } from '../../test/render';
import { backend, products, server } from '../../test/server';

// Сторінка ферми показує мапу Leaflet; у jsdom її замінює проста розмітка.
vi.mock('../map/FarmMapView', () => ({ default: () => <div data-testid="map" /> }));

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

  it('категорії - «пігулки» з довідника мовою інтерфейсу: одне натискання фільтрує каталог за кодом', async () => {
    const { user } = await renderApp('/', { lang: 'en' });
    await screen.findByRole('article', { name: 'Carrots' });
    const categories = screen.getByRole('group', { name: 'Category' });
    expect(within(categories).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(await within(categories).findByRole('button', { name: 'Dairy' }));

    await waitFor(() => expect(screen.queryByRole('article', { name: 'Carrots' })).not.toBeInTheDocument());
    expect(screen.getByRole('article', { name: "Cow's milk" })).toBeInTheDocument();
    expect(lastRequest().get('category')).toBe('dairy');
    expect(within(categories).getByRole('button', { name: 'Dairy' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(within(categories).getByRole('button', { name: 'All' }));
    expect(await screen.findByRole('article', { name: 'Carrots' })).toBeInTheDocument();
  });

  it('типово товари впорядковано «спершу популярні»', async () => {
    await renderApp('/');
    await screen.findByRole('article', { name: 'Морква' });

    expect(lastRequest().get('sort')).toBe('Popular');
    expect(screen.getByRole('combobox', { name: 'Сортування' })).toHaveTextContent('Спершу популярні');
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

  it('«Скинути фільтри» з’являється лише тоді, коли обрано фільтр', async () => {
    const { user } = await renderApp('/');
    await screen.findByRole('article', { name: 'Морква' });
    expect(screen.queryByRole('button', { name: 'Скинути фільтри' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Лише з органічним сертифікатом' }));

    expect(await screen.findByRole('button', { name: 'Скинути фільтри' })).toBeInTheDocument();
  });

  it('фільтри відновлюються з адреси сторінки, а «Скинути» повертає все, крім сортування', async () => {
    const { user } = await renderApp('/?category=dairy&minPrice=30&sort=PriceAsc');

    expect(await screen.findByRole('article', { name: /Молоко/ })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Морква' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Ціна від, ₴')).toHaveValue('30');

    await user.click(screen.getByRole('button', { name: 'Скинути фільтри' }));

    expect(await screen.findByRole('article', { name: 'Морква' })).toBeInTheDocument();
    expect(lastRequest().get('sort')).toBe('PriceAsc');
    expect(screen.queryByRole('button', { name: 'Скинути фільтри' })).not.toBeInTheDocument();
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

  it('після додавання кнопка стає лічильником «− N +»: кількість змінюється прямо в каталозі', async () => {
    const { user } = await renderApp('/', { signedIn: true });

    await user.click(await screen.findByRole('button', { name: 'Додати в кошик: Морква' }));

    const carrots = screen.getByRole('article', { name: 'Морква' });
    await within(carrots).findByRole('group', { name: 'У кошику: Морква, 1' });
    expect(within(carrots).queryByRole('button', { name: 'Додати в кошик: Морква' })).not.toBeInTheDocument();

    await user.click(within(carrots).getByRole('button', { name: 'Збільшити кількість: Морква' }));
    await within(carrots).findByRole('group', { name: 'У кошику: Морква, 2' });
    await user.click(within(carrots).getByRole('button', { name: 'Збільшити кількість: Морква' }));
    expect(await within(carrots).findByRole('group', { name: 'У кошику: Морква, 3' })).toHaveTextContent('48,00');
    expect(await screen.findByRole('link', { name: 'Товарів у кошику: 3' })).toBeInTheDocument();

    await user.click(within(carrots).getByRole('button', { name: 'Зменшити кількість: Морква' }));
    expect(await within(carrots).findByRole('group', { name: 'У кошику: Морква, 2' })).toBeInTheDocument();
    expect(backend.cart.lines).toEqual([expect.objectContaining({ productId: 1, quantity: 2 })]);
  });

  it('з одиниці лічильник прибирає товар з кошика, і повертається кнопка «У кошик»', async () => {
    backend.putInCart(1, 1);
    const { user } = await renderApp('/', { signedIn: true });

    const carrots = await screen.findByRole('article', { name: 'Морква' });
    await user.click(await within(carrots).findByRole('button', { name: 'Видалити з кошика: Морква' }));

    expect(await within(carrots).findByRole('button', { name: 'Додати в кошик: Морква' })).toBeInTheDocument();
    expect(backend.cart.lines).toEqual([]);
  });

  it('тост після додавання веде до кошика, а шапка показує кількість і суму', async () => {
    const { user } = await renderApp('/', { signedIn: true });

    await user.click(await screen.findByRole('button', { name: 'Додати в кошик: Морква' }));

    const cartLink = await screen.findByRole('link', { name: 'Товарів у кошику: 1' });
    await waitFor(() => expect(cartLink).toHaveTextContent('16,00'));
    await user.click(screen.getByRole('button', { name: 'До кошика' }));
    expect(await screen.findByRole('heading', { name: 'Кошик' })).toBeInTheDocument();
  });

  it('гість теж бачить кошик у шапці: він веде на вхід', async () => {
    const { user } = await renderApp('/');
    await screen.findByRole('article', { name: 'Морква' });

    await user.click(screen.getByRole('link', { name: 'Товарів у кошику: 0' }));

    expect(await screen.findByRole('heading', { name: 'Вхід за номером телефону' })).toBeInTheDocument();
  });

  it('«сердечко» зберігає товар в обраному, а «пігулка» «Обране» показує лише обрані', async () => {
    const { user } = await renderApp('/');
    const carrots = await screen.findByRole('article', { name: 'Морква' });

    await user.click(within(carrots).getByRole('button', { name: 'Додати в обране: Морква' }));

    expect(within(carrots).getByRole('button', { name: 'Прибрати з обраного: Морква' })).toHaveAttribute('aria-pressed', 'true');
    const favourites = within(screen.getByRole('group', { name: 'Категорія' })).getByRole('button', { name: 'Обране · 1' });
    await user.click(favourites);

    await waitFor(() => expect(screen.queryByRole('article', { name: 'Картопля' })).not.toBeInTheDocument());
    expect(screen.getByRole('article', { name: 'Морква' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Знайдено товарів: 1');
    // Обране фільтрується в браузері: на сервер такий параметр не йде.
    expect(lastRequest().has('favorites')).toBe(false);
    expect(JSON.parse(localStorage.getItem('farmcart.favorites')!)).toEqual([1]);
  });

  it('порожнє обране пояснює, як додати товар', async () => {
    const { user } = await renderApp('/?favorites=true');

    expect(await screen.findByText('Тут з’являться ваші обрані товари')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Показати всі товари' }));

    expect(await screen.findByRole('article', { name: 'Морква' })).toBeInTheDocument();
  });

  it('залишок показується, лише коли товару мало; ферма без відгуків має нейтральний значок', async () => {
    server.use(http.get('*/api/catalog', () => HttpResponse.json([{ ...products[0]!, stock: 4 }, products[2]!]), { once: true }));
    await renderApp('/');

    const carrots = await screen.findByRole('article', { name: 'Морква' });
    const milk = screen.getByRole('article', { name: "Молоко коров'яче" });

    expect(within(carrots).getByText('Лишилося лише 4')).toBeInTheDocument();
    expect(within(milk).queryByText(/Лишилося|В наявності/)).not.toBeInTheDocument();
    expect(within(milk).getByText('Ще без відгуків')).toBeInTheDocument();
    expect(within(carrots).getByLabelText('Рейтинг ферми: 4,8 з 5')).toBeInTheDocument();
  });

  it('назва ферми на картці - посилання на сторінку ферми', async () => {
    await renderApp('/');

    const milk = await screen.findByRole('article', { name: "Молоко коров'яче" });

    expect(within(milk).getByRole('link', { name: 'Сторінка ферми: Сироварня «Карпатська бринза»' })).toHaveAttribute('href', '/farms/2');
  });

  // Раніше товар іншого фермера не додавався (cart_other_farmer); тепер кошик спільний для всіх ферм (п. 8 покращень).
  it('товар іншої ферми додається в той самий кошик', async () => {
    backend.putInCart(1, 1);
    const { user } = await renderApp('/', { signedIn: true, lang: 'en' });

    await user.click(await screen.findByRole('button', { name: "Add to cart: Cow's milk" }));

    expect(await screen.findByText("Added to cart: Cow's milk")).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Items in cart: 2' })).toBeInTheDocument();
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

    // Покупець бачить, від якої точки рахується відстань: назву міста чи району, а не «ваше місце».
    expect(await screen.findByText('Відстань від: Винники')).toBeInTheDocument();
    await waitFor(() => expect(lastRequest().get('lat')).toBe('49.8'));

    await user.click(screen.getByLabelText('Рахувати від центру Львова'));
    expect(await screen.findByText('Відстань від: центр Львова')).toBeInTheDocument();
    // Каталог для центру Львова вже в кеші, тож новий запит не потрібен; збережена точка забута.
    expect(localStorage.getItem('farmcart.location')).toBeNull();
    Reflect.deleteProperty(navigator, 'geolocation');
  });
});

describe('Картка товару', () => {
  it('назва відкриває картку з описом, сезоном і відгуками ферми; кількість додається в кошик', async () => {
    backend.addFarmReview(5, 'Морква солодка, як цукерка', 'Оксана Д.');
    const { user } = await renderApp('/', { signedIn: true });

    await user.click(await screen.findByRole('button', { name: 'Докладніше: Морква' }));
    const dialog = await screen.findByRole('dialog', { name: 'Морква' });
    expect(dialog).toHaveTextContent('Солодка морква без гербіцидів');
    expect(dialog).toHaveTextContent(/Сезон: лип/);
    expect(await within(dialog).findByText('Морква солодка, як цукерка')).toBeInTheDocument();
    expect(within(dialog).getByText('Оксана Д.')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Більше' }));
    await user.click(within(dialog).getByRole('button', { name: 'Більше' }));
    await user.click(within(dialog).getByRole('button', { name: /У кошик: 3 · 48,00/ }));

    expect(await screen.findByText('Додано в кошик: Морква')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByRole('link', { name: 'Товарів у кошику: 3' })).toBeInTheDocument();
  });

  it('назва ферми в картці товару веде на сторінку ферми', async () => {
    const { user } = await renderApp('/');

    await user.click(await screen.findByRole('button', { name: "Докладніше: Молоко коров'яче" }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('link', { name: 'Сторінка ферми: Сироварня «Карпатська бринза»' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Сироварня «Карпатська бринза»' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('без відгуків картка так і каже', async () => {
    const { user } = await renderApp('/');

    await user.click(await screen.findByRole('button', { name: 'Докладніше: Картопля' }));

    expect(await within(await screen.findByRole('dialog')).findByText('Відгуків ще немає.')).toBeInTheDocument();
  });
});
