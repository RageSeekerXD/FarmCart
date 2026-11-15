import type { LocalizedText } from '../../../api/types';

/**
 * Ілюстрація товару, поки фермер не завантажив фото: кожен вид товару має власний малюнок
 * (буряк, капуста й картопля не виглядають однаково). Вид визначається за назвою товару обома мовами;
 * невідомий товар отримує кошик у кольорах своєї категорії.
 */
export const PRODUCT_ARTS = [
  'carrot', 'potato', 'new-potato', 'beet', 'cabbage', 'onion', 'garlic', 'cucumber', 'tomato', 'dill', 'parsley',
  'lettuce', 'spinach', 'pepper', 'beans', 'sauerkraut',
  'apple-golden', 'apple-red', 'pear', 'apple-juice',
  'strawberry', 'raspberry', 'blueberry', 'blackcurrant', 'frozen-raspberry', 'jam',
  'bryndza', 'milk', 'hard-cheese', 'sour-cream', 'butter', 'goat-milk', 'goat-cheese', 'kefir',
  'honey-linden', 'honey-buckwheat', 'honey-acacia', 'honeycomb',
  'eggs', 'quail-eggs', 'chicken', 'chicken-fillet', 'sausage', 'salo', 'pork',
  'rye-bread', 'sourdough', 'palianytsia', 'poppy-bun', 'apple-pie',
] as const;

export type ProductArtKey = (typeof PRODUCT_ARTS)[number];

/** Кошик із дарами категорії: запасний малюнок для товару, вид якого невідомий. */
export type BasketArtKey = `basket:${string}`;

export type ArtKey = ProductArtKey | BasketArtKey;

// Порядок важливий: «Пиріг з яблуками» - пиріг, а не яблука; «Капуста квашена» - не капуста; «Філе куряче» - не курка.
// \b у JavaScript не бачить меж кириличних слів, тож короткі кириличні слова шукаються з пробілами: « мед ».
const RULES: readonly (readonly [RegExp, ProductArtKey])[] = [
  [/sauerkraut|квашен/, 'sauerkraut'],
  [/new potato|картопля молода|молода картопля/, 'new-potato'],
  [/potato|картопл/, 'potato'],
  [/carrot|морк/, 'carrot'],
  [/beet|буряк/, 'beet'],
  [/cabbage|капуст/, 'cabbage'],
  [/onion|цибул/, 'onion'],
  [/garlic|часник/, 'garlic'],
  [/cucumber|огір/, 'cucumber'],
  [/tomato|помідор|томат/, 'tomato'],
  [/\bdill\b| кріп /, 'dill'],
  [/parsley|петрушк/, 'parsley'],
  [/lettuce|салат/, 'lettuce'],
  [/spinach|шпинат/, 'spinach'],
  [/pepper|перець|перц/, 'pepper'],
  [/\bbeans?\b|квасол/, 'beans'],
  [/juice| сік /, 'apple-juice'],
  [/\bpie\b|пиріг/, 'apple-pie'],
  [/\bjam\b|варення|джем|конфітюр/, 'jam'],
  [/frozen|заморож/, 'frozen-raspberry'],
  [/golden|голден/, 'apple-golden'],
  [/apple|яблук/, 'apple-red'],
  [/\bpears?\b|груш/, 'pear'],
  [/strawberr|полуниц|суниц/, 'strawberry'],
  [/raspberr|малин/, 'raspberry'],
  [/blueberr|лохин|чорниц/, 'blueberry'],
  [/currant|смородин/, 'blackcurrant'],
  [/\bcomb\b|стільник/, 'honeycomb'],
  [/buckwheat|гречан/, 'honey-buckwheat'],
  [/acacia|акаці/, 'honey-acacia'],
  [/honey| мед /, 'honey-linden'],
  [/goat.*milk|молоко козин/, 'goat-milk'],
  [/goat.*cheese|сир козин/, 'goat-cheese'],
  [/kefir|кефір/, 'kefir'],
  [/sour cream|сметан/, 'sour-cream'],
  [/butter|масло/, 'butter'],
  [/bryndza|бринз/, 'bryndza'],
  [/cheese| сир /, 'hard-cheese'],
  [/milk|молок/, 'milk'],
  [/quail|перепел/, 'quail-eggs'],
  [/\beggs?\b|яйц/, 'eggs'],
  [/fillet|філе/, 'chicken-fillet'],
  [/chicken|курк|куряч/, 'chicken'],
  [/sausage|ковбас/, 'sausage'],
  [/\bsalo\b| сало /, 'salo'],
  [/pork|свинин|ошийок/, 'pork'],
  [/\brye\b|житн/, 'rye-bread'],
  [/palianytsia|паляниц/, 'palianytsia'],
  [/\bbuns?\b|булоч/, 'poppy-bun'],
  [/sourdough|bread|loaf|хліб|заквас/, 'sourdough'],
];

/** Малюнок товару за назвою (обома мовами) і категорією. */
export function artFor(name: LocalizedText | null | undefined, category: string): ArtKey {
  // Назва обрамлена пробілами, лапки й дужки стають пробілами: « мед » знаходиться і в «Мед липовий».
  const text = name ? ` ${name.en} ${name.uk} `.toLowerCase().replace(/[«»"'’().,]/g, ' ') : '';
  const rule = RULES.find(([pattern]) => pattern.test(text));
  return rule ? rule[1] : `basket:${category}`;
}

/** Ілюстрація-значок категорії для швидких фільтрів каталогу. */
export const CATEGORY_ICON: Record<string, ProductArtKey> = {
  vegetables: 'carrot',
  fruits: 'apple-red',
  berries: 'strawberry',
  dairy: 'hard-cheese',
  honey: 'honey-linden',
  'meat-eggs': 'eggs',
  bakery: 'palianytsia',
};
