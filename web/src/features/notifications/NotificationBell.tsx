import NotificationsIcon from '@mui/icons-material/Notifications';
import { Badge, Box, IconButton, ListItemText, Menu, MenuItem, Tooltip, Typography } from '@mui/material';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { AppNotification, User } from '../../api/types';
import { useLang } from '../../i18n';
import { formatDateTime } from '../../shared/dates';
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

  const announce = useCallback((notification: AppNotification) => toast.show(notificationText(notification, t, lang), 'info'), [toast, t, lang]);
  const { items, unread, seenId, live, markAllRead } = useNotifications(user, announce);

  const close = () => {
    setAnchor(null);
    markAllRead();
  };

  const open = (notification: AppNotification) => {
    const target = notificationTarget(notification);
    close();
    if (roles.includes(target.role)) {
      setRole(target.role);
      void navigate(target.to);
    }
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
          <Badge badgeContent={unread} color="secondary">
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
        </Box>
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
