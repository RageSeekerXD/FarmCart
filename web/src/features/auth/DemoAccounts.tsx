import SwitchAccountIcon from '@mui/icons-material/SwitchAccount';
import { Alert, Box, Button, IconButton, ListItemText, Menu, MenuItem, Stack, Tooltip, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import type { CodeResponse, LocalizedText, Role, SessionResponse } from '../../api/types';
import { errorMessage, useLang } from '../../i18n';
import { ROLE_HOME, useAuth } from './AuthContext';

/** Демонстраційний акаунт сервера: телефон, роль, заради якої його показують, і підпис двома мовами. */
export interface DemoAccount {
  phone: string;
  role: Role;
  title: LocalizedText;
}

/** Список демо-акаунтів; поза демонстраційним режимом сервер віддає порожній список, і клієнт нічого не показує. */
function useDemoAccounts() {
  return useQuery({ queryKey: ['demo-accounts'], queryFn: () => api<DemoAccount[]>('/demo/accounts'), staleTime: Infinity, retry: false });
}

/**
 * Вхід у демо-акаунт одним натисканням: ті самі два запити, що й у формі входу (код, підтвердження),
 * тільки код береться з відповіді сервера режиму розробки. Одразу вмикається роль акаунта й відкривається її екран.
 */
function useDemoSignIn() {
  const { signIn, signOut, setRole } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (account: DemoAccount) => {
      const sent = await api<CodeResponse>('/auth/code', { method: 'POST', body: { phone: account.phone } });
      return api<SessionResponse>('/auth/verify', { method: 'POST', body: { phone: account.phone, code: sent.devCode ?? '' } });
    },
    onSuccess: (response, account) => {
      // Дані попереднього користувача (кошик, замовлення, сповіщення) новому не належать.
      signOut();
      queryClient.removeQueries({ predicate: (query) => !['demo-accounts', 'reference', 'catalog', 'farms', 'slots'].includes(String(query.queryKey[0])) });
      signIn(response);
      setRole(account.role);
      void navigate(ROLE_HOME[account.role], { replace: true });
    },
  });
}

/** На сторінці входу: кнопки «увійти як покупець / фермер / кур'єр / адміністратор». */
export function DemoAccountButtons() {
  const { t } = useTranslation();
  const { pick } = useLang();
  const accounts = useDemoAccounts();
  const enter = useDemoSignIn();

  if (!accounts.data?.length) {
    return null;
  }

  return (
    <Box component="section" aria-labelledby="demo-accounts" sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
      <Typography id="demo-accounts" component="h2" variant="subtitle1" sx={{ fontWeight: 600 }}>
        {t('demo.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {t('demo.hint')}
      </Typography>
      <Stack spacing={1}>
        {accounts.data.map((account) => (
          <Button
            key={account.phone}
            variant="outlined"
            loading={enter.isPending && enter.variables?.phone === account.phone}
            disabled={enter.isPending}
            onClick={() => enter.mutate(account)}
            sx={{ justifyContent: 'flex-start', textAlign: 'left' }}
          >
            {t(`roles.${account.role}`)} · {pick(account.title)}
          </Button>
        ))}
      </Stack>
      {enter.isError && (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {errorMessage(enter.error)}
        </Alert>
      )}
    </Box>
  );
}

/** У шапці: перемикання між демо-акаунтами без виходу - щоб показати всі ролі поспіль. */
export function DemoAccountSwitcher() {
  const { t } = useTranslation();
  const { pick } = useLang();
  const { user } = useAuth();
  const accounts = useDemoAccounts();
  const enter = useDemoSignIn();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  if (!accounts.data?.length) {
    return null;
  }

  return (
    <>
      <Tooltip title={t('demo.switch')}>
        <IconButton color="inherit" aria-label={t('demo.switch')} aria-haspopup="menu" onClick={(event) => setAnchor(event.currentTarget)}>
          <SwitchAccountIcon />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={anchor !== null} onClose={() => setAnchor(null)} slotProps={{ list: { 'aria-label': t('demo.title') } }}>
        {accounts.data.map((account) => (
          <MenuItem
            key={account.phone}
            selected={user?.phone === account.phone}
            onClick={() => {
              setAnchor(null);
              enter.mutate(account);
            }}
          >
            <ListItemText primary={t(`roles.${account.role}`)} secondary={pick(account.title)} />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
