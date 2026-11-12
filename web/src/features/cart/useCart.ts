import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { Cart } from '../../api/types';
import { useAuth } from '../auth/AuthContext';

const CART_KEY = ['cart'] as const;

/** Кошик покупця (UI-04). Сервер повертає оновлений кошик після кожної зміни - ним і заміщується кеш. */
export function useCart() {
  const { user, role } = useAuth();
  return useQuery({
    queryKey: CART_KEY,
    queryFn: () => api<Cart>('/cart'),
    enabled: user !== null && role === 'Buyer',
  });
}

export function useAddToCart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (item: { productId: number; quantity: number }) => api<Cart>('/cart/items', { method: 'POST', body: item }),
    onSuccess: (cart) => queryClient.setQueryData(CART_KEY, cart),
  });
}

export function useRemoveFromCart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productId: number) => api<Cart>(`/cart/items/${productId}`, { method: 'DELETE' }),
    onSuccess: (cart) => queryClient.setQueryData(CART_KEY, cart),
  });
}

/**
 * Зміна кількості в кошику. API вміє лише додавати одиниці й прибирати позицію цілком, тож зменшення -
 * це «прибрати позицію й додати її знову з меншою кількістю»; до 0 - просто прибрати.
 */
export function useChangeQuantity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, from, to }: { productId: number; from: number; to: number }) => {
      if (to > from) {
        return api<Cart>('/cart/items', { method: 'POST', body: { productId, quantity: to - from } });
      }

      const removed = await api<Cart>(`/cart/items/${productId}`, { method: 'DELETE' });
      return to > 0 ? api<Cart>('/cart/items', { method: 'POST', body: { productId, quantity: to } }) : removed;
    },
    onSuccess: (cart) => queryClient.setQueryData(CART_KEY, cart),
    // Якщо другий крок зменшення не вдався, кошик на сервері вже інший - перечитуємо його.
    onError: () => void queryClient.invalidateQueries({ queryKey: CART_KEY }),
  });
}

export function cartCount(cart: Cart | undefined): number {
  return cart?.lines.reduce((sum, line) => sum + line.quantity, 0) ?? 0;
}
