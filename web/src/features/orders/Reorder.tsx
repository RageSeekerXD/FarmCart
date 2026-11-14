import ReplayIcon from '@mui/icons-material/Replay';
import { Button } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import type { Cart, LocalizedText } from '../../api/types';
import { errorMessage, useLang } from '../../i18n';
import { useToast } from '../../shared/Toast';

interface ReorderResult {
  cart: Cart;
  shortfalls: { name: LocalizedText; requested: number; added: number }[];
}

/**
 * «Замовити знову» (п. 4 покращень): позиції минулого замовлення лягають у кошик у межах наявного залишку.
 * Якщо чогось бракує, тост каже, чого саме і скільки вдалося додати.
 */
export function ReorderButton({ orderId, compact = false }: { orderId: number; compact?: boolean }) {
  const { t } = useTranslation();
  const { pick } = useLang();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const reorder = useMutation({
    mutationFn: () => api<ReorderResult>(`/orders/${orderId}/reorder`, { method: 'POST', body: {} }),
    onSuccess: ({ cart, shortfalls }) => {
      queryClient.setQueryData(['cart'], cart);
      const toCart = { label: t('catalog.goToCart'), onClick: () => void navigate('/cart') };
      if (shortfalls.length === 0) {
        toast.show(t('orders.reordered'), 'success', { action: toCart });
        return;
      }

      const missing = shortfalls
        .map((item) => (item.added === 0 ? t('orders.reorderNone', { name: pick(item.name) }) : t('orders.reorderPart', { name: pick(item.name), added: item.added, requested: item.requested })))
        .join('; ');
      toast.show(missing, 'warning', { title: t('orders.reorderShort'), action: cart.lines.length > 0 ? toCart : undefined });
    },
    onError: (error) => toast.show(errorMessage(error), 'error'),
  });

  return (
    <Button
      size="small"
      variant={compact ? 'text' : 'outlined'}
      startIcon={<ReplayIcon />}
      loading={reorder.isPending}
      onClick={() => reorder.mutate()}
      aria-label={t('orders.reorderNamed', { id: orderId })}
    >
      {t('orders.reorder')}
    </Button>
  );
}
