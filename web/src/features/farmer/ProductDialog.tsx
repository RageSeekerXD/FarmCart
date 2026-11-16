import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormHelperText,
  FormLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Lang, Product, ProductDraft, ReferenceData } from '../../api/types';
import { errorMessage, useLang } from '../../i18n';
import { useSaveProduct } from './api';

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export function monthName(month: number, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-GB', { month: 'short' }).format(new Date(2026, month - 1, 15));
}

interface Props {
  /** null - новий товар. */
  product: Product | null;
  reference: ReferenceData;
  onClose: () => void;
  onSaved: (product: Product) => void;
}

/** UI-08: форма товару - назва українською й англійською, категорія й одиниця з довідників, ціна, залишок, сезон. */
export function ProductDialog({ product, reference, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const { lang, pick } = useLang();
  const save = useSaveProduct();

  const [nameUk, setNameUk] = useState(product?.name.uk ?? '');
  const [nameEn, setNameEn] = useState(product?.name.en ?? '');
  const [category, setCategory] = useState(product?.category ?? '');
  const [unit, setUnit] = useState(product?.unitCode ?? '');
  const [price, setPrice] = useState(product ? String(product.price) : '');
  const [stock, setStock] = useState(product ? String(product.stock) : '');
  const [season, setSeason] = useState<number[]>(product?.seasonMonths ?? []);
  const [descriptionUk, setDescriptionUk] = useState(product?.description?.uk ?? '');
  const [descriptionEn, setDescriptionEn] = useState(product?.description?.en ?? '');
  // Склад, термін придатності й умови зберігання - для сторінки товару; як і опис, обома мовами або жодною.
  const [facts, setFacts] = useState(() => ({
    composition: { uk: product?.composition?.uk ?? '', en: product?.composition?.en ?? '' },
    shelfLife: { uk: product?.shelfLife?.uk ?? '', en: product?.shelfLife?.en ?? '' },
    storage: { uk: product?.storage?.uk ?? '', en: product?.storage?.en ?? '' },
  }));
  const [touched, setTouched] = useState(false);
  const factIncomplete = (key: keyof typeof facts) => (facts[key].uk.trim() === '') !== (facts[key].en.trim() === '');
  const setFact = (key: keyof typeof facts, lang: 'uk' | 'en', value: string) =>
    setFacts((current) => ({ ...current, [key]: { ...current[key], [lang]: value } }));

  const priceValue = Number(price.replace(',', '.'));
  const stockValue = Number(stock);
  const invalid = {
    nameUk: nameUk.trim() === '',
    nameEn: nameEn.trim() === '',
    category: category === '',
    unit: unit === '',
    price: price.trim() === '' || !Number.isFinite(priceValue) || priceValue <= 0,
    stock: stock.trim() === '' || !Number.isInteger(stockValue) || stockValue < 0,
    // Опис необов'язковий, але якщо є - обома мовами (як і на сервері, description_incomplete).
    description: (descriptionUk.trim() === '') !== (descriptionEn.trim() === ''),
    facts: factIncomplete('composition') || factIncomplete('shelfLife') || factIncomplete('storage'),
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (Object.values(invalid).some(Boolean)) {
      return;
    }

    const draft: ProductDraft = {
      name: { uk: nameUk.trim(), en: nameEn.trim() },
      category,
      unit,
      price: priceValue,
      stock: stockValue,
      seasonMonths: [...season].sort((a, b) => a - b),
      description: { uk: descriptionUk.trim(), en: descriptionEn.trim() },
      composition: { uk: facts.composition.uk.trim(), en: facts.composition.en.trim() },
      shelfLife: { uk: facts.shelfLife.uk.trim(), en: facts.shelfLife.en.trim() },
      storage: { uk: facts.storage.uk.trim(), en: facts.storage.en.trim() },
    };
    save.mutate({ id: product?.id ?? null, draft }, { onSuccess: onSaved });
  };

  const toggle = (month: number) =>
    setSeason((months) => (months.includes(month) ? months.filter((item) => item !== month) : [...months, month]));

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="product-dialog-title">
      <form onSubmit={submit} noValidate>
        <DialogTitle id="product-dialog-title">{t(product ? 'farm.editProduct' : 'farm.newProduct')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label={t('farm.productNameUk')}
              required
              autoFocus
              value={nameUk}
              onChange={(event) => setNameUk(event.target.value)}
              error={touched && invalid.nameUk}
              helperText={touched && invalid.nameUk ? t('farm.nameRequired') : ' '}
              slotProps={{ htmlInput: { lang: 'uk', maxLength: 80 } }}
            />
            <TextField
              label={t('farm.productNameEn')}
              required
              value={nameEn}
              onChange={(event) => setNameEn(event.target.value)}
              error={touched && invalid.nameEn}
              helperText={touched && invalid.nameEn ? t('farm.nameRequired') : t('farm.nameEnHint')}
              slotProps={{ htmlInput: { lang: 'en', maxLength: 80 } }}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                select
                fullWidth
                required
                label={t('catalog.category')}
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                disabled={product !== null}
                error={touched && invalid.category}
                helperText={touched && invalid.category ? t('farm.chooseFromList') : ' '}
              >
                {reference.categories.map((item) => (
                  <MenuItem key={item.code} value={item.code}>
                    {pick(item.title)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                fullWidth
                required
                label={t('farm.unit')}
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
                disabled={product !== null}
                error={touched && invalid.unit}
                helperText={touched && invalid.unit ? t('farm.chooseFromList') : ' '}
              >
                {reference.units.map((item) => (
                  <MenuItem key={item.code} value={item.code}>
                    {pick(item.title)}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                fullWidth
                required
                label={t('farm.price')}
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                error={touched && invalid.price}
                helperText={touched && invalid.price ? t('errors.price_invalid') : ' '}
                slotProps={{ htmlInput: { inputMode: 'decimal' } }}
              />
              <TextField
                fullWidth
                required
                label={t('farm.stock')}
                value={stock}
                onChange={(event) => setStock(event.target.value)}
                error={touched && invalid.stock}
                helperText={touched && invalid.stock ? t('errors.stock_negative') : ' '}
                slotProps={{ htmlInput: { inputMode: 'numeric' } }}
              />
            </Stack>
            <div>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  label={t('farm.descriptionUk')}
                  value={descriptionUk}
                  onChange={(event) => setDescriptionUk(event.target.value)}
                  error={touched && invalid.description && descriptionUk.trim() === ''}
                  slotProps={{ htmlInput: { maxLength: 600 } }}
                />
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  label={t('farm.descriptionEn')}
                  value={descriptionEn}
                  onChange={(event) => setDescriptionEn(event.target.value)}
                  error={touched && invalid.description && descriptionEn.trim() === ''}
                  slotProps={{ htmlInput: { maxLength: 600, lang: 'en' } }}
                />
              </Stack>
              <FormHelperText error={touched && invalid.description} sx={{ mx: 1.75 }}>
                {touched && invalid.description ? t('errors.description_incomplete') : t('farm.descriptionHint')}
              </FormHelperText>
            </div>
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <FormLabel component="legend" sx={{ mb: 1 }}>
                {t('product.facts')}
              </FormLabel>
              <Stack spacing={1.5}>
                {(['composition', 'shelfLife', 'storage'] as const).map((key) => (
                  <Stack key={key} direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                    <TextField
                      fullWidth
                      size="small"
                      label={`${t(`product.${key}`)} (${t('farm.inUkrainian')})`}
                      value={facts[key].uk}
                      onChange={(event) => setFact(key, 'uk', event.target.value)}
                      error={touched && factIncomplete(key) && facts[key].uk.trim() === ''}
                      slotProps={{ htmlInput: { maxLength: 400 } }}
                    />
                    <TextField
                      fullWidth
                      size="small"
                      label={`${t(`product.${key}`)} (${t('farm.inEnglish')})`}
                      value={facts[key].en}
                      onChange={(event) => setFact(key, 'en', event.target.value)}
                      error={touched && factIncomplete(key) && facts[key].en.trim() === ''}
                      slotProps={{ htmlInput: { maxLength: 400, lang: 'en' } }}
                    />
                  </Stack>
                ))}
              </Stack>
              <FormHelperText error={touched && invalid.facts} sx={{ mx: 1.75 }}>
                {touched && invalid.facts ? t('errors.product_details_incomplete') : t('farm.factsHint')}
              </FormHelperText>
            </fieldset>
            <div>
              <FormLabel id="product-season">{t('farm.season')}</FormLabel>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {t('farm.seasonHint')}
              </Typography>
              <Stack direction="row" spacing={0.5} useFlexGap role="group" aria-labelledby="product-season" sx={{ flexWrap: 'wrap' }}>
                {MONTHS.map((month) => {
                  const selected = season.includes(month);
                  return (
                    <Chip
                      key={month}
                      component="button"
                      type="button"
                      clickable
                      label={monthName(month, lang)}
                      color={selected ? 'primary' : 'default'}
                      variant={selected ? 'filled' : 'outlined'}
                      aria-pressed={selected}
                      onClick={() => toggle(month)}
                    />
                  );
                })}
              </Stack>
            </div>
            {save.isError && <Alert severity="error">{errorMessage(save.error)}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" variant="contained" loading={save.isPending}>
            {t('common.save')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
