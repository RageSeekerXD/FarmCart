/** Стан дозволу на системні сповіщення браузера; «unsupported» - браузер їх не має (або це тестове середовище). */
export type BrowserPermission = NotificationPermission | 'unsupported';

export function browserPermission(): BrowserPermission {
  return typeof window !== 'undefined' && 'Notification' in window ? window.Notification.permission : 'unsupported';
}

/** Запит дозволу: браузери дозволяють його лише у відповідь на дію користувача (натискання в меню дзвіночка). */
export async function requestBrowserPermission(): Promise<BrowserPermission> {
  if (browserPermission() === 'unsupported') {
    return 'unsupported';
  }

  return window.Notification.requestPermission();
}

/**
 * Системне сповіщення про подію, поки вкладка FarmCart у фоні (п. 11 покращень). На видимій вкладці досить тосту,
 * тож двічі не сповіщаємо. Натискання повертає вкладку на передній план і відкриває екран події.
 */
export function showBrowserNotification(title: string, body: string, onOpen: () => void): boolean {
  if (browserPermission() !== 'granted' || document.visibilityState !== 'hidden') {
    return false;
  }

  const notification = new window.Notification(title, { body, tag: `farmcart-${title}-${body}` });
  notification.onclick = () => {
    window.focus();
    onOpen();
    notification.close();
  };
  return true;
}
