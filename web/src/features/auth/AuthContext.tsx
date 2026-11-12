import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, session } from '../../api/client';
import type { Role, SessionResponse, User } from '../../api/types';

const ROLE_KEY = 'farmcart.role';
const ROLE_ORDER: readonly Role[] = ['Buyer', 'Farmer', 'Courier', 'Admin'];

interface AuthState {
  user: User | null;
  /** Перевіряється збережена сесія: інтерфейс ще не знає, чи користувач увійшов. */
  loading: boolean;
  /** Роль, у якій користувач працює зараз (перемикач у шапці). */
  role: Role;
  roles: Role[];
  setRole: (role: Role) => void;
  signIn: (response: SessionResponse) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(() => session.token);
  const [storedRole, setStoredRole] = useState<string | null>(() => localStorage.getItem(ROLE_KEY));

  const me = useQuery({
    queryKey: ['me', token],
    queryFn: () => api<User>('/me'),
    enabled: token !== null,
    retry: false,
    staleTime: Infinity,
  });

  const signOut = useCallback(() => {
    session.token = null;
    setToken(null);
    queryClient.removeQueries({ queryKey: ['me'] });
    queryClient.removeQueries({ queryKey: ['cart'] });
  }, [queryClient]);

  useEffect(() => {
    session.onUnauthorized(signOut);
    return () => session.onUnauthorized(null);
  }, [signOut]);

  const signIn = useCallback(
    (response: SessionResponse) => {
      session.token = response.token;
      queryClient.setQueryData(['me', response.token], response.user);
      setToken(response.token);
    },
    [queryClient],
  );

  const setRole = useCallback((role: Role) => {
    localStorage.setItem(ROLE_KEY, role);
    setStoredRole(role);
  }, []);

  const value = useMemo<AuthState>(() => {
    const user = token !== null ? (me.data ?? null) : null;
    const roles = ROLE_ORDER.filter((role) => user?.roles.includes(role));
    const role = roles.find((candidate) => candidate === storedRole) ?? roles[0] ?? 'Buyer';
    return { user, loading: token !== null && me.isPending, role, roles, setRole, signIn, signOut };
  }, [token, me.data, me.isPending, storedRole, setRole, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return value;
}

export const ROLE_HOME: Record<Role, string> = {
  Buyer: '/',
  Farmer: '/farmer/orders',
  Courier: '/courier',
  Admin: '/admin',
};
