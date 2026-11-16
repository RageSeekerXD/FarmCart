import { keyframes } from '@emotion/react';
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/** Замовлення чи доставка, на які вказує посилання зі сповіщення: ?order=1001. */
export function useHighlightedId(param = 'order'): number | null {
  const [params] = useSearchParams();
  const id = Number(params.get(param));
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** ref для виділеного елемента: щойно він з'явився на сторінці, вона прокручується до нього. */
export function useScrollIntoView() {
  return useCallback((element: HTMLElement | null) => {
    element?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, []);
}

const flash = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 179, 0, 0); }
  30% { box-shadow: 0 0 0 6px rgba(255, 179, 0, 0.55); }
`;

/** Стиль виділеного елемента: бурштинова рамка й короткий спалах навколо. */
export const highlightSx = {
  outline: '3px solid',
  outlineColor: 'secondary.main',
  outlineOffset: 2,
  animation: `${flash} 1.4s ease-out 2`,
} as const;
