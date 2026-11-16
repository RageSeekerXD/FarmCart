import { Box, GlobalStyles } from '@mui/material';
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Друк частини сторінки (пакувальна накладна, лист збирання): вміст рендериться в окремий блок поза застосунком,
 * під час друку видно лише його, а на екрані його немає. Після друку (чи скасування) onDone прибирає блок.
 */
export function PrintArea({ children, onDone }: { children: ReactNode; onDone: () => void }) {
  // Друкуємо один раз: батьківський компонент передає щоразу нову функцію, тож вона йде через ref, а не в залежності ефекту.
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });

  useEffect(() => {
    const done = () => doneRef.current();
    window.addEventListener('afterprint', done);
    // Друк - після того, як блок потрапив у DOM.
    const timer = setTimeout(() => {
      try {
        window.print();
      } catch {
        done();
      }
    }, 50);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('afterprint', done);
    };
  }, []);

  return createPortal(
    <>
      <GlobalStyles
        styles={{
          '.print-area': { display: 'none' },
          '@media print': {
            'body > *:not(.print-area)': { display: 'none !important' },
            '.print-area': { display: 'block', color: '#000', background: '#fff' },
            '@page': { margin: '14mm' },
          },
        }}
      />
      <Box className="print-area" data-testid="print-area" sx={{ fontFamily: 'system-ui, sans-serif', fontSize: 13 }}>
        {children}
      </Box>
    </>,
    document.body,
  );
}

/** Таблиця для друку: чорний текст, тонкі лінії, без кольорів теми. */
export const printTableSx = {
  width: '100%',
  borderCollapse: 'collapse',
  '& th, & td': { borderBottom: '1px solid #999', padding: '6px 4px', textAlign: 'left', verticalAlign: 'top' },
  '& th': { fontWeight: 700, borderBottom: '2px solid #000' },
} as const;
