import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type ColorMode = 'light' | 'dark';

const MODE_KEY = 'farmcart.mode';

/** Збережений вибір користувача; без нього - налаштування системи (prefers-color-scheme). */
function initialMode(): ColorMode {
  try {
    const stored = localStorage.getItem(MODE_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
  } catch {
    // Сховище недоступне (приватний режим) - беремо налаштування системи.
  }

  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

interface ColorModeApi {
  mode: ColorMode;
  toggle: () => void;
}

const ColorModeContext = createContext<ColorModeApi | null>(null);

/** Світла чи темна тема інтерфейсу; вибір запам'ятовується в браузері. */
export function ColorModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ColorMode>(initialMode);
  const toggle = useCallback(() => {
    setMode((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(MODE_KEY, next);
      } catch {
        // Без сховища вибір діє до перезавантаження сторінки.
      }
      return next;
    });
  }, []);
  const value = useMemo(() => ({ mode, toggle }), [mode, toggle]);
  return <ColorModeContext.Provider value={value}>{children}</ColorModeContext.Provider>;
}

export function useColorMode(): ColorModeApi {
  const value = useContext(ColorModeContext);
  if (!value) {
    throw new Error('useColorMode must be used inside ColorModeProvider');
  }

  return value;
}
