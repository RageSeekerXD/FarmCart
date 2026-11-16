import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import CallIcon from '@mui/icons-material/Call';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import DirectionsIcon from '@mui/icons-material/Directions';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import ScheduleIcon from '@mui/icons-material/Schedule';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import {
  alpha,
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  FormControlLabel,
  LinearProgress,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Suspense, lazy, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import type { DeliveryTask, Order } from '../../api/types';
import { errorMessage, formatMoney, useLang } from '../../i18n';
import { formatSlot } from '../../shared/dates';
import { useAddressDetailsText } from '../../shared/addressDetails';
import { highlightSx, useHighlightedId, useScrollIntoView } from '../../shared/highlight';
import { enter } from '../../shared/motion';
import { EmptyState } from '../../shared/pages';
import { useToast } from '../../shared/Toast';
import { POLL_MS } from '../orders/orders';
import { CodeBoxes } from './CodeBoxes';
import { ReportFailureButton } from './ReportFailure';
import { googleRouteUrl, navigatorLinks, planRoute, slotState, type RouteStop } from './route';

// Leaflet вантажиться лише тоді, коли кур'єр бачить мапу маршруту.
const RouteMap = lazy(() => import('./RouteMap'));

const DELIVERIES = ['courier', 'deliveries'] as const;

/** Поточний час, що оновлюється раз на півхвилини: таймер слоту йде без перезавантаження. */
function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** «1 год 12 хв» / «1 h 12 min»; понад добу - «1 д 19 год». */
function useDuration() {
  const { t } = useTranslation();
  return (minutes: number) => {
    // Понад добу - у днях і годинах: «1 д 19 год» читається швидше за «43 год 10 хв».
    if (minutes >= 24 * 60) {
      return t('courier.daysHours', { days: Math.floor(minutes / 1440), hours: Math.floor((minutes % 1440) / 60) });
    }

    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return hours > 0 ? t('courier.hoursMinutes', { hours, minutes: rest }) : t('courier.minutes', { minutes: rest });
  };
}

/** Скільки лишилося до кінця слоту (або до його початку, або скільки минуло після) - смужкою й текстом. */
function SlotTimer({ task, now }: { task: DeliveryTask; now: number }) {
  const { t } = useTranslation();
  const duration = useDuration();
  const state = slotState(task.slotStart, task.slotEnd, now);
  const late = state.phase === 'after';
  const urgent = state.phase === 'during' && state.minutes <= 20;
  const text =
    state.phase === 'before'
      ? t('courier.slotStartsIn', { time: duration(state.minutes) })
      : state.phase === 'during'
        ? t('courier.slotEndsIn', { time: duration(state.minutes) })
        : t('courier.slotEndedAgo', { time: duration(state.minutes) });
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5, color: late ? 'error.main' : urgent ? 'warning.dark' : 'text.secondary' }}>
        {text}
      </Typography>
      <LinearProgress
        variant="determinate"
        value={state.progress * 100}
        color={late ? 'error' : urgent ? 'warning' : 'primary'}
        aria-label={text}
        sx={{ height: 8, borderRadius: 4 }}
      />
    </Box>
  );
}

