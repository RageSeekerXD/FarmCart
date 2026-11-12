import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { Courier, FarmerProfile, Order, Product, ProductChanges, ProductDraft, ReferenceData, Shortage } from '../../api/types';
import { POLL_MS } from '../orders/orders';

export function useReference() {
  return useQuery({ queryKey: ['reference'], queryFn: () => api<ReferenceData>('/reference'), staleTime: Infinity });
}

export function useFarmerProfile() {
  return useQuery({ queryKey: ['farmer', 'profile'], queryFn: () => api<FarmerProfile>('/farmer/profile') });
}

const PRODUCTS = ['farmer', 'products'] as const;

export function useMyProducts() {
  return useQuery({ queryKey: PRODUCTS, queryFn: () => api<Product[]>('/farmer/products') });
}

/** Зберігає товар: новий - POST, наявний - PATCH (назва, ціна, залишок, сезон). */
export function useSaveProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, draft }: { id: number | null; draft: ProductDraft }) => {
      if (id === null) {
        return api<Product>('/farmer/products', { method: 'POST', body: draft });
      }

      const changes: ProductChanges = { name: draft.name, price: draft.price, stock: draft.stock, seasonMonths: draft.seasonMonths };
      return api<Product>(`/farmer/products/${id}`, { method: 'PATCH', body: changes });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PRODUCTS });
      void queryClient.invalidateQueries({ queryKey: ['catalog'] });
    },
  });
}

const ORDERS = ['farmer', 'orders'] as const;

/** Вхідні замовлення перечитуються кожні кілька секунд: нове замовлення з'являється само (UI-09). */
export function useFarmerOrders() {
  return useQuery({ queryKey: ORDERS, queryFn: () => api<Order[]>('/farmer/orders'), refetchInterval: POLL_MS });
}

export function useCouriers(enabled: boolean) {
  return useQuery({ queryKey: ['couriers'], queryFn: () => api<Courier[]>('/couriers'), enabled, staleTime: 60_000 });
}

export type OrderAction =
  | { kind: 'accept'; orderId: number; shortages: Shortage[] }
  | { kind: 'reject'; orderId: number; reason: string }
  | { kind: 'assemble'; orderId: number }
  | { kind: 'handover'; orderId: number; courierId: number };

function body(action: OrderAction): unknown {
  switch (action.kind) {
    case 'accept':
      return { shortages: action.shortages };
    case 'reject':
      return { reason: action.reason };
    case 'handover':
      return { courierId: action.courierId };
    default:
      return {};
  }
}

export function useOrderAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (action: OrderAction) => api<Order>(`/farmer/orders/${action.orderId}/${action.kind}`, { method: 'POST', body: body(action) }),
    onSuccess: (order) => {
      queryClient.setQueryData<Order[]>(ORDERS, (orders) => orders?.map((item) => (item.id === order.id ? order : item)));
      void queryClient.invalidateQueries({ queryKey: PRODUCTS });
    },
  });
}
