// Контракт REST API FarmCart 2.0. Типи відповідей виводяться зі схеми OpenAPI сервера (schema.d.ts):
// її генерує `npm run api:schema` із запущеного FarmCart.Api, тож зміна DTO на сервері ламає збірку клієнта,
// а не вилазить помилкою в браузері. Вручну описано лише запити й відповіді з анонімних типів сервера.
import type { components } from './schema';

type Schemas = components['schemas'];

/**
 * Числа в схемі мають тип `number | string`, бо сервер приймає число і з рядка; у відповідях він завжди
 * пише число, тому для клієнта це `number`.
 */
type Wire<T> = number extends T ? Exclude<T, string> : T extends (infer Item)[] ? Wire<Item>[] : T extends object ? { [Key in keyof T]: Wire<T[Key]> } : T;

export type Lang = 'uk' | 'en';

/** Двомовне поле API: { uk, en }. */
export type LocalizedText = Wire<Schemas['LocalizedText']>;

export type Role = Schemas['Role'];
export type User = Wire<Schemas['UserDto']>;

export type ReferenceItem = Wire<Schemas['ReferenceItem']>;
export type ReferenceData = Wire<Schemas['ReferenceData']>;

export type CatalogSort = NonNullable<Schemas['CatalogSort']>;
export type CatalogItem = Wire<Schemas['CatalogItem']>;
export type FarmOnMap = Wire<Schemas['FarmOnMap']>;

export type CartLine = Wire<Schemas['CartLineView']>;
export type Cart = Wire<Schemas['CartView']>;
export type Slot = Wire<Schemas['SlotView']>;

export type PaymentMethod = Schemas['PaymentMethod'];
export type PaymentStatus = Schemas['PaymentStatus'];
export type OrderStatus = Schemas['OrderStatus'];
export type OrderLine = Wire<Schemas['OrderLineDto']>;

/** Українські назви статусів (title, statusTitle, paymentTitle) клієнт не використовує: він перекладає за кодом. */
export type StatusChange = Omit<Wire<Schemas['StatusChangeDto']>, 'title'>;
export type Order = Omit<Wire<Schemas['OrderDto']>, 'statusTitle' | 'paymentTitle' | 'history'> & { history: StatusChange[] };

export type FarmerProfile = Wire<Schemas['FarmerDto']>;
export type Product = Wire<Schemas['ProductDto']>;
export type Courier = Wire<Schemas['CourierDto']>;
export type DeliveryTask = Wire<Schemas['DeliveryTask']>;
export type Shortage = Wire<Schemas['Shortage']>;

/** Сповіщення (BE-2): клієнт складає текст мовою інтерфейсу з kind і params; text - український запасний варіант. */
export type AppNotification = Wire<Schemas['Notification']>;
export type AuditEntry = Wire<Schemas['AuditEntry']>;
export type PromoCode = Wire<Schemas['PromoCode']>;
export type Review = Wire<Schemas['ReviewDto']>;

// --- Відповіді з анонімних типів сервера та тіла запитів ---

export interface CodeResponse {
  expiresAt: string;
  /** Лише в режимі розробки (FarmCart:ExposeSmsCodes). */
  devCode: string | null;
}

export interface SessionResponse {
  token: string;
  isNewUser: boolean;
  user: User;
}

export interface CheckoutRequest {
  address: string;
  slotId: number;
  paymentMethod: PaymentMethod;
  /** Токен платіжного провайдера; номер картки на сервер FarmCart не надсилається ніколи. */
  paymentToken: string | null;
  promoCode: string | null;
  comment: string | null;
}

export interface FarmRegistration {
  farmName: LocalizedText;
  lat: number;
  lon: number;
  certified: boolean;
  documents: string | null;
}

export interface ProductDraft {
  name: LocalizedText;
  /** Код категорії з довідника. */
  category: string;
  /** Код одиниці продажу з довідника. */
  unit: string;
  price: number;
  stock: number;
  /** Місяці сезону 1-12; порожній список - цілий рік. */
  seasonMonths: number[];
}

export type ProductChanges = Partial<Pick<ProductDraft, 'name' | 'price' | 'stock' | 'seasonMonths'>>;

export interface ApiErrorBody {
  error: string;
  message: string;
}
