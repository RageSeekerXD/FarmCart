/** Скільки останніх адрес доставки пам'ятати для кожного покупця. */
export const RECENT_LIMIT = 3;

const key = (userId: number) => `farmcart.addresses.${userId}`;

/**
 * Останні адреси доставки покупця (найновіша перша). Зберігаються лише в цьому браузері: сервер адрес не запам'ятовує,
 * а без доступу до сховища (приватний режим) оформлення просто починається з порожнього поля.
 */
export function recentAddresses(userId: number): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key(userId)) ?? '[]');
    return Array.isArray(stored) ? stored.filter((item): item is string => typeof item === 'string').slice(0, RECENT_LIMIT) : [];
  } catch {
    return [];
  }
}

/** Адреса, на яку щойно оформлено замовлення, стає першою; повтор не дублюється. */
export function rememberAddress(userId: number, address: string): void {
  const trimmed = address.trim();
  if (!trimmed) {
    return;
  }

  const next = [trimmed, ...recentAddresses(userId).filter((item) => item !== trimmed)].slice(0, RECENT_LIMIT);
  try {
    localStorage.setItem(key(userId), JSON.stringify(next));
  } catch {
    // Без сховища адреса не запам'ятовується - оформлення від цього не залежить.
  }
}
