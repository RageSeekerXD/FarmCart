import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import CallIcon from '@mui/icons-material/Call';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import ScheduleIcon from '@mui/icons-material/Schedule';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Order, OrderStatus } from '../../api/types';
import { errorMessage, formatMoney, useLang } from '../../i18n';
import { formatSlot } from '../../shared/dates';
import { highlightSx, useHighlightedId, useScrollIntoView } from '../../shared/highlight';
import { PrintArea, printTableSx } from '../../shared/Print';
import { enter, pulseDot } from '../../shared/motion';
import { EmptyState } from '../../shared/pages';
import { useToast } from '../../shared/Toast';
import { StatusChip } from '../orders/OrdersPage';
import { useAddressDetailsText } from '../../shared/addressDetails';
import { useCouriers, useFarmerOrders, useFarmerProfile, useOrderAction, type OrderAction } from './api';

/** Пакувальна накладна для друку: що зібрати, кому й куди везти, скільки отримати. */
function PackingSlip({ order, farmName }: { order: Order; farmName: string }) {
  const { t } = useTranslation();
  const { lang, pick } = useLang();
  const details = useAddressDetailsText()(order.addressDetails);
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '2px solid #000', pb: 1, mb: 2 }}>
        <Typography sx={{ fontSize: 22, fontWeight: 800 }}>{t('farmOrders.slipTitle', { id: order.id })}</Typography>
        <Typography sx={{ fontSize: 14 }}>FarmCart · {farmName}</Typography>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
        <Box>
          <Typography sx={{ fontWeight: 700 }}>{t('farmOrders.slipRecipient')}</Typography>
          <Typography>{order.buyerName || t('farmOrders.buyer')}</Typography>
          <Typography>{order.buyerPhone}</Typography>
          <Typography>{order.address}</Typography>
          {details && <Typography>{details}</Typography>}
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 700 }}>{t('checkout.slot')}</Typography>
          <Typography>{formatSlot(order.slotStart, order.slotEnd, lang)}</Typography>
          <Typography sx={{ fontWeight: 700, mt: 1 }}>{t('farmOrders.slipPayment')}</Typography>
          <Typography>
            {order.paymentStatus === 'PayOnDelivery' ? t('farmOrders.slipCollect', { amount: formatMoney(order.total, lang) }) : t('farmOrders.slipPaid')}
          </Typography>
        </Box>
      </Box>
      {order.comment && (
        <Typography sx={{ border: '1px dashed #000', p: 1, mb: 2 }}>
          <strong>{t('farmOrders.buyerComment')}:</strong> {order.comment}
        </Typography>
      )}
      <Box component="table" sx={printTableSx}>
        <thead>
          <tr>
            <th style={{ width: 28 }}>✓</th>
            <th>{t('cart.product')}</th>
            <th>{t('cart.quantity')}</th>
            <th style={{ textAlign: 'right' }}>{t('cart.sum')}</th>
          </tr>
        </thead>
        <tbody>
          {order.lines.map((line) => (
            <tr key={line.productId}>
              <td>☐</td>
              <td>{pick(line.name)}</td>
              <td>
                {line.quantity} × {pick(line.unit)}
              </td>
              <td style={{ textAlign: 'right' }}>{formatMoney(line.total, lang)}</td>
            </tr>
          ))}
        </tbody>
      </Box>
      <Typography sx={{ textAlign: 'right', fontWeight: 800, fontSize: 16, mt: 1 }}>
        {t('cart.total')}: {formatMoney(order.total, lang)}
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, mt: 5 }}>
        <Typography sx={{ borderTop: '1px solid #000', pt: 0.5 }}>{t('farmOrders.slipPacked')}</Typography>
        <Typography sx={{ borderTop: '1px solid #000', pt: 0.5 }}>{t('farmOrders.slipCourier')}</Typography>
      </Box>
    </Box>
  );
}

/** Групи замовлень для фільтра: нові чекають рішення фермера, «у роботі» - прийняті й ті, що збираються. */
const FILTERS = ['all', 'new', 'active', 'done'] as const;
type Filter = (typeof FILTERS)[number];

function inFilter(status: OrderStatus, filter: Filter): boolean {
  switch (filter) {
    case 'new':
      return status === 'Placed';
    case 'active':
      return status === 'Accepted' || status === 'Assembling' || status === 'DeliveryFailed';
    case 'done':
      return status === 'InTransit' || status === 'Delivered' || status === 'Rejected' || status === 'Cancelled';
    default:
      return true;
  }
}

