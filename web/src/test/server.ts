import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { AppNotification, AuditEntry, Cart, PromoCode, Review, CatalogItem, CheckoutRequest, Courier, DeliveryTask, FarmOnMap, FarmRegistration, FarmerProfile, Order, OrderStatus, Product, ProductDraft, ReferenceData, Role, Shortage, Slot, User } from '../api/types';

// MSW-моки у формі контракту API 2.0 (двомовні поля { uk, en }).

export const TOKEN = 'test-token';

export const reference: ReferenceData = {
  categories: [
    { code: 'vegetables', title: { uk: 'Овочі', en: 'Vegetables' } },
    { code: 'dairy', title: { uk: 'Молочні продукти', en: 'Dairy' } },
    { code: 'honey', title: { uk: 'Мед', en: 'Honey' } },
  ],
  units: [
    { code: 'kg', title: { uk: 'кг', en: 'kg' } },
    { code: 'l', title: { uk: 'л', en: 'l' } },
  ],
};

const green = { farmerId: 1, farmerName: { uk: 'Ферма «Зелений Гай»', en: 'Zelenyi Hai Farm' }, certified: true, farmerRating: 4.8, distanceKm: 7.6 };
const cheese = { farmerId: 2, farmerName: { uk: 'Сироварня «Карпатська бринза»', en: 'Karpatska Bryndza Creamery' }, certified: false, farmerRating: null, distanceKm: 8.3 };

export const products: CatalogItem[] = [
  { productId: 1, name: { uk: 'Морква', en: 'Carrots' }, category: 'vegetables', unitCode: 'kg', unit: { uk: 'кг', en: 'kg' }, price: 16, stock: 200, photoUrl: null, ...green },
  { productId: 2, name: { uk: 'Картопля', en: 'Potatoes' }, category: 'vegetables', unitCode: 'kg', unit: { uk: 'кг', en: 'kg' }, price: 18, stock: 300, photoUrl: null, ...green },
  { productId: 3, name: { uk: "Молоко коров'яче", en: "Cow's milk" }, category: 'dairy', unitCode: 'l', unit: { uk: 'л', en: 'l' }, price: 38, stock: 60, photoUrl: '/img/products/milk.jpg', ...cheese },
];

export const farms: FarmOnMap[] = [
  { id: 1, name: green.farmerName, lat: 49.816, lon: 24.13, certified: true, rating: 4.8, reviewCount: 12, productCount: 2, distanceKm: 7.6 },
  { id: 2, name: cheese.farmerName, lat: 49.9, lon: 23.96, certified: false, rating: null, reviewCount: 0, productCount: 1, distanceKm: 8.3 },
  { id: 6, name: { uk: 'Сад «Яворівські ягоди»', en: 'Yavoriv Berry Orchard' }, lat: 49.94, lon: 23.39, certified: true, rating: 4.2, reviewCount: 3, productCount: 0, distanceKm: 47.2 },
];

export const slots: Slot[] = [
  { id: 1, start: '2026-10-02T10:00:00+03:00', end: '2026-10-02T12:00:00+03:00', remaining: 3 },
  { id: 2, start: '2026-10-02T12:00:00+03:00', end: '2026-10-02T14:00:00+03:00', remaining: 0 },
];

export const couriers: Courier[] = [{ id: 2, name: 'Андрій Шевчук' }];

export const farmProfile: FarmerProfile = { id: 1, name: green.farmerName, lat: 49.816, lon: 24.13, certified: true, verified: true, rating: 4.8, reviewCount: 12 };

export const ownProducts: Product[] = [
  { id: 1, farmerId: 1, name: { uk: 'Морква', en: 'Carrots' }, category: 'vegetables', unitCode: 'kg', unit: { uk: 'кг', en: 'kg' }, price: 16, stock: 200, photoUrl: null, seasonMonths: [] },
  { id: 4, farmerId: 1, name: { uk: 'Полуниця', en: 'Strawberries' }, category: 'vegetables', unitCode: 'kg', unit: { uk: 'кг', en: 'kg' }, price: 95, stock: 0, photoUrl: null, seasonMonths: [5, 6, 7] },
];

export const delivery: DeliveryTask = {
  orderId: 1001,
  slotStart: slots[0]!.start,
  slotEnd: slots[0]!.end,
  pickupFrom: green.farmerName,
  address: 'Львів, вул. Городоцька, 15',
  items: 10,
  amountToCollect: 0,
  routeUrl: 'https://www.google.com/maps/dir/?api=1&origin=49.816,24.13&destination=Lviv',
};

const PATH: OrderStatus[] = ['Placed', 'Accepted', 'Assembling', 'InTransit', 'Delivered'];

