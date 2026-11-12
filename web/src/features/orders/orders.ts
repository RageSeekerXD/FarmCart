import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { Order, OrderStatus } from '../../api/types';

/** Звичайний шлях замовлення; «відхилено» - окремий кінець після «оформлено». */
export const ORDER_PATH: readonly OrderStatus[] = ['Placed', 'Accepted', 'Assembling', 'InTransit', 'Delivered'];

export const isFinal = (status: OrderStatus) => status === 'Delivered' || status === 'Rejected';

/**
 * Резервне опитування (UI-12): поки замовлення в роботі, статус перечитується кожні кілька секунд,
 * тож він оновлюється без перезавантаження сторінки й без SignalR (ітерація 5 додасть миттєві події).
 */
export const POLL_MS = 5000;

export type StepState = 'done' | 'current' | 'upcoming';

export interface TimelineStep {
  status: OrderStatus;
  state: StepState;
  at: string | null;
}

/** Таймлайн трекера: пройдені статуси з часом з історії, поточний і майбутні; відхилене замовлення далі не йде. */
export function timeline(order: Pick<Order, 'status' | 'history'>): TimelineStep[] {
  const at = (status: OrderStatus) => order.history.find((change) => change.status === status)?.at ?? null;
  if (order.status === 'Rejected') {
    return [
      { status: 'Placed', state: 'done', at: at('Placed') },
      { status: 'Rejected', state: 'current', at: at('Rejected') },
    ];
  }

  const reached = ORDER_PATH.indexOf(order.status);
  return ORDER_PATH.map((status, index) => ({
    status,
    state: index < reached ? 'done' : index === reached ? 'current' : 'upcoming',
    at: index <= reached ? at(status) : null,
  }));
}

export function useOrders() {
  return useQuery({
    queryKey: ['orders'],
    queryFn: () => api<Order[]>('/orders'),
    refetchInterval: (query) => (query.state.data?.some((order) => !isFinal(order.status)) ? POLL_MS : false),
  });
}

export function useOrder(id: number) {
  return useQuery({
    queryKey: ['order', id],
    queryFn: () => api<Order>(`/orders/${id}`),
    enabled: Number.isInteger(id) && id > 0,
    refetchInterval: (query) => (query.state.data && !isFinal(query.state.data.status) ? POLL_MS : false),
  });
}
