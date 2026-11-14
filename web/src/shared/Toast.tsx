import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CloseIcon from '@mui/icons-material/Close';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { alpha, Box, Button, IconButton, Paper, Typography } from '@mui/material';
import { keyframes } from '@emotion/react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { EASE_OUT, EASE_SPRING, shrinkX } from './motion';

type Severity = 'success' | 'info' | 'warning' | 'error';

export interface ToastOptions {
  /** Короткий заголовок над текстом (наприклад, «Нове сповіщення»). */
  title?: string;
  /** Власна піктограма замість піктограми рівня. */
  icon?: ReactNode;
  /** Дія просто з тосту: «До кошика», «Відкрити». Натискання закриває тост. */
  action?: { label: string; onClick: () => void };
}

interface ToastApi {
  show: (message: string, severity?: Severity, options?: ToastOptions) => void;
}

interface ToastItem extends ToastOptions {
  id: number;
  message: string;
  severity: Severity;
  lang: string;
  leaving: boolean;
}

const ToastContext = createContext<ToastApi | null>(null);

/** Одночасно видно не більше стількох тостів: найстаріший іде, щоб звільнити місце. */
const MAX_VISIBLE = 4;
const DURATION: Record<Severity, number> = { success: 4500, info: 6000, warning: 7000, error: 7000 };
const EXIT_MS = 220;

const SEVERITY_ICON: Record<Severity, ReactNode> = {
  success: <CheckCircleRoundedIcon />,
  info: <InfoRoundedIcon />,
  warning: <WarningAmberRoundedIcon />,
  error: <ErrorRoundedIcon />,
};

// На телефоні тости виїжджають знизу (там великий палець), на ширшому екрані - справа під шапкою.
// Лише вертикальний зсув на вузькому екрані: горизонтальний давав би прокручування сторінки вбік.
const enterMobile = keyframes`
  from { opacity: 0; transform: translateY(24px) scale(0.96); }
  to { opacity: 1; transform: none; }
`;
const enterDesktop = keyframes`
  from { opacity: 0; transform: translateX(40px) scale(0.96); }
  to { opacity: 1; transform: none; }
`;
const leave = keyframes`
  to { opacity: 0; transform: scale(0.94); }
`;

/**
 * Таймер, що зупиняється, поки на тості курсор або фокус: людина встигає дочитати й натиснути дію.
 * Смужка внизу тосту показує час, що лишився, і зупиняється разом із таймером.
 */
function useDismissTimer(duration: number, onDone: () => void) {
  const remaining = useRef(duration);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [paused, setPaused] = useState(false);

  const start = useCallback(() => {
    startedAt.current = Date.now();
    timer.current = setTimeout(onDone, remaining.current);
  }, [onDone]);

  const pause = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
    }
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    if (!timer.current) {
      start();
    }
    setPaused(false);
  }, [start]);

  useEffect(() => {
    start();
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, [start]);

  return { paused, pause, resume };
}

