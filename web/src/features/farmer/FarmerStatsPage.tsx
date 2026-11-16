import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import { Alert, Box, Button, CircularProgress, Paper, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography, useTheme } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Lang } from '../../api/types';
import { errorMessage, formatMoney, useLang } from '../../i18n';
import { EmptyState } from '../../shared/pages';
import { useFarmerOrders } from './api';
import { kpis, revenueByDay, topProducts, type DayRevenue } from './stats';

/** Колір стовпчиків: зелений ролі, перевірений на контраст і світлоту для обох тем (dataviz: один ряд - один колір). */
const BAR = { light: '#2e7d32', dark: '#43a047' } as const;

const locale = (lang: Lang) => (lang === 'uk' ? 'uk-UA' : 'en-GB');

/** Гроші без копійок для осей і плиток: «1 284 ₴». */
function money(amount: number, lang: Lang): string {
  return new Intl.NumberFormat(locale(lang), { style: 'currency', currency: 'UAH', currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0 }).format(amount);
}

function dayLabel(day: string, lang: Lang, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale(lang), options).format(new Date(`${day}T12:00:00`));
}

/** Кругла верхня межа осі: 0 / половина / верх. */
function niceTop(max: number): number {
  if (max <= 0) {
    return 100;
  }

  const step = 10 ** Math.floor(Math.log10(max));
  return Math.ceil(max / step) * step;
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Paper elevation={1} sx={{ p: 2 }}>
      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: '1.6rem', fontWeight: 650, lineHeight: 1.2, mt: 0.5 }}>{value}</Typography>
    </Paper>
  );
}

