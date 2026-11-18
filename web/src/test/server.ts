import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { AdminReview, AppNotification, AuditEntry, Cart, DocumentCheck, PlannedBasket, ProductSuggestion, PromoCode, Review, ReviewCheckResult, ReviewSummaryReply, CatalogItem, CheckoutRequest, Courier, DeliveryTask, FarmDocument, FarmOnMap, FarmProfileChanges, FarmRegistration, FarmerProfile, Order, OrderStatus, Product, ProductDraft, ProductText, ReferenceData, Role, SmartSearchResult, Shortage, Slot, User } from '../api/types';

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

const green = { farmerId: 1, farmerName: { uk: 'Ферма «Зелений Гай»', en: 'Zelenyi Hai Farm' }, certified: true, farmerRating: 4.8, distanceKm: 7.6, farmerReviewCount: 2, farmerDeliveryDays: ['Tuesday', 'Saturday'] as CatalogItem['farmerDeliveryDays'] };
const cheese = { farmerId: 2, farmerName: { uk: 'Сироварня «Карпатська бринза»', en: 'Karpatska Bryndza Creamery' }, certified: false, farmerRating: null, distanceKm: 8.3, farmerReviewCount: 0, farmerDeliveryDays: [] as CatalogItem['farmerDeliveryDays'] };
const noDetails = { description: null, seasonMonths: [] as number[] };
/** Склад, термін і зберігання - лише в моркви; решта товарів їх не має. */
const noFacts = { inSeason: true, composition: null, shelfLife: null, storage: null };

export const products: CatalogItem[] = [
  { productId: 1, name: { uk: 'Морква', en: 'Carrots' }, category: 'vegetables', unitCode: 'kg', unit: { uk: 'кг', en: 'kg' }, price: 16, stock: 200, photoUrl: null, ...green, description: { uk: 'Солодка морква без гербіцидів', en: 'Sweet carrots grown without herbicides' }, seasonMonths: [7, 8, 9, 10], ...noFacts, composition: { uk: 'Морква сорту «Нантська»', en: 'Nantes carrots' }, shelfLife: { uk: '3 тижні', en: '3 weeks' }, storage: { uk: 'У прохолодному темному місці', en: 'In a cool dark place' } },
  { productId: 2, name: { uk: 'Картопля', en: 'Potatoes' }, category: 'vegetables', unitCode: 'kg', unit: { uk: 'кг', en: 'kg' }, price: 18, stock: 300, photoUrl: null, ...green, ...noDetails, ...noFacts },
  { productId: 3, name: { uk: "Молоко коров'яче", en: "Cow's milk" }, category: 'dairy', unitCode: 'l', unit: { uk: 'л', en: 'l' }, price: 38, stock: 60, photoUrl: '/img/products/milk.jpg', ...cheese, ...noDetails, ...noFacts },
];

/** Товар, якого зараз немає в наявності: каталог показує його лише з includeSoldOut=true. */
export const soldOut: CatalogItem = { productId: 4, name: { uk: 'Агрус', en: 'Gooseberries' }, category: 'vegetables', unitCode: 'kg', unit: { uk: 'кг', en: 'kg' }, price: 90, stock: 0, photoUrl: null, ...green, ...noDetails, ...noFacts };

export const farms: FarmOnMap[] = [
  { id: 1, name: green.farmerName, lat: 49.816, lon: 24.13, certified: true, rating: 4.8, reviewCount: 12, productCount: 2, distanceKm: 7.6, story: { uk: 'Сімейна органічна ферма з 2009 року', en: 'A family organic farm since 2009' }, deliveryDays: ['Tuesday', 'Saturday'] },
  { id: 2, name: cheese.farmerName, lat: 49.9, lon: 23.96, certified: false, rating: null, reviewCount: 0, productCount: 1, distanceKm: 8.3, story: null, deliveryDays: [] },
  { id: 6, name: { uk: 'Сад «Яворівські ягоди»', en: 'Yavoriv Berry Orchard' }, lat: 49.94, lon: 23.39, certified: true, rating: 4.2, reviewCount: 3, productCount: 0, distanceKm: 47.2, story: null, deliveryDays: ['Friday'] },
];

