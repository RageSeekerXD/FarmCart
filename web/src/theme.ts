import { alpha, createTheme, lighten, type Shadows, type Theme } from '@mui/material';
import type { Role } from './api/types';
import type { ColorMode } from './shared/colorMode';
import { EASE_OUT, EASE_SPRING, fadeUp, growWidth, popIn } from './shared/motion';

/** Візуальний стиль ролі: основний колір, градієнт шапки, тло сторінки й емодзі-знак. */
export interface Brand {
  main: string;
  dark: string;
  light: string;
  /** Градієнт шапки (однаковий у світлій і темній темі: білий текст на ньому контрастний). */
  gradient: string;
  /** Тло сторінки під вмістом у світлій темі. */
  background: string;
  /** Темна тема: світліший основний колір (текст і кнопки на темному тлі), тло сторінки й поверхонь. */
  night: { main: string; background: string; paper: string };
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
 * адміністратор - індиго. Білий текст на основному кольорі кожної ролі має контраст не нижче WCAG AA (4,5:1);
 * у темній темі основний колір світлий, а текст на ньому - темний.
 */
const MARKET: Brand = {
  main: '#2e7d32',
  dark: '#1b5e20',
  light: '#4c9a50',
  gradient: 'linear-gradient(120deg, #1b5e20 0%, #2e7d32 55%, #43a047 100%)',
  background: '#f5f6f0',
  night: { main: '#81c784', background: '#0f1511', paper: '#18201a' },
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
    night: { main: '#e0a36b', background: '#15110d', paper: '#201a14' },
    emoji: '🌾',
  },
  Courier: {
    main: '#1565c0',
    dark: '#0d47a1',
    light: '#1e88e5',
    gradient: 'linear-gradient(120deg, #0d47a1 0%, #1565c0 55%, #1e88e5 100%)',
    background: '#f2f5f9',
    night: { main: '#64b5f6', background: '#0d1219', paper: '#151c26' },
    emoji: '🚚',
  },
  Admin: {
    main: '#4527a0',
    dark: '#311b92',
    light: '#5e35b1',
    gradient: 'linear-gradient(120deg, #311b92 0%, #4527a0 55%, #5e35b1 100%)',
    background: '#f4f3f8',
    night: { main: '#b39ddb', background: '#110f18', paper: '#1b1824' },
    emoji: '🛡️',
  },
};

/**
 * Рівні 1, 2, 4 і 6 - тонке «кільце» з м'якою тінню замість важких тіней MUI: картки читаються як пласкі
 * поверхні з рамкою, а Alert і інші поверхні з elevation 0 лишаються без рамки. Решта рівнів (меню, діалоги) - типові.
 */
function ringShadows(mode: ColorMode): Shadows {
  const shadows = [...createTheme().shadows] as Shadows;
  const ring = mode === 'dark' ? 'rgba(255, 255, 255, 0.09)' : 'rgba(25, 40, 30, 0.08)';
  const shade = mode === 'dark' ? 'rgba(0, 0, 0, 0.5)' : 'rgba(25, 40, 30, 0.08)';
  shadows[1] = `0 0 0 1px ${ring}, 0 1px 3px ${shade}`;
  shadows[2] = `0 0 0 1px ${ring}, 0 2px 6px ${shade}`;
  shadows[4] = `0 0 0 1px ${ring}, 0 10px 24px ${mode === 'dark' ? 'rgba(0, 0, 0, 0.6)' : 'rgba(25, 40, 30, 0.14)'}`;
  shadows[6] = `0 0 0 1px ${ring}, 0 14px 32px ${mode === 'dark' ? 'rgba(0, 0, 0, 0.65)' : 'rgba(25, 40, 30, 0.18)'}`;
  return shadows;
}

/** Тема FarmCart для ролі й режиму. Контраст тексту не нижче WCAG AA; рух вимикається, якщо користувач просить менше руху. */
export function createAppTheme(key: BrandKey, mode: ColorMode = 'light'): Theme {
  const brand = BRANDS[key];
  const dark = mode === 'dark';
  const main = dark ? brand.night.main : brand.main;
  const border = dark ? 'rgba(255, 255, 255, 0.12)' : '#e3e6dc';
  return createTheme({
    brand,
    palette: {
      mode,
      primary: dark ? { main } : { main, dark: brand.dark, light: brand.light },
      secondary: { main: '#ffb300' },
      background: dark ? { default: brand.night.background, paper: brand.night.paper } : { default: brand.background, paper: '#ffffff' },
      text: dark ? { primary: '#e6ebe4', secondary: '#a6b0a8' } : { primary: '#1d2a1e', secondary: '#55605a' },
      divider: border,
    },
    shape: { borderRadius: 12 },
    shadows: ringShadows(mode),
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
          '::selection': { background: alpha(main, 0.25) },
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
        styleOverrides: { outlined: { borderColor: border } },
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
                  backgroundImage: dark
                    ? `linear-gradient(135deg, ${lighten(main, 0.18)} 0%, ${main} 100%)`
                    : `linear-gradient(135deg, ${brand.light} 0%, ${brand.main} 55%, ${brand.dark} 140%)`,
                  '&:hover': { boxShadow: `0 6px 16px ${alpha(main, 0.35)}` },
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
            backgroundColor: dark ? 'rgba(255, 255, 255, 0.04)' : '#fff',
            borderRadius: 10,
            transition: 'box-shadow 200ms ease',
            '&.Mui-focused': { boxShadow: `0 0 0 4px ${alpha(main, 0.16)}` },
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
        styleOverrides: { root: { borderRadius: 4, backgroundColor: alpha(main, 0.14) } },
      },
    },
  });
}
