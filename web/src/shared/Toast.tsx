import { Alert, Snackbar } from '@mui/material';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

type Severity = 'success' | 'info' | 'warning' | 'error';

interface ToastApi {
  show: (message: string, severity?: Severity) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** Короткі повідомлення про результат дії; role="alert"/"status" озвучується читачем екрана. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const [shown, setToast] = useState<{ message: string; severity: Severity; key: number; lang: string } | null>(null);
  const show = useCallback(
    (message: string, severity: Severity = 'success') => {
      setToast({ message, severity, key: Date.now(), lang: i18n.language });
    },
    [i18n],
  );
  const value = useMemo(() => ({ show }), [show]);
  // Текст тосту складено мовою, що діяла в ту мить: після перемикання мови старий тост зникає,
  // інакше в англійському інтерфейсі лишався б український рядок.
  const toast = shown?.lang === i18n.language ? shown : null;

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Snackbar
        key={toast?.key}
        open={toast !== null}
        autoHideDuration={5000}
        onClose={(_, reason) => {
          if (reason !== 'clickaway') {
            setToast(null);
          }
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={toast?.severity ?? 'success'}
          variant="filled"
          onClose={() => setToast(null)}
          closeText={t('common.close')}
          sx={{ width: '100%' }}
        >
          {toast?.message}
        </Alert>
      </Snackbar>
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
