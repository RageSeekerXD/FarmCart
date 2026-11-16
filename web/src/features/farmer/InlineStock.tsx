import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { Box, FormControlLabel, IconButton, Switch, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { Product } from '../../api/types';
import { errorMessage, useLang } from '../../i18n';
import { useToast } from '../../shared/Toast';
import { LOW_STOCK } from '../catalog/categoryLook';
import { useChangeStock } from './api';

const RESTOCK_KEY = (productId: number) => `farmcart.restock.${productId}`;

/** Залишок до вимкнення «у продажу»: увімкнення повертає його, а не нуль чи довільне число. */
function remembered(productId: number): number {
  try {
    const value = Number(localStorage.getItem(RESTOCK_KEY(productId)));
    return Number.isInteger(value) && value > 0 ? value : 1;
  } catch {
    return 1;
  }
}

function remember(productId: number, stock: number) {
  try {
    localStorage.setItem(RESTOCK_KEY(productId), String(stock));
  } catch {
    // Без сховища увімкнення поверне 1 - залишок легко підправити кнопкою «+».
  }
}

/**
 * Залишок прямо в рядку товару: «− N +» і перемикач «у продажу». Фермер на ринку чи біля печі змінює залишок
 * одним дотиком, не відкриваючи форму товару; вимкнений товар зникає з каталогу (залишок 0).
 */
export function InlineStock({ product }: { product: Product }) {
  const { t } = useTranslation();
  const { pick } = useLang();
  const toast = useToast();
  const change = useChangeStock();
  const name = pick(product.name);
  const busy = change.isPending;
  const low = product.stock > 0 && product.stock <= LOW_STOCK;

  const apply = (delta: number) =>
    change.mutate({ id: product.id, delta }, { onError: (error) => toast.show(errorMessage(error), 'error') });

  const toggle = (onSale: boolean) => {
    if (onSale) {
      apply(remembered(product.id));
    } else {
      remember(product.id, product.stock);
      apply(-product.stock);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: { xs: 'flex-start', sm: 'flex-end' }, gap: 0.25 }}>
      <Box role="group" aria-label={t('farm.stockOf', { name, count: product.stock })} sx={{ display: 'inline-flex', alignItems: 'center', border: 1, borderColor: 'divider', borderRadius: 5, opacity: busy ? 0.7 : 1 }}>
        <IconButton size="small" aria-label={t('farm.stockLess', { name })} disabled={busy || product.stock === 0} onClick={() => apply(-1)}>
          <RemoveIcon fontSize="small" />
        </IconButton>
        <Typography
          aria-hidden
          sx={{ minWidth: 40, textAlign: 'center', fontWeight: 700, color: product.stock === 0 ? 'error.main' : low ? 'warning.dark' : 'text.primary' }}
        >
          {product.stock}
        </Typography>
        <IconButton size="small" aria-label={t('farm.stockMore', { name })} disabled={busy} onClick={() => apply(1)}>
          <AddIcon fontSize="small" />
        </IconButton>
      </Box>
      <FormControlLabel
        sx={{ mr: 0, '& .MuiFormControlLabel-label': { fontSize: '0.8125rem', color: product.stock === 0 ? 'error.main' : 'text.secondary' } }}
        labelPlacement="start"
        control={
          <Switch
            size="small"
            checked={product.stock > 0}
            disabled={busy}
            onChange={(event) => toggle(event.target.checked)}
            slotProps={{ input: { 'aria-label': t('farm.onSaleNamed', { name }) } }}
          />
        }
        label={product.stock > 0 ? t('farm.onSale') : t('farm.outOfStock')}
      />
    </Box>
  );
}
