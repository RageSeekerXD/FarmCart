import i18n from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import { ApiError } from '../api/client';
import type { Lang, LocalizedText } from '../api/types';
import en from './en.json';
import uk from './uk.json';

export const LANG_KEY = 'farmcart.lang';
export const LANGS: readonly Lang[] = ['uk', 'en'];

export function storedLang(): Lang {
  return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'uk';
}

void i18n.use(initReactI18next).init({
  resources: { uk: { translation: uk }, en: { translation: en } },
  lng: storedLang(),
  fallbackLng: 'uk',
  interpolation: { escapeValue: false },
  returnNull: false,
});

function applyLang(lang: string) {
  document.documentElement.lang = lang;
}

applyLang(i18n.language);
i18n.on('languageChanged', (lang) => {
  localStorage.setItem(LANG_KEY, lang);
  applyLang(lang);
});

/** Поточна мова інтерфейсу й вибір потрібного варіанта з двомовного поля API. */
export function useLang() {
  const { i18n: instance } = useTranslation();
  const lang: Lang = instance.language === 'en' ? 'en' : 'uk';
  return {
    lang,
    setLang: (next: Lang) => void instance.changeLanguage(next),
    pick: (text: LocalizedText) => text[lang],
  };
}

/** Текст помилки мовою інтерфейсу: за кодом API, а не за його українським повідомленням. */
export function errorMessage(error: unknown): string {
  const code = error instanceof ApiError ? error.code : 'unknown';
  const key = `errors.${code}`;
  return i18n.exists(key) ? i18n.t(key) : i18n.t('errors.unknown');
}

export function formatMoney(amount: number, lang: Lang): string {
  return new Intl.NumberFormat(lang === 'uk' ? 'uk-UA' : 'en-GB', {
    style: 'currency',
    currency: 'UAH',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(value: number, lang: Lang, digits = 1): string {
  return new Intl.NumberFormat(lang === 'uk' ? 'uk-UA' : 'en-GB', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export default i18n;
