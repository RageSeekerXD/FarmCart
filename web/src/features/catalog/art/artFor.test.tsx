import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { artFor, CATEGORY_ICON, PRODUCT_ARTS } from './artFor';
import { ProductArt } from './ProductArt';

/** Усі 50 товарів демонстраційних даних сервера (src/FarmCart.Api/DemoData.cs): назва українською й англійською, категорія. */
const DEMO: readonly [string, string, string][] = [
  ['Яблука «Голден»', 'Golden Delicious apples', 'fruits'],
  ['Картопля', 'Potatoes', 'vegetables'],
  ['Морква', 'Carrots', 'vegetables'],
  ['Полуниця', 'Strawberries', 'berries'],
  ['Груші «Конференція»', 'Conference pears', 'fruits'],
  ['Бринза овеча', 'Sheep bryndza cheese', 'dairy'],
  ["Молоко коров'яче", "Cow's milk", 'dairy'],
  ['Сир «Гірський»', 'Hirskyi mountain cheese', 'dairy'],
  ['Сметана домашня', 'Homemade sour cream', 'dairy'],
  ['Масло вершкове', 'Butter', 'dairy'],
  ['Мед липовий', 'Linden honey', 'honey'],
  ['Мед гречаний', 'Buckwheat honey', 'honey'],
  ['Мед акацієвий', 'Acacia honey', 'honey'],
  ['Мед у стільниках', 'Comb honey', 'honey'],
  ['Буряк', 'Beetroot', 'vegetables'],
  ['Капуста білокачанна', 'White cabbage', 'vegetables'],
  ['Цибуля ріпчаста', 'Onions', 'vegetables'],
  ['Часник', 'Garlic', 'vegetables'],
  ['Огірки', 'Cucumbers', 'vegetables'],
  ['Помідори', 'Tomatoes', 'vegetables'],
  ['Кріп', 'Dill', 'vegetables'],
  ['Петрушка', 'Parsley', 'vegetables'],
  ['Малина', 'Raspberries', 'berries'],
  ['Лохина', 'Blueberries', 'berries'],
  ['Смородина чорна', 'Blackcurrants', 'berries'],
  ['Малина заморожена', 'Frozen raspberries', 'berries'],
  ['Варення малинове', 'Raspberry jam', 'berries'],
  ['Яблука «Чемпіон»', 'Champion apples', 'fruits'],
  ['Сік яблучний', 'Apple juice', 'fruits'],
  ['Яйця курячі', 'Chicken eggs', 'meat-eggs'],
  ['Яйця перепелині', 'Quail eggs', 'meat-eggs'],
  ['Курка домашня', 'Free-range chicken', 'meat-eggs'],
  ['Філе куряче', 'Chicken fillet', 'meat-eggs'],
  ['Ковбаса домашня', 'Homemade sausage', 'meat-eggs'],
  ['Сало копчене', 'Smoked salo', 'meat-eggs'],
  ['Свинина (ошийок)', 'Pork neck', 'meat-eggs'],
  ['Хліб житній', 'Rye bread', 'bakery'],
  ['Хліб пшеничний на заквасці', 'Wheat sourdough bread', 'bakery'],
  ['Паляниця', 'Palianytsia bread', 'bakery'],
  ['Булочка з маком', 'Poppy seed bun', 'bakery'],
  ['Пиріг з яблуками', 'Apple pie', 'bakery'],
  ['Молоко козине', "Goat's milk", 'dairy'],
  ['Сир козиний', 'Goat cheese', 'dairy'],
  ['Кефір', 'Kefir', 'dairy'],
  ['Картопля молода', 'New potatoes', 'vegetables'],
  ['Салат листовий', 'Leaf lettuce', 'vegetables'],
  ['Шпинат', 'Spinach', 'vegetables'],
  ['Перець солодкий', 'Sweet peppers', 'vegetables'],
  ['Квасоля', 'Beans', 'vegetables'],
  ['Капуста квашена', 'Sauerkraut', 'vegetables'],
];

describe('ілюстрації товарів', () => {
  it('кожен демонстраційний товар має власний малюнок: буряк, капуста й картопля не однакові', () => {
    const arts = DEMO.map(([uk, en, category]) => artFor({ uk, en }, category));

    expect(arts.filter((art) => art.startsWith('basket:'))).toEqual([]);
    expect(new Set(arts).size).toBe(DEMO.length);
    expect(new Set(arts)).toEqual(new Set(PRODUCT_ARTS));
  });

  it('вид товару впізнається й лише за українською назвою', () => {
    expect(artFor({ uk: 'Мед травневий', en: '' }, 'honey')).toBe('honey-linden');
    expect(artFor({ uk: 'Сир твердий', en: '' }, 'dairy')).toBe('hard-cheese');
    expect(artFor({ uk: 'Пиріг з вишнями', en: '' }, 'bakery')).toBe('apple-pie');
  });

  it('невідомий товар отримує кошик у кольорах своєї категорії', () => {
    expect(artFor({ uk: 'Кабачки', en: 'Zucchini' }, 'vegetables')).toBe('basket:vegetables');
    expect(artFor(null, 'dairy')).toBe('basket:dairy');
  });

  it('кожна категорія має значок для швидких фільтрів', () => {
    expect(Object.keys(CATEGORY_ICON).sort()).toEqual(['bakery', 'berries', 'dairy', 'fruits', 'honey', 'meat-eggs', 'vegetables']);
  });

  it('кожен малюнок малюється й прихований від читачів екрана', () => {
    for (const art of [...PRODUCT_ARTS, 'basket:honey', 'basket:unknown'] as const) {
      const { container, unmount } = render(<ProductArt art={art} size={48} />);
      const svg = container.querySelector('svg')!;
      expect(svg.getAttribute('aria-hidden'), art).toBe('true');
      expect(svg.querySelectorAll('*').length, art).toBeGreaterThan(3);
      unmount();
    }
  });
});
