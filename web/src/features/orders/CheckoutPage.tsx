import AppleIcon from '@mui/icons-material/Apple';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import GoogleIcon from '@mui/icons-material/Google';
import PaymentsIcon from '@mui/icons-material/Payments';
import ShoppingBasketOutlinedIcon from '@mui/icons-material/ShoppingBasketOutlined';
import {
  alpha,
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
  type Theme,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import type { CheckoutRequest, Order, PaymentMethod, Slot } from '../../api/types';
import { errorMessage, formatMoney, useLang } from '../../i18n';
import { formatSlot } from '../../shared/dates';
import { EASE_SPRING, enter, popIn } from '../../shared/motion';
import { EmptyState } from '../../shared/pages';
import { useToast } from '../../shared/Toast';
import { useCart } from '../cart/useCart';

const METHODS: readonly PaymentMethod[] = ['Card', 'ApplePay', 'GooglePay', 'Cash'];
const METHOD_ICON: Record<PaymentMethod, ReactNode> = {
  Card: <CreditCardIcon />,
  ApplePay: <AppleIcon />,
  GooglePay: <GoogleIcon />,
  Cash: <PaymentsIcon />,
};

/**
 * Токени пісочниці платіжного провайдера. У продукті картку токенізує SDK провайдера на пристрої покупця;
 * FarmCart номера картки не бачить і поля для нього не має (PCI DSS, US-06).
 */
const SANDBOX_CARDS = ['tok_visa', 'tok_mastercard', 'tok_declined'] as const;
const WALLET_TOKEN: Partial<Record<PaymentMethod, string>> = { ApplePay: 'tok_applepay', GooglePay: 'tok_googlepay' };

function newKey(): string {
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Варіант вибору у вигляді плитки з рамкою: уся плитка натискається, обрана підсвічується кольором бренду. */
const tile = (selected: boolean, disabled = false) => ({
  m: 0,
  px: 1.5,
  py: 1,
  border: 1,
  borderRadius: '12px',
  borderColor: selected ? 'primary.main' : 'divider',
  bgcolor: (theme: Theme) => (selected ? alpha(theme.palette.primary.main, 0.06) : theme.palette.background.paper),
  boxShadow: (theme: Theme) => (selected ? `0 0 0 1px ${theme.palette.primary.main}` : 'none'),
  opacity: disabled ? 0.55 : 1,
  transition: 'border-color 160ms ease, background-color 160ms ease, box-shadow 160ms ease, transform 120ms ease',
  '&:hover': disabled || selected ? {} : { borderColor: 'text.secondary' },
  '& .MuiFormControlLabel-label': { flex: 1, minWidth: 0 },
  '& .Mui-checked svg:last-of-type': { animation: `${popIn} 300ms ${EASE_SPRING}` },
  '&:active': disabled ? {} : { transform: 'scale(0.98)' },
});

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
      void navigate(`/orders/${order.id}`, { replace: true, state: { placed: true } });
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
      <Box sx={{ maxWidth: 560, mx: 'auto' }}>
        <EmptyState
          icon={<ShoppingBasketOutlinedIcon />}
          title={t('cart.empty')}
          action={
            <Button component={RouterLink} to="/" variant="contained">
              {t('cart.goToCatalog')}
            </Button>
          }
        />
      </Box>
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

  const section = { p: { xs: 2, sm: 2.5 } };

  return (
    <Box component="form" onSubmit={submit} noValidate sx={{ maxWidth: 1040, mx: 'auto' }}>
      <Typography component="h1" variant="h4" sx={{ mb: 2, fontSize: { xs: '1.6rem', sm: '2.1rem' } }}>
        {t('checkout.title')}
      </Typography>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 340px' }, alignItems: 'start' }}>
        <Stack spacing={2} sx={{ minWidth: 0 }}>
          <Paper component="section" elevation={1} aria-labelledby="checkout-delivery" sx={{ ...section, ...enter(0, 90) }}>
            <Typography id="checkout-delivery" component="h2" variant="h6" sx={{ mb: 2 }}>
              <StepNumber n={1} />
              {t('checkout.delivery')}
            </Typography>
            <Stack spacing={2.5}>
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
                <FormLabel id="checkout-slot" sx={{ mb: 1 }}>
                  {t('checkout.slot')}
                </FormLabel>
                {slots.data.length === 0 ? (
                  <Alert severity="warning">{t('checkout.noSlots')}</Alert>
                ) : (
                  <RadioGroup
                    aria-labelledby="checkout-slot"
                    value={slotId ?? ''}
                    onChange={(event) => setSlotId(Number(event.target.value))}
                    sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 210px), 1fr))' }}
                  >
                    {slots.data.map((slot) => {
                      const full = slot.remaining <= 0;
                      return (
                        <FormControlLabel
                          key={slot.id}
                          value={slot.id}
                          control={<Radio size="small" />}
                          disabled={full}
                          sx={{ ...tile(slotId === slot.id, full), alignItems: 'flex-start', '& .MuiRadio-root': { mt: -0.5 } }}
                          label={
                            <>
                              <Typography component="span" sx={{ display: 'block', fontWeight: 600, lineHeight: 1.3 }}>
                                {formatSlot(slot.start, slot.end, lang)}
                              </Typography>
                              <Typography component="span" variant="body2" sx={{ display: 'block', color: full ? 'text.disabled' : slot.remaining === 1 ? 'warning.dark' : 'text.secondary' }}>
                                {full ? t('checkout.slotFull') : t('checkout.slotLeft', { count: slot.remaining })}
                              </Typography>
                            </>
                          }
                        />
                      );
                    })}
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

          <Paper component="section" elevation={1} aria-labelledby="checkout-payment" sx={{ ...section, ...enter(1, 90) }}>
            <Typography id="checkout-payment" component="h2" variant="h6" sx={{ mb: 2 }}>
              <StepNumber n={2} />
              {t('checkout.payment')}
            </Typography>
            <Stack spacing={2.5}>
              <FormControl>
                <FormLabel id="checkout-method" sx={{ mb: 1 }}>
                  {t('checkout.method')}
                </FormLabel>
                <RadioGroup
                  aria-labelledby="checkout-method"
                  value={method}
                  onChange={(event) => setMethod(event.target.value as PaymentMethod)}
                  sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' } }}
                >
                  {METHODS.map((item) => (
                    <FormControlLabel
                      key={item}
                      value={item}
                      // Радіокнопка - невидимий шар на всю плитку: натискається будь-де, лишається у фокусі клавіатури й у дереві доступності.
                      control={<Radio size="small" sx={{ position: 'absolute', inset: 0, m: 0, width: 1, height: 1, opacity: 0, borderRadius: 'inherit' }} />}
                      sx={{
                        ...tile(method === item),
                        position: 'relative',
                        py: 1.5,
                        justifyContent: 'center',
                        textAlign: 'center',
                        '&:has(.Mui-focusVisible)': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
                      }}
                      label={
                        <Box component="span" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, color: method === item ? 'primary.dark' : 'text.primary' }}>
                          {METHOD_ICON[item]}
                          <Typography component="span" variant="body2" sx={{ fontWeight: 600 }}>
                            {t(`paymentMethod.${item}`)}
                          </Typography>
                        </Box>
                      }
                    />
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
            </Stack>
          </Paper>
        </Stack>

        <Paper component="aside" elevation={1} aria-labelledby="checkout-order" sx={{ ...section, position: { md: 'sticky' }, top: { md: 128 }, ...enter(2, 90) }}>
          <Typography id="checkout-order" component="h2" variant="h6" sx={{ mb: 1.5 }}>
            {t('checkout.yourOrder')}
          </Typography>
          <Stack component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }} spacing={1}>
            {cart.data.lines.map((line) => (
              <Box component="li" key={line.productId} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                <Typography variant="body2">
                  {pick(line.name)} × {line.quantity}
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                  {formatMoney(line.total, lang)}
                </Typography>
              </Box>
            ))}
          </Stack>
          <TextField
            label={t('checkout.promo')}
            size="small"
            fullWidth
            value={promoCode}
            onChange={(event) => setPromoCode(event.target.value.toUpperCase())}
            helperText={t('checkout.promoHint')}
            slotProps={{ htmlInput: { maxLength: 16, autoCapitalize: 'characters' } }}
            sx={{ mt: 2 }}
          />
          <Divider sx={{ my: 1.5 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 2 }}>
            <Typography sx={{ fontWeight: 600 }}>{t('cart.total')}</Typography>
            <Typography variant="h6" component="p">
              {formatMoney(cart.data.total, lang)}
            </Typography>
          </Box>

          {place.isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorMessage(place.error)}
            </Alert>
          )}

          <Button type="submit" variant="contained" size="large" fullWidth loading={place.isPending}>
            {t('checkout.submit', { total: formatMoney(cart.data.total, lang) })}
          </Button>
          <Button component={RouterLink} to="/cart" startIcon={<ArrowBackIcon />} fullWidth sx={{ mt: 1 }}>
            {t('checkout.backToCart')}
          </Button>
        </Paper>
      </Box>
    </Box>
  );
}

/** Номер кроку оформлення перед заголовком секції - показує, що форма коротка й послідовна. */
function StepNumber({ n }: { n: number }) {
  return (
    <Box
      component="span"
      aria-hidden
      sx={{
        display: 'inline-grid',
        placeItems: 'center',
        width: 26,
        height: 26,
        mr: 1,
        borderRadius: '50%',
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
        fontSize: '0.85rem',
        fontWeight: 700,
        verticalAlign: 'text-bottom',
      }}
    >
      {n}
    </Box>
  );
}
