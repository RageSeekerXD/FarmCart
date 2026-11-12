import type { Lang } from '../api/types';

const locale = (lang: Lang) => (lang === 'uk' ? 'uk-UA' : 'en-GB');

const time = (value: string, lang: Lang) =>
  new Intl.DateTimeFormat(locale(lang), { hour: '2-digit', minute: '2-digit' }).format(new Date(value));

/** Слот доставки: «пт, 13 лист., 10:00–12:00» / «Fri 13 Nov, 10:00–12:00». */
export function formatSlot(start: string, end: string, lang: Lang): string {
  const day = new Intl.DateTimeFormat(locale(lang), { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(start));
  return `${day}, ${time(start, lang)}–${time(end, lang)}`;
}

export function formatDateTime(value: string, lang: Lang): string {
  return new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

/** Місцеві дата й час із форми як ISO 8601 зі зміщенням пояса: сервер зберігає слот у часі адміністратора, а не в UTC. */
export function localIso(date: string, time: string): string {
  const offset = -new Date(`${date}T${time}`).getTimezoneOffset();
  const pad = (value: number) => String(Math.trunc(Math.abs(value))).padStart(2, '0');
  return `${date}T${time.length === 5 ? `${time}:00` : time}${offset >= 0 ? '+' : '-'}${pad(offset / 60)}:${pad(offset % 60)}`;
}
