import { describe, expect, it } from 'vitest';
import type { Order } from '../../api/types';
import { backend, products, slots } from '../../test/server';
import { kpis, pickList, revenueByDay, slotsToPack, topProducts } from './stats';

const bread = { uk: 'Хліб житній', en: 'Rye bread' };
const loaf = { uk: 'буханець', en: 'loaf' };

function order(status: Order['status'], total: number, patch: Partial<Order> = {}): Order {
  return backend.addOrder(status, { total, ...patch });
}

describe('аналітика фермера', () => {
  it('виторг - доставлені; очікується - у роботі; скасовані й відхилені не рахуються', () => {
    const list = [order('Delivered', 100), order('Accepted', 60), order('Cancelled', 500), order('Rejected', 40)];

    expect(kpis(list)).toEqual({ revenue: 100, expected: 60, orders: 4, averageOrder: 80, lostShare: 0.5 });
  });

  it('за днями доставки - рівна вісь часу з порожніми днями', () => {
    const today = new Date(slots[0]!.start);
    const days = revenueByDay([order('Placed', 160), order('Cancelled', 999)], today, -1, 1);

    expect(days.map((day) => day.total)).toEqual([0, 160, 0]);
    expect(days[1]!.orders).toBe(1);
  });

  it('найпопулярніші товари - за виторгом', () => {
    const list = [
      order('Delivered', 160),
      order('Placed', 96, { lines: [{ productId: 9, name: bread, unit: loaf, unitPrice: 48, quantity: 2, total: 96 }] }),
      order('Placed', 480, { lines: [{ productId: 9, name: bread, unit: loaf, unitPrice: 48, quantity: 10, total: 480 }] }),
    ];

    const top = topProducts(list);

    expect(top.map((item) => [item.name.uk, item.quantity, item.revenue])).toEqual([
      ['Хліб житній', 12, 576],
      [products[0]!.name.uk, 10, 160],
    ]);
  });

  it('лист збирання: товари всіх нових і прийнятих замовлень слоту разом', () => {
    const later = { slotStart: '2026-10-02T14:00:00+03:00', slotEnd: '2026-10-02T16:00:00+03:00' };
    const list = [
      order('Placed', 160),
      order('Accepted', 96, { lines: [{ productId: 9, name: bread, unit: loaf, unitPrice: 48, quantity: 2, total: 96 }, { ...backend.orders.at(-1)!.lines[0]!, quantity: 5 }] }),
      order('Placed', 48, { ...later, lines: [{ productId: 9, name: bread, unit: loaf, unitPrice: 48, quantity: 1, total: 48 }] }),
      order('InTransit', 160),
    ];

    const groups = slotsToPack(list);

    expect(groups.map((group) => group.orders.length)).toEqual([2, 1]);
    expect(pickList(groups[0]!).map((line) => [line.name.uk, line.quantity, line.orderIds.length])).toEqual([
      ['Морква', 15, 2],
      ['Хліб житній', 2, 1],
    ]);
  });
});
