import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import ShoppingBasketIcon from '@mui/icons-material/ShoppingBasket';
import {
  alpha,
  AppBar,
  Badge,
  Box,
  Button,
  Container,
  IconButton,
  Link,
  MenuItem,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { Lang, Role } from '../api/types';
import { ROLE_HOME, useAuth } from '../features/auth/AuthContext';
import { DemoAccountSwitcher } from '../features/auth/DemoAccounts';
import { cartCount, useCart } from '../features/cart/useCart';
import { NotificationBell } from '../features/notifications/NotificationBell';
import { LANGS, useLang } from '../i18n';
import { useColorMode } from './colorMode';
import { bump, EASE_OUT, EASE_SPRING, fadeUp, popIn } from './motion';

interface NavItem {
  to: string;
  label: string;
}

const NAV: Record<Role, readonly NavItem[]> = {
  Buyer: [
    { to: '/', label: 'nav.catalog' },
    { to: '/map', label: 'nav.map' },
    { to: '/cart', label: 'nav.cart' },
    { to: '/orders', label: 'nav.orders' },
  ],
  Farmer: [
    { to: '/farmer/orders', label: 'nav.farmerOrders' },
    { to: '/farmer/products', label: 'nav.farmerProducts' },
  ],
  Courier: [{ to: '/courier', label: 'nav.deliveries' }],
  Admin: [{ to: '/admin', label: 'nav.admin' }],
};

const BECOME_SELLER: NavItem = { to: '/farmer/register', label: 'nav.becomeSeller' };

const GUEST_NAV: readonly NavItem[] = [
  { to: '/', label: 'nav.catalog' },
  { to: '/map', label: 'nav.map' },
];

/** Каркас сторінки: шапка з навігацією за роллю, перемикачі мови й ролі, вміст маршруту. */
export function Layout() {
  const { t } = useTranslation();
  const { lang, setLang } = useLang();
  const { user, role, roles, setRole, signOut } = useAuth();
  const cart = useCart();
  const location = useLocation();
  const navigate = useNavigate();

  const items = !user ? GUEST_NAV : role === 'Buyer' && !roles.includes('Farmer') ? [...NAV.Buyer, BECOME_SELLER] : NAV[role];
  const current = items.find((item) => item.to === location.pathname)?.to ?? false;
  const inCart = cartCount(cart.data);
  const theme = useTheme();
  const brand = theme.brand;
  const { mode, toggle: toggleMode } = useColorMode();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        // Тло з м'якими плямами кольору ролі вгорі сторінки.
        background: `radial-gradient(1100px 380px at 0% 0%, ${alpha(brand.main, 0.08)}, transparent 70%), radial-gradient(800px 320px at 100% 0%, ${alpha(theme.palette.secondary.main, 0.08)}, transparent 70%), ${theme.palette.background.default}`,
        transition: 'background-color 400ms ease',
      }}
    >
      <Link
        href="#main"
        sx={{
          position: 'absolute',
          left: -9999,
          zIndex: 2000,
          bgcolor: 'background.paper',
          p: 1,
          '&:focus': { left: 8, top: 8 },
        }}
      >
        {t('header.skipToContent')}
      </Link>
      <AppBar
        position="sticky"
        color="primary"
        elevation={0}
        sx={{
          // Градієнт ролі з ледь помітною «крапковою» фактурою.
          background: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.10) 1px, transparent 0) 0 0 / 18px 18px, ${brand.gradient}`,
          // Текст шапки білий в обох темах: у темній основний колір світлий, і MUI обрав би темний текст.
          color: '#fff',
          boxShadow: `0 6px 20px ${alpha(brand.dark, 0.25)}`,
        }}
      >
        <Toolbar sx={{ gap: { xs: 0.25, sm: 1 }, flexWrap: 'wrap', py: 0.5, px: { xs: 1, sm: 3 } }}>
          <Typography
            component={RouterLink}
            to="/"
            variant="h6"
            sx={{
              color: 'inherit',
              textDecoration: 'none',
              fontWeight: 800,
              letterSpacing: '-0.01em',
              mr: 'auto',
              fontSize: { xs: '1.05rem', sm: '1.3rem' },
              whiteSpace: 'nowrap',
              '& .logo-mark': { display: 'inline-block', transition: `transform 400ms ${EASE_SPRING}` },
              '&:hover .logo-mark': { transform: 'rotate(-12deg) scale(1.2)' },
            }}
          >
            <span className="logo-mark">{brand.emoji}</span> {t('app.name')}
          </Typography>

          {user && roles.length > 1 && (
            <TextField
              select
              size="small"
              variant="outlined"
              value={role}
              onChange={(event) => {
                const next = event.target.value as Role;
                setRole(next);
                void navigate(ROLE_HOME[next]);
              }}
              slotProps={{ htmlInput: { 'aria-label': t('header.role') } }}
              sx={{
                minWidth: 130,
                '& .MuiOutlinedInput-root': { color: 'inherit', bgcolor: 'rgba(255,255,255,0.08)' },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
                '& .MuiSvgIcon-root': { color: 'inherit' },
              }}
            >
              {roles.map((item) => (
                <MenuItem key={item} value={item}>
                  {t(`roles.${item}`)}
                </MenuItem>
              ))}
            </TextField>
          )}

          <ToggleButtonGroup
            exclusive
            size="small"
            value={lang}
            aria-label={t('header.language')}
            onChange={(_, next: Lang | null) => {
              if (next) {
                setLang(next);
              }
            }}
            sx={{ '& .MuiToggleButton-root': { color: 'inherit', borderColor: 'rgba(255,255,255,0.5)', px: { xs: 0.8, sm: 1.2 } } }}
          >
            {LANGS.map((code) => (
              <ToggleButton
                key={code}
                value={code}
                lang={code}
                sx={{ '&.Mui-selected': { bgcolor: 'rgba(255,255,255,0.25)', color: 'inherit' } }}
              >
                {code.toUpperCase()}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          {user && role === 'Buyer' && (
            <Tooltip title={t('nav.cart')}>
              <IconButton component={RouterLink} to="/cart" color="inherit" aria-label={t('header.cartItems', { count: inCart })}>
                {/* key={inCart}: товар додано чи прибрано - бейдж кошика «підстрибує». */}
                <Badge
                  key={inCart}
                  badgeContent={inCart}
                  color="secondary"
                  sx={{ '& .MuiBadge-badge:not(.MuiBadge-invisible)': { animation: `${bump} 480ms ${EASE_SPRING}`, fontWeight: 700 } }}
                >
                  <ShoppingBasketIcon />
                </Badge>
              </IconButton>
            </Tooltip>
          )}

          {user && <NotificationBell key={user.id} user={user} />}
          {user && <DemoAccountSwitcher />}

          {user ? (
            <Tooltip title={`${t('header.logout')} (${user.phone})`}>
              <IconButton
                color="inherit"
                aria-label={t('header.logout')}
                onClick={() => {
                  signOut();
                  void navigate('/');
                }}
              >
                <LogoutIcon />
              </IconButton>
            </Tooltip>
          ) : (
            <Button component={RouterLink} to="/login" color="inherit" variant="outlined" size="small">
              {t('header.login')}
            </Button>
          )}
        </Toolbar>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Tabs
            component="nav"
            aria-label={t('nav.main')}
            value={current}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            textColor="inherit"
            indicatorColor="secondary"
            sx={{
              flex: 1,
              minWidth: 0,
              minHeight: 44,
              px: { xs: 0, sm: 2 },
              '& .MuiTabs-indicator': { height: 3, borderRadius: '3px 3px 0 0', transition: `all 360ms ${EASE_OUT}` },
            }}
          >
            {items.map((item) => (
              <Tab
                key={item.to}
                value={item.to}
                label={t(item.label)}
                component={RouterLink}
                to={item.to}
                sx={{
                  minHeight: 44,
                  textTransform: 'none',
                  fontSize: '0.95rem',
                  opacity: 0.85,
                  borderRadius: '8px 8px 0 0',
                  '&:hover': { opacity: 1, bgcolor: 'rgba(255,255,255,0.08)' },
                  '&.Mui-selected': { opacity: 1 },
                }}
              />
            ))}
          </Tabs>
          {/* Знак ролі, у якій користувач працює: колір шапки й емодзі змінюються разом із роллю. */}
          {user && (
            <Typography
              key={role}
              variant="body2"
              sx={{
                display: { xs: 'none', sm: 'block' },
                mr: 1,
                px: 1.5,
                py: 0.25,
                borderRadius: 5,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                bgcolor: 'rgba(255,255,255,0.16)',
                border: '1px solid rgba(255,255,255,0.28)',
                animation: `${popIn} 360ms ${EASE_SPRING} backwards`,
              }}
            >
              {brand.emoji} {t(`roles.${role}`)}
            </Typography>
          )}
          {/* Світла/темна тема: перемикач у рядку вкладок, щоб верхній рядок шапки на 360 px не переносився. */}
          <Tooltip title={t(mode === 'dark' ? 'header.lightMode' : 'header.darkMode')}>
            <IconButton
              color="inherit"
              size="small"
              aria-label={t('header.darkMode')}
              aria-pressed={mode === 'dark'}
              onClick={toggleMode}
              sx={{ mr: { xs: 1, sm: 2.5 }, '& svg': { transition: `transform 500ms ${EASE_SPRING}` }, '&:hover svg': { transform: 'rotate(-30deg)' } }}
            >
              {mode === 'dark' ? <LightModeOutlinedIcon fontSize="small" /> : <DarkModeOutlinedIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>
      </AppBar>
      <Container component="main" id="main" maxWidth="lg" sx={{ flex: 1, py: { xs: 2, sm: 4 }, px: { xs: 1.5, sm: 3 } }}>
        {/* Перехід між сторінками: нова сторінка плавно з'являється знизу. */}
        <Box key={location.pathname} sx={{ animation: `${fadeUp} 420ms ${EASE_OUT} backwards` }}>
          <Outlet />
        </Box>
      </Container>
      <Box component="footer" sx={{ py: 3, mt: 2, textAlign: 'center', color: 'text.secondary', borderTop: 1, borderColor: 'divider' }}>
        <Typography variant="body2">
          {brand.emoji} <strong>{t('app.name')}</strong> · {t('app.tagline')}
        </Typography>
      </Box>
    </Box>
  );
}
