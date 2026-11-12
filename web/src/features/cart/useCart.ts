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

export function cartCount(cart: Cart | undefined): number {
  return cart?.lines.reduce((sum, line) => sum + line.quantity, 0) ?? 0;
}
