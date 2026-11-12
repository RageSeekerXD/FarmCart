import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Alert, Box, Button, CircularProgress, Divider, Paper, Stack, Step, StepLabel, Stepper, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { errorMessage, formatMoney, useLang } from '../../i18n';
import { formatDateTime, formatSlot } from '../../shared/dates';
import { useFarms } from '../map/MapPage';
import { StatusChip } from './OrdersPage';
import { ReviewSection } from './ReviewSection';
import { isFinal, timeline, useOrder } from './orders';

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
        <Box role="status" aria-label={t('orders.status')}>
          <StatusChip status={data.status} />
        </Box>
      </Box>

      <Stack spacing={2}>
        {data.status === 'Rejected' && (
          <Alert severity="error">
            {t('orders.rejected')}
            {data.rejectionReason ? ` ${t('orders.reason')}: ` : ''}
            {/* Причину пише фермер - це користувацький текст, він не перекладається. */}
            {data.rejectionReason && <span>{data.rejectionReason}</span>}
          </Alert>
        )}

        {data.deliveryCode && !isFinal(data.status) && (
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'secondary.light' }}>
            <Typography>{t('orders.codeTitle')}</Typography>
            <Typography component="p" variant="h3" data-testid="delivery-code" sx={{ letterSpacing: 8, fontWeight: 700 }}>
              {data.deliveryCode}
            </Typography>
            <Typography variant="body2">{t('orders.codeHint')}</Typography>
          </Paper>
        )}

        {data.status === 'Delivered' && <ReviewSection orderId={data.id} />}

        <Paper component="section" aria-labelledby="order-timeline" sx={{ p: { xs: 1.5, sm: 2.5 } }}>
          <Typography id="order-timeline" component="h2" variant="h6" sx={{ mb: 1 }}>
            {t('orders.timeline')}
          </Typography>
          <Stepper orientation="vertical" activeStep={steps.findIndex((step) => step.state === 'current')}>
            {steps.map((step) => (
              <Step key={step.status} completed={step.state === 'done' || (step.state === 'current' && data.status === 'Delivered')}>
                <StepLabel
                  error={step.status === 'Rejected'}
                  optional={step.at ? <Typography variant="caption">{formatDateTime(step.at, lang)}</Typography> : undefined}
                  aria-current={step.state === 'current' ? 'step' : undefined}
                >
                  {t(`status.${step.status}`)}
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        </Paper>

        <Paper component="section" aria-labelledby="order-lines" sx={{ p: { xs: 1.5, sm: 2.5 } }}>
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

        <Paper component="section" aria-labelledby="order-delivery" sx={{ p: { xs: 1.5, sm: 2.5 } }}>
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
