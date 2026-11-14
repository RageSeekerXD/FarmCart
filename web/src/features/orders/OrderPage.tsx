import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Alert, Box, Button, CircularProgress, Divider, Paper, Stack, Step, StepLabel, Stepper, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useLocation, useParams } from 'react-router-dom';
import { errorMessage, formatMoney, useLang } from '../../i18n';
import { formatDateTime, formatSlot } from '../../shared/dates';
import { EASE_SPRING, enter, glow, popIn, shine } from '../../shared/motion';
import { useFarms } from '../map/MapPage';
import { StatusChip } from './OrdersPage';
import { CancelOrderButton } from './CancelOrder';
import { PlacedBanner } from './PlacedBanner';
import { ReorderButton } from './Reorder';
import { RescheduleDelivery } from './Reschedule';
import { ReviewSection } from './ReviewSection';
import { isFinal, isStopped, timeline, useOrder } from './orders';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
      <Typography color="text.secondary">{label}</Typography>
      <Typography sx={{ textAlign: 'right' }}>{children}</Typography>
    </Box>
  );
}

/** UI-06: трекер замовлення - таймлайн статусів, код вручення для покупця, позиції мовою інтерфейсу. */
export function OrderPage() {
  const { t } = useTranslation();
  const { lang, pick } = useLang();
  const id = Number(useParams().id);
  const order = useOrder(id);
  const farms = useFarms(null);
  // Сюди щойно перейшли з оформлення: показуємо святкове підтвердження.
  const justPlaced = (useLocation().state as { placed?: boolean } | null)?.placed === true;

  const back = (
    <Button component={RouterLink} to="/orders" startIcon={<ArrowBackIcon />} sx={{ mb: 1 }}>
      {t('orders.title')}
    </Button>
  );

  if (order.isError || !order.isEnabled) {
    return (
      <Box sx={{ maxWidth: 760, mx: 'auto' }}>
        {back}
        <Alert severity="error">{order.isError ? errorMessage(order.error) : t('errors.order_not_found')}</Alert>
      </Box>
    );
  }

  if (order.isPending) {
    return <CircularProgress aria-label={t('common.loading')} />;
  }

  const data = order.data;
  const steps = timeline(data);
  const farm = farms.data?.find((item) => item.id === data.farmerId);

  return (
    <Box sx={{ maxWidth: 760, mx: 'auto' }}>
      {back}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Typography component="h1" variant="h4" sx={{ fontSize: { xs: '1.6rem', sm: '2.1rem' } }}>
          {t('orders.number', { id: data.id })}
        </Typography>
        {/* key={data.status}: статус змінився (подія чи опитування) - позначка м'яко «вистрибує» заново. */}
        <Box key={data.status} role="status" aria-label={t('orders.status')} sx={{ animation: `${popIn} 420ms ${EASE_SPRING} backwards` }}>
          <StatusChip status={data.status} />
        </Box>
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
          <CancelOrderButton order={data} />
          {isFinal(data.status) && <ReorderButton orderId={data.id} />}
        </Box>
      </Box>

      <Stack spacing={2}>
        {justPlaced && !isFinal(data.status) && <PlacedBanner />}

        {data.status === 'Cancelled' && (
          <Alert severity="info">
            {t('orders.cancelledNote')}
            {data.refundedAmount > 0 ? ` ${t('orders.refunded')}: ${formatMoney(data.refundedAmount, lang)}.` : ''}
          </Alert>
        )}

        {data.status === 'DeliveryFailed' && <RescheduleDelivery order={data} />}

        {data.status === 'Rejected' && (
          <Alert severity="error">
            {t('orders.rejected')}
            {data.rejectionReason ? ` ${t('orders.reason')}: ` : ''}
            {/* Причину пише фермер - це користувацький текст, він не перекладається. */}
            {data.rejectionReason && <span>{data.rejectionReason}</span>}
          </Alert>
        )}

        {data.deliveryCode && !isFinal(data.status) && (
          <Paper
            elevation={1}
            sx={{
              p: { xs: 2, sm: 2.5 },
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
              background: 'linear-gradient(135deg, #ffe082 0%, #ffca28 55%, #ffb300 100%)',
              // Картка коду завжди бурштинова - текст на ній темний і в темній темі.
              color: '#1d2a1e',
              ...enter(0),
              // Відблиск, що час від часу пробігає карткою коду: код помітний, але не кричить.
              '&::after': {
                content: '""',
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                width: '30%',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)',
                animation: `${shine} 4.5s ease-in-out 600ms infinite`,
                pointerEvents: 'none',
              },
            }}
          >
            <Typography sx={{ fontWeight: 600 }}>{t('orders.codeTitle')}</Typography>
            <Typography
              component="p"
              variant="h3"
              data-testid="delivery-code"
              sx={{ letterSpacing: 10, fontWeight: 800, animation: `${popIn} 520ms ${EASE_SPRING} 150ms backwards` }}
            >
              {data.deliveryCode}
            </Typography>
            <Typography variant="body2">{t('orders.codeHint')}</Typography>
          </Paper>
        )}

        {data.status === 'Delivered' && <ReviewSection orderId={data.id} />}

        <Paper component="section" elevation={1} aria-labelledby="order-timeline" sx={{ p: { xs: 1.5, sm: 2.5 }, ...enter(1) }}>
          <Typography id="order-timeline" component="h2" variant="h6" sx={{ mb: 1 }}>
            {t('orders.timeline')}
          </Typography>
          <Stepper
            orientation="vertical"
            activeStep={steps.findIndex((step) => step.state === 'current')}
            sx={(theme) => ({
              // Пройдена частина шляху - лінією кольору ролі; поточний крок м'яко світиться, поки замовлення в роботі.
              '& .MuiStepConnector-line': { borderLeftWidth: 2, transition: 'border-color 400ms ease' },
              '& .MuiStepConnector-root.Mui-completed .MuiStepConnector-line, & .MuiStepConnector-root.Mui-active .MuiStepConnector-line': {
                borderColor: theme.palette.primary.main,
              },
              '& .MuiStepIcon-root.Mui-active': isFinal(data.status) ? {} : { animation: `${glow} 2.2s ease-in-out infinite` },
              '& .MuiStepIcon-root.Mui-completed': { color: theme.palette.primary.main },
              '& .MuiStepLabel-label.Mui-active': { fontWeight: 700 },
            })}
          >
            {steps.map((step, index) => (
              <Step
                key={step.status}
                completed={step.state === 'done' || (step.state === 'current' && data.status === 'Delivered')}
                sx={enter(index + 2, 70)}
              >
                <StepLabel
                  error={isStopped(step.status)}
                  optional={step.at ? <Typography variant="caption">{formatDateTime(step.at, lang)}</Typography> : undefined}
                  aria-current={step.state === 'current' ? 'step' : undefined}
                >
                  {t(`status.${step.status}`)}
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        </Paper>

        <Paper component="section" elevation={1} aria-labelledby="order-lines" sx={{ p: { xs: 1.5, sm: 2.5 }, ...enter(2) }}>
          <Typography id="order-lines" component="h2" variant="h6" sx={{ mb: 1 }}>
            {t('orders.contents')}
          </Typography>
          {farm && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {pick(farm.name)}
            </Typography>
          )}
          <Stack component="ul" spacing={0.5} sx={{ listStyle: 'none', p: 0, m: 0 }}>
            {data.lines.map((line) => (
              <Box component="li" key={line.productId} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                <Typography>
                  {pick(line.name)} × {line.quantity}{' '}
                  <Typography component="span" variant="body2" color="text.secondary">
                    ({formatMoney(line.unitPrice, lang)} {t('catalog.perUnit', { unit: pick(line.unit) })})
                  </Typography>
                </Typography>
                <Typography>{formatMoney(line.total, lang)}</Typography>
              </Box>
            ))}
          </Stack>
          <Divider sx={{ my: 1.5 }} />
          <Stack spacing={0.5}>
            {data.discount > 0 && (
              <>
                <Row label={t('orders.subtotal')}>{formatMoney(data.subtotal, lang)}</Row>
                <Row label={t('orders.discount', { code: data.promoCode ?? '' })}>−{formatMoney(data.discount, lang)}</Row>
              </>
            )}
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography sx={{ fontWeight: 600 }}>{t('cart.total')}</Typography>
              <Typography sx={{ fontWeight: 600 }} data-testid="order-total">
                {formatMoney(data.total, lang)}
              </Typography>
            </Box>
            <Row label={t('orders.payment')}>
              {t(`paymentMethod.${data.paymentMethod}`)} · {t(`paymentStatus.${data.paymentStatus}`)}
            </Row>
            {data.refundedAmount > 0 && <Row label={t('orders.refunded')}>{formatMoney(data.refundedAmount, lang)}</Row>}
          </Stack>
        </Paper>

        <Paper component="section" elevation={1} aria-labelledby="order-delivery" sx={{ p: { xs: 1.5, sm: 2.5 }, ...enter(3) }}>
          <Typography id="order-delivery" component="h2" variant="h6" sx={{ mb: 1 }}>
            {t('checkout.delivery')}
          </Typography>
          <Stack spacing={0.5}>
            <Row label={t('checkout.slot')}>{formatSlot(data.slotStart, data.slotEnd, lang)}</Row>
            <Row label={t('checkout.address')}>{data.address}</Row>
            {data.comment && <Row label={t('checkout.comment')}>{data.comment}</Row>}
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}
