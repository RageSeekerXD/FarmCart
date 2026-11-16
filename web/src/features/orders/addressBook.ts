import type { AddressDetails } from '../../api/types';

/** Скільки останніх адрес доставки пам'ятати для кожного покупця. */
export const RECENT_LIMIT = 3;

const key = (userId: number) => `farmcart.addresses.${userId}`;
const extrasKey = (userId: number) => `farmcart.addressExtras.${userId}`;

/** До адреси: під'їзд, поверх, домофон і точка на мапі - щоб наступного разу не вводити їх знову. */
export interface AddressExtras {
  details: AddressDetails | null;
  lat: number | null;
  lon: number | null;
}

function read<T>(storageKey: string, fallback: T): T {
  try {
    return (JSON.parse(localStorage.getItem(storageKey) ?? 'null') as T | null) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(storageKey: string, value: unknown) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // Без сховища адреса не запам'ятовується - оформлення від цього не залежить.
  }
}

/**
 * Останні адреси доставки покупця (найновіша перша). Зберігаються лише в цьому браузері: сервер адрес не запам'ятовує,
 * а без доступу до сховища (приватний режим) оформлення просто починається з порожнього поля.
 */
export function recentAddresses(userId: number): string[] {
  const stored: unknown = read(key(userId), []);
  return Array.isArray(stored) ? stored.filter((item): item is string => typeof item === 'string').slice(0, RECENT_LIMIT) : [];
}

/** Під'їзд, поверх, домофон і точка, з якими покупець востаннє замовляв на цю адресу. */
export function addressExtras(userId: number, address: string): AddressExtras | null {
  const stored = read<Record<string, AddressExtras>>(extrasKey(userId), {});
  return stored[address.trim()] ?? null;
}

/** Адреса, на яку щойно оформлено замовлення, стає першою; повтор не дублюється. */
export function rememberAddress(userId: number, address: string, extras?: AddressExtras): void {
  const trimmed = address.trim();
  if (!trimmed) {
    return;
  }

  const next = [trimmed, ...recentAddresses(userId).filter((item) => item !== trimmed)].slice(0, RECENT_LIMIT);
  write(key(userId), next);
  if (extras) {
    const stored = read<Record<string, AddressExtras>>(extrasKey(userId), {});
    // Деталі зберігаються лише для адрес, які ще в списку нещодавніх.
    const kept = Object.fromEntries(next.filter((item) => item !== trimmed && stored[item]).map((item) => [item, stored[item]!]));
    write(extrasKey(userId), { ...kept, [trimmed]: extras });
  }
}