export function user(...roles: Role[]): User {
  return { id: 7, phone: '+380971234567', name: '', roles: roles.length > 0 ? roles : ['Buyer'] };
}

/** Стан сервера-мока, який тест може підготувати й перевірити. */
export const backend = {
  user: user(),
  cart: { farmerId: null, lines: [], total: 0 } as Cart,
  catalogRequests: [] as URL[],
  orders: [] as Order[],
  /** Запити оформлення: тіло й заголовок Idempotency-Key. */
  checkouts: [] as { key: string | null; body: CheckoutRequest }[],
  /** Замовлення покупця з кошика-зразка (морква × 10) у вказаному статусі. */
  addOrder(status: OrderStatus, patch: Partial<Order> = {}): Order {
    const reached = status === 'Rejected' ? ['Placed', 'Rejected'] : PATH.slice(0, PATH.indexOf(status) + 1);
    const order: Order = {
      id: 1001 + this.orders.length,
      status,
      farmerId: 1,
      lines: [{ productId: 1, name: products[0]!.name, unit: products[0]!.unit, unitPrice: 16, quantity: 10, total: 160 }],
      subtotal: 160,
      discount: 0,
      total: 160,
      paymentMethod: 'Card',
      paymentStatus: status === 'Rejected' ? 'Refunded' : 'Paid',
      paidAmount: 160,
      refundedAmount: status === 'Rejected' ? 160 : 0,
      address: 'Львів, вул. Городоцька, 15',
      slotStart: slots[0]!.start,
      slotEnd: slots[0]!.end,
      comment: null,
      promoCode: null,
      deliveryCode: '4821',
      rejectionReason: status === 'Rejected' ? 'Морква закінчилася' : null,
      history: reached.map((item, index) => ({ status: item as OrderStatus, at: `2026-10-01T${String(9 + index).padStart(2, "0")}:00:00+03:00` })),
      ...patch,
    };
    this.orders.unshift(order);
    return order;
  },
  /** Фермер чи кур'єр перевів замовлення далі - покупець має побачити це без перезавантаження. */
  moveOrder(id: number, status: OrderStatus) {
    this.orders = this.orders.map((order) =>
      order.id === id ? { ...order, status, history: [...order.history, { status, at: '2026-10-01T15:00:00+03:00' }] } : order,
    );
  },
  notifications: [] as AppNotification[],
  /** Демо-акаунти сервера; порожньо - сервер не в демонстраційному режимі. */
  demoAccounts: [] as { phone: string; role: Role; title: { uk: string; en: string } }[],
  /** Заявки продавців у черзі верифікації. */
  pendingFarmers: [] as FarmerProfile[],
  audit: [] as AuditEntry[],
  promoCodes: [{ code: 'FARM10', percent: 10, minTotal: 300, validUntil: '2026-10-31T09:00:00+03:00' }] as PromoCode[],
  adminRequests: [] as { path: string; body: Record<string, unknown> }[],
  reviews: [] as Review[],
  record(action: string, target: string, details: string) {
    this.audit = [...this.audit, { id: this.audit.length + 1, at: '2026-10-01T09:30:00+03:00', adminId: 1, action, target, details }];
  },

  /** Сервер створив сповіщення користувачу (клієнт побачить його опитуванням або після події хаба). */
  notify(kind: string, orderId: number | null, params: Record<string, string> = {}): AppNotification {
    const notification: AppNotification = {
      id: this.notifications.length + 1,
      userId: this.user.id,
      kind,
      orderId,
      params,
      text: 'Текст сервера українською',
      at: `2026-10-01T09:${String(10 + this.notifications.length).padStart(2, '0')}:00+03:00`,
    };
    this.notifications = [...this.notifications, notification];
    return notification;
  },
  /** Господарство користувача; null - користувач ще не продавець. */
  farm: null as FarmerProfile | null,
  farmProducts: [] as Product[],
  deliveries: [] as DeliveryTask[],
  /** Дії фермера над замовленнями: accept, reject... з тілом запиту. */
  actions: [] as { orderId: number; kind: string; body: Record<string, unknown> }[],
  registrations: [] as FarmRegistration[],
  productRequests: [] as { method: string; id: number | null; body: Partial<ProductDraft> }[],
  /** Користувач - фермер із двома товарами (якщо верифікований). */
  asFarmer(verified = true) {
    this.user = user('Buyer', 'Farmer');
    this.farm = { ...farmProfile, verified };
    this.farmProducts = verified ? ownProducts.map((product) => ({ ...product })) : [];
  },
  reset() {
    this.demoAccounts = [];
    this.pendingFarmers = [];
    this.audit = [];
    this.promoCodes = [{ code: 'FARM10', percent: 10, minTotal: 300, validUntil: '2026-10-31T09:00:00+03:00' }];
    this.adminRequests = [];
    this.reviews = [];
    this.notifications = [];
    this.farm = null;
    this.farmProducts = [];
    this.deliveries = [];
    this.actions = [];
    this.registrations = [];
    this.productRequests = [];
    this.orders = [];

    this.checkouts = [];

    this.user = user();
    this.cart = { farmerId: null, lines: [], total: 0 };
    this.catalogRequests = [];
  },
  putInCart(productId: number, quantity: number) {
    const product = products.find((item) => item.productId === productId)!;
    const lines = this.cart.lines.filter((line) => line.productId !== productId);
    const existing = this.cart.lines.find((line) => line.productId === productId);
    const total = (existing?.quantity ?? 0) + quantity;
    lines.push({ productId, name: product.name, unit: product.unit, photoUrl: product.photoUrl, price: product.price, quantity: total, total: product.price * total });
    this.cart = { farmerId: product.farmerId, lines, total: lines.reduce((sum, line) => sum + line.total, 0) };
  },
};

