import FavoriteIcon from '@mui/icons-material/Favorite';
import { alpha, Box, Chip, Divider } from '@mui/material';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReferenceItem } from '../../api/types';
import { useLang } from '../../i18n';
import { CATEGORY_ICON } from './art/artFor';
import { ProductArt } from './art/ProductArt';

function Pill({ selected, icon, label, onClick }: { selected: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <Chip
      clickable
      icon={<Box sx={{ display: 'grid', placeItems: 'center', width: 24, height: 24 }}>{icon}</Box>}
      label={label}
      aria-pressed={selected}
      onClick={onClick}
      color={selected ? 'primary' : 'default'}
      variant={selected ? 'filled' : 'outlined'}
      sx={{
        flexShrink: 0,
        height: 40,
        borderRadius: 20,
        px: 0.5,
        fontSize: '0.9rem',
        fontWeight: 600,
        bgcolor: selected ? undefined : 'background.paper',
        borderColor: selected ? undefined : 'divider',
        boxShadow: selected ? (theme) => `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}` : 'none',
        '& .MuiChip-icon': { ml: 0.5, mr: -0.25, color: 'inherit' },
        '&:hover': { borderColor: 'primary.main' },
      }}
    />
  );
}

interface Props {
  categories: readonly ReferenceItem[];
  /** Код обраної категорії; '' - усі. */
  value: string;
  onChange: (category: string) => void;
  favorites: { active: boolean; count: number; onToggle: () => void };
}

/**
 * Швидкі фільтри каталогу: категорії рядком «пігулок» з ілюстраціями замість випадного списку -
 * до потрібних товарів одне натискання. На вузькому екрані рядок гортається вбік, а не переноситься.
 */
export function CategoryPills({ categories, value, onChange, favorites }: Props) {
  const { t } = useTranslation();
  const { pick } = useLang();
  return (
    <Box
      role="group"
      aria-label={t('catalog.category')}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        overflowX: 'auto',
        py: 0.75,
        mb: 1.5,
        // На телефоні рядок гортається від краю до краю екрана.
        mx: { xs: -1.5, sm: 0 },
        px: { xs: 1.5, sm: 0 },
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
      }}
    >
      <Pill selected={value === ''} icon={<ProductArt art="basket:all" size={24} />} label={t('catalog.all')} onClick={() => onChange('')} />
      {categories.map((category) => (
        <Pill
          key={category.code}
          selected={value === category.code}
          icon={<ProductArt art={CATEGORY_ICON[category.code] ?? `basket:${category.code}`} size={24} />}
          label={pick(category.title)}
          onClick={() => onChange(value === category.code ? '' : category.code)}
        />
      ))}
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 1 }} />
      <Pill
        selected={favorites.active}
        icon={<FavoriteIcon sx={{ fontSize: 20, color: favorites.active ? 'inherit' : '#e53935' }} />}
        label={favorites.count > 0 ? `${t('catalog.favorites')} · ${favorites.count}` : t('catalog.favorites')}
        onClick={favorites.onToggle}
      />
    </Box>
  );
}
