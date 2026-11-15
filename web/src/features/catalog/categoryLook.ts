/** Тло зображення товару за категорією: пастельний колір, на якому лежить ілюстрація товару (art/ProductArt). */
export interface CategoryLook {
  tint: string;
}

const LOOKS: Record<string, CategoryLook> = {
  vegetables: { tint: 'linear-gradient(135deg, #fff1e3 0%, #fde0c2 100%)' },
  fruits: { tint: 'linear-gradient(135deg, #ffecec 0%, #fdd5d2 100%)' },
  berries: { tint: 'linear-gradient(135deg, #fdeef4 0%, #f9d4e3 100%)' },
  dairy: { tint: 'linear-gradient(135deg, #eef6fb 0%, #d8e9f4 100%)' },
  honey: { tint: 'linear-gradient(135deg, #fff6e0 0%, #fbe2a6 100%)' },
  'meat-eggs': { tint: 'linear-gradient(135deg, #f8f1ea 0%, #ecdccb 100%)' },
  bakery: { tint: 'linear-gradient(135deg, #fbf3e6 0%, #f0dcbc 100%)' },
};

const DEFAULT_LOOK: CategoryLook = { tint: 'linear-gradient(135deg, #eef5ea 0%, #d9ead2 100%)' };

export function categoryLook(category: string): CategoryLook {
  return LOOKS[category] ?? DEFAULT_LOOK;
}

/** Тло картинки товару: у темній темі пастельний колір категорії притемнено, щоб не сліпив на темному тлі. */
export function artBackground(tint: string, mode: 'light' | 'dark'): string {
  return mode === 'dark' ? `linear-gradient(rgba(0, 0, 0, 0.38), rgba(0, 0, 0, 0.38)), ${tint}` : tint;
}

/** Залишок, з якого товар вважається «майже розпроданим»: лише тоді картка показує залишок. */
export const LOW_STOCK = 10;
