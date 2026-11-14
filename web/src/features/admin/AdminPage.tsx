import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import HistoryIcon from '@mui/icons-material/History';
import RateReviewOutlinedIcon from '@mui/icons-material/RateReviewOutlined';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import { Alert, Box, Button, Chip, CircularProgress, IconButton, Link, Paper, Stack, Tab, Tabs, TextField, Tooltip, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactElement, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import type { AuditEntry, FarmerProfile, PromoCode, Slot } from '../../api/types';
import { errorMessage, formatMoney, useLang } from '../../i18n';
import { formatDateTime, formatSlot, localIso } from '../../shared/dates';
import { enter } from '../../shared/motion';
import { EmptyState } from '../../shared/pages';
import { RejectFarmerDialog, SlotDeleteDialog, SlotEditDialog } from './AdminDialogs';
import { ReviewModeration } from './ReviewModeration';
import { useToast } from '../../shared/Toast';

const SECTIONS = ['verification', 'slots', 'promo', 'reviews', 'audit'] as const;
type Section = (typeof SECTIONS)[number];
const SECTION_ICON: Record<Section, ReactElement> = {
  verification: <VerifiedUserOutlinedIcon fontSize="small" />,
  slots: <EventAvailableOutlinedIcon fontSize="small" />,
  promo: <LocalOfferOutlinedIcon fontSize="small" />,
  reviews: <RateReviewOutlinedIcon fontSize="small" />,
  audit: <HistoryIcon fontSize="small" />,
};

function Loading({ pending, error, children }: { pending: boolean; error: unknown; children: ReactNode }) {
  const { t } = useTranslation();
  if (error) {
    return <Alert severity="error">{errorMessage(error)}</Alert>;
  }

  return pending ? <CircularProgress aria-label={t('common.loading')} /> : children;
}

/** Черга заявок продавців: адміністратор перевіряє документи й верифікує господарство. */
function Verification() {
  const { t } = useTranslation();
  const { lang, pick } = useLang();
  const toast = useToast();
  const [rejecting, setRejecting] = useState<FarmerProfile | null>(null);
  const queryClient = useQueryClient();
  const pending = useQuery({ queryKey: ['admin', 'pending'], queryFn: () => api<FarmerProfile[]>('/admin/farmers/pending'), refetchInterval: 15_000 });
  const verify = useMutation({
    mutationFn: (farmer: FarmerProfile) => api<FarmerProfile>(`/admin/farmers/${farmer.id}/verify`, { method: 'POST', body: {} }),
    onSuccess: (farmer) => {
      queryClient.setQueryData<FarmerProfile[]>(['admin', 'pending'], (farmers) => farmers?.filter((item) => item.id !== farmer.id));
      void queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
      void queryClient.invalidateQueries({ queryKey: ['farms'] });
      toast.show(t('admin.verifiedNamed', { name: pick(farmer.name) }));
    },
    onError: (error) => toast.show(errorMessage(error), 'error'),
  });

  return (
    <Loading pending={pending.isPending} error={pending.error}>
      {pending.data?.length === 0 && <EmptyState icon={<VerifiedUserOutlinedIcon />} title={t('admin.noPending')} />}
      <Stack component="ul" spacing={1.5} sx={{ listStyle: 'none', p: 0, m: 0 }}>
        {pending.data?.map((farmer, index) => (
          <Paper component="li" key={farmer.id} aria-label={pick(farmer.name)} elevation={1} sx={{ p: 2, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', ...enter(index) }}>
            <Box aria-hidden sx={{ width: 48, height: 48, flexShrink: 0, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 26, bgcolor: 'background.default' }}>
              🌾
            </Box>
            <Box sx={{ flex: '1 1 240px' }}>
              <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 600 }}>
                {pick(farmer.name)}
              </Typography>
              <Typography variant="body2" color="text.secondary" lang={lang === 'uk' ? 'en' : 'uk'}>
                {lang === 'uk' ? farmer.name.en : farmer.name.uk}
              </Typography>
              <Link
                href={`https://www.openstreetmap.org/?mlat=${farmer.lat}&mlon=${farmer.lon}#map=13/${farmer.lat}/${farmer.lon}`}
                target="_blank"
                rel="noopener noreferrer"
                variant="body2"
                aria-label={t('admin.openMap', { name: pick(farmer.name) })}
                sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
              >
                <MapOutlinedIcon sx={{ fontSize: 16 }} />
                {farmer.lat.toFixed(4)}, {farmer.lon.toFixed(4)}
              </Link>
              {farmer.certified && (
                <Box sx={{ mt: 0.5 }}>
                  <Chip size="small" color="success" variant="outlined" label={t('catalog.organic')} />
                </Box>
              )}
            </Box>
            <Stack direction="row" spacing={1}>
              <Button color="error" onClick={() => setRejecting(farmer)} aria-label={t('admin.rejectNamed', { name: pick(farmer.name) })}>
                {t('admin.reject')}
              </Button>
              <Button
                variant="contained"
                loading={verify.isPending && verify.variables?.id === farmer.id}
                onClick={() => verify.mutate(farmer)}
                aria-label={t('admin.verifyNamed', { name: pick(farmer.name) })}
              >
                {t('admin.verify')}
              </Button>
            </Stack>
          </Paper>
        ))}
      </Stack>
      {rejecting && <RejectFarmerDialog key={rejecting.id} farmer={rejecting} onClose={() => setRejecting(null)} />}
    </Loading>
  );
}

const tomorrow = () => {
  const date = new Date(Date.now() + 24 * 3600 * 1000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

/** Слоти доставки: майбутні слоти й форма нового. Час вводиться місцевий, на сервер іде в ISO 8601. */
function Slots() {
  const { t } = useTranslation();
  const { lang } = useLang();
  const toast = useToast();
  const [editing, setEditing] = useState<Slot | null>(null);
  const [deleting, setDeleting] = useState<Slot | null>(null);
  const queryClient = useQueryClient();
  const slots = useQuery({ queryKey: ['slots'], queryFn: () => api<Slot[]>('/slots'), staleTime: 0 });
  const [date, setDate] = useState(tomorrow);
  const [from, setFrom] = useState('10:00');
  const [to, setTo] = useState('12:00');
  const [capacity, setCapacity] = useState('3');

  const create = useMutation({
    mutationFn: () =>
      api<unknown>('/admin/slots', {
        method: 'POST',
        body: { start: localIso(date, from), end: localIso(date, to), capacity: Number(capacity) },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['slots'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
      toast.show(t('admin.slotAdded'));
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate();
  };

  return (
    <Stack spacing={2}>
      <Paper component="form" onSubmit={submit} noValidate aria-label={t('admin.newSlot')} elevation={1} sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
          {t('admin.newSlot')}
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'flex-start' } }}>
          <TextField label={t('admin.date')} type="date" required value={date} onChange={(event) => setDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField label={t('admin.from')} type="time" required value={from} onChange={(event) => setFrom(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField label={t('admin.to')} type="time" required value={to} onChange={(event) => setTo(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField
            label={t('admin.capacity')}
            required
            value={capacity}
            onChange={(event) => setCapacity(event.target.value.replace(/\D/g, ''))}
            slotProps={{ htmlInput: { inputMode: 'numeric' } }}
            sx={{ maxWidth: { sm: 140 } }}
          />
          <Button type="submit" variant="contained" loading={create.isPending} disabled={!date || !from || !to || capacity === ''} sx={{ minHeight: 56 }}>
            {t('admin.add')}
          </Button>
        </Stack>
        {create.isError && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {errorMessage(create.error)}
          </Alert>
        )}
      </Paper>
      <Loading pending={slots.isPending} error={slots.error}>
        {slots.data?.length === 0 && <Typography color="text.secondary">{t('checkout.noSlots')}</Typography>}
        <Typography component="h3" variant="subtitle1" sx={{ mb: 1 }}>
          {t('admin.upcomingSlots')}
        </Typography>
        <Box
          component="ul"
          aria-label={t('admin.upcomingSlots')}
          sx={{ listStyle: 'none', p: 0, m: 0, display: 'grid', gap: 1, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))' }}
        >
          {slots.data?.map((slot, index) => (
            <Paper component="li" key={slot.id} variant="outlined" sx={{ pl: 2, pr: 1, py: 1.5, display: 'flex', alignItems: 'flex-start', gap: 1, ...enter(index, 35) }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600 }}>{formatSlot(slot.start, slot.end, lang)}</Typography>
                <Typography variant="body2" sx={{ color: slot.remaining === 0 ? 'error.main' : slot.remaining === 1 ? 'warning.dark' : 'text.secondary' }}>
                  {slot.remaining > 0 ? t('checkout.slotLeft', { count: slot.remaining }) : t('checkout.slotFull')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('admin.bookedOf', { booked: slot.capacity - slot.remaining, capacity: slot.capacity })}
                </Typography>
              </Box>
              <Tooltip title={t('admin.editSlot')}>
                <IconButton size="small" aria-label={t('admin.editSlotNamed', { slot: formatSlot(slot.start, slot.end, lang) })} onClick={() => setEditing(slot)}>
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              {/* Слот із замовленнями видалити не можна - кнопки для нього немає. */}
              {slot.remaining === slot.capacity && (
                <Tooltip title={t('admin.deleteSlot')}>
                  <IconButton size="small" color="error" aria-label={t('admin.deleteSlotNamed', { slot: formatSlot(slot.start, slot.end, lang) })} onClick={() => setDeleting(slot)}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Paper>
          ))}
        </Box>
      </Loading>
      {editing && <SlotEditDialog key={editing.id} slot={editing} onClose={() => setEditing(null)} />}
      {deleting && <SlotDeleteDialog key={deleting.id} slot={deleting} onClose={() => setDeleting(null)} />}
    </Stack>
  );
}

/** Промокоди: список усіх кодів і форма нового. */
function Promo() {
  const { t } = useTranslation();
  const { lang } = useLang();
  const toast = useToast();
  // Вимкнення й увімкнення промокоду (п. 6 покращень): вимкнений не приймається при оформленні.
  const toggle = useMutation({
    mutationFn: ({ code, active }: { code: string; active: boolean }) =>
      api<PromoCode>(`/admin/promocodes/${encodeURIComponent(code)}/${active ? 'activate' : 'deactivate'}`, { method: 'POST', body: {} }),
    onSuccess: (promo) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'promocodes'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
      toast.show(t(promo.active ? 'admin.promoOnToast' : 'admin.promoOffToast', { code: promo.code }), promo.active ? 'success' : 'info');
    },
    onError: (error) => toast.show(errorMessage(error), 'error'),
  });
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [percent, setPercent] = useState('10');
  const [minTotal, setMinTotal] = useState('300');
  const [until, setUntil] = useState(() => {
    const date = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  });
  const codes = useQuery({ queryKey: ['admin', 'promocodes'], queryFn: () => api<PromoCode[]>('/admin/promocodes') });

  const create = useMutation({
    mutationFn: () =>
      api<PromoCode>('/admin/promocodes', {
        method: 'POST',
        body: { code: code.trim(), percent: Number(percent), minTotal: Number(minTotal.replace(',', '.')), validUntil: localIso(until, '23:59:59') },
      }),
    onSuccess: (promo) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'promocodes'] });
      setCode('');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
      toast.show(t('admin.promoAdded', { code: promo.code }));
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate();
  };

  return (
    <Stack spacing={2}>
      <Paper component="form" onSubmit={submit} noValidate aria-label={t('admin.newPromo')} elevation={1} sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
          {t('admin.newPromo')}
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'flex-start' } }}>
          <TextField
            label={t('admin.promoCode')}
            required
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            helperText={t('admin.promoCodeHint')}
            slotProps={{ htmlInput: { maxLength: 16 } }}
          />
          <TextField label={t('admin.percent')} required value={percent} onChange={(event) => setPercent(event.target.value.replace(/\D/g, ''))} slotProps={{ htmlInput: { inputMode: 'numeric' } }} sx={{ maxWidth: { sm: 130 } }} />
          <TextField label={t('admin.minTotal')} required value={minTotal} onChange={(event) => setMinTotal(event.target.value)} slotProps={{ htmlInput: { inputMode: 'decimal' } }} sx={{ maxWidth: { sm: 170 } }} />
          <TextField label={t('admin.validUntil')} type="date" required value={until} onChange={(event) => setUntil(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <Button type="submit" variant="contained" loading={create.isPending} disabled={code.trim() === '' || percent === '' || minTotal === '' || !until} sx={{ minHeight: 56 }}>
            {t('admin.add')}
          </Button>
        </Stack>
        {create.isError && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {errorMessage(create.error)}
          </Alert>
        )}
      </Paper>
      <Loading pending={codes.isPending} error={codes.error}>
        <Stack component="ul" spacing={1} aria-label={t('admin.createdPromo')} sx={{ listStyle: 'none', p: 0, m: 0 }}>
          {codes.data?.map((promo, index) => (
            <Paper component="li" key={promo.code} variant="outlined" sx={{ px: 2, py: 1.25, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, ...enter(index) }}>
              <Box
                component="strong"
                sx={{
                  fontFamily: 'ui-monospace, "Cascadia Mono", Consolas, monospace',
                  letterSpacing: '0.05em',
                  px: 1,
                  py: 0.25,
                  borderRadius: 1,
                  border: 1,
                  borderStyle: 'dashed',
                  borderColor: 'primary.main',
                  color: 'primary.dark',
                }}
              >
                {promo.code}
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 180 }}>
                {t('admin.promoSummary', { percent: promo.percent, min: formatMoney(promo.minTotal, lang), until: formatDateTime(promo.validUntil, lang) })}
              </Typography>
              <Chip size="small" color={promo.active ? 'success' : 'default'} variant={promo.active ? 'outlined' : 'filled'} label={t(promo.active ? 'admin.promoActive' : 'admin.promoOff')} />
              <Button
                size="small"
                color={promo.active ? 'error' : 'primary'}
                loading={toggle.isPending && toggle.variables?.code === promo.code}
                onClick={() => toggle.mutate({ code: promo.code, active: !promo.active })}
                aria-label={t(promo.active ? 'admin.deactivateNamed' : 'admin.activateNamed', { code: promo.code })}
              >
                {t(promo.active ? 'admin.deactivate' : 'admin.activate')}
              </Button>
            </Paper>
          ))}
        </Stack>
      </Loading>
    </Stack>
  );
}

/** Журнал аудиту (B-FR-12). Дія показується мовою інтерфейсу за кодом; подробиці - текст сервера, як записано. */
function Audit() {
  const { t, i18n } = useTranslation();
  const { lang } = useLang();
  const audit = useQuery({ queryKey: ['admin', 'audit'], queryFn: () => api<AuditEntry[]>('/admin/audit') });
  const entries = [...(audit.data ?? [])].sort((a, b) => b.id - a.id);
  const actionTitle = (action: string) => (i18n.exists(`admin.action.${action}`) ? t(`admin.action.${action}`) : action);

  return (
    <Loading pending={audit.isPending} error={audit.error}>
      {entries.length === 0 && <EmptyState icon={<HistoryIcon />} title={t('admin.noAudit')} />}
      <Stack component="ol" spacing={1} sx={{ listStyle: 'none', p: 0, m: 0 }}>
        {entries.map((entry, index) => (
          <Paper component="li" key={entry.id} variant="outlined" sx={{ px: 2, py: 1.25, borderLeft: 3, borderLeftColor: 'primary.main', ...enter(index, 30) }}>
            <Typography sx={{ fontWeight: 600 }}>
              {actionTitle(entry.action)} <Typography component="span" color="text.secondary">· {entry.target}</Typography>
            </Typography>
            <Typography variant="body2">{entry.details}</Typography>
            <Typography variant="caption" color="text.secondary">
              {formatDateTime(entry.at, lang)} · {t('admin.byAdmin', { id: entry.adminId })}
            </Typography>
          </Paper>
        ))}
      </Stack>
    </Loading>
  );
}

/** UI-11: кабінет адміністратора - верифікація продавців, слоти доставки, промокоди, журнал аудиту. */
export function AdminPage() {
  const { t } = useTranslation();
  const [section, setSection] = useState<Section>('verification');

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto' }}>
      <Typography component="h1" variant="h4" sx={{ mb: 1, fontSize: { xs: '1.6rem', sm: '2.1rem' } }}>
        {t('nav.admin')}
      </Typography>
      <Tabs value={section} onChange={(_, next: Section) => setSection(next)} variant="scrollable" allowScrollButtonsMobile aria-label={t('nav.admin')} sx={{ mb: 2.5, borderBottom: 1, borderColor: 'divider' }}>
        {SECTIONS.map((item) => (
          <Tab
            key={item}
            value={item}
            icon={SECTION_ICON[item]}
            iconPosition="start"
            label={t(`admin.section.${item}`)}
            id={`admin-tab-${item}`}
            aria-controls={`admin-panel-${item}`}
            sx={{ textTransform: 'none', minHeight: 48 }}
          />
        ))}
      </Tabs>
      <Box role="tabpanel" id={`admin-panel-${section}`} aria-labelledby={`admin-tab-${section}`}>
        {section === 'verification' && <Verification />}
        {section === 'slots' && <Slots />}
        {section === 'promo' && <Promo />}
        {section === 'reviews' && <ReviewModeration />}
        {section === 'audit' && <Audit />}
      </Box>
    </Box>
  );
}