const error = (status: number, code: string, message = 'Повідомлення сервера українською') =>
  HttpResponse.json({ error: code, message }, { status });

const authorized = (request: Request) => request.headers.get('Authorization') === `Bearer ${TOKEN}`;

export const handlers = [
  http.get('*/api/reference', () => HttpResponse.json(reference)),

  http.get('*/api/farmers', ({ request }) =>
    HttpResponse.json(new URL(request.url).searchParams.has('lat') ? farms : farms.map((farm) => ({ ...farm, distanceKm: null }))),
  ),

  http.get('*/api/slots', () => HttpResponse.json(slots)),

  http.get('*/api/admin/farmers/pending', () => (backend.user.roles.includes('Admin') ? HttpResponse.json(backend.pendingFarmers) : error(403, 'role_required'))),

  http.post('*/api/admin/farmers/:id/verify', ({ params }) => {
    const farmer = backend.pendingFarmers.find((item) => item.id === Number(params.id));
    if (!farmer) {
      return error(404, 'farmer_not_found');
    }

    backend.pendingFarmers = backend.pendingFarmers.filter((item) => item !== farmer);
    backend.record('farmer.verify', `farmer#${farmer.id}`, `Верифіковано продавця «${farmer.name.uk}»`);
    return HttpResponse.json({ ...farmer, verified: true });
  }),

  http.post('*/api/admin/slots', async ({ request }) => {
    const body = (await request.json()) as { start: string; end: string; capacity: number };
    backend.adminRequests.push({ path: 'slots', body });
    if (new Date(body.end) <= new Date(body.start) || body.capacity <= 0) {
      return error(400, 'slot_invalid');
    }

    backend.record('slot.create', 'slot#9', `ємність ${body.capacity}`);
    return HttpResponse.json({ id: 9, ...body }, { status: 201 });
  }),

  http.get('*/api/admin/promocodes', () => HttpResponse.json(backend.promoCodes)),

  http.post('*/api/admin/promocodes', async ({ request }) => {
    const body = (await request.json()) as PromoCode;
    backend.adminRequests.push({ path: 'promocodes', body: { ...body } });
    if (backend.promoCodes.some((promo) => promo.code === body.code)) {
      return error(409, 'promo_exists');
    }

    backend.promoCodes = [body, ...backend.promoCodes];
    backend.record('promo.create', `promo#${body.code}`, `${body.percent} %`);
    return HttpResponse.json(body, { status: 201 });
  }),

  http.get('*/api/admin/audit', () => HttpResponse.json(backend.audit)),

  http.get('*/api/orders/:id/review', ({ params }) =>
    HttpResponse.json({ review: backend.reviews.find((review) => review.orderId === Number(params.id)) ?? null }),
  ),

  http.post('*/api/orders/:id/review', async ({ params, request }) => {
    const body = (await request.json()) as { rating: number; comment: string | null };
    const orderId = Number(params.id);
    if (backend.reviews.some((review) => review.orderId === orderId)) {
      return error(409, 'already_reviewed');
    }

    const review: Review = { id: backend.reviews.length + 1, orderId, rating: body.rating, comment: body.comment, at: '2026-10-01T16:00:00+03:00' };
    backend.reviews.push(review);
    return HttpResponse.json(review, { status: 201 });
  }),

  http.get('*/api/demo/accounts', () => HttpResponse.json(backend.demoAccounts)),

  http.get('*/api/me/notifications', () => HttpResponse.json(backend.notifications)),

  http.post('*/api/farmers', async ({ request }) => {
    const body = (await request.json()) as FarmRegistration;
    backend.registrations.push(body);
    if (backend.farm) {
      return error(409, 'already_farmer');
    }

    backend.farm = { id: 13, name: body.farmName, lat: body.lat, lon: body.lon, certified: body.certified, verified: false, rating: null, reviewCount: 0 };
    backend.user = { ...backend.user, roles: ['Buyer', 'Farmer'] };
    return HttpResponse.json(backend.farm, { status: 201 });
  }),

  http.get('*/api/farmer/profile', () => (backend.farm ? HttpResponse.json(backend.farm) : error(403, 'not_a_farmer'))),

  http.get('*/api/farmer/products', () => (backend.farm ? HttpResponse.json(backend.farmProducts) : error(403, 'not_a_farmer'))),

  http.post('*/api/farmer/products', async ({ request }) => {
    const body = (await request.json()) as ProductDraft;
    backend.productRequests.push({ method: 'POST', id: null, body });
    if (!backend.farm?.verified) {
      return error(403, 'farmer_not_verified');
    }

    const unit = reference.units.find((item) => item.code === body.unit);
    if (!unit) {
      return error(400, 'unit_unknown');
    }

    const product: Product = {
      id: 100 + backend.farmProducts.length,
      farmerId: backend.farm.id,
      name: body.name,
      category: body.category,
      unitCode: unit.code,
      unit: unit.title,
      price: body.price,
      stock: body.stock,
      photoUrl: null,
      seasonMonths: body.seasonMonths,
    };
    backend.farmProducts.push(product);
    return HttpResponse.json(product, { status: 201 });
  }),

  http.patch('*/api/farmer/products/:id', async ({ params, request }) => {
    const body = (await request.json()) as Partial<ProductDraft>;
    const id = Number(params.id);
    backend.productRequests.push({ method: 'PATCH', id, body });
    if (body.price !== undefined && body.price > 10_000) {
      return error(400, 'price_invalid');
    }

    backend.farmProducts = backend.farmProducts.map((product) =>
      product.id === id
        ? { ...product, name: body.name ?? product.name, price: body.price ?? product.price, stock: body.stock ?? product.stock, seasonMonths: body.seasonMonths ?? product.seasonMonths }
        : product,
    );
    return HttpResponse.json(backend.farmProducts.find((product) => product.id === id));
  }),

  http.get('*/api/farmer/orders', () => HttpResponse.json(backend.orders.map((order) => ({ ...order, deliveryCode: null })))),

  http.post('*/api/farmer/orders/:id/:kind', async ({ params, request }) => {
    const orderId = Number(params.id);
    const kind = String(params.kind);
    const body = (await request.json()) as Record<string, unknown>;
    backend.actions.push({ orderId, kind, body });
    const order = backend.orders.find((item) => item.id === orderId)!;
    const expected: Record<string, OrderStatus> = { accept: 'Placed', reject: 'Placed', assemble: 'Accepted', handover: 'Assembling' };
    if (order.status !== expected[kind]) {
      return error(409, 'invalid_status');
    }

    const next: Record<string, OrderStatus> = { accept: 'Accepted', reject: 'Rejected', assemble: 'Assembling', handover: 'InTransit' };
    backend.moveOrder(orderId, next[kind]!);
    if (kind === 'accept') {
      const shortages = (body.shortages ?? []) as Shortage[];
      backend.orders = backend.orders.map((item) => {
        if (item.id !== orderId) {
          return item;
        }

        const lines = item.lines
          .map((line) => {
            const quantity = line.quantity - (shortages.find((shortage) => shortage.productId === line.productId)?.quantity ?? 0);
            return { ...line, quantity, total: quantity * line.unitPrice };
          })
          .filter((line) => line.quantity > 0);
        const total = lines.reduce((sum, line) => sum + line.total, 0);
        return { ...item, lines, subtotal: total, total, refundedAmount: item.paidAmount - total };
      });
    }

    return HttpResponse.json({ ...backend.orders.find((item) => item.id === orderId)!, deliveryCode: null });
  }),

  http.get('*/api/couriers', () => HttpResponse.json(couriers)),

  http.get('*/api/courier/deliveries', () => HttpResponse.json(backend.deliveries)),

  http.post('*/api/courier/deliveries/:id/confirm', async ({ params, request }) => {
    const { code } = (await request.json()) as { code: string };
    if (code !== '4821') {
      return error(400, 'delivery_code_invalid');
    }

    backend.deliveries = backend.deliveries.filter((task) => task.orderId !== Number(params.id));
    return HttpResponse.json({ id: Number(params.id), status: 'Delivered' });
  }),


  http.get('*/api/orders', () => HttpResponse.json(backend.orders)),

  http.get('*/api/orders/:id', ({ params }) => {
    const order = backend.orders.find((item) => item.id === Number(params.id));
    return order ? HttpResponse.json(order) : error(404, 'order_not_found');
  }),

  http.post('*/api/orders', async ({ request }) => {
    const body = (await request.json()) as CheckoutRequest;
    const key = request.headers.get('Idempotency-Key');
    backend.checkouts.push({ key, body });
    if (body.paymentMethod !== 'Cash' && body.paymentToken === 'tok_declined') {
      return error(402, 'payment_declined', 'Банк відхилив оплату: недостатньо коштів на картці');
    }

    if (body.promoCode && body.promoCode !== 'FARM10') {
      return error(400, 'promo_unknown');
    }

    const subtotal = backend.cart.total;
    const discount = body.promoCode ? subtotal / 10 : 0;
    const order = backend.addOrder('Placed', {
      lines: backend.cart.lines.map((line) => ({ productId: line.productId, name: line.name, unit: line.unit, unitPrice: line.price, quantity: line.quantity, total: line.total })),
      subtotal,
      discount,
      total: subtotal - discount,
      paymentMethod: body.paymentMethod,
      paymentStatus: body.paymentMethod === 'Cash' ? 'PayOnDelivery' : 'Paid',
      paidAmount: body.paymentMethod === 'Cash' ? 0 : subtotal - discount,
      address: body.address,
      comment: body.comment,
      promoCode: body.promoCode,
    });
    backend.cart = { farmerId: null, lines: [], total: 0 };
    return HttpResponse.json(order, { status: 201 });
  }),


  http.get('*/api/catalog', ({ request }) => {
    const url = new URL(request.url);
    backend.catalogRequests.push(url);
    const q = url.searchParams.get('q')?.toLowerCase();
    const category = url.searchParams.get('category');
    const farmerId = Number(url.searchParams.get('farmerId') ?? 0);
    const min = Number(url.searchParams.get('minPrice') ?? 0);
    const max = Number(url.searchParams.get('maxPrice') ?? Infinity);
    if (min > max) {
      return error(400, 'price_range_invalid');
    }

    return HttpResponse.json(
      products.filter(
        (item) =>
          (!q || item.name.uk.toLowerCase().includes(q) || item.name.en.toLowerCase().includes(q)) &&
          (!category || item.category === category) &&
          (!farmerId || item.farmerId === farmerId) &&
          (url.searchParams.get('certified') !== 'true' || item.certified) &&
          item.price >= min &&
          item.price <= max,
      ),
    );
  }),

  http.post('*/api/auth/code', async ({ request }) => {
    const { phone } = (await request.json()) as { phone: string };
    return /^\+380\d{9}$/.test(phone)
      ? HttpResponse.json({ expiresAt: '2026-10-01T09:05:00+03:00', devCode: '123456' }, { status: 202 })
      : error(400, 'phone_invalid');
  }),

  http.post('*/api/auth/verify', async ({ request }) => {
    const { code } = (await request.json()) as { code: string };
    return code === '123456'
      ? HttpResponse.json({ token: TOKEN, isNewUser: true, user: backend.user })
      : error(400, 'code_invalid', 'Невірний код. Залишилось спроб: 4');
  }),

  http.get('*/api/me', ({ request }) => (authorized(request) ? HttpResponse.json(backend.user) : error(401, 'session_invalid'))),

  http.get('*/api/cart', ({ request }) => (authorized(request) ? HttpResponse.json(backend.cart) : error(401, 'auth_required'))),

  http.post('*/api/cart/items', async ({ request }) => {
    if (!authorized(request)) {
      return error(401, 'auth_required');
    }

    const { productId, quantity } = (await request.json()) as { productId: number; quantity: number };
    const product = products.find((item) => item.productId === productId)!;
    if (backend.cart.farmerId !== null && backend.cart.farmerId !== product.farmerId) {
      return error(409, 'cart_other_farmer');
    }

    backend.putInCart(productId, quantity);
    return HttpResponse.json(backend.cart);
  }),

  http.delete('*/api/cart/items/:id', ({ params }) => {
    const lines = backend.cart.lines.filter((line) => line.productId !== Number(params.id));
    backend.cart = { farmerId: lines.length > 0 ? backend.cart.farmerId : null, lines, total: lines.reduce((sum, line) => sum + line.total, 0) };
    return HttpResponse.json(backend.cart);
  }),
];

export const server = setupServer(...handlers);