function ToastCard({ toast, onClose }: { toast: ToastItem; onClose: (id: number) => void }) {
  const { t } = useTranslation();
  const close = useCallback(() => onClose(toast.id), [onClose, toast.id]);
  const duration = DURATION[toast.severity];
  const { paused, pause, resume } = useDismissTimer(duration, close);

  return (
    <Paper
      elevation={6}
      // role="alert": тост озвучується читачем екрана одразу, як і раніше (Alert у Snackbar).
      role="alert"
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        pointerEvents: 'auto',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.5,
        width: { xs: '100%', sm: 380 },
        p: 1.5,
        pr: 1,
        borderRadius: '16px',
        animation: toast.leaving
          ? `${leave} ${EXIT_MS}ms ease-in forwards`
          : { xs: `${enterMobile} 360ms ${EASE_SPRING} backwards`, sm: `${enterDesktop} 420ms ${EASE_SPRING} backwards` },
      }}
    >
      <Box
        aria-hidden
        sx={(theme) => ({
          width: 36,
          height: 36,
          flexShrink: 0,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          color: theme.palette[toast.severity].main,
          bgcolor: alpha(theme.palette[toast.severity].main, 0.12),
          '& svg': { fontSize: 22 },
        })}
      >
        {toast.icon ?? SEVERITY_ICON[toast.severity]}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0, pt: toast.title ? 0 : 1 }}>
        {toast.title && (
          <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
            {toast.title}
          </Typography>
        )}
        <Typography variant="body2" sx={{ lineHeight: 1.4, overflowWrap: 'anywhere' }}>
          {toast.message}
        </Typography>
        {toast.action && (
          <Button
            size="small"
            onClick={() => {
              toast.action?.onClick();
              close();
            }}
            sx={{ mt: 0.5, ml: -1, px: 1 }}
          >
            {toast.action.label}
          </Button>
        )}
      </Box>
      <IconButton size="small" aria-label={t('common.close')} onClick={close} sx={{ mt: -0.25 }}>
        <CloseIcon fontSize="small" />
      </IconButton>
      <Box
        aria-hidden
        sx={(theme) => ({
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 3,
          transformOrigin: 'left',
          bgcolor: theme.palette[toast.severity].main,
          opacity: 0.7,
          animation: `${shrinkX} ${duration}ms linear forwards`,
          animationPlayState: paused ? 'paused' : 'running',
        })}
      />
    </Paper>
  );
}

/** Спливні повідомлення про результат дії й нові події: стос до чотирьох, з анімацією появи й зникнення. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((items) => items.map((item) => (item.id === id ? { ...item, leaving: true } : item)));
  }, []);

  // Тост, що йде, прибирається після короткої анімації зникнення (таймер, а не animationend: так і без анімацій).
  useEffect(() => {
    const leaving = new Set(toasts.filter((item) => item.leaving).map((item) => item.id));
    if (leaving.size === 0) {
      return;
    }

    const timer = setTimeout(() => setToasts((items) => items.filter((item) => !leaving.has(item.id))), EXIT_MS);
    return () => clearTimeout(timer);
  }, [toasts]);

  const show = useCallback(
    (message: string, severity: Severity = 'success', options: ToastOptions = {}) => {
      const id = nextId.current++;
      const lang = i18n.language;
      setToasts((items) => {
        // Тости іншою мовою вже не показуються - їх не тримаємо.
        const next = [...items.filter((item) => item.lang === lang), { id, message, severity, lang, leaving: false, ...options }];
        const visible = next.filter((item) => !item.leaving);
        const oldest = new Set(visible.slice(0, Math.max(0, visible.length - MAX_VISIBLE)).map((item) => item.id));
        return oldest.size === 0 ? next : next.map((item) => (oldest.has(item.id) ? { ...item, leaving: true } : item));
      });
    },
    [i18n],
  );

  const value = useMemo(() => ({ show }), [show]);
  // Текст тосту складено мовою, що діяла в ту мить: після перемикання мови старі тости зникають,
  // інакше в англійському інтерфейсі лишався б український рядок.
  const shown = toasts.filter((item) => item.lang === i18n.language);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Box
        sx={(theme) => ({
          position: 'fixed',
          zIndex: theme.zIndex.snackbar,
          pointerEvents: 'none',
          display: 'flex',
          gap: 1,
          left: { xs: 12, sm: 'auto' },
          right: { xs: 12, sm: 20 },
          bottom: { xs: 12, sm: 'auto' },
          top: { xs: 'auto', sm: 124 },
          // Найновіший тост - найближче до краю, звідки вони з'являються.
          flexDirection: { xs: 'column', sm: 'column-reverse' },
          transition: `gap 200ms ${EASE_OUT}`,
        })}
      >
        {shown.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onClose={dismiss} />
        ))}
      </Box>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error('useToast must be used inside ToastProvider');
  }

  return value;
}
