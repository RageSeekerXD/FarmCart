import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import { Alert, Box, Button, Chip, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Product } from '../../api/types';
import { errorMessage, formatMoney, useLang } from '../../i18n';
import { useToast } from '../../shared/Toast';
import { useFarmerProfile, useMyProducts, useReference } from './api';
import { ProductDialog, monthName } from './ProductDialog';

/** UI-08: товари фермера. Публікувати можна після верифікації господарства адміністратором. */
export function FarmerProductsPage() {
  const { t } = useTranslation();
  const { lang, pick } = useLang();
  const toast = useToast();
  const profile = useFarmerProfile();
  const products = useMyProducts();
  const reference = useReference();
  const [editing, setEditing] = useState<Product | 'new' | null>(null);

  const error = profile.error ?? products.error ?? reference.error;
  const categoryTitle = (code: string) => {
    const item = reference.data?.categories.find((category) => category.code === code);
    return item ? pick(item.title) : code;
  };

  return (
    <Box sx={{ maxWidth: 860, mx: 'auto' }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Typography component="h1" variant="h4" sx={{ mr: 'auto', fontSize: { xs: '1.6rem', sm: '2.1rem' } }}>
          {t('nav.farmerProducts')}
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} disabled={!profile.data?.verified || !reference.data} onClick={() => setEditing('new')}>
          {t('farm.addProduct')}
        </Button>
      </Box>

      {error && <Alert severity="error">{errorMessage(error)}</Alert>}
      {(profile.isPending || products.isPending) && !error && <CircularProgress aria-label={t('common.loading')} />}

      {profile.data && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography component="h2" variant="h6">
            {pick(profile.data.name)}
          </Typography>
          <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', mt: 1 }}>
            <Chip size="small" color={profile.data.verified ? 'success' : 'warning'} label={t(profile.data.verified ? 'farm.verified' : 'farm.pending')} />
            {profile.data.certified && <Chip size="small" variant="outlined" color="success" label={t('catalog.organic')} />}
          </Stack>
          {!profile.data.verified && (
            <Alert severity="info" sx={{ mt: 1.5 }}>
              {t('farm.pendingHint')}
            </Alert>
          )}
        </Paper>
      )}

      {products.data?.length === 0 && profile.data?.verified && <Typography color="text.secondary">{t('farm.noProducts')}</Typography>}

      <Stack component="ul" spacing={1.5} sx={{ listStyle: 'none', p: 0, m: 0 }}>
        {products.data?.map((product) => (
          <Paper component="li" key={product.id} aria-label={pick(product.name)} sx={{ p: 2, display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
            <Box sx={{ flex: '1 1 240px', minWidth: 0 }}>
              <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 600 }}>
                {pick(product.name)}
              </Typography>
              {/* Фермер бачить обидві назви: друга мова - та, якою товар побачать інші покупці. */}
              <Typography variant="body2" color="text.secondary" lang={lang === 'uk' ? 'en' : 'uk'}>
                {lang === 'uk' ? product.name.en : product.name.uk}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {categoryTitle(product.category)} ·{' '}
                {product.seasonMonths.length === 0 ? t('farm.allYear') : product.seasonMonths.map((month) => monthName(month, lang)).join(', ')}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right', minWidth: 120 }}>
              <Typography sx={{ fontWeight: 600 }}>
                {formatMoney(product.price, lang)}{' '}
                <Typography component="span" variant="body2" color="text.secondary">
                  {t('catalog.perUnit', { unit: pick(product.unit) })}
                </Typography>
              </Typography>
              <Typography variant="body2" color={product.stock === 0 ? 'error' : 'text.secondary'}>
                {product.stock === 0 ? t('farm.outOfStock') : t('catalog.inStock', { count: product.stock })}
              </Typography>
            </Box>
            <Button size="small" startIcon={<EditIcon />} disabled={!reference.data} onClick={() => setEditing(product)} aria-label={t('farm.editNamed', { name: pick(product.name) })}>
              {t('common.edit')}
            </Button>
          </Paper>
        ))}
      </Stack>

      {editing !== null && reference.data && (
        <ProductDialog
          key={editing === 'new' ? 'new' : editing.id}
          product={editing === 'new' ? null : editing}
          reference={reference.data}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null);
            toast.show(t('farm.saved', { name: pick(saved.name) }));
          }}
        />
      )}
    </Box>
  );
}
