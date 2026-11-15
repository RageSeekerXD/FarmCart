import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import type { CatalogItem } from '../../api/types';
import { errorMessage, useLang } from '../../i18n';
import { useToast } from '../../shared/Toast';
import { useAuth } from '../auth/AuthContext';
import { useAddToCart, useCart, useChangeQuantity } from './useCart';

/**
 * Дії з кошиком на вітрині (каталог, сторінка ферми): «У кошик» і зміна кількості прямо на картці.
 * Гостя веде на вхід і повертає на ту саму сторінку. Кожен товар має власний стан «зберігається»,
 * тож поки змінюється кількість одного товару, інші картки лишаються доступними.
 */
export function useCartActions() {
  const { t } = useTranslation();
  const { pick } = useLang();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const cart = useCart();
  const addToCart = useAddToCart();
  const change = useChangeQuantity();
  const [busy, setBusy] = useState<ReadonlySet<number>>(() => new Set());

  const quantities = useMemo(() => new Map((cart.data?.lines ?? []).map((line) => [line.productId, line.quantity])), [cart.data]);

  const track = (productId: number, on: boolean) =>
    setBusy((current) => {
      const next = new Set(current);
      if (on) {
        next.add(productId);
      } else {
        next.delete(productId);
      }

      return next;
    });

  const signedIn = () => {
    if (user) {
      return true;
    }

    toast.show(t('catalog.loginToBuy'), 'info');
    void navigate('/login', { state: { from: `${location.pathname}${location.search}` } });
    return false;
  };

  /** Додає quantity одиниць; done - після успіху (наприклад, закрити картку товару). */
  const add = (item: CatalogItem, quantity = 1, done?: () => void) => {
    if (!signedIn()) {
      return;
    }

    track(item.productId, true);
    // mutateAsync, а не mutate з колбеками: колбеки mutate спрацьовують лише для останнього виклику,
    // а покупець може додавати кілька товарів поспіль.
    addToCart
      .mutateAsync({ productId: item.productId, quantity })
      .then(() => {
        done?.();
        toast.show(t('catalog.added', { name: pick(item.name) }), 'success', {
          action: { label: t('catalog.goToCart'), onClick: () => void navigate('/cart') },
        });
      })
      .catch((error: unknown) => toast.show(errorMessage(error), 'error'))
      .finally(() => track(item.productId, false));
  };

  /** Нова кількість товару в кошику; 0 - прибрати товар. */
  const setQuantity = (item: CatalogItem, to: number) => {
    const from = quantities.get(item.productId) ?? 0;
    if (to === from || to < 0 || !signedIn()) {
      return;
    }

    track(item.productId, true);
    change
      .mutateAsync({ productId: item.productId, from, to })
      .catch((error: unknown) => toast.show(errorMessage(error), 'error'))
      .finally(() => track(item.productId, false));
  };

  return {
    quantityOf: (productId: number) => quantities.get(productId) ?? 0,
    isBusy: (productId: number) => busy.has(productId),
    add,
    setQuantity,
  };
}

export type CartActions = ReturnType<typeof useCartActions>;
