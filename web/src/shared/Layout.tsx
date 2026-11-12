import LogoutIcon from '@mui/icons-material/Logout';
import ShoppingBasketIcon from '@mui/icons-material/ShoppingBasket';
import {
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
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { Lang, Role } from '../api/types';
import { ROLE_HOME, useAuth } from '../features/auth/AuthContext';
import { DemoAccountSwitcher } from '../features/auth/DemoAccounts';
import { cartCount, useCart } from '../features/cart/useCart';
import { NotificationBell } from '../features/notifications/NotificationBell';
import { LANGS, useLang } from '../i18n';

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

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
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
      <AppBar position="sticky" color="primary" elevation={1}>
        <Toolbar sx={{ gap: { xs: 0.25, sm: 1 }, flexWrap: 'wrap', py: 0.5, px: { xs: 1, sm: 3 } }}>
          <Typography
            component={RouterLink}
            to="/"
            variant="h6"
            sx={{ color: 'inherit', textDecoration: 'none', fontWeight: 700, mr: 'auto', fontSize: { xs: '1.05rem', sm: '1.25rem' }, whiteSpace: 'nowrap' }}
          >
            🧺 {t('app.name')}
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
                <Badge badgeContent={inCart} color="secondary">
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
            minHeight: 44,
            px: { xs: 0, sm: 2 },
            '& .MuiTabs-indicator': { height: 3, borderRadius: '3px 3px 0 0' },
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
      </AppBar>
      <Container component="main" id="main" maxWidth="lg" sx={{ flex: 1, py: { xs: 2, sm: 4 }, px: { xs: 1.5, sm: 3 } }}>
        <Outlet />
      </Container>
      <Box component="footer" sx={{ py: 3, mt: 2, textAlign: 'center', color: 'text.secondary', borderTop: 1, borderColor: 'divider' }}>
        <Typography variant="body2">
          🧺 <strong>{t('app.name')}</strong> · {t('app.tagline')}
        </Typography>
      </Box>
    </Box>
  );
}
