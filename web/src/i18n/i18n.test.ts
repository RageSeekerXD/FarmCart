import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/client';
import { CYRILLIC } from '../test/render';
import en from './en.json';
import i18n, { errorMessage, formatMoney, formatNumber, storedLang } from './index';
import uk from './uk.json';

/** Дерево перекладів; списки (пункти умов, типові причини) перевіряються поелементно, як рядки з ключами 0, 1, … */
type Tree = { [key: string]: string | readonly string[] | Tree };

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((all, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? { ...all, [path]: value } : { ...all, ...flatten(value as Tree, path) };
  }, {});
}

const ukrainian = flatten(uk);
const english = flatten(en);

describe('переклади інтерфейсу', () => {
  it('ключі uk.json і en.json збігаються', () => {
    expect(Object.keys(english).sort()).toEqual(Object.keys(ukrainian).sort());
  });

  it('жоден переклад не порожній', () => {
    for (const [key, value] of [...Object.entries(ukrainian), ...Object.entries(english)]) {
      expect(value.trim(), key).not.toBe('');
    }
  });

  it('англійські тексти не містять кирилиці', () => {
    for (const [key, value] of Object.entries(english)) {
      expect(CYRILLIC.test(value), `${key}: ${value}`).toBe(false);
    }
  });

  it('параметри {{...}} однакові в обох мовах', () => {
    const placeholders = (text: string) => [...text.matchAll(/{{\s*(\w+)\s*}}/g)].map((match) => match[1]).sort();
    for (const key of Object.keys(ukrainian)) {
      expect(placeholders(english[key] ?? ''), key).toEqual(placeholders(ukrainian[key] ?? ''));
    }
  });
});

describe('повідомлення про помилки', () => {
  it('обирається за кодом API мовою інтерфейсу, а не з українського тексту сервера', async () => {
    const error = new ApiError(400, 'code_invalid', 'Невірний код. Залишилось спроб: 4');

    expect(errorMessage(error)).toBe(uk.errors.code_invalid);
    await i18n.changeLanguage('en');
    expect(errorMessage(error)).toBe(en.errors.code_invalid);
  });

  it('невідомий код і не-API помилка дають загальне повідомлення', () => {
    expect(errorMessage(new ApiError(418, 'teapot', 'Я чайник'))).toBe(uk.errors.unknown);
    expect(errorMessage(new Error('boom'))).toBe(uk.errors.unknown);
  });
});

describe('мова та формати', () => {
  it('вибір мови зберігається в localStorage і відновлюється', async () => {
    expect(storedLang()).toBe('uk');

    await i18n.changeLanguage('en');

    expect(localStorage.getItem('farmcart.lang')).toBe('en');
    expect(storedLang()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('гроші й числа форматуються за мовою без кирилиці в англійській', () => {
    expect(formatMoney(1234.5, 'uk')).toMatch(/1\s?234,50\s?₴/);
    expect(formatMoney(1234.5, 'en')).toBe('₴1,234.50');
    expect(formatNumber(7.6, 'uk')).toBe('7,6');
    expect(formatNumber(7.6, 'en')).toBe('7.6');
  });
});
