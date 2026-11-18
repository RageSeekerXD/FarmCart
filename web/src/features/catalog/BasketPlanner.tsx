import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, TextField, Typography } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import type { PlannedBasket, PlannedLine } from '../../api/types';
import { errorMessage, formatMoney, useLang } from '../../i18n';
import { useToast } from '../../shared/Toast';
import { useAiAvailable } from '../ai/useAi';
import { useAuth } from '../auth/AuthContext';
import { useAddToCart } from '../cart/useCart';

const MAX_LENGTH = 200;

/** Кнопка «Кошик за рецептом»: кожен запит платний, тому лише після входу й коли ШІ ввімкнено. */
export function BasketPlanner() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const available = useAiAvailable();
  const [open, setOpen] = useState(false);
  if (user === null || !available) {
    return null;
  }

  return (
    <>
      <Button variant="outlined" startIcon={<RestaurantMenuIcon />} onClick={() => setOpen(true)}>
        {t('ai.basketOpen')}
      </Button>
      {open && <BasketDialog onClose={() => setOpen(false)} />}
    </>
  );
}

/** ШІ лише пропонує: покупець сам обирає товари й кількість, і тільки тоді вони потрапляють до кошика. */
function BasketDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { lang, pick } = useLang();
  const toast = useToast();
  const navigate = useNavigate();
  const addToCart = useAddToCart();
  const [request, setRequest] = useState('');
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<unknown>(null);

  const plan = useMutation({
    mutationFn: (text: string) => api<PlannedBasket>('/catalog/basket-plan', { method: 'POST', body: { request: text, lang } }),
    onSuccess: (basket) => setQuantities(Object.fromEntries(basket.lines.map((line) => [line.item.productId, line.quantity]))),
  });

  const lines = plan.data?.lines ?? [];
  const chosen = lines.filter((line) => quantities[line.item.productId] !== undefined);
  const total = chosen.reduce((sum, line) => sum + line.item.price * quantities[line.item.productId]!, 0);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (request.trim() !== '') {
      plan.mutate(request.trim());
    }
  };

  const toggle = (line: PlannedLine) =>
    setQuantities((current) => {
      const { [line.item.productId]: selected, ...rest } = current;
      return selected === undefined ? { ...current, [line.item.productId]: line.quantity } : rest;
    });

  const change = (line: PlannedLine, by: number) =>
    setQuantities((current) => ({
      ...current,
      [line.item.productId]: Math.min(line.item.stock, Math.max(1, (current[line.item.productId] ?? 1) + by)),
    }));

  const addAll = async () => {
    setAdding(true);
    setAddError(null);
    try {
      // По одному: кожна відповідь сервера містить кошик з усіма попередніми товарами.
      for (const line of chosen) {
        await addToCart.mutateAsync({ productId: line.item.productId, quantity: quantities[line.item.productId]! });
      }

      toast.show(t('ai.basketAdded', { count: chosen.length }), 'success', {
        action: { label: t('catalog.goToCart'), onClick: () => void navigate('/cart') },
      });
      onClose();
    } catch (error) {
      setAddError(error);
    } finally {
      setAdding(false);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="basket-plan-title">
      <DialogTitle id="basket-plan-title">{t('ai.basketTitle')}</DialogTitle>
      <DialogContent>
        <Box component="form" onSubmit={submit} sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: '1fr auto' }, alignItems: 'start', pt: 1 }}>
          <TextField
            autoFocus
            size="small"
            label={t('ai.basketLabel')}
            placeholder={t('ai.basketPlaceholder')}
            value={request}
            onChange={(event) => setRequest(event.target.value)}
            slotProps={{ htmlInput: { maxLength: MAX_LENGTH }, inputLabel: { shrink: true } }}
          />
          <Button type="submit" variant="contained" disabled={request.trim() === ''} loading={plan.isPending}>
            {t('ai.basketSubmit')}
          </Button>
        </Box>

        <Box aria-live="polite" sx={{ mt: 2 }}>
          {plan.isError && <Alert severity="error">{errorMessage(plan.error)}</Alert>}
          {plan.isSuccess && lines.length === 0 && <Alert severity="info">{t('ai.basketEmpty')}</Alert>}
          {lines.length > 0 && (
            <Stack component="ul" spacing={1} aria-label={t('ai.basketProducts')} sx={{ listStyle: 'none', p: 0, m: 0 }}>
              {lines.map((line) => {
                const name = pick(line.item.name);
                const quantity = quantities[line.item.productId];
                return (
                  <Box component="li" key={line.item.productId} sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                    <Checkbox checked={quantity !== undefined} onChange={() => toggle(line)} slotProps={{ input: { 'aria-label': t('ai.basketChoose', { name }) } }} />
                    <Box sx={{ flex: '1 1 150px', minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600 }}>{name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {formatMoney(line.item.price, lang)} {t('catalog.perUnit', { unit: pick(line.item.unit) })} · {pick(line.item.farmerName)}
                      </Typography>
                    </Box>
                    {quantity !== undefined && (
                      <Box role="group" aria-label={`${t('cart.quantity')}: ${quantity}`} sx={{ display: 'inline-flex', alignItems: 'center', border: 1, borderColor: 'divider', borderRadius: 5 }}>
                        <IconButton size="small" aria-label={t('cart.decrease', { name })} disabled={quantity <= 1} onClick={() => change(line, -1)}>
                          <RemoveIcon fontSize="small" />
                        </IconButton>
                        <Typography aria-hidden sx={{ minWidth: 28, textAlign: 'center', fontWeight: 600 }}>
                          {quantity}
                        </Typography>
                        <IconButton size="small" aria-label={t('cart.increase', { name })} disabled={quantity >= line.item.stock} onClick={() => change(line, 1)}>
                          <AddIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Stack>
          )}
          {plan.data && plan.data.missing.length > 0 && (
            <Alert severity="info" sx={{ mt: 1.5 }}>
              {t('ai.basketMissing', { items: plan.data.missing.join(', ') })}
            </Alert>
          )}
          {lines.length > 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              {t('ai.basketReview')}
            </Typography>
          )}
          {addError !== null && (
            <Alert severity="error" sx={{ mt: 1.5 }}>
              {errorMessage(addError)}
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', rowGap: 1 }}>
        {chosen.length > 0 && (
          <Typography sx={{ mr: 'auto', fontWeight: 700 }} data-testid="basket-total">
            {formatMoney(total, lang)}
          </Typography>
        )}
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" disabled={chosen.length === 0} loading={adding} onClick={() => void addAll()}>
          {t('ai.basketAdd', { count: chosen.length })}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
