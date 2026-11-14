import { keyframes } from '@emotion/react';

/**
 * Рух інтерфейсу FarmCart: спільні криві, тривалості й ключові кадри, щоб анімації всіх екранів були однакові.
 * Для користувачів із «prefers-reduced-motion: reduce» тема гасить усі анімації й переходи (див. theme.ts).
 */
export const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
/** Легкий «перестрибок» у кінці - для появи дрібних елементів (бейджі, плитки, тости). */
export const EASE_SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

export const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: none; }
`;

export const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

export const popIn = keyframes`
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: none; }
`;

/** Лічильник змінився: бейдж коротко «підстрибує». */
export const bump = keyframes`
  0% { transform: scale(1) translate(50%, -50%); }
  30% { transform: scale(1.45) translate(35%, -35%); }
  60% { transform: scale(0.9) translate(55%, -55%); }
  100% { transform: scale(1) translate(50%, -50%); }
`;

/** Дзвіночок «дзеленчить», коли прийшло нове сповіщення. */
export const ring = keyframes`
  0%, 100% { transform: rotate(0); }
  12% { transform: rotate(16deg); }
  24% { transform: rotate(-14deg); }
  36% { transform: rotate(10deg); }
  48% { transform: rotate(-6deg); }
  60% { transform: rotate(3deg); }
`;

/** Поточний крок трекера й «нові» позначки м'яко пульсують кольором елемента. */
export const glow = keyframes`
  0%, 100% { filter: drop-shadow(0 0 0 currentColor); transform: scale(1); }
  50% { filter: drop-shadow(0 0 6px currentColor); transform: scale(1.12); }
`;

export const pulseDot = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(255, 179, 0, 0.6); }
  70% { box-shadow: 0 0 0 10px rgba(255, 179, 0, 0); }
  100% { box-shadow: 0 0 0 0 rgba(255, 179, 0, 0); }
`;

/** Відблиск, що пробігає поверхнею (код вручення). */
export const shine = keyframes`
  0% { transform: translateX(-150%) skewX(-20deg); }
  60%, 100% { transform: translateX(350%) skewX(-20deg); }
`;

export const float = keyframes`
  0%, 100% { transform: translateY(0) rotate(0); }
  50% { transform: translateY(-10px) rotate(4deg); }
`;

/** Смуга заповнюється зліва направо до свого значення (кінцевий кадр - власний стиль елемента). */
export const growX = keyframes`
  from { transform: translateX(-100%); }
`;

/** Підкреслення заголовка сторінки «виростає». */
export const growWidth = keyframes`
  from { width: 0; opacity: 0; }
`;

/** Галочка «малюється» штрихом. */
export const drawStroke = keyframes`
  to { stroke-dashoffset: 0; }
`;

export const confettiFall = keyframes`
  0% { opacity: 0; transform: translate3d(0, -20px, 0) rotate(0); }
  10% { opacity: 1; }
  100% { opacity: 0; transform: translate3d(var(--drift, 0px), 180px, 0) rotate(var(--spin, 360deg)); }
`;

/** Смужка часу на тості зменшується до нуля за час показу. */
export const shrinkX = keyframes`
  from { transform: scaleX(1); }
  to { transform: scaleX(0); }
`;

/**
 * Поява елемента списку «хвилею»: кожен наступний - трохи пізніше (не довше ~0,5 с для довгих списків).
 * fill-mode backwards: після появи анімація не тримає transform, тож ефекти наведення працюють як завжди.
 */
export function enter(index = 0, step = 45) {
  return {
    animation: `${fadeUp} 480ms ${EASE_OUT} backwards`,
    animationDelay: `${Math.min(index, 10) * step}ms`,
  } as const;
}