/** Стовпчикова діаграма за днями: один ряд, тонкі стовпчики з округленим верхом, підказка при наведенні й фокусі. */
function RevenueChart({ days, today }: { days: DayRevenue[]; today: string }) {
  const { t } = useTranslation();
  const { lang } = useLang();
  const theme = useTheme();
  const top = niceTop(Math.max(...days.map((item) => item.total)));
  const height = 180;
  const peak = days.reduce((best, item) => (item.total > best.total ? item : best), days[0]!);

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 1 }}>
      {/* Вісь Y: 0, половина, верх - круглі значення. */}
      <Box sx={{ position: 'relative', height, width: 64 }} aria-hidden>
        {[top, top / 2, 0].map((tick, index) => (
          <Typography key={tick} variant="caption" color="text.secondary" sx={{ position: 'absolute', right: 0, top: `${index * 50}%`, transform: 'translateY(-50%)', whiteSpace: 'nowrap' }}>
            {money(tick, lang)}
          </Typography>
        ))}
      </Box>
      <Box>
        <Box sx={{ position: 'relative', height }}>
          {[0, 50, 100].map((position) => (
            <Box key={position} aria-hidden sx={{ position: 'absolute', left: 0, right: 0, top: `${position}%`, borderTop: 1, borderColor: 'divider' }} />
          ))}
          <Box sx={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: `repeat(${days.length}, 1fr)`, gap: '2px', alignItems: 'end' }}>
            {days.map((item) => {
              const label = `${dayLabel(item.day, lang, { weekday: 'short', day: 'numeric', month: 'short' })}: ${formatMoney(item.total, lang)} · ${t('stats.ordersCount', { count: item.orders })}`;
              return (
                <Tooltip key={item.day} title={label} placement="top" arrow>
                  <Box
                    tabIndex={0}
                    role="img"
                    aria-label={label}
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-end',
                      alignItems: 'center',
                      cursor: 'default',
                      borderRadius: 1,
                      outline: 'none',
                      '&:hover > span, &:focus-visible > span': { filter: 'brightness(1.18)' },
                      '&:focus-visible': { boxShadow: `0 0 0 2px ${theme.palette.primary.main}` },
                    }}
                  >
                    {item === peak && item.total > 0 && (
                      <Typography variant="caption" sx={{ fontWeight: 700, mb: 0.25, whiteSpace: 'nowrap' }}>
                        {money(item.total, lang)}
                      </Typography>
                    )}
                    <Box
                      component="span"
                      sx={{
                        display: 'block',
                        width: 'min(24px, 70%)',
                        height: `${(item.total / top) * 100}%`,
                        minHeight: item.total > 0 ? 2 : 0,
                        bgcolor: BAR[theme.palette.mode],
                        borderRadius: '4px 4px 0 0',
                        transition: 'filter 120ms ease',
                      }}
                    />
                  </Box>
                </Tooltip>
              );
            })}
          </Box>
        </Box>
        {/* Вісь X: число місяця; сьогоднішній день виділено. */}
        <Box aria-hidden sx={{ display: 'grid', gridTemplateColumns: `repeat(${days.length}, 1fr)`, gap: '2px', mt: 0.5 }}>
          {days.map((item) => (
            <Typography
              key={item.day}
              variant="caption"
              sx={{ textAlign: 'center', color: item.day === today ? 'text.primary' : 'text.secondary', fontWeight: item.day === today ? 800 : 400, fontSize: '0.7rem' }}
            >
              {dayLabel(item.day, lang, { day: 'numeric' })}
            </Typography>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

/**
 * Аналітика фермера: виторг доставлених замовлень, сума замовлень у роботі, середній чек, частка втрачених замовлень,
 * сума замовлень за днями доставки (два тижні назад і тиждень наперед) і найпопулярніші товари.
 */
export function FarmerStatsPage() {
  const { t } = useTranslation();
  const { lang, pick } = useLang();
  const theme = useTheme();
  const orders = useFarmerOrders();
  const [table, setTable] = useState(false);
  const list = orders.data ?? [];
  const summary = kpis(list);
  const now = new Date();
  const days = revenueByDay(list, now);
  const today = days[13]?.day ?? '';
  const products = topProducts(list);
  const bestRevenue = products[0]?.revenue ?? 0;

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      <Typography component="h1" variant="h4" sx={{ mb: 2, fontSize: { xs: '1.6rem', sm: '2.1rem' } }}>
        {t('stats.title')}
      </Typography>
      {orders.isPending && <CircularProgress aria-label={t('common.loading')} />}
      {orders.isError && <Alert severity="error">{errorMessage(orders.error)}</Alert>}
      {orders.isSuccess && list.length === 0 && <EmptyState icon={<InsightsOutlinedIcon />} title={t('stats.empty')} />}

      {list.length > 0 && (
        <>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, mb: 2 }}>
            <StatTile label={t('stats.revenue')} value={money(summary.revenue, lang)} />
            <StatTile label={t('stats.expected')} value={money(summary.expected, lang)} />
            <StatTile label={t('stats.averageOrder')} value={money(summary.averageOrder, lang)} />
            <StatTile label={t('stats.lostShare')} value={`${Math.round(summary.lostShare * 100)} %`} />
          </Box>

          <Paper component="section" elevation={1} aria-labelledby="stats-days" sx={{ p: { xs: 2, sm: 2.5 }, mb: 2 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 1, mb: 2 }}>
              <Box sx={{ mr: 'auto' }}>
                <Typography id="stats-days" component="h2" variant="h6">
                  {t('stats.byDay')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('stats.byDayHint')}
                </Typography>
              </Box>
              <Button size="small" onClick={() => setTable((value) => !value)} aria-pressed={table}>
                {t(table ? 'stats.showChart' : 'stats.showTable')}
              </Button>
            </Box>
            {table ? (
              <Table size="small" aria-labelledby="stats-days">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('stats.day')}</TableCell>
                    <TableCell align="right">{t('stats.ordersColumn')}</TableCell>
                    <TableCell align="right">{t('stats.sum')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {days.map((item) => (
                    <TableRow key={item.day} selected={item.day === today}>
                      <TableCell>{dayLabel(item.day, lang, { weekday: 'short', day: 'numeric', month: 'short' })}</TableCell>
                      <TableCell align="right">{item.orders}</TableCell>
                      <TableCell align="right">{formatMoney(item.total, lang)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <RevenueChart days={days} today={today} />
            )}
          </Paper>

          <Paper component="section" elevation={1} aria-labelledby="stats-top" sx={{ p: { xs: 2, sm: 2.5 } }}>
            <Typography id="stats-top" component="h2" variant="h6" sx={{ mb: 1.5 }}>
              {t('stats.topProducts')}
            </Typography>
            <Box component="ol" sx={{ listStyle: 'none', p: 0, m: 0, display: 'grid', gap: 1.25 }}>
              {products.map((product) => (
                <Box component="li" key={product.productId} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '200px 1fr' }, gap: { xs: 0.5, sm: 2 }, alignItems: 'center' }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pick(product.name)}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {product.quantity} × {pick(product.unit)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                      aria-hidden
                      sx={{ height: 20, width: `${bestRevenue > 0 ? (product.revenue / bestRevenue) * 75 : 0}%`, minWidth: 4, bgcolor: BAR[theme.palette.mode], borderRadius: '0 4px 4px 0' }}
                    />
                    <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {formatMoney(product.revenue, lang)}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Paper>
        </>
      )}
    </Box>
  );
}