/** Рядок картки доставки: піктограма в кружечку, підпис дрібно, значення великим шрифтом; праворуч - дія (дзвінок). */
function Detail({ icon, label, children, action }: { icon: ReactNode; label: string; children: ReactNode; action?: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box
        aria-hidden
        sx={{
          width: 40,
          height: 40,
          flexShrink: 0,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          color: 'primary.main',
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
          {label}
        </Typography>
        <Box sx={{ fontSize: '1.1rem', fontWeight: 500, overflowWrap: 'anywhere' }}>{children}</Box>
      </Box>
      {action}
    </Box>
  );
}

/** Велика кнопка дзвінка для набору однією рукою. */
function CallButton({ phone, label }: { phone: string; label: string }) {
  return (
    <Button href={`tel:${phone}`} variant="outlined" aria-label={label} sx={{ minWidth: 48, minHeight: 48, px: 1.5, borderRadius: 3, flexShrink: 0 }}>
      <CallIcon />
    </Button>
  );
}

/** Вибір навігатора для маршруту «ферма → покупець». */
function RouteButton({ task }: { task: DeliveryTask }) {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <Button
        variant="outlined"
        size="large"
        fullWidth
        startIcon={<DirectionsIcon />}
        endIcon={<ExpandMoreIcon />}
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        onClick={(event) => setAnchor(event.currentTarget)}
        sx={{ minHeight: 56, mb: 2 }}
      >
        {t('courier.route')}
      </Button>
      <Menu anchorEl={anchor} open={anchor !== null} onClose={() => setAnchor(null)} slotProps={{ list: { 'aria-label': t('courier.routeIn') } }}>
        {navigatorLinks(task).map((link) => (
          <MenuItem key={link.name} component="a" href={link.href} target="_blank" rel="noopener noreferrer" onClick={() => setAnchor(null)} sx={{ minHeight: 48, gap: 1.5 }}>
            <OpenInNewIcon fontSize="small" />
            {link.name}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

function DeliveryCard({ task, index, now, highlighted }: { task: DeliveryTask; index: number; now: number; highlighted: boolean }) {
  const { t } = useTranslation();
  const { lang, pick } = useLang();
  const toast = useToast();
  const queryClient = useQueryClient();
  const scrollTo = useScrollIntoView();
  const detailsText = useAddressDetailsText();
  const [code, setCode] = useState('');
  const [itemsOpen, setItemsOpen] = useState(false);
  const [checked, setChecked] = useState<ReadonlySet<number>>(new Set());
  const label = t('courier.delivery', { id: task.orderId });
  const buyer = task.buyerName || t('farmOrders.buyer');

  const confirm = useMutation({
    mutationFn: () => api<Order>(`/courier/deliveries/${task.orderId}/confirm`, { method: 'POST', body: { code: code.trim() } }),
    onSuccess: () => {
      queryClient.setQueryData<DeliveryTask[]>(DELIVERIES, (tasks) => tasks?.filter((item) => item.orderId !== task.orderId));
      toast.show(t('courier.delivered', { id: task.orderId }));
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    confirm.mutate();
  };

  return (
    <Paper
      component="li"
      aria-label={label}
      aria-current={highlighted ? 'true' : undefined}
      ref={highlighted ? scrollTo : undefined}
      elevation={1}
      sx={{ p: { xs: 2, sm: 2.5 }, ...enter(index, 80), ...(highlighted ? highlightSx : {}) }}
    >
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Typography component="h2" variant="h5" sx={{ mr: 'auto' }}>
          {label}
        </Typography>
        <Chip color="primary" icon={<ScheduleIcon />} label={formatSlot(task.slotStart, task.slotEnd, lang)} sx={{ fontWeight: 600, fontSize: '0.95rem' }} />
      </Box>
      <SlotTimer task={task} now={now} />

      <Stack spacing={1.5} sx={{ mb: 2 }}>
        <Detail
          icon={<StorefrontOutlinedIcon />}
          label={t('courier.pickup')}
          action={<CallButton phone={task.farmerPhone} label={t('courier.callFarmer', { name: pick(task.pickupFrom) })} />}
        >
          {pick(task.pickupFrom)}
          {task.farmerContact && (
            <Typography variant="body2" color="text.secondary">
              {task.farmerContact}
            </Typography>
          )}
        </Detail>
        <Detail icon={<PlaceOutlinedIcon />} label={t('courier.address')} action={<CallButton phone={task.buyerPhone} label={t('courier.callBuyer', { name: buyer })} />}>
          {task.address}
          <Typography variant="body2" color="text.secondary">
            {buyer}
          </Typography>
        </Detail>
        {task.addressDetails && (
          <Detail icon={<ApartmentOutlinedIcon />} label={t('courier.access')}>
            {detailsText(task.addressDetails)}
          </Detail>
        )}
      </Stack>
      {task.comment && (
        <Alert severity="info" icon={<ChatBubbleOutlineIcon fontSize="inherit" />} sx={{ mb: 1.5, fontSize: '1rem' }}>
          <strong>{t('farmOrders.buyerComment')}:</strong> {task.comment}
        </Alert>
      )}

      {/* Склад замовлення - звірити з тим, що видав фермер, ще на фермі. */}
      <Box sx={{ mb: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
        <Button
          fullWidth
          onClick={() => setItemsOpen((open) => !open)}
          aria-expanded={itemsOpen}
          startIcon={<Inventory2OutlinedIcon />}
          endIcon={<ExpandMoreIcon sx={{ transform: itemsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }} />}
          sx={{ justifyContent: 'flex-start', minHeight: 48, px: 1.5, color: 'text.primary', '& .MuiButton-endIcon': { ml: 'auto' } }}
        >
          {t('courier.itemsToCheck', { count: task.items, checked: checked.size, lines: task.lines.length })}
        </Button>
        <Collapse in={itemsOpen}>
          <Stack sx={{ px: 1.5, pb: 1 }}>
            {task.lines.map((line, lineIndex) => (
              <FormControlLabel
                key={lineIndex}
                control={
                  <Checkbox
                    checked={checked.has(lineIndex)}
                    onChange={() =>
                      setChecked((current) => {
                        const next = new Set(current);
                        if (!next.delete(lineIndex)) {
                          next.add(lineIndex);
                        }

                        return next;
                      })
                    }
                  />
                }
                label={`${pick(line.name)} — ${line.quantity} × ${pick(line.unit)}`}
                sx={{ minHeight: 44, textDecoration: checked.has(lineIndex) ? 'line-through' : 'none' }}
              />
            ))}
          </Stack>
        </Collapse>
      </Box>

      {task.amountToCollect > 0 ? (
        <Alert severity="warning" sx={{ mb: 1.5, fontSize: '1.05rem' }}>
          {t('courier.collect', { amount: formatMoney(task.amountToCollect, lang) })}
        </Alert>
      ) : (
        <Alert severity="success" sx={{ mb: 1.5 }}>
          {t('courier.prepaid')}
        </Alert>
      )}
      <RouteButton task={task} />

      <Stack component="form" spacing={1.5} onSubmit={submit} noValidate>
        <Typography variant="subtitle2">{t('courier.code')}</Typography>
        <CodeBoxes value={code} onChange={setCode} label={`${t('courier.code')}: ${label}`} error={confirm.isError} />
        <Typography variant="body2" color="text.secondary">
          {t('courier.codeHint')}
        </Typography>
        {confirm.isError && <Alert severity="error">{errorMessage(confirm.error)}</Alert>}
        <Button type="submit" variant="contained" size="large" fullWidth disabled={code.length < 4} loading={confirm.isPending} sx={{ minHeight: 56, fontSize: '1.1rem' }}>
          {t('courier.confirm')}
        </Button>
      </Stack>
      <ReportFailureButton task={task} deliveriesKey={DELIVERIES} />
    </Paper>
  );
}

/** Маршрут на всі доставки: мапа з пронумерованими зупинками «забрати → віддати» і той самий порядок списком. */
function RouteOverview({ tasks }: { tasks: DeliveryTask[] }) {
  const { t } = useTranslation();
  const { pick } = useLang();
  const stops = planRoute(tasks);
  const byId = new Map(tasks.map((task) => [task.orderId, task]));
  const stopLabel = (stop: RouteStop) => {
    const task = byId.get(stop.orderId)!;
    return stop.kind === 'pickup'
      ? t('courier.stopPickup', { id: stop.orderId, place: pick(task.pickupFrom) })
      : t('courier.stopDropoff', { id: stop.orderId, place: task.address });
  };
  const full = googleRouteUrl(stops);

  return (
    <Paper component="section" elevation={1} aria-labelledby="courier-route" sx={{ mb: 2, overflow: 'hidden' }}>
      <Box sx={{ px: { xs: 2, sm: 2.5 }, pt: 2, pb: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
        <Typography id="courier-route" component="h2" variant="h6" sx={{ mr: 'auto' }}>
          {t('courier.routeTitle')}
        </Typography>
        {full && (
          <Button size="small" href={full} target="_blank" rel="noopener noreferrer" endIcon={<OpenInNewIcon fontSize="small" />}>
            {t('courier.wholeRoute')}
          </Button>
        )}
      </Box>
      <Box sx={{ height: { xs: 220, sm: 260 }, position: 'relative', zIndex: 0 }}>
        <Suspense
          fallback={
            <Box sx={{ height: '100%', display: 'grid', placeItems: 'center' }}>
              <CircularProgress aria-label={t('common.loading')} />
            </Box>
          }
        >
          <RouteMap stops={stops} label={stopLabel} />
        </Suspense>
      </Box>
      <Box component="ol" aria-label={t('courier.routeOrder')} sx={{ m: 0, px: { xs: 2, sm: 2.5 }, py: 1.5, pl: { xs: 4.5, sm: 5 }, display: 'grid', gap: 0.5 }}>
        {stops.map((stop) => (
          <Typography component="li" key={`${stop.kind}-${stop.orderId}`} variant="body2" sx={{ '&::marker': { fontWeight: 700, color: stop.kind === 'pickup' ? '#ef6c00' : 'primary.main' } }}>
            {stopLabel(stop)}
            {stop.lat === null && (
              <Typography component="span" variant="body2" color="text.secondary">
                {' '}
                ({t('courier.noPoint')})
              </Typography>
            )}
          </Typography>
        ))}
      </Box>
    </Paper>
  );
}

/** UI-10: доставки кур'єра - маршрут на мапі, великі елементи для телефона, дзвінки, звірка складу й вручення за кодом. */
export function CourierPage() {
  const { t } = useTranslation();
  const now = useNow();
  const highlighted = useHighlightedId();
  const deliveries = useQuery({
    queryKey: DELIVERIES,
    queryFn: () => api<DeliveryTask[]>('/courier/deliveries'),
    refetchInterval: POLL_MS,
  });

  return (
    <Box sx={{ maxWidth: 640, mx: 'auto' }}>
      <Typography component="h1" variant="h4" sx={{ mb: 1, fontSize: { xs: '1.6rem', sm: '2.1rem' } }}>
        {t('nav.deliveries')}
      </Typography>
      {deliveries.isPending && <CircularProgress aria-label={t('common.loading')} />}
      {deliveries.isError && <Alert severity="error">{errorMessage(deliveries.error)}</Alert>}
      {deliveries.data && deliveries.data.length > 0 && (
        <>
          <Typography color="text.secondary" sx={{ mb: 1.5, fontWeight: 500 }}>
            {t('courier.count', { count: deliveries.data.length })}
          </Typography>
          <RouteOverview tasks={deliveries.data} />
        </>
      )}
      {deliveries.data?.length === 0 && <EmptyState icon={<LocalShippingOutlinedIcon />} title={t('courier.empty')} hint={t('courier.emptyHint')} />}
      <Stack component="ul" spacing={2} sx={{ listStyle: 'none', p: 0, m: 0 }}>
        {deliveries.data?.map((task, index) => (
          <DeliveryCard key={task.orderId} task={task} index={index} now={now} highlighted={task.orderId === highlighted} />
        ))}
      </Stack>
    </Box>
  );
}
