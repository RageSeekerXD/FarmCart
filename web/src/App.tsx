import { CssBaseline, ThemeProvider, type Theme } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { ApiError } from './api/client';
import { AdminPage } from './features/admin/AdminPage';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import { LoginPage } from './features/auth/LoginPage';
import { CartPage } from './features/cart/CartPage';
import { CatalogPage } from './features/catalog/CatalogPage';
import { CourierPage } from './features/courier/CourierPage';
import { FarmerOrdersPage } from './features/farmer/FarmerOrdersPage';
import { FarmerProductsPage } from './features/farmer/FarmerProductsPage';
import { RegisterFarmPage } from './features/farmer/RegisterFarmPage';
import { MapPage } from './features/map/MapPage';
import { CheckoutPage } from './features/orders/CheckoutPage';
import { OrderPage } from './features/orders/OrderPage';
import { OrdersPage } from './features/orders/OrdersPage';
import { Layout } from './shared/Layout';
import { NotFoundPage, RequireRole } from './shared/pages';
import { ColorModeProvider, useColorMode, type ColorMode } from './shared/colorMode';
import { ToastProvider } from './shared/Toast';
import { BRANDS, createAppTheme, type BrandKey } from './theme';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Помилки клієнта (4xx) повторювати марно; мережеві й серверні - один раз.
        retry: (failures, error) => failures < 1 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
        refetchOnWindowFocus: false,
        staleTime: 15_000,
      },
    },
  });
}

/** Теми ролей створюються один раз: перемикання ролі чи світлої/темної теми лише вибирає готову. */
const THEMES = Object.fromEntries(
  (Object.keys(BRANDS) as BrandKey[]).map((key) => [key, { light: createAppTheme(key, 'light'), dark: createAppTheme(key, 'dark') }]),
) as Record<BrandKey, Record<ColorMode, Theme>>;

/** Візуальний стиль за роллю, у якій користувач працює зараз (гість бачить стиль покупця), і за обраним режимом. */
function RoleTheme({ children }: { children: ReactNode }) {
  const { user, role } = useAuth();
  const { mode } = useColorMode();
  return (
    <ThemeProvider theme={THEMES[user ? role : 'Guest'][mode]}>
      <CssBaseline enableColorScheme />
      {children}
    </ThemeProvider>
  );
}

/** Провайдери застосунку без маршрутизатора: його дає main.tsx (BrowserRouter) або тест (MemoryRouter). */
export function Providers({ children, client }: { children: ReactNode; client?: QueryClient }) {
  const [queryClient] = useState(() => client ?? createQueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ColorModeProvider>
          <RoleTheme>
            <ToastProvider>{children}</ToastProvider>
          </RoleTheme>
        </ColorModeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<CatalogPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="map" element={<MapPage />} />
        <Route
          path="cart"
          element={
            <RequireRole role="Buyer">
              <CartPage />
            </RequireRole>
          }
        />
        <Route
          path="checkout"
          element={
            <RequireRole role="Buyer">
              <CheckoutPage />
            </RequireRole>
          }
        />
        <Route
          path="orders"
          element={
            <RequireRole role="Buyer">
              <OrdersPage />
            </RequireRole>
          }
        />
        <Route
          path="orders/:id"
          element={
            <RequireRole role="Buyer">
              <OrderPage />
            </RequireRole>
          }
        />
        <Route
          path="farmer/register"
          element={
            <RequireRole role="Buyer">
              <RegisterFarmPage />
            </RequireRole>
          }
        />
        <Route
          path="farmer/orders"
          element={
            <RequireRole role="Farmer">
              <FarmerOrdersPage />
            </RequireRole>
          }
        />
        <Route
          path="farmer/products"
          element={
            <RequireRole role="Farmer">
              <FarmerProductsPage />
            </RequireRole>
          }
        />
        <Route
          path="courier"
          element={
            <RequireRole role="Courier">
              <CourierPage />
            </RequireRole>
          }
        />
        <Route
          path="admin"
          element={
            <RequireRole role="Admin">
              <AdminPage />
            </RequireRole>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
