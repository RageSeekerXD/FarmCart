import type { LocalizedText, Order, OrderStatus } from '../../api/types';

/** Замовлення, які ще треба зібрати: нові, прийняті й ті, що збираються. */
export const TO_PACK: readonly OrderStatus[] = ['Placed', 'Accepted', 'Assembling'];
/** Скасовані покупцем і відхилені фермером - не виторг. */
const LOST: readonly OrderStatus[] = ['Rejected', 'Cancelled'];

/** Місцева дата слоту як ключ дня: «2026-11-17». */
export function dayKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export interface Kpis {
  /** Виторг доставлених замовлень. */
  revenue: number;
  /** Сума замовлень у роботі: ще не доставлені, але й не скасовані. */
  expected: number;
  orders: number;
  averageOrder: number;
  /** Частка відхилених і скасованих замовлень, 0-1. */
  lostShare: number;
}

export function kpis(orders: readonly Order[]): Kpis {
  const delivered = orders.filter((order) => order.status === 'Delivered');
  const lost = orders.filter((order) => LOST.includes(order.status));
  const active = orders.filter((order) => order.status !== 'Delivered' && !LOST.includes(order.status));
  const counted = [...delivered, ...active];
  const sum = (list: readonly Order[]) => list.reduce((total, order) => total + order.total, 0);
  return {
    revenue: sum(delivered),
    expected: sum(active),
    orders: orders.length,
    averageOrder: counted.length > 0 ? sum(counted) / counted.length : 0,
    lostShare: orders.length > 0 ? lost.length / orders.length : 0,
  };
}

export interface DayRevenue {
  /** Ключ дня «2026-11-17». */
  day: string;
  total: number;
  orders: number;
}

/**
 * Сума замовлень (без скасованих і відхилених) за днями доставки: from днів до сьогодні … to днів після -
 * минулі продажі й уже замовлене наперед. Дні без замовлень теж є, щоб вісь часу була рівномірною.
 */
export function revenueByDay(orders: readonly Order[], today: Date, from = -13, to = 6): DayRevenue[] {
  const days: DayRevenue[] = [];
  for (let offset = from; offset <= to; offset++) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset, 12);
    days.push({ day: dayKey(date.toISOString()), total: 0, orders: 0 });
  }

  const byDay = new Map(days.map((item) => [item.day, item]));
  for (const order of orders) {
    const bucket = byDay.get(dayKey(order.slotStart));
    if (bucket && !LOST.includes(order.status)) {
      bucket.total += order.total;
      bucket.orders += 1;
    }
  }

  return days;
}

export interface ProductSales {
  productId: number;
  name: LocalizedText;
  unit: LocalizedText;
  quantity: number;
  revenue: number;
}

/** Найпопулярніші товари за виторгом (без скасованих і відхилених замовлень). */
export function topProducts(orders: readonly Order[], limit = 5): ProductSales[] {
  const byProduct = new Map<number, ProductSales>();
  for (const order of orders.filter((item) => !LOST.includes(item.status))) {
    for (const line of order.lines) {
      const entry = byProduct.get(line.productId) ?? { productId: line.productId, name: line.name, unit: line.unit, quantity: 0, revenue: 0 };
      entry.quantity += line.quantity;
      entry.revenue += line.total;
      byProduct.set(line.productId, entry);
    }
  }

  return [...byProduct.values()].sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity).slice(0, limit);
}

export interface SlotGroup {
  /** Початок слоту - ключ групи. */
  start: string;
  end: string;
  orders: Order[];
}

/** Слоти, у яких є що збирати, від найближчого. */
export function slotsToPack(orders: readonly Order[]): SlotGroup[] {
  const groups = new Map<string, SlotGroup>();
  for (const order of orders.filter((item) => TO_PACK.includes(item.status))) {
    const group = groups.get(order.slotStart) ?? { start: order.slotStart, end: order.slotEnd, orders: [] };
    group.orders.push(order);
    groups.set(order.slotStart, group);
  }

  return [...groups.values()].sort((a, b) => a.start.localeCompare(b.start));
}

export interface PickLine {
  productId: number;
  name: LocalizedText;
  unit: LocalizedText;
  quantity: number;
  orderIds: number[];
}

/** Лист збирання: скільки кожного товару підготувати на слот і для яких замовлень (наприклад, 9 хлібин на вт 10:00-12:00). */
export function pickList(group: SlotGroup): PickLine[] {
  const byProduct = new Map<number, PickLine>();
  for (const order of group.orders) {
    for (const line of order.lines) {
      const entry = byProduct.get(line.productId) ?? { productId: line.productId, name: line.name, unit: line.unit, quantity: 0, orderIds: [] };
      entry.quantity += line.quantity;
      entry.orderIds.push(order.id);
      byProduct.set(line.productId, entry);
    }
  }

  return [...byProduct.values()]
    .map((line) => ({ ...line, orderIds: [...line.orderIds].sort((x, y) => x - y) }))
    .sort((a, b) => b.quantity - a.quantity);
}
