import AddIcon from '@mui/icons-material/Add';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import EditIcon from '@mui/icons-material/Edit';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import VerifiedIcon from '@mui/icons-material/Verified';
import { alpha, Alert, Box, Button, Chip, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { FarmerProfile, Product } from '../../api/types';
import { errorMessage, formatMoney, useLang } from '../../i18n';
import { enter } from '../../shared/motion';
import { EmptyState } from '../../shared/pages';
import { useToast } from '../../shared/Toast';
import { categoryLook } from '../catalog/categoryLook';
import { useFarmerProfile, useMyProducts, useReference } from './api';
import { DocumentsDialog } from './DocumentsDialog';
import { FarmProfileDialog } from './FarmProfileDialog';
import { InlineStock } from './InlineStock';
import { ProductDialog, monthName } from './ProductDialog';
import { ProductPhoto } from './ProductPhoto';

/** UI-08: товари фермера. Публікувати можна після верифікації господарства адміністратором. */
export function FarmerProductsPage() {
  const { t } = useTranslation();
  const { lang, pick } = useLang();
  const toast = useToast();
  const profile = useFarmerProfile();
  const products = useMyProducts();
  const reference = useReference();
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [dialog, setDialog] = useState<'profile' | 'documents' | null>(null);
  const queryClient = useQueryClient();
  const reapply = useMutation({
    mutationFn: () => api<FarmerProfile>('/farmer/reapply', { method: 'POST', body: {} }),
    onSuccess: (farm) => {
      queryClient.setQueryData(['farmer', 'profile'], farm);
      void queryClient.invalidateQueries({ queryKey: ['farmer', 'profile'] });
      toast.show(t('farm.reapplied'));
    },
    onError: (error) => toast.show(errorMessage(error), 'error'),
  });

  const error = profile.error ?? products.error ?? reference.error;
  const canAdd = Boolean(profile.data?.verified && reference.data);
  const categoryTitle = (code: string) => {
    const item = reference.data?.categories.find((category) => category.code === code);
    return item ? pick(item.title) : code;
  };

  const addButton = (
    <Button variant="contained" startIcon={<AddIcon />} disabled={!canAdd} onClick={() => setEditing('new')}>
      {t('farm.addProduct')}
    </Button>
  );

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Typography component="h1" variant="h4" sx={{ mr: 'auto', fontSize: { xs: '1.6rem', sm: '2.1rem' } }}>
          {t('nav.farmerProducts')}
        </Typography>
        {addButton}
      </Box>

      {error && <Alert severity="error">{errorMessage(error)}</Alert>}
      {(profile.isPending || products.isPending) && !error && <CircularProgress aria-label={t('common.loading')} />}

      {profile.data && (
        <Paper
          elevation={1}
          sx={{ p: { xs: 2, sm: 2.5 }, mb: 2, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, background: (theme) => `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${alpha(theme.palette.primary.main, 0.1)} 100%)` }}
        >
          <Box aria-hidden sx={{ width: 56, height: 56, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 30, bgcolor: 'background.paper', boxShadow: 1 }}>
            🌾
          </Box>
          <Box sx={{ flex: '1 1 220px', minWidth: 0 }}>
            <Typography component="h2" variant="h6">
              {pick(profile.data.name)}
            </Typography>
            <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', mt: 0.5 }}>
              <Chip
                size="small"
                color={profile.data.verified ? 'success' : profile.data.rejectionReason ? 'error' : 'warning'}
                icon={profile.data.verified ? <VerifiedIcon /> : undefined}
                label={t(profile.data.verified ? 'farm.verified' : profile.data.rejectionReason ? 'farm.rejectedChip' : 'farm.pending')}
              />
              {profile.data.certified && <Chip size="small" variant="outlined" color="success" label={t('catalog.organic')} />}
              {products.data && <Chip size="small" variant="outlined" label={t('farm.productsCount', { count: products.data.length })} sx={{ bgcolor: 'background.paper' }} />}
            </Stack>
          </Box>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
            <Button size="small" variant="outlined" startIcon={<StorefrontOutlinedIcon />} onClick={() => setDialog('profile')} sx={{ bgcolor: 'background.paper' }}>
              {t('farm.profileButton')}
            </Button>
            <Button size="small" variant="outlined" startIcon={<DescriptionOutlinedIcon />} onClick={() => setDialog('documents')} sx={{ bgcolor: 'background.paper' }}>
              {t('farm.documentsButton', { count: profile.data.documentCount })}
            </Button>
          </Stack>
          {!profile.data.verified && !profile.data.rejectionReason && (
            <Alert
              severity="info"
              sx={{ flexBasis: '100%' }}
              action={
                profile.data.documentCount === 0 && (
                  <Button color="inherit" size="small" onClick={() => setDialog('documents')}>
                    {t('farm.documentUpload')}
                  </Button>
                )
              }
            >
              {t('farm.pendingHint')} {profile.data.documentCount === 0 && t('farm.uploadDocumentsHint')}
            </Alert>
          )}
          {profile.data.rejectionReason && (
            // Заявку відхилено (п. 6 покращень): фермер бачить причину й може подати заявку повторно.
            <Alert
              severity="error"
              sx={{ flexBasis: '100%' }}
              action={
                <Button color="inherit" size="small" loading={reapply.isPending} onClick={() => reapply.mutate()}>
                  {t('farm.reapply')}
                </Button>
              }
            >
              {t('farm.rejected', { reason: profile.data.rejectionReason })}
            </Alert>
          )}
        </Paper>
      )}

      {products.data?.length === 0 && profile.data?.verified && <EmptyState icon={<Inventory2OutlinedIcon />} title={t('farm.noProducts')} />}

      <Stack component="ul" spacing={1.5} sx={{ listStyle: 'none', p: 0, m: 0 }}>
        {products.data?.map((product, index) => {
          const look = categoryLook(product.category);
          return (
            <Paper
              component="li"
              key={product.id}
              aria-label={pick(product.name)}
              elevation={1}
              sx={{
                p: 1.5,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 2,
                alignItems: 'center',
                opacity: product.stock === 0 ? 0.8 : 1,
                transition: 'box-shadow 200ms ease',
                '&:hover': { boxShadow: 4 },
                ...enter(index),
              }}
            >
              <ProductPhoto product={product} look={look} />
              <Box sx={{ flex: '1 1 220px', minWidth: 0 }}>
                <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 650, lineHeight: 1.3 }}>
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
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: { xs: 'flex-start', sm: 'flex-end' }, gap: 0.5, minWidth: 140 }}>
                <Typography sx={{ fontWeight: 700 }}>
                  {formatMoney(product.price, lang)}{' '}
                  <Typography component="span" variant="body2" color="text.secondary" sx={{ fontWeight: 400 }}>
                    {t('catalog.perUnit', { unit: pick(product.unit) })}
                  </Typography>
                </Typography>
                <InlineStock product={product} />
              </Box>
              <Button
                variant="outlined"
                size="small"
                startIcon={<EditIcon />}
                disabled={!reference.data}
                onClick={() => setEditing(product)}
                aria-label={t('farm.editNamed', { name: pick(product.name) })}
              >
                {t('common.edit')}
              </Button>
            </Paper>
          );
        })}
      </Stack>

      {dialog === 'profile' && profile.data && (
        <FarmProfileDialog
          profile={profile.data}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            toast.show(t('farm.profileSaved'));
          }}
        />
      )}
      {dialog === 'documents' && <DocumentsDialog onClose={() => setDialog(null)} />}

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
