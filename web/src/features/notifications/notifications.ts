import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, session } from '../../api/client';
import type { AppNotification, Lang, Role, User } from '../../api/types';
import { formatMoney } from '../../i18n';

/**
 * Частота опитування сповіщень. Поки хаб на зв'язку, опитування лише підстраховує; без хаба (обрив, проксі без
 * WebSocket) воно стає основним каналом - це резервне опитування з UI-12.
 */
export const notificationConfig = { fallbackPollMs: 10_000, livePollMs: 60_000 };

const HUB_URL = '/hubs/notifications';
const SEEN_KEY = (userId: number) => `farmcart.seen.${userId}`;

/** Запити, дані яких змінює подія замовлення: їх перечитуємо, щойно прийшло сповіщення. */
const AFFECTED: readonly (readonly string[])[] = [['orders'], ['order'], ['farmer', 'orders'], ['courier', 'deliveries'], ['cart']];

export function notificationText(notification: AppNotification, t: TFunction, lang: Lang): string {
  const id = notification.orderId ?? '';
  switch (notification.kind) {
    case 'order.placed':
      return t('notify.orderPlaced', { id, total: formatMoney(Number(notification.params.total ?? 0), lang) });
    case 'order.new':
      return t('notify.orderNew', { id, total: formatMoney(Number(notification.params.total ?? 0), lang) });
    case 'order.status':
      return t('notify.orderStatus', { id, status: t(`status.${notification.params.status}`) });
    case 'delivery.assigned':
      return t('notify.deliveryAssigned', { id });
    default:
      return t('notify.other');
  }
}

/** Куди веде сповіщення і в якій ролі цей екран доступний. */
export function notificationTarget(notification: AppNotification): { to: string; role: Role } {
  switch (notification.kind) {
    case 'order.new':
      return { to: '/farmer/orders', role: 'Farmer' };
    case 'delivery.assigned':
      return { to: '/courier', role: 'Courier' };
    default:
      return { to: notification.orderId ? `/orders/${notification.orderId}` : '/orders', role: 'Buyer' };
  }
}

/** З'єднання з хабом: повідомляє, чи воно на зв'язку, і викликає onEvent на кожну подію та після перепідключення. */
function useHub(user: User, onEvent: () => void): boolean {
  const [live, setLive] = useState(false);

  useEffect(() => {
    let active = true;
    const connection = new HubConnectionBuilder()
      .withUrl(HUB_URL, { accessTokenFactory: () => session.token ?? '' })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.None)
      .build();

    connection.on('notification', onEvent);
    connection.onreconnecting(() => active && setLive(false));
    connection.onreconnected(() => {
      if (active) {
        setLive(true);
        onEvent();
      }
    });
    connection.onclose(() => active && setLive(false));
    connection
      .start()
      .then(() => active && setLive(true))
      .catch(() => active && setLive(false));

    return () => {
      active = false;
      setLive(false);
      void connection.stop();
    };
  }, [user.id, onEvent]);

  return live;
}

/**
 * UI-12: стрічка сповіщень користувача. Нові сповіщення приходять через хаб або резервним опитуванням;
 * на кожне нове викликається onNew (тост) і перечитуються екрани замовлень.
 */
export function useNotifications(user: User, onNew: (notification: AppNotification) => void) {
  const queryClient = useQueryClient();
  const key = ['notifications', user.id] as const;
  const refresh = useCallback(() => void queryClient.invalidateQueries({ queryKey: ['notifications', user.id] }), [queryClient, user.id]);
  const live = useHub(user, refresh);

  const feed = useQuery({
    queryKey: key,
    queryFn: () => api<AppNotification[]>('/me/notifications'),
    refetchInterval: () => (live ? notificationConfig.livePollMs : notificationConfig.fallbackPollMs),
  });

  const [seenId, setSeenId] = useState(() => Number(localStorage.getItem(SEEN_KEY(user.id)) ?? 0));
  const known = useRef<number | null>(null);
  const items = feed.data;
  const latestId = items?.reduce((max, item) => Math.max(max, item.id), 0) ?? 0;

  useEffect(() => {
    if (!items) {
      return;
    }

    // Перше завантаження лише запам'ятовує, що вже було: тост показуємо тільки про те, що сталося при користувачеві.
    if (known.current !== null && latestId > known.current) {
      const fresh = items.filter((item) => item.id > (known.current ?? 0));
      onNew(fresh[fresh.length - 1]!);
      for (const queryKey of AFFECTED) {
        void queryClient.invalidateQueries({ queryKey: [...queryKey] });
      }
    }

    known.current = latestId;
  }, [items, latestId, onNew, queryClient]);

  const markAllRead = useCallback(() => {
    localStorage.setItem(SEEN_KEY(user.id), String(latestId));
    setSeenId(latestId);
  }, [latestId, user.id]);

  const newestFirst = [...(items ?? [])].sort((a, b) => b.id - a.id);
  return { items: newestFirst, unread: newestFirst.filter((item) => item.id > seenId).length, seenId, live, markAllRead };
}