export const slots: Slot[] = [
  { id: 1, start: '2026-10-02T10:00:00+03:00', end: '2026-10-02T12:00:00+03:00', remaining: 3, capacity: 3 },
  { id: 2, start: '2026-10-02T12:00:00+03:00', end: '2026-10-02T14:00:00+03:00', remaining: 0, capacity: 2 },
];

export const couriers: Courier[] = [{ id: 2, name: 'Андрій Шевчук' }];

export const farmProfile: FarmerProfile = { id: 1, name: green.farmerName, lat: 49.816, lon: 24.13, certified: true, verified: true, rating: 4.8, reviewCount: 12, rejectionReason: null, story: null, deliveryDays: [], documentCount: 0 };

export const ownProducts: Product[] = [
  { id: 1, farmerId: 1, name: { uk: 'Морква', en: 'Carrots' }, category: 'vegetables', unitCode: 'kg', unit: { uk: 'кг', en: 'kg' }, price: 16, stock: 200, photoUrl: null, seasonMonths: [], description: null, composition: null, shelfLife: null, storage: null },
  { id: 4, farmerId: 1, name: { uk: 'Полуниця', en: 'Strawberries' }, category: 'vegetables', unitCode: 'kg', unit: { uk: 'кг', en: 'kg' }, price: 95, stock: 0, photoUrl: null, seasonMonths: [5, 6, 7], description: null, composition: null, shelfLife: null, storage: null },
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
  farmerContact: 'Олена Коваль',
  farmerPhone: '+380671110001',
  pickupLat: 49.816,
  pickupLon: 24.13,
  buyerName: 'Оксана Демченко',
  buyerPhone: '+380931112233',
  addressDetails: { entrance: '2', floor: '3', intercom: '5К' },
  dropOffLat: 49.8378,
  dropOffLon: 24.0468,
  comment: 'Подзвоніть за 10 хвилин',
  lines: [{ name: { uk: 'Морква', en: 'Carrots' }, unit: { uk: 'кг', en: 'kg' }, quantity: 10 }],
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
    const stopped = status === 'Rejected' || status === 'Cancelled';
    const failed = status === 'DeliveryFailed';
    const reached = stopped ? ['Placed', status] : failed ? [...PATH.slice(0, 4), status] : PATH.slice(0, PATH.indexOf(status) + 1);
    const order: Order = {
      id: 1001 + this.orders.length,
      checkoutOrderIds: [1001 + this.orders.length],
      status,
      farmerId: 1,
      lines: [{ productId: 1, name: products[0]!.name, unit: products[0]!.unit, unitPrice: 16, quantity: 10, total: 160 }],
      subtotal: 160,
      discount: 0,
      total: 160,
      paymentMethod: 'Card',
      paymentStatus: stopped ? 'Refunded' : 'Paid',
      paidAmount: 160,
      refundedAmount: stopped ? 160 : 0,
      address: 'Львів, вул. Городоцька, 15',
      slotStart: slots[0]!.start,
      slotEnd: slots[0]!.end,
      comment: null,
      promoCode: null,
      deliveryCode: '4821',
      rejectionReason: status === 'Rejected' ? 'Морква закінчилася' : null,
      deliveryProblem: failed ? 'BuyerAbsent' : null,
      deliveryProblemNote: null,
      addressDetails: null,
      dropOffLat: null,
      dropOffLon: null,
      buyerName: 'Оксана Демченко',
      buyerPhone: '+380931112233',
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
  promoCodes: [{ code: 'FARM10', percent: 10, minTotal: 300, validUntil: '2026-10-31T09:00:00+03:00', active: true }] as PromoCode[],
  /** Слоти доставки, які бачать покупець і адміністратор; адміністратор може їх змінювати. */
  slotList: slots.map((slot) => ({ ...slot })),
  adminRequests: [] as { path: string; body: Record<string, unknown> }[],
  reviews: [] as Review[],
  /** Відгуки покупців, що купували товар: GET /api/products/:id/reviews. */
  productReviews: {} as Record<number, Review[]>,
  /** Документи фермера для верифікації (і того, кого перевіряє адміністратор). */
  documents: [] as FarmDocument[],
  /** Запити підказок адрес до геокодера. */
  geocodeQueries: [] as string[],
  /** Швидкі зміни залишку з рядка товару: POST /api/farmer/products/:id/stock. */
  stockChanges: [] as { id: number; delta: number }[],
  /** Відгуки про ферми (усі, зокрема приховані) - для сторінки ферми й модерації адміністратора. */
  farmReviews: [] as AdminReview[],
  /** Залишки, що відрізняються від каталогу-зразка (для «Замовити знову»). */
  stock: {} as Record<number, number>,
  /** Завантаження фото товарів: товар, тип і розмір файлу. */
  photoUploads: [] as { id: number; type: string; bytes: number }[],
  /** Додає відгук про ферму «Зелений Гай» (farmerId 1). */
  addFarmReview(rating: number, comment: string | null, author = 'Оксана Д.', hidden = false): AdminReview {
    const review: AdminReview = {
      id: 500 + this.farmReviews.length,
      orderId: 900 + this.farmReviews.length,
      farmerId: 1,
      farmName: { uk: 'Ферма «Зелений Гай»', en: 'Zelenyi Hai Farm' },
      rating,
      comment,
      author,
      at: `2026-09-${String(10 + this.farmReviews.length).padStart(2, '0')}T12:00:00+03:00`,
      hidden,
      hiddenReason: hidden ? 'Реклама' : null,
    };
    this.farmReviews.unshift(review);
    return review;
  },
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
  /** Чи ввімкнено на сервері автоматичний переклад полів товару. */
  translationAvailable: false,
  translationRequests: [] as ProductText[][],
  /** Код помилки, з якою сервер відхиляє переклад; null - переклад успішний. */
  translationError: null as string | null,
  /** Чи ввімкнено на сервері підказки ШІ та що вони відповідають. */
  aiAvailable: false,
  aiError: null as string | null,
  reviewSummaries: {} as Record<string, ReviewSummaryReply['summary']>,
  related: [] as CatalogItem[],
  relatedRequests: [] as string[],
  basketPlan: { lines: [], missing: [] } as PlannedBasket,
  basketRequests: [] as { request: string; lang: string }[],
  suggestion: { understood: true, name: { uk: 'Мед липовий', en: 'Linden honey' }, category: 'honey', description: { uk: 'Світлий мед', en: 'Light honey' } } as ProductSuggestion,
  suggestionUploads: 0,
  reviewCheck: { flagged: [], remaining: 0 } as ReviewCheckResult,
  reviewChecks: 0,
  documentCheck: { kind: { uk: 'Сертифікат', en: 'Certificate' }, holderName: 'Ферма «Сокільники»', number: 'UA-77', issuedOn: null, validUntil: '2027-01-01', concerns: [{ uk: 'Назва не збігається', en: 'The name differs' }] } as DocumentCheck,
  documentChecks: [] as number[],
  /** Чи ввімкнено на сервері розумний пошук каталогу. */
  smartSearchAvailable: false,
  smartSearchRequests: [] as string[],
  smartSearchResult: { understood: true, text: null, category: 'dairy', certified: false, minPrice: null, maxPrice: null, maxKm: null, sort: null, deliveryDay: null } as SmartSearchResult,
  /** Код помилки, з якою сервер відхиляє розумний пошук; null - пошук успішний. */
  smartSearchError: null as string | null,
  /** Користувач - фермер із двома товарами (якщо верифікований). */
  asFarmer(verified = true) {
    this.user = user('Buyer', 'Farmer');
    this.farm = { ...farmProfile, verified };
    this.farmProducts = verified ? ownProducts.map((product) => ({ ...product })) : [];
  },
  reset() {
    this.productReviews = {};
    this.documents = [];
    this.geocodeQueries = [];
    this.stockChanges = [];
    this.farmReviews = [];
    this.photoUploads = [];
    this.stock = {};
    this.demoAccounts = [];
    this.pendingFarmers = [];
    this.audit = [];
    this.promoCodes = [{ code: 'FARM10', percent: 10, minTotal: 300, validUntil: '2026-10-31T09:00:00+03:00', active: true }];
    this.slotList = slots.map((slot) => ({ ...slot }));
    this.adminRequests = [];
    this.reviews = [];
    this.notifications = [];
    this.farm = null;
    this.farmProducts = [];
    this.deliveries = [];
    this.actions = [];
    this.registrations = [];
    this.productRequests = [];
    this.translationAvailable = false;
    this.translationRequests = [];
    this.translationError = null;
    this.aiAvailable = false;
    this.aiError = null;
    this.reviewSummaries = {};
    this.related = [];
    this.relatedRequests = [];
    this.basketPlan = { lines: [], missing: [] };
    this.basketRequests = [];
    this.suggestion = { understood: true, name: { uk: 'Мед липовий', en: 'Linden honey' }, category: 'honey', description: { uk: 'Світлий мед', en: 'Light honey' } };
    this.suggestionUploads = 0;
    this.reviewCheck = { flagged: [], remaining: 0 };
    this.reviewChecks = 0;
    this.documentChecks = [];
    this.smartSearchAvailable = false;
    this.smartSearchRequests = [];
    this.smartSearchResult = { understood: true, text: null, category: 'dairy', certified: false, minPrice: null, maxPrice: null, maxKm: null, sort: null, deliveryDay: null };
    this.smartSearchError = null;
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
    lines.push({ productId, name: product.name, unit: product.unit, photoUrl: product.photoUrl, price: product.price, quantity: total, total: product.price * total, farmerId: product.farmerId, farmerName: product.farmerName });
    this.cart = cartOf(lines);
  },
};

/** Кошик із рядків: farmerId - ферма, якщо всі товари від однієї, інакше null (як на сервері). */
function cartOf(lines: Cart['lines']): Cart {
  const farms = [...new Set(lines.map((line) => line.farmerId))];
  return { farmerId: farms.length === 1 ? farms[0]! : null, lines, total: lines.reduce((sum, line) => sum + line.total, 0) };
}

const error = (status: number, code: string, message = 'Повідомлення сервера українською') =>
  HttpResponse.json({ error: code, message }, { status });

const authorized = (request: Request) => request.headers.get('Authorization') === `Bearer ${TOKEN}`;

export const handlers = [
  http.get('*/api/reference', () => HttpResponse.json(reference)),

  http.get('*/api/farmers', ({ request }) =>
    HttpResponse.json(new URL(request.url).searchParams.has('lat') ? farms : farms.map((farm) => ({ ...farm, distanceKm: null }))),
  ),

  http.get('*/api/slots', () => HttpResponse.json(backend.slotList)),

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

  http.post('*/api/admin/farmers/:id/reject', async ({ params, request }) => {
    const { reason } = (await request.json()) as { reason: string };
    const farmer = backend.pendingFarmers.find((item) => item.id === Number(params.id));
    if (!farmer) {
      return error(404, 'farmer_not_found');
    }

    if (!reason.trim()) {
      return error(400, 'reason_required');
    }

    backend.pendingFarmers = backend.pendingFarmers.filter((item) => item !== farmer);
    backend.record('farmer.reject', `farmer#${farmer.id}`, reason);
    return HttpResponse.json({ ...farmer, rejectionReason: reason });
  }),

  http.patch('*/api/admin/slots/:id', async ({ params, request }) => {
    const body = (await request.json()) as { start: string; end: string; capacity: number };
    const slot = backend.slotList.find((item) => item.id === Number(params.id));
    if (!slot) {
      return error(404, 'slot_not_found');
    }

    const booked = slot.capacity - slot.remaining;
    if (body.capacity < booked) {
      return error(409, 'slot_capacity_below_booked');
    }

    if (booked > 0 && (body.start !== slot.start || body.end !== slot.end)) {
      return error(409, 'slot_in_use');
    }

    Object.assign(slot, { start: body.start, end: body.end, capacity: body.capacity, remaining: body.capacity - booked });
    backend.record('slot.update', `slot#${slot.id}`, `ємність ${body.capacity}`);
    return HttpResponse.json({ id: slot.id, start: slot.start, end: slot.end, capacity: slot.capacity });
  }),

  http.delete('*/api/admin/slots/:id', ({ params }) => {
    const slot = backend.slotList.find((item) => item.id === Number(params.id));
    if (!slot) {
      return error(404, 'slot_not_found');
    }

    if (slot.remaining < slot.capacity) {
      return error(409, 'slot_in_use');
    }

    backend.slotList = backend.slotList.filter((item) => item !== slot);
    backend.record('slot.delete', `slot#${slot.id}`, '');
    return new HttpResponse(null, { status: 204 });
  }),

  http.post('*/api/admin/promocodes/:code/:action', ({ params }) => {
    const active = params.action === 'activate';
    const promo = backend.promoCodes.find((item) => item.code === params.code);
    if (!promo) {
      return error(404, 'promo_unknown');
    }

    backend.promoCodes = backend.promoCodes.map((item) => (item === promo ? { ...item, active } : item));
    backend.record(active ? 'promo.activate' : 'promo.deactivate', `promo#${promo.code}`, '');
    return HttpResponse.json({ ...promo, active });
  }),

  http.put('*/api/farmer/products/:id/photo', async ({ params, request }) => {
    const type = request.headers.get('Content-Type') ?? '';
    const bytes = (await request.arrayBuffer()).byteLength;
    backend.photoUploads.push({ id: Number(params.id), type, bytes });
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) {
      return error(400, 'photo_type_invalid');
    }

    const url = `/img/products/${String(params.id)}?v=${backend.photoUploads.length}`;
    backend.farmProducts = backend.farmProducts.map((product) => (product.id === Number(params.id) ? { ...product, photoUrl: url } : product));
    return HttpResponse.json(backend.farmProducts.find((product) => product.id === Number(params.id)));
  }),

  http.delete('*/api/farmer/products/:id/photo', ({ params }) => {
    backend.farmProducts = backend.farmProducts.map((product) => (product.id === Number(params.id) ? { ...product, photoUrl: null } : product));
    return HttpResponse.json(backend.farmProducts.find((product) => product.id === Number(params.id)));
  }),

  http.post('*/api/farmer/reapply', () => {
    if (!backend.farm?.rejectionReason) {
      return error(409, 'not_rejected');
    }

    backend.farm = { ...backend.farm, rejectionReason: null };
    return HttpResponse.json(backend.farm);
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

    backend.promoCodes = [{ ...body, active: true }, ...backend.promoCodes];
    backend.record('promo.create', `promo#${body.code}`, `${body.percent} %`);
    return HttpResponse.json(body, { status: 201 });
  }),

  http.get('*/api/admin/audit', () => HttpResponse.json(backend.audit)),

  http.get('*/api/farmers/:id/reviews', ({ params }) =>
    HttpResponse.json(
      backend.farmReviews
        .filter((review) => review.farmerId === Number(params.id) && !review.hidden)
        .map(({ id, orderId, rating, comment, author, at }) => ({ id, orderId, rating, comment, author, at })),
    ),
  ),
  http.get('*/api/admin/reviews', () => HttpResponse.json(backend.farmReviews)),
  http.post('*/api/admin/reviews/:id/:action', async ({ params, request }) => {
    const id = Number(params.id);
    const hide = params.action === 'hide';
    const body = hide ? ((await request.json()) as { reason: string }) : null;
    if (hide && !body?.reason.trim()) {
      return error(400, 'reason_required');
    }

    backend.farmReviews = backend.farmReviews.map((review) =>
      review.id === id ? { ...review, hidden: hide, hiddenReason: hide ? body!.reason.trim() : null } : review,
    );
    backend.audit.push({ id: backend.audit.length + 1, adminId: 1, action: hide ? 'review.hide' : 'review.restore', target: `review#${id}`, details: body?.reason ?? '', at: '2026-10-01T16:30:00+03:00' });
    return HttpResponse.json(backend.farmReviews.find((review) => review.id === id));
  }),

  http.get('*/api/orders/:id/review', ({ params }) =>
    HttpResponse.json({ review: backend.reviews.find((review) => review.orderId === Number(params.id)) ?? null }),
  ),

  http.post('*/api/orders/:id/review', async ({ params, request }) => {
    const body = (await request.json()) as { rating: number; comment: string | null };
    const orderId = Number(params.id);
    if (backend.reviews.some((review) => review.orderId === orderId)) {
      return error(409, 'already_reviewed');
    }

    const review: Review = { id: backend.reviews.length + 1, orderId, rating: body.rating, comment: body.comment, author: 'Оксана Д.', at: '2026-10-01T16:00:00+03:00' };
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

    backend.farm = { id: 13, name: body.farmName, lat: body.lat, lon: body.lon, certified: body.certified, verified: false, rating: null, reviewCount: 0, rejectionReason: null, story: null, deliveryDays: [], documentCount: 0 };
    backend.user = { ...backend.user, roles: ['Buyer', 'Farmer'] };
    return HttpResponse.json(backend.farm, { status: 201 });
  }),

  http.get('*/api/farmer/profile', () => (backend.farm ? HttpResponse.json(backend.farm) : error(403, 'not_a_farmer'))),

  http.get('*/api/farmer/products', () => (backend.farm ? HttpResponse.json(backend.farmProducts) : error(403, 'not_a_farmer'))),

  http.get('*/api/farmer/products/translation', () => HttpResponse.json({ available: backend.translationAvailable })),

  http.post('*/api/farmer/products/translation', async ({ request }) => {
    const { items } = (await request.json()) as { items: ProductText[] };
    backend.translationRequests.push(items);
    return backend.translationError
      ? error(503, backend.translationError)
      : HttpResponse.json({ items: items.map((item) => ({ ...item, text: `${item.targetLang}: ${item.text}` })) });
  }),

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
      description: body.description ?? null,
      composition: body.composition ?? null,
      shelfLife: body.shelfLife ?? null,
      storage: body.storage ?? null,
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

  http.post('*/api/courier/deliveries/:id/fail', async ({ params, request }) => {
    const body = (await request.json()) as { problem: 'BuyerAbsent' | 'AddressNotFound' | 'Other'; note: string | null };
    backend.actions.push({ orderId: Number(params.id), kind: 'fail', body });
    if (body.problem === 'Other' && !body.note?.trim()) {
      return error(400, 'note_required');
    }

    backend.deliveries = backend.deliveries.filter((task) => task.orderId !== Number(params.id));
    return HttpResponse.json({ id: Number(params.id), status: 'DeliveryFailed', deliveryProblem: body.problem });
  }),

  http.post('*/api/orders/:id/reschedule', async ({ params, request }) => {
    const { slotId } = (await request.json()) as { slotId: number };
    const orderId = Number(params.id);
    const order = backend.orders.find((item) => item.id === orderId);
    if (!order) {
      return error(404, 'order_not_found');
    }

    if (order.status !== 'DeliveryFailed') {
      return error(409, 'invalid_status');
    }

    const slot = backend.slotList.find((item) => item.id === slotId);
    if (!slot || slot.remaining <= 0) {
      return error(409, 'slot_full');
    }

    backend.moveOrder(orderId, 'InTransit');
    backend.orders = backend.orders.map((item) => (item.id === orderId ? { ...item, slotStart: slot.start, slotEnd: slot.end } : item));
    return HttpResponse.json(backend.orders.find((item) => item.id === orderId)!);
  }),

  http.post('*/api/courier/deliveries/:id/confirm', async ({ params, request }) => {
    const { code } = (await request.json()) as { code: string };
    if (code !== '4821') {
      return error(400, 'delivery_code_invalid');
    }

    backend.deliveries = backend.deliveries.filter((task) => task.orderId !== Number(params.id));
    return HttpResponse.json({ id: Number(params.id), status: 'Delivered' });
  }),


  http.get('*/api/orders', () => HttpResponse.json(backend.orders)),

  // Скасування покупцем: лише до прийняття фермером; повтор повертає вже скасоване замовлення.
  http.post('*/api/orders/:id/cancel', ({ params }) => {
    const orderId = Number(params.id);
    const order = backend.orders.find((item) => item.id === orderId);
    if (!order) {
      return error(404, 'order_not_found');
    }

    if (order.status !== 'Placed' && order.status !== 'Cancelled') {
      return error(409, 'cancel_unavailable');
    }

    if (order.status === 'Placed') {
      backend.moveOrder(orderId, 'Cancelled');
      backend.orders = backend.orders.map((item) =>
        item.id === orderId && item.paidAmount > 0 ? { ...item, paymentStatus: 'Refunded', refundedAmount: item.paidAmount } : item,
      );
    }

    return HttpResponse.json(backend.orders.find((item) => item.id === orderId)!);
  }),

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

    // Як на сервері: по замовленню на кожну ферму кошика; усі знають номери одне одного.
    const farms = [...new Set(backend.cart.lines.map((line) => line.farmerId))];
    const placed = farms.map((farmerId) => {
      const lines = backend.cart.lines.filter((line) => line.farmerId === farmerId);
      const subtotal = lines.reduce((sum, line) => sum + line.total, 0);
      const discount = body.promoCode ? subtotal / 10 : 0;
      return backend.addOrder('Placed', {
        farmerId,
        lines: lines.map((line) => ({ productId: line.productId, name: line.name, unit: line.unit, unitPrice: line.price, quantity: line.quantity, total: line.total })),
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
    });
    const ids = placed.map((order) => order.id);
    backend.orders = backend.orders.map((order) => (ids.includes(order.id) ? { ...order, checkoutOrderIds: ids } : order));
    backend.cart = { farmerId: null, lines: [], total: 0 };
    return HttpResponse.json(backend.orders.find((order) => order.id === ids[0]), { status: 201 });
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

    const day = url.searchParams.get('deliveryDay');
    const all = url.searchParams.get('includeSoldOut') === 'true' ? [...products, soldOut] : products;
    return HttpResponse.json(
      all.filter(
        (item) =>
          (!q || item.name.uk.toLowerCase().includes(q) || item.name.en.toLowerCase().includes(q)) &&
          (!category || item.category === category) &&
          (!farmerId || item.farmerId === farmerId) &&
          (url.searchParams.get('certified') !== 'true' || item.certified) &&
          (!day || item.farmerDeliveryDays.length === 0 || item.farmerDeliveryDays.includes(day as CatalogItem['farmerDeliveryDays'][number])) &&
          item.price >= min &&
          item.price <= max,
      ),
    );
  }),

  http.get('*/api/ai/status', () => HttpResponse.json({ available: backend.aiAvailable })),

  http.get('*/api/farmers/:id/reviews/summary', ({ params }) => HttpResponse.json({ summary: backend.reviewSummaries[`farm:${String(params.id)}`] ?? null })),

  http.get('*/api/products/:id/reviews/summary', ({ params }) => HttpResponse.json({ summary: backend.reviewSummaries[`product:${String(params.id)}`] ?? null })),

  http.get('*/api/catalog/related', ({ request }) => {
    backend.relatedRequests.push(new URL(request.url).searchParams.get('ids') ?? '');
    return HttpResponse.json(backend.related);
  }),

  http.post('*/api/catalog/basket-plan', async ({ request }) => {
    backend.basketRequests.push((await request.json()) as { request: string; lang: string });
    return backend.aiError ? error(503, backend.aiError) : HttpResponse.json(backend.basketPlan);
  }),

  http.post('*/api/farmer/products/suggestion', () => {
    backend.suggestionUploads += 1;
    return backend.aiError ? error(503, backend.aiError) : HttpResponse.json(backend.suggestion);
  }),

  http.post('*/api/admin/reviews/check', () => {
    backend.reviewChecks += 1;
    return backend.aiError ? error(503, backend.aiError) : HttpResponse.json(backend.reviewCheck);
  }),

  http.post('*/api/admin/farmers/:id/documents/:documentId/check', ({ params }) => {
    backend.documentChecks.push(Number(params.documentId));
    return backend.aiError ? error(503, backend.aiError) : HttpResponse.json(backend.documentCheck);
  }),

  http.get('*/api/catalog/smart-search', () => HttpResponse.json({ available: backend.smartSearchAvailable })),

  http.post('*/api/catalog/smart-search', async ({ request }) => {
    const { query } = (await request.json()) as { query: string };
    backend.smartSearchRequests.push(query);
    return backend.smartSearchError ? error(503, backend.smartSearchError) : HttpResponse.json(backend.smartSearchResult);
  }),

  http.get('*/api/catalog/:id', ({ params }) => {
    const item = [...products, soldOut].find((product) => product.productId === Number(params.id));
    return item ? HttpResponse.json(item) : error(404, 'product_not_found');
  }),

  http.get('*/api/products/:id/reviews', ({ params }) => HttpResponse.json(backend.productReviews[Number(params.id)] ?? [])),

  http.patch('*/api/farmer/profile', async ({ request }) => {
    const body = (await request.json()) as FarmProfileChanges;
    if (!backend.farm) {
      return error(403, 'not_a_farmer');
    }

    const story = body.story && (body.story.uk.trim() || body.story.en.trim()) ? body.story : null;
    backend.farm = { ...backend.farm, story: body.story === undefined ? backend.farm.story : story, deliveryDays: body.deliveryDays ?? backend.farm.deliveryDays };
    return HttpResponse.json(backend.farm);
  }),

  http.post('*/api/farmer/products/:id/stock', async ({ params, request }) => {
    const { delta } = (await request.json()) as { delta: number };
    const product = backend.farmProducts.find((item) => item.id === Number(params.id));
    if (!product) {
      return error(404, 'product_not_found');
    }

    if (product.stock + delta < 0) {
      return error(409, 'stock_negative');
    }

    backend.stockChanges.push({ id: product.id, delta });
    product.stock += delta;
    return HttpResponse.json(product);
  }),

  http.get('*/api/farmer/documents', () => HttpResponse.json(backend.documents)),

  http.post('*/api/farmer/documents', async ({ request }) => {
    const name = new URL(request.url).searchParams.get('name') ?? 'Документ';
    const size = (await request.arrayBuffer()).byteLength;
    const document: FarmDocument = { id: 70 + backend.documents.length, name, contentType: request.headers.get('Content-Type') ?? 'application/pdf', size, uploadedAt: '2026-10-01T09:00:00+03:00' };
    backend.documents.push(document);
    if (backend.farm) {
      backend.farm = { ...backend.farm, documentCount: backend.documents.length };
    }

    return HttpResponse.json(document, { status: 201 });
  }),

  http.delete('*/api/farmer/documents/:id', ({ params }) => {
    backend.documents = backend.documents.filter((document) => document.id !== Number(params.id));
    if (backend.farm) {
      backend.farm = { ...backend.farm, documentCount: backend.documents.length };
    }

    return new HttpResponse(null, { status: 204 });
  }),

  http.get('*/api/admin/farmers/:id/documents', () => HttpResponse.json(backend.documents)),

  http.get('*/api/admin/farmers/:id/documents/:documentId', ({ params }) => {
    const document = backend.documents.find((item) => item.id === Number(params.documentId));
    return document ? new HttpResponse('<svg xmlns="http://www.w3.org/2000/svg"/>', { headers: { 'Content-Type': document.contentType } }) : error(404, 'document_not_found');
  }),

  // Геокодер підказок адрес (Photon, OpenStreetMap): відповідь у форматі GeoJSON, як у справжнього сервісу.
  http.get('https://photon.komoot.io/api/', ({ request }) => {
    const q = new URL(request.url).searchParams.get('q') ?? '';
    backend.geocodeQueries.push(q);
    const features = q.toLowerCase().startsWith('личак')
      ? [
          { geometry: { coordinates: [24.0468, 49.8378] }, properties: { street: 'вулиця Личаківська', housenumber: '24', district: 'Личаківський район', city: 'Львів' } },
          { geometry: { coordinates: [24.06, 49.836] }, properties: { name: 'вулиця Личаківська', city: 'Львів' } },
        ]
      : [];
    return HttpResponse.json({ type: 'FeatureCollection', features });
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
    backend.putInCart(productId, quantity);
    return HttpResponse.json(backend.cart);
  }),

  http.delete('*/api/cart/items/:id', ({ params }) => {
    backend.cart = cartOf(backend.cart.lines.filter((line) => line.productId !== Number(params.id)));
    return HttpResponse.json(backend.cart);
  }),

  http.post('*/api/orders/:id/reorder', ({ params }) => {
    const order = backend.orders.find((item) => item.id === Number(params.id));
    if (!order) {
      return error(404, 'order_not_found');
    }

    const shortfalls: { name: Order['lines'][number]['name']; requested: number; added: number }[] = [];
    for (const line of order.lines) {
      const stock = backend.stock[line.productId] ?? products.find((item) => item.productId === line.productId)?.stock ?? 0;
      const added = Math.min(line.quantity, stock);
      if (added > 0) {
        backend.putInCart(line.productId, added);
      }

      if (added < line.quantity) {
        shortfalls.push({ name: line.name, requested: line.quantity, added });
      }
    }

    return HttpResponse.json({ cart: backend.cart, shortfalls });
  }),
];

export const server = setupServer(...handlers);
