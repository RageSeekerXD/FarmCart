import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { Order, OrderStatus } from '../../api/types';

/** Звичайний шлях замовлення; «відхилено» й «скасовано» - окремі кінці після «оформлено». */
export const ORDER_PATH: readonly OrderStatus[] = ['Placed', 'Accepted', 'Assembling', 'InTransit', 'Delivered'];

export const isFinal = (status: OrderStatus) => status === 'Delivered' || status === 'Rejected' || status === 'Cancelled';

/** Замовлення пішло з дистанції, не дійшовши до покупця: відхилив фермер або скасував покупець. */
export const isStopped = (status: OrderStatus) => status === 'Rejected' || status === 'Cancelled';

/** Скільки кроків звичайного шляху пройдено: для смуги прогресу в списку замовлень. */
export function progressStep(status: OrderStatus): number {
  if (isStopped(status)) {
    return ORDER_PATH.length;
  }

  return status === 'DeliveryFailed' ? ORDER_PATH.indexOf('InTransit') + 1 : ORDER_PATH.indexOf(status) + 1;
}

/** Покупець може скасувати замовлення, доки фермер його не прийняв (те саме правило, що й на сервері). */
export const canCancel = (status: OrderStatus) => status === 'Placed';

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
  // Кур'єр не зміг вручити: шлях пройдено до «в дорозі», далі - «не вручено», а «доставлено» ще попереду.
  if (order.status === 'DeliveryFailed') {
    return [
      ...ORDER_PATH.slice(0, 4).map((status) => ({ status, state: 'done' as const, at: at(status) })),
      { status: 'DeliveryFailed', state: 'current', at: at('DeliveryFailed') },
      { status: 'Delivered', state: 'upcoming', at: null },
    ];
  }

  if (isStopped(order.status)) {
    return [
      { status: 'Placed', state: 'done', at: at('Placed') },
      { status: order.status, state: 'current', at: at(order.status) },
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

/**
 * Скасування замовлення покупцем. Відповідь сервера - оновлене замовлення: ним заміщується кеш трекера,
 * а список замовлень, каталог (залишки) і слоти (звільнене місце) перечитуються.
 */
export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<Order>(`/orders/${id}/cancel`, { method: 'POST' }),
    onSuccess: (order) => {
      queryClient.setQueryData(['order', order.id], order);
      for (const key of ['orders', 'catalog', 'slots']) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
    // Відмова (фермер щойно прийняв) - статус на екрані застарів: перечитуємо замовлення.
    onError: (_, id) => void queryClient.invalidateQueries({ queryKey: ['order', id] }),
  });
}
