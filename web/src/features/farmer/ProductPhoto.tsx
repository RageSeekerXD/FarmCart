import AddAPhotoOutlinedIcon from '@mui/icons-material/AddAPhotoOutlined';
import CloseIcon from '@mui/icons-material/Close';
import { Box, CircularProgress, IconButton, Tooltip } from '@mui/material';
import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Product } from '../../api/types';
import { errorMessage, useLang } from '../../i18n';
import { useToast } from '../../shared/Toast';
import { artFor } from '../catalog/art/artFor';
import { ProductArt } from '../catalog/art/ProductArt';
import { artBackground, type CategoryLook } from '../catalog/categoryLook';
import { PHOTO_MAX_BYTES, PHOTO_TYPES, useProductPhoto } from './api';

/**
 * Фото товару в кабінеті фермера (п. 5 покращень): мініатюра з кнопками «додати/замінити» й «прибрати».
 * Тип і розмір перевіряються ще до надсилання, щоб не чекати на відмову сервера.
 */
export function ProductPhoto({ product, look }: { product: Product; look: CategoryLook }) {
  const { t } = useTranslation();
  const { pick } = useLang();
  const toast = useToast();
  const photo = useProductPhoto();
  const name = pick(product.name);

  const upload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    if (!PHOTO_TYPES.includes(file.type)) {
      toast.show(t('errors.photo_type_invalid'), 'error');
      return;
    }

    if (file.size > PHOTO_MAX_BYTES) {
      toast.show(t('errors.photo_too_large'), 'error');
      return;
    }

    photo.mutate(
      { id: product.id, file },
      { onSuccess: () => toast.show(t('farm.photoSaved', { name })), onError: (error) => toast.show(errorMessage(error), 'error') },
    );
  };

  return (
    <Box sx={{ position: 'relative', width: 64, height: 64, flexShrink: 0 }}>
      {product.photoUrl ? (
        <Box component="img" src={product.photoUrl} alt="" sx={{ width: 64, height: 64, borderRadius: 2, objectFit: 'cover', display: 'block' }} />
      ) : (
        <Box
          aria-hidden
          sx={{ width: 64, height: 64, p: 0.75, borderRadius: 2, display: 'grid', placeItems: 'center', background: (theme) => artBackground(look.tint, theme.palette.mode) }}
        >
          <ProductArt art={artFor(product.name, product.category)} />
        </Box>
      )}
      {photo.isPending && (
        <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', bgcolor: 'rgba(0,0,0,0.35)', borderRadius: 2 }}>
          <CircularProgress size={24} sx={{ color: '#fff' }} aria-label={t('common.loading')} />
        </Box>
      )}
      <Tooltip title={t(product.photoUrl ? 'farm.photoReplace' : 'farm.photoAdd')}>
        <IconButton
          component="label"
          size="small"
          aria-label={t(product.photoUrl ? 'farm.photoReplaceNamed' : 'farm.photoAddNamed', { name })}
          disabled={photo.isPending}
          sx={{ position: 'absolute', right: -8, bottom: -8, bgcolor: 'background.paper', boxShadow: 2, '&:hover': { bgcolor: 'background.paper' } }}
        >
          <AddAPhotoOutlinedIcon sx={{ fontSize: 16 }} />
          <input hidden type="file" accept={PHOTO_TYPES.join(',')} onChange={upload} />
        </IconButton>
      </Tooltip>
      {product.photoUrl && (
        <Tooltip title={t('farm.photoRemove')}>
          <IconButton
            size="small"
            aria-label={t('farm.photoRemoveNamed', { name })}
            disabled={photo.isPending}
            onClick={() =>
              photo.mutate(
                { id: product.id, file: null },
                { onSuccess: () => toast.show(t('farm.photoRemoved', { name }), 'info'), onError: (error) => toast.show(errorMessage(error), 'error') },
              )
            }
            sx={{ position: 'absolute', right: -8, top: -8, bgcolor: 'background.paper', boxShadow: 2, p: 0.25, '&:hover': { bgcolor: 'background.paper' } }}
          >
            <CloseIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}
