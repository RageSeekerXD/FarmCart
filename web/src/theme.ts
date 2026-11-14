import { alpha, createTheme, type Shadows, type Theme } from '@mui/material';
import type { Role } from './api/types';
import { EASE_OUT, EASE_SPRING, fadeUp, growWidth, popIn } from './shared/motion';

/** Візуальний стиль ролі: основний колір, градієнт шапки, тло сторінки й емодзі-знак. */
export interface Brand {
  main: string;
  dark: string;
  light: string;
  /** Градієнт шапки. */
  gradient: string;
  /** Тло сторінки під вмістом. */
  background: string;
  emoji: string;
}

declare module '@mui/material/styles' {
  interface Theme {
    brand: Brand;
  }
  interface ThemeOptions {
    brand?: Brand;
  }
}

export type BrandKey = Role | 'Guest';

/**
 * Покупець і гість - зелений «фермерський ринок»; фермер - теплий «урожай»; кур'єр - синій «дорога»;
 * адміністратор - індиго. Білий текст на основному кольорі кожної ролі має контраст не нижче WCAG AA (4,5:1).
 */
const MARKET: Brand = {
  main: '#2e7d32',
  dark: '#1b5e20',
  light: '#4c9a50',
  gradient: 'linear-gradient(120deg, #1b5e20 0%, #2e7d32 55%, #43a047 100%)',
  background: '#f5f6f0',
  emoji: '🧺',
};

export const BRANDS: Record<BrandKey, Brand> = {
  Guest: MARKET,
  Buyer: MARKET,
  Farmer: {
    main: '#a0522d',
    dark: '#6d3a17',
    light: '#c67a3c',
    gradient: 'linear-gradient(120deg, #6d3a17 0%, #a0522d 55%, #c67a3c 100%)',
    background: '#f8f4ee',
    emoji: '🌾',
  },
  Courier: {
    main: '#1565c0',
    dark: '#0d47a1',
    light: '#1e88e5',
    gradient: 'linear-gradient(120deg, #0d47a1 0%, #1565c0 55%, #1e88e5 100%)',
    background: '#f2f5f9',
    emoji: '🚚',
  },
  Admin: {
    main: '#4527a0',
    dark: '#311b92',
    light: '#5e35b1',
    gradient: 'linear-gradient(120deg, #311b92 0%, #4527a0 55%, #5e35b1 100%)',
    background: '#f4f3f8',
    emoji: '🛡️',
  },
};

const BORDER = '#e3e6dc';

/**
 * Рівні 1, 2 і 4 - тонке «кільце» з м'якою тінню замість важких тіней MUI: картки читаються як пласкі
 * поверхні з рамкою, а Alert і інші поверхні з elevation 0 лишаються без рамки. Решта рівнів (меню, діалоги) - типові.
 */
const shadows = [...createTheme().shadows] as Shadows;
shadows[1] = '0 0 0 1px rgba(25, 40, 30, 0.08), 0 1px 3px rgba(25, 40, 30, 0.06)';
shadows[2] = '0 0 0 1px rgba(25, 40, 30, 0.08), 0 2px 6px rgba(25, 40, 30, 0.08)';
shadows[4] = '0 0 0 1px rgba(25, 40, 30, 0.06), 0 10px 24px rgba(25, 40, 30, 0.14)';
shadows[6] = '0 0 0 1px rgba(25, 40, 30, 0.06), 0 14px 32px rgba(25, 40, 30, 0.18)';

/** Тема FarmCart для ролі. Контраст тексту не нижче WCAG AA; рух вимикається, якщо користувач просить менше руху. */
export function createAppTheme(key: BrandKey): Theme {
  const brand = BRANDS[key];
  return createTheme({
    brand,
    palette: {
      primary: { main: brand.main, dark: brand.dark, light: brand.light },
      secondary: { main: '#ffb300' },
      background: { default: brand.background, paper: '#ffffff' },
      text: { primary: '#1d2a1e', secondary: '#55605a' },
      divider: BORDER,
    },
    shape: { borderRadius: 12 },
    shadows,
    typography: {
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      h4: { fontWeight: 700, letterSpacing: '-0.02em' },
      h5: { fontWeight: 700, letterSpacing: '-0.01em' },
      h6: { fontWeight: 650, fontSize: '1.1rem' },
      subtitle1: { fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          '::selection': { background: alpha(brand.main, 0.2) },
          // Заголовок кожної сторінки має короткий кольоровий акцент, що «виростає» при відкритті сторінки.
          '#main h1::after': {
            content: '""',
            display: 'block',
            width: 44,
            height: 4,
            marginTop: 6,
            borderRadius: 4,
            background: brand.gradient,
            animation: `${growWidth} 700ms ${EASE_OUT} 120ms backwards`,
          },
          '@media (prefers-reduced-motion: reduce)': {
            '*, *::before, *::after': {
              animationDuration: '1ms !important',
              animationDelay: '0ms !important',
              animationIterationCount: '1 !important',
              transitionDuration: '1ms !important',
              scrollBehavior: 'auto !important',
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: { outlined: { borderColor: BORDER } },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 10,
            transition: 'transform 120ms ease, box-shadow 200ms ease, background-color 200ms ease, border-color 200ms ease, color 200ms ease',
            '&:active': { transform: 'scale(0.97)' },
            variants: [
              {
                // Основна кнопка - градієнт кольору ролі й м'яке світіння при наведенні.
                props: { variant: 'contained', color: 'primary' },
                style: {
                  backgroundImage: `linear-gradient(135deg, ${brand.light} 0%, ${brand.main} 55%, ${brand.dark} 140%)`,
                  '&:hover': { boxShadow: `0 6px 16px ${alpha(brand.main, 0.35)}` },
                  '&.Mui-disabled': { backgroundImage: 'none' },
                },
              },
            ],
          },
          sizeLarge: { paddingTop: 11, paddingBottom: 11 },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: { transition: 'transform 120ms ease, background-color 200ms ease', '&:active': { transform: 'scale(0.9)' } },
        },
      },
      MuiChip: {
        styleOverrides: { root: { fontWeight: 500, transition: 'background-color 200ms ease, color 200ms ease, box-shadow 200ms ease, transform 120ms ease' } },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: '#fff',
            borderRadius: 10,
            transition: 'box-shadow 200ms ease',
            '&.Mui-focused': { boxShadow: `0 0 0 4px ${alpha(brand.main, 0.12)}` },
          },
        },
      },
      MuiAlert: {
        styleOverrides: { root: { animation: `${fadeUp} 320ms ${EASE_OUT} backwards` } },
      },
      MuiDialog: {
        styleOverrides: { paper: { borderRadius: 16, animation: `${popIn} 280ms ${EASE_SPRING} backwards` } },
      },
      MuiTab: {
        styleOverrides: { root: { transition: 'color 200ms ease, opacity 200ms ease, background-color 200ms ease' } },
      },
      MuiTooltip: {
        styleOverrides: { tooltip: { fontSize: '0.8rem' } },
      },
      MuiLinearProgress: {
        styleOverrides: { root: { borderRadius: 4, backgroundColor: alpha(brand.main, 0.12) } },
      },
    },
  });
}
