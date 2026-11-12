import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import type { CheckoutRequest, Order, PaymentMethod, Slot } from '../../api/types';
import { errorMessage, formatMoney, useLang } from '../../i18n';
import { formatSlot } from '../../shared/dates';
import { useToast } from '../../shared/Toast';
import { useCart } from '../cart/useCart';

const METHODS: readonly PaymentMethod[] = ['Card', 'ApplePay', 'GooglePay', 'Cash'];

/**
 * Токени пісочниці платіжного провайдера. У продукті картку токенізує SDK провайдера на пристрої покупця;
 * FarmCart номера картки не бачить і поля для нього не має (PCI DSS, US-06).
 */
const SANDBOX_CARDS = ['tok_visa', 'tok_mastercard', 'tok_declined'] as const;
const WALLET_TOKEN: Partial<Record<PaymentMethod, string>> = { ApplePay: 'tok_applepay', GooglePay: 'tok_googlepay' };

function newKey(): string {
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** UI-05: оформлення - адреса, слот, промокод, спосіб оплати. Запит іде з Idempotency-Key: повтор не створить дубль. */
export function CheckoutPage() {
  const { t } = useTranslation();
  const { lang, pick } = useLang();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cart = useCart();
  const slots = useQuery({ queryKey: ['slots'], queryFn: () => api<Slot[]>('/slots'), staleTime: 0 });

  const [address, setAddress] = useState('');
  const [slotId, setSlotId] = useState<number | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [comment, setComment] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('Card');
  const [card, setCard] = useState<string>(SANDBOX_CARDS[0]);
  const [touched, setTouched] = useState(false);
  // Один ключ на одну спробу оформлення цього кошика: повторне натискання чи повтор після обриву мережі не створить друге замовлення.
  const [idempotencyKey] = useState(newKey);

  const place = useMutation({
    mutationFn: (request: CheckoutRequest) =>
      api<Order>('/orders', { method: 'POST', body: request, headers: { 'Idempotency-Key': idempotencyKey } }),
    onSuccess: (order) => {
      queryClient.setQueryData(['cart'], { farmerId: null, lines: [], total: 0 });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['catalog'] });
      queryClient.setQueryData(['order', order.id], order);
      toast.show(t('checkout.placed', { id: order.id }));
      void navigate(`/orders/${order.id}`, { replace: true });
    },
    onError: () => void slots.refetch(),
  });

  if (cart.isPending || slots.isPending) {
    return <CircularProgress aria-label={t('common.loading')} />;
  }

  if (cart.isError || slots.isError) {
    return <Alert severity="error">{errorMessage(cart.error ?? slots.error)}</Alert>;
  }

  if (cart.data.lines.length === 0 && !place.isSuccess) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center', maxWidth: 560, mx: 'auto' }}>
        <Typography sx={{ mb: 2 }}>{t('cart.empty')}</Typography>
        <Button component={RouterLink} to="/" variant="contained">
          {t('cart.goToCatalog')}
        </Button>
      </Paper>
    );
  }

  const addressMissing = address.trim() === '';
  const slotMissing = slotId === null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (addressMissing || slotMissing) {
      return;
    }

    place.mutate({
      address: address.trim(),
      slotId,
      paymentMethod: method,
      paymentToken: method === 'Card' ? card : (WALLET_TOKEN[method] ?? null),
      promoCode: promoCode.trim() || null,
      comment: comment.trim() || null,
    });
  };

  return (
    <Box component="form" onSubmit={submit} noValidate sx={{ maxWidth: 760, mx: 'auto' }}>
      <Typography component="h1" variant="h4" sx={{ mb: 2, fontSize: { xs: '1.6rem', sm: '2.1rem' } }}>
        {t('checkout.title')}
      </Typography>

      <Stack spacing={2}>
        <Paper component="section" aria-labelledby="checkout-order" sx={{ p: { xs: 1.5, sm: 2.5 } }}>
          <Typography id="checkout-order" component="h2" variant="h6" sx={{ mb: 1 }}>
            {t('checkout.yourOrder')}
          </Typography>
          <Stack component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }} spacing={0.5}>
            {cart.data.lines.map((line) => (
              <Box component="li" key={line.productId} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                <Typography>
                  {pick(line.name)} × {line.quantity}
                </Typography>
                <Typography>{formatMoney(line.total, lang)}</Typography>
              </Box>
            ))}
          </Stack>
          <Divider sx={{ my: 1 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography sx={{ fontWeight: 600 }}>{t('cart.total')}</Typography>
            <Typography sx={{ fontWeight: 600 }}>{formatMoney(cart.data.total, lang)}</Typography>
          </Box>
        </Paper>

        <Paper component="section" aria-labelledby="checkout-delivery" sx={{ p: { xs: 1.5, sm: 2.5 } }}>
          <Typography id="checkout-delivery" component="h2" variant="h6" sx={{ mb: 1.5 }}>
            {t('checkout.delivery')}
          </Typography>
          <Stack spacing={2}>
            <TextField
              label={t('checkout.address')}
              autoComplete="street-address"
              required
              fullWidth
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              error={touched && addressMissing}
              helperText={touched && addressMissing ? t('errors.address_required') : t('checkout.addressHint')}
            />
            <FormControl required error={touched && slotMissing}>
              <FormLabel id="checkout-slot">{t('checkout.slot')}</FormLabel>
              {slots.data.length === 0 ? (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  {t('checkout.noSlots')}
                </Alert>
              ) : (
                <RadioGroup aria-labelledby="checkout-slot" value={slotId ?? ''} onChange={(event) => setSlotId(Number(event.target.value))}>
                  {slots.data.map((slot) => (
                    <FormControlLabel
                      key={slot.id}
                      value={slot.id}
                      control={<Radio />}
                      disabled={slot.remaining <= 0}
                      label={`${formatSlot(slot.start, slot.end, lang)} · ${slot.remaining > 0 ? t('checkout.slotLeft', { count: slot.remaining }) : t('checkout.slotFull')}`}
                    />
                  ))}
                </RadioGroup>
              )}
              {touched && slotMissing && <FormHelperText>{t('checkout.slotRequired')}</FormHelperText>}
            </FormControl>
            <TextField
              label={t('checkout.comment')}
              fullWidth
              multiline
              minRows={2}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 300 } }}
            />
          </Stack>
        </Paper>

        <Paper component="section" aria-labelledby="checkout-payment" sx={{ p: { xs: 1.5, sm: 2.5 } }}>
          <Typography id="checkout-payment" component="h2" variant="h6" sx={{ mb: 1.5 }}>
            {t('checkout.payment')}
          </Typography>
          <Stack spacing={2}>
            <FormControl>
              <FormLabel id="checkout-method">{t('checkout.method')}</FormLabel>
              <RadioGroup aria-labelledby="checkout-method" value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}>
                {METHODS.map((item) => (
                  <FormControlLabel key={item} value={item} control={<Radio />} label={t(`paymentMethod.${item}`)} />
                ))}
              </RadioGroup>
            </FormControl>
            {method === 'Card' && (
              <TextField
                select
                label={t('checkout.sandboxCard')}
                value={card}
                onChange={(event) => setCard(event.target.value)}
                helperText={t('checkout.sandboxHint')}
              >
                {SANDBOX_CARDS.map((token) => (
                  <MenuItem key={token} value={token}>
                    {t(`checkout.token.${token}`)}
                  </MenuItem>
                ))}
              </TextField>
            )}
            <TextField
              label={t('checkout.promo')}
              value={promoCode}
              onChange={(event) => setPromoCode(event.target.value.toUpperCase())}
              helperText={t('checkout.promoHint')}
              slotProps={{ htmlInput: { maxLength: 16, autoCapitalize: 'characters' } }}
              sx={{ maxWidth: 320 }}
            />
          </Stack>
        </Paper>

        {place.isError && <Alert severity="error">{errorMessage(place.error)}</Alert>}

        <Button type="submit" variant="contained" size="large" loading={place.isPending}>
          {t('checkout.submit', { total: formatMoney(cart.data.total, lang) })}
        </Button>
        <Button component={RouterLink} to="/cart">
          {t('checkout.backToCart')}
        </Button>
      </Stack>
    </Box>
  );
}
