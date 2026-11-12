import { createTheme } from '@mui/material';

/** Тема FarmCart: зелений «фермерський» основний колір, теплий акцент; контраст тексту не нижче WCAG AA. */
export const theme = createTheme({
  palette: {
    primary: { main: '#2e7d32' },
    secondary: { main: '#ffb300' },
    background: { default: '#f6f7f2' },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    button: { textTransform: 'none', fontWeight: 600 },
  },
});
