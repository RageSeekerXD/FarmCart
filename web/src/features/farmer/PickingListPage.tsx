import ChecklistOutlinedIcon from '@mui/icons-material/ChecklistOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import { Alert, Box, Button, Checkbox, Chip, CircularProgress, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorMessage, useLang } from '../../i18n';
import { formatSlot } from '../../shared/dates';
import { EmptyState } from '../../shared/pages';
import { PrintArea, printTableSx } from '../../shared/Print';
import { useFarmerOrders, useFarmerProfile } from './api';
import { pickList, slotsToPack, type PickLine, type SlotGroup } from './stats';

function PrintablePickList({ group, lines, farmName }: { group: SlotGroup; lines: PickLine[]; farmName: string }) {
  const { t } = useTranslation();
  const { lang, pick } = useLang();
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '2px solid #000', pb: 1, mb: 2 }}>
        <Typography sx={{ fontSize: 22, fontWeight: 800 }}>{t('picking.printTitle', { slot: formatSlot(group.start, group.end, lang) })}</Typography>
        <Typography sx={{ fontSize: 14 }}>FarmCart · {farmName}</Typography>
      </Box>
      <Box component="table" sx={printTableSx}>
        <thead>
          <tr>
            <th style={{ width: 28 }}>✓</th>
            <th>{t('cart.product')}</th>
            <th>{t('cart.quantity')}</th>
            <th>{t('picking.orders')}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.productId}>
              <td>☐</td>
              <td>{pick(line.name)}</td>
              <td>
                <strong>{line.quantity}</strong> × {pick(line.unit)}
              </td>
              <td>{line.orderIds.map((id) => `№${id}`).join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </Box>
    </Box>
  );
}

/**
 * Лист збирання на слот доставки: скільки кожного товару підготувати (наприклад, 9 хлібин житніх на вт 10:00-12:00)
 * і для яких замовлень. Позначки «зібрано» - лише на цьому екрані; лист можна надрукувати.
 */
export function PickingListPage() {
  const { t } = useTranslation();
  const { lang, pick } = useLang();
  const orders = useFarmerOrders();
  const profile = useFarmerProfile();
  const groups = slotsToPack(orders.data ?? []);
  const [chosen, setChosen] = useState<string | null>(null);
  const [packed, setPacked] = useState<ReadonlySet<string>>(new Set());
  const [printing, setPrinting] = useState(false);
  const group = groups.find((item) => item.start === chosen) ?? groups[0] ?? null;
  const lines = group ? pickList(group) : [];
  const key = (line: PickLine) => `${group?.start}:${line.productId}`;

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <Typography component="h1" variant="h4" sx={{ mr: 'auto', fontSize: { xs: '1.6rem', sm: '2.1rem' } }}>
          {t('picking.title')}
        </Typography>
        {group && (
          <Button variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={() => setPrinting(true)}>
            {t('picking.print')}
          </Button>
        )}
      </Box>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {t('picking.subtitle')}
      </Typography>

      {orders.isPending && <CircularProgress aria-label={t('common.loading')} />}
      {orders.isError && <Alert severity="error">{errorMessage(orders.error)}</Alert>}
      {orders.isSuccess && groups.length === 0 && <EmptyState icon={<ChecklistOutlinedIcon />} title={t('picking.empty')} hint={t('picking.emptyHint')} />}

      {groups.length > 0 && (
        <Stack direction="row" spacing={1} useFlexGap role="group" aria-label={t('picking.slots')} sx={{ flexWrap: 'wrap', mb: 2 }}>
          {groups.map((item) => {
            const active = item.start === group?.start;
            return (
              <Chip
                key={item.start}
                clickable
                aria-pressed={active}
                color={active ? 'primary' : 'default'}
                variant={active ? 'filled' : 'outlined'}
                onClick={() => setChosen(item.start)}
                label={`${formatSlot(item.start, item.end, lang)} · ${t('picking.ordersCount', { count: item.orders.length })}`}
                sx={{ fontWeight: 600, bgcolor: active ? undefined : 'background.paper' }}
              />
            );
          })}
        </Stack>
      )}

      {group && (
        <Paper elevation={1} sx={{ overflowX: 'auto' }}>
          <Table aria-label={t('picking.tableLabel', { slot: formatSlot(group.start, group.end, lang) })}>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Box component="span" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
                    {t('picking.packed')}
                  </Box>
                </TableCell>
                <TableCell>{t('cart.product')}</TableCell>
                <TableCell align="right">{t('picking.total')}</TableCell>
                <TableCell>{t('picking.orders')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lines.map((line) => {
                const done = packed.has(key(line));
                return (
                  <TableRow key={line.productId} sx={{ opacity: done ? 0.55 : 1 }}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={done}
                        onChange={() =>
                          setPacked((current) => {
                            const next = new Set(current);
                            if (!next.delete(key(line))) {
                              next.add(key(line));
                            }

                            return next;
                          })
                        }
                        slotProps={{ input: { 'aria-label': t('picking.packedNamed', { name: pick(line.name) }) } }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, textDecoration: done ? 'line-through' : 'none' }}>{pick(line.name)}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Typography component="span" sx={{ fontWeight: 800, fontSize: '1.1rem' }}>
                        {line.quantity}
                      </Typography>{' '}
                      × {pick(line.unit)}
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{line.orderIds.map((id) => `№${id}`).join(', ')}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Paper>
      )}

      {printing && group && (
        <PrintArea onDone={() => setPrinting(false)}>
          <PrintablePickList group={group} lines={lines} farmName={profile.data ? pick(profile.data.name) : ''} />
        </PrintArea>
      )}
    </Box>
  );
}
