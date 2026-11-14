import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import { Badge, Box, IconButton, ListItemText, Menu, MenuItem, Tooltip, Typography } from '@mui/material';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { AppNotification, User } from '../../api/types';
import { useLang } from '../../i18n';
import { formatDateTime } from '../../shared/dates';
import { bump, EASE_SPRING, ring } from '../../shared/motion';
import { browserPermission, requestBrowserPermission, showBrowserNotification, type BrowserPermission } from './browserNotify';
import { useToast } from '../../shared/Toast';
import { useAuth } from '../auth/AuthContext';
import { notificationTarget, notificationText, useNotifications } from './notifications';

/** UI-12: дзвіночок із лічильником непрочитаних, тост на нову подію, перехід до замовлення зі списку. */
export function NotificationBell({ user }: { user: User }) {
  const { t } = useTranslation();
  const { lang } = useLang();
  const { roles, setRole } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const go = useCallback(
    (notification: AppNotification) => {
      const target = notificationTarget(notification);
      if (roles.includes(target.role)) {
        setRole(target.role);
        void navigate(target.to);
      }
    },
    [roles, setRole, navigate],
  );

  // Нова подія спливає тостом із заголовком і кнопкою «Відкрити» - до замовлення чи доставки, яких вона стосується.
  // «Замовлення оформлено» й «скасовано» - наслідки дій самого покупця: їх уже підтвердив власний тост,
  // другий був би повтором. Сповіщення все одно лягає в стрічку й лічильник дзвіночка.
  const announce = useCallback(
    (notification: AppNotification) => {
      if (notification.kind === 'order.placed' || (notification.kind === 'order.status' && notification.params.status === 'Cancelled')) {
        return;
      }

      const text = notificationText(notification, t, lang);
      toast.show(text, 'info', {
        title: t('notify.newTitle'),
        icon: <NotificationsActiveIcon />,
        action: { label: t('notify.open'), onClick: () => go(notification) },
      });
      // Вкладка у фоні: тост ніхто не побачить, тож ще й системне сповіщення браузера (якщо його дозволено).
      showBrowserNotification(t('notify.newTitle'), text, () => go(notification));
    },
    [toast, t, lang, go],
  );
  const { items, unread, seenId, live, markAllRead } = useNotifications(user, announce);
  const [permission, setPermission] = useState<BrowserPermission>(browserPermission);

  const close = () => {
    setAnchor(null);
    markAllRead();
  };

  const open = (notification: AppNotification) => {
    close();
    go(notification);
  };

  return (
    <>
      <Tooltip title={t('notify.title')}>
        <IconButton
          color="inherit"
          aria-label={t('notify.bell', { count: unread })}
          aria-haspopup="menu"
          aria-expanded={anchor !== null}
          data-live={live}
          onClick={(event) => setAnchor(event.currentTarget)}
        >
          {/* key={unread}: лічильник змінився - бейдж «підстрибує», а дзвіночок дзеленчить, якщо є непрочитані. */}
          <Badge
            key={unread}
            badgeContent={unread}
            color="secondary"
            sx={{
              '& .MuiBadge-badge:not(.MuiBadge-invisible)': { animation: `${bump} 480ms ${EASE_SPRING}` },
              '& > svg': unread > 0 ? { transformOrigin: '50% 4px', animation: `${ring} 900ms ease-in-out` } : {},
            }}
          >
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={anchor !== null}
        onClose={close}
        slotProps={{ paper: { sx: { width: 360, maxWidth: 'calc(100vw - 24px)', maxHeight: 440 } }, list: { 'aria-label': t('notify.title') } }}
      >
        <Box sx={{ px: 2, py: 0.5 }}>
          <Typography variant="subtitle2">{t('notify.title')}</Typography>
          {!live && (
            <Typography variant="caption" color="text.secondary">
              {t('notify.offline')}
            </Typography>
          )}
          {(permission === 'granted' || permission === 'denied') && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {t(permission === 'granted' ? 'notify.browserOn' : 'notify.browserBlocked')}
            </Typography>
          )}
        </Box>
        {permission === 'default' && (
          <MenuItem onClick={() => void requestBrowserPermission().then(setPermission)} sx={{ color: 'primary.main' }}>
            <NotificationsNoneOutlinedIcon fontSize="small" sx={{ mr: 1.5 }} />
            {t('notify.browserEnable')}
          </MenuItem>
        )}
        {items.length === 0 && (
          <MenuItem disabled>
            <ListItemText primary={t('notify.empty')} />
          </MenuItem>
        )}
        {items.map((item) => (
          <MenuItem key={item.id} onClick={() => open(item)} sx={{ whiteSpace: 'normal', alignItems: 'flex-start' }}>
            <ListItemText
              primary={notificationText(item, t, lang)}
              secondary={formatDateTime(item.at, lang)}
              slotProps={{ primary: { sx: { fontWeight: item.id > seenId ? 700 : 400 } } }}
            />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
