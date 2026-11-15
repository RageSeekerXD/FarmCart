import { useCallback, useSyncExternalStore } from 'react';

/**
 * Обрані товари покупця («сердечко» на картці): фермерські продукти купують регулярно, і до улюблених
 * треба повертатися одним натисканням. Список зберігається в браузері, тож працює й до входу;
 * між вкладками синхронізується через подію storage.
 */
const KEY = 'farmcart.favorites';

const EMPTY: ReadonlySet<number> = new Set();
let cache: { raw: string | null; ids: ReadonlySet<number> } = { raw: null, ids: EMPTY };
/** Сховище недоступне (приватний режим, заборона cookies): список живе лише в пам'яті вкладки. */
let memoryOnly = false;
const listeners = new Set<() => void>();

function parse(raw: string | null): ReadonlySet<number> {
  try {
    const value: unknown = JSON.parse(raw ?? '[]');
    return new Set(Array.isArray(value) ? value.filter((id): id is number => Number.isInteger(id) && id > 0) : []);
  } catch {
    return EMPTY;
  }
}

function snapshot(): ReadonlySet<number> {
  if (memoryOnly) {
    return cache.ids;
  }

  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return cache.ids;
  }

  if (raw !== cache.raw) {
    cache = { raw, ids: parse(raw) };
  }

  return cache.ids;
}

function save(ids: ReadonlySet<number>) {
  const raw = JSON.stringify([...ids]);
  cache = { raw, ids };
  try {
    localStorage.setItem(KEY, raw);
  } catch {
    memoryOnly = true;
  }

  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) {
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function useFavorites() {
  const ids = useSyncExternalStore(subscribe, snapshot);
  /** Додає товар в обране або прибирає з нього; повертає, чи товар тепер в обраному. */
  const toggle = useCallback((productId: number) => {
    const next = new Set(snapshot());
    const added = !next.delete(productId);
    if (added) {
      next.add(productId);
    }

    save(next);
    return added;
  }, []);
  return { ids, toggle };
}
