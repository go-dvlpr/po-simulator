// Player-facing language. Russian strings in the code are the keys; the other languages map them to translations.
// The language is fixed for a page load: switching saves the choice and reloads the page,
// so texts built when modules load are always in the chosen language.

export type Locale = 'uk' | 'ru' | 'en';

export const LOCALES: { id: Locale; label: string }[] = [
  { id: 'uk', label: 'Українська' },
  { id: 'ru', label: 'Русский' },
  { id: 'en', label: 'English' },
];

const KEY = 'po-simulator-locale';
const DEFAULT_LOCALE: Locale = 'uk';

function storedLocale(): Locale {
  try {
    const v = globalThis.localStorage?.getItem(KEY);
    return v === 'uk' || v === 'ru' || v === 'en' ? v : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export const locale: Locale = storedLocale();

// Tag for number and date formatting.
export const intlLocale = { uk: 'uk-UA', ru: 'ru-RU', en: 'en-US' }[locale];

// Only the dictionary of the chosen language is loaded.
const dictionary: Record<string, string> = locale === 'uk' ? (await import('./uk.ts')).UK : locale === 'en' ? (await import('./en.ts')).EN : {};

// Translates a Russian source string; {0}, {1}… are replaced with params.
export function t(text: string, params?: readonly unknown[]): string {
  const s = dictionary[text] ?? text;
  if (!params) return s;
  return s.replace(/\{(\d+)\}/g, (m, i: string) => (Number(i) < params.length ? String(params[Number(i)]) : m));
}

export function setLocale(next: Locale): void {
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // Without storage the choice cannot survive the reload.
    return;
  }
  location.reload();
}