/** Статуси, на яких хід за фермером: картка підказує наступний крок. */
const NEXT_STEP: readonly OrderStatus[] = ['Placed', 'Accepted', 'Assembling'];

function InfoRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, color: 'text.secondary', '& > svg': { fontSize: 18, mt: '2px', flexShrink: 0 } }}>
      {icon}
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {children}
      </Typography>
    </Box>
  );
}

type DialogState ={ kind: 'accept' | 'reject' | 'handover'; order: Order } | null;

interface ActionDialogProps {
  state: NonNullable<DialogState>;
  onClose: () => void;
  onDone: (order: Order) => void;
}

/** Діалог дії над замовленням: прийняти з нестачами, відхилити з причиною або передати кур'єру. */
function ActionDialog({ state, onClose, onDone }: ActionDialogProps) {
  const { t } = useTranslation();
  const { pick } = useLang();
  const { kind, order } = state;
  const act = useOrderAction();
  const couriers = useCouriers(kind === 'handover');
  const [missing, setMissing] = useState<Record<number, string>>({});
  const [reason, setReason] = useState('');
  const [courierId, setCourierId] = useState('');
  const [touched, setTouched] = useState(false);

  const shortages = order.lines
    .map((line) => ({ productId: line.productId, quantity: Number(missing[line.productId] ?? 0), ordered: line.quantity }))
    .filter((item) => item.quantity !== 0);
  const shortagesInvalid = shortages.some((item) => !Number.isInteger(item.quantity) || item.quantity < 0 || item.quantity > item.ordered);
  const invalid = (kind === 'accept' && shortagesInvalid) || (kind === 'reject' && reason.trim() === '') || (kind === 'handover' && courierId === '');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (invalid) {
      return;
    }

    const action: OrderAction =
      kind === 'accept'
        ? { kind, orderId: order.id, shortages: shortages.map(({ productId, quantity }) => ({ productId, quantity })) }
        : kind === 'reject'
          ? { kind, orderId: order.id, reason: reason.trim() }
          : { kind, orderId: order.id, courierId: Number(courierId) };
    act.mutate(action, { onSuccess: onDone });
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" aria-labelledby="order-action-title">
      <form onSubmit={submit} noValidate>
        <DialogTitle id="order-action-title">{t(`farmOrders.${kind}Title`, { id: order.id })}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {kind === 'accept' && (
              <>
                <Typography variant="body2" color="text.secondary">
                  {t('farmOrders.shortageHint')}
                </Typography>
                {order.lines.map((line) => (
                  <TextField
                    key={line.productId}
                    label={t('farmOrders.missingOf', { name: pick(line.name), count: line.quantity })}
                    value={missing[line.productId] ?? ''}
                    placeholder="0"
                    onChange={(event) => setMissing((values) => ({ ...values, [line.productId]: event.target.value }))}
                    slotProps={{ htmlInput: { inputMode: 'numeric' }, inputLabel: { shrink: true } }}
                  />
                ))}
                {touched && shortagesInvalid && <Alert severity="error">{t('errors.shortage_invalid')}</Alert>}
              </>
            )}
            {kind === 'reject' && (
              <TextField
                label={t('farmOrders.reason')}
                required
                autoFocus
                multiline
                minRows={2}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                error={touched && reason.trim() === ''}
                helperText={touched && reason.trim() === '' ? t('errors.reason_required') : t('farmOrders.reasonHint')}
              />
            )}
            {kind === 'handover' && (
              <TextField
                select
                required
                label={t('farmOrders.courier')}
                value={courierId}
                onChange={(event) => setCourierId(event.target.value)}
                error={touched && courierId === ''}
                helperText={couriers.isError ? errorMessage(couriers.error) : touched && courierId === '' ? t('farmOrders.chooseCourier') : ' '}
              >
                {(couriers.data ?? []).map((courier) => (
                  <MenuItem key={courier.id} value={String(courier.id)}>
                    {courier.name || `#${courier.id}`}
                  </MenuItem>
                ))}
              </TextField>
            )}
            {act.isError && <Alert severity="error">{errorMessage(act.error)}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" variant="contained" color={kind === 'reject' ? 'error' : 'primary'} loading={act.isPending}>
            {t(`farmOrders.${kind}`)}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

/** UI-09: вхідні замовлення фермера - прийняти (з нестачами), відхилити з причиною, зібрати, передати кур'єру. */
export function FarmerOrdersPage() {
  const { t } = useTranslation();
  const { lang, pick } = useLang();
  const toast = useToast();
  const orders = useFarmerOrders();
  const profile = useFarmerProfile();
  const assemble = useOrderAction();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [printing, setPrinting] = useState<Order | null>(null);
  const detailsText = useAddressDetailsText();
  // Перехід зі сповіщення (?order=1001): замовлення видно за будь-якого фільтра, сторінка прокручує до нього.
  const highlighted = useHighlightedId();
  const scrollTo = useScrollIntoView();
  useEffect(() => {
    if (highlighted !== null) {
      setFilter('all');
    }
  }, [highlighted]);

  const done = (order: Order) => {
    setDialog(null);
    toast.show(`${t('orders.number', { id: order.id })}: ${t(`status.${order.status}`)}`);
  };

  const all = orders.data ?? [];
  const counts = Object.fromEntries(FILTERS.map((item) => [item, all.filter((order) => inFilter(order.status, item)).length])) as Record<Filter, number>;
  // Спершу ті, де хід за фермером (нові, потім прийняті й ті, що збираються); усередині групи - порядок сервера.
  const priority = (status: OrderStatus) => (NEXT_STEP.includes(status) ? NEXT_STEP.indexOf(status) : NEXT_STEP.length);
  const shown = all.filter((order) => inFilter(order.status, filter)).sort((a, b) => priority(a.status) - priority(b.status));

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Typography component="h1" variant="h4" sx={{ mb: 2, fontSize: { xs: '1.6rem', sm: '2.1rem' } }}>
        {t('farmOrders.title')}
      </Typography>

      {orders.isPending && <CircularProgress aria-label={t('common.loading')} />}
      {orders.isError && <Alert severity="error">{errorMessage(orders.error)}</Alert>}
      {orders.data?.length === 0 && <EmptyState icon={<InboxOutlinedIcon />} title={t('farmOrders.empty')} />}

      {all.length > 0 && (
        <Stack direction="row" spacing={1} useFlexGap role="group" aria-label={t('farmOrders.filterLabel')} sx={{ flexWrap: 'wrap', mb: 2 }}>
          {FILTERS.map((item) => (
            <Chip
              key={item}
              clickable
              color={filter === item ? 'primary' : 'default'}
              variant={filter === item ? 'filled' : 'outlined'}
              aria-pressed={filter === item}
              onClick={() => setFilter(item)}
              label={`${t(`farmOrders.filter.${item}`)} · ${counts[item]}`}
              sx={{ fontWeight: 600, bgcolor: filter === item ? undefined : 'background.paper' }}
            />
          ))}
        </Stack>
      )}
      {all.length > 0 && shown.length === 0 && <Typography color="text.secondary">{t('farmOrders.noneInFilter')}</Typography>}

      <Stack component="ul" spacing={1.5} sx={{ listStyle: 'none', p: 0, m: 0 }}>
        {shown.map((order, index) => {
          const label = t('orders.number', { id: order.id });
          const isNew = order.status === 'Placed';
          const next = NEXT_STEP.includes(order.status) ? t(`farmOrders.next.${order.status}`) : null;
          return (
            <Paper
              component="li"
              key={order.id}
              aria-label={label}
              aria-current={order.id === highlighted ? 'true' : undefined}
              ref={order.id === highlighted ? scrollTo : undefined}
              elevation={1}
              sx={{
                p: { xs: 2, sm: 2.5 },
                borderLeft: 4,
                borderColor: isNew ? 'secondary.main' : 'transparent',
                transition: 'box-shadow 200ms ease',
                '&:hover': { boxShadow: 4 },
                ...enter(index),
                ...(order.id === highlighted ? highlightSx : {}),
              }}
            >
              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Typography component="h2" variant="h6" sx={{ mr: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
                  {label}
                  {/* Нове замовлення чекає рішення: поруч із номером пульсує бурштинова крапка. */}
                  {isNew && (
                    <Box
                      component="span"
                      aria-hidden
                      sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'secondary.main', animation: `${pulseDot} 1.8s ease-out infinite` }}
                    />
                  )}
                </Typography>
                <StatusChip status={order.status} />
              </Box>
              <Stack component="ul" spacing={0.5} sx={{ listStyle: 'none', p: 1.5, m: 0, mb: 1.5, bgcolor: 'background.default', borderRadius: 2 }}>
                {order.lines.map((line) => (
                  <Typography component="li" key={line.productId} sx={{ fontWeight: 500 }}>
                    {pick(line.name)} — {line.quantity} × {pick(line.unit)}
                  </Typography>
                ))}
              </Stack>
              <Stack spacing={0.5}>
                <InfoRow icon={<ScheduleIcon />}>{t('orders.deliveryAt', { slot: formatSlot(order.slotStart, order.slotEnd, lang) })}</InfoRow>
                <InfoRow icon={<PlaceOutlinedIcon />}>{order.address}</InfoRow>
                {order.addressDetails && <InfoRow icon={<ApartmentOutlinedIcon />}>{detailsText(order.addressDetails)}</InfoRow>}
                {order.buyerPhone && (
                  <InfoRow icon={<PersonOutlineIcon />}>
                    {order.buyerName || t('farmOrders.buyer')} · {order.buyerPhone}
                  </InfoRow>
                )}
              </Stack>
              {/* Коментар покупця помітний: прохання нарізати хліб чи код домофону не мають загубитися. */}
              {order.comment && (
                <Alert severity="info" icon={<ChatBubbleOutlineIcon fontSize="inherit" />} sx={{ mt: 1.5, py: 0.25 }}>
                  <strong>{t('farmOrders.buyerComment')}:</strong> {order.comment}
                </Alert>
              )}
              <Typography sx={{ fontWeight: 700, mt: 1.5 }}>
                {formatMoney(order.total, lang)} · {t(`paymentStatus.${order.paymentStatus}`)}
              </Typography>
              {next && (
                <Typography variant="body2" sx={{ mt: 1.5, color: 'primary.dark', fontWeight: 600 }}>
                  → {next}
                </Typography>
              )}

              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mt: 1 }}>
                {order.status === 'Placed' && (
                  <>
                    <Button variant="contained" onClick={() => setDialog({ kind: 'accept', order })} aria-label={`${t('farmOrders.accept')}: ${label}`}>
                      {t('farmOrders.accept')}
                    </Button>
                    <Button color="error" onClick={() => setDialog({ kind: 'reject', order })} aria-label={`${t('farmOrders.reject')}: ${label}`}>
                      {t('farmOrders.reject')}
                    </Button>
                  </>
                )}
                {order.status === 'Accepted' && (
                  <Button
                    variant="contained"
                    loading={assemble.isPending && assemble.variables?.orderId === order.id}
                    onClick={() =>
                      assemble.mutate({ kind: 'assemble', orderId: order.id }, { onSuccess: done, onError: (error) => toast.show(errorMessage(error), 'error') })
                    }
                    aria-label={`${t('farmOrders.assemble')}: ${label}`}
                  >
                    {t('farmOrders.assemble')}
                  </Button>
                )}
                {order.status === 'Assembling' && (
                  <Button variant="contained" onClick={() => setDialog({ kind: 'handover', order })} aria-label={`${t('farmOrders.handover')}: ${label}`}>
                    {t('farmOrders.handover')}
                  </Button>
                )}
                <Box sx={{ flex: 1 }} />
                {order.buyerPhone && (
                  <Button href={`tel:${order.buyerPhone}`} startIcon={<CallIcon />} aria-label={t('farmOrders.callNamed', { name: order.buyerName || t('farmOrders.buyer'), id: order.id })}>
                    {t('farmOrders.call')}
                  </Button>
                )}
                <Button startIcon={<PrintOutlinedIcon />} onClick={() => setPrinting(order)} aria-label={t('farmOrders.printNamed', { id: order.id })}>
                  {t('farmOrders.print')}
                </Button>
              </Stack>
            </Paper>
          );
        })}
      </Stack>

      {dialog && <ActionDialog key={`${dialog.kind}-${dialog.order.id}`} state={dialog} onClose={() => setDialog(null)} onDone={done} />}
      {printing && (
        <PrintArea onDone={() => setPrinting(null)}>
          <PackingSlip order={printing} farmName={profile.data ? pick(profile.data.name) : ''} />
        </PrintArea>
      )}
    </Box>
  );
}
