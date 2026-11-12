import { alpha, createTheme, type Shadows } from '@mui/material';

const GREEN = '#2e7d32';
const BORDER = '#e3e6dc';

/**
 * Рівні 1, 2 і 4 - тонке «кільце» з м'якою тінню замість важких тіней MUI: картки читаються як пласкі
 * поверхні з рамкою, а Alert і інші поверхні з elevation 0 лишаються без рамки. Решта рівнів (меню, діалоги) - типові.
 */
const shadows = [...createTheme().shadows] as Shadows;
shadows[1] = '0 0 0 1px rgba(30, 60, 30, 0.08), 0 1px 3px rgba(30, 60, 30, 0.06)';
shadows[2] = '0 0 0 1px rgba(30, 60, 30, 0.08), 0 2px 6px rgba(30, 60, 30, 0.08)';
shadows[4] = '0 0 0 1px rgba(30, 60, 30, 0.06), 0 10px 24px rgba(30, 60, 30, 0.14)';

/** Тема FarmCart: зелений «фермерський» основний колір, теплий акцент; контраст тексту не нижче WCAG AA. */
export const theme = createTheme({
  palette: {
    primary: { main: GREEN, dark: '#1b5e20', light: '#4c9a50' },
    secondary: { main: '#ffb300' },
    background: { default: '#f5f6f0', paper: '#ffffff' },
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
    MuiPaper: {
      styleOverrides: { outlined: { borderColor: BORDER } },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 10 },
        sizeLarge: { paddingTop: 11, paddingBottom: 11 },
      },
    },
    MuiChip: {
      styleOverrides: { root: { fontWeight: 500 } },
    },
    MuiOutlinedInput: {
      styleOverrides: { root: { backgroundColor: '#fff', borderRadius: 10 } },
    },
    MuiTooltip: {
      styleOverrides: { tooltip: { fontSize: '0.8rem' } },
    },
    MuiLinearProgress: {
      styleOverrides: { root: { borderRadius: 4, backgroundColor: alpha(GREEN, 0.12) } },
    },
  },
});
