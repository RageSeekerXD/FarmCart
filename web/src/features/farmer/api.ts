import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { Courier, FarmDocument, FarmerProfile, FarmProfileChanges, Order, Product, ProductChanges, ProductDraft, ReferenceData, Shortage } from '../../api/types';
import { POLL_MS } from '../orders/orders';

export function useReference() {
  return useQuery({ queryKey: ['reference'], queryFn: () => api<ReferenceData>('/reference'), staleTime: Infinity });
}

/** Типи й розмір фото, які приймає сервер (п. 5 покращень). */
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

/** Завантаження чи видалення фото товару; після нього оновлюються товари фермера й каталог. */
export function useProductPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: number; file: File | null }) =>
      api<Product>(`/farmer/products/${id}/photo`, file ? { method: 'PUT', body: file } : { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PRODUCTS });
      void queryClient.invalidateQueries({ queryKey: ['catalog'] });
    },
  });
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

      const changes: ProductChanges = {
        name: draft.name,
        price: draft.price,
        stock: draft.stock,
        seasonMonths: draft.seasonMonths,
        description: draft.description,
        composition: draft.composition,
        shelfLife: draft.shelfLife,
        storage: draft.storage,
      };
      return api<Product>(`/farmer/products/${id}`, { method: 'PATCH', body: changes });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PRODUCTS });
      void queryClient.invalidateQueries({ queryKey: ['catalog'] });
    },
  });
}

/**
 * Швидка зміна залишку прямо в списку товарів: +1/−1 чи «немає в наявності» без відкриття форми.
 * Сервер змінює залишок на delta; відповідь одразу кладеться в кеш списку.
 */
export function useChangeStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, delta }: { id: number; delta: number }) => api<Product>(`/farmer/products/${id}/stock`, { method: 'POST', body: { delta } }),
    onSuccess: (product) => {
      queryClient.setQueryData<Product[]>(PRODUCTS, (list) => list?.map((item) => (item.id === product.id ? product : item)));
      void queryClient.invalidateQueries({ queryKey: ['catalog'] });
    },
  });
}

/** Історія ферми й дні доставки. */
export function useUpdateFarmProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: FarmProfileChanges) => api<FarmerProfile>('/farmer/profile', { method: 'PATCH', body: changes }),
    onSuccess: (profile) => {
      queryClient.setQueryData(['farmer', 'profile'], profile);
      void queryClient.invalidateQueries({ queryKey: ['farms'] });
    },
  });
}

const DOCUMENTS = ['farmer', 'documents'] as const;

/** Типи й розмір документів для верифікації, які приймає сервер. */
export const DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
export const DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;

export function useFarmDocuments(enabled = true) {
  return useQuery({ queryKey: DOCUMENTS, queryFn: () => api<FarmDocument[]>('/farmer/documents'), enabled });
}

/** Завантаження чи видалення скану документа; лічильник документів у профілі оновлюється. */
export function useFarmDocumentChange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (change: { file: File } | { removeId: number }) =>
      'file' in change
        ? api<FarmDocument | undefined>(`/farmer/documents?name=${encodeURIComponent(change.file.name)}`, { method: 'POST', body: change.file })
        : api<FarmDocument | undefined>(`/farmer/documents/${change.removeId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: DOCUMENTS });
      void queryClient.invalidateQueries({ queryKey: ['farmer', 'profile'] });
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
