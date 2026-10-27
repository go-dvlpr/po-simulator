import { intlLocale, t } from './i18n/index.ts';
// Number formatting for player-facing texts in the chosen language.

export function fixed(v: number, digits: number): string {
  return v.toLocaleString(intlLocale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function money(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const sign = v < 0 ? '−' : '';
  const abs = Math.abs(v);
  const d = abs < 100 && digits === 0 && abs % 1 !== 0 ? 2 : digits;
  return `${sign}$${fixed(abs, d)}`;
}

export function compactMoney(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const sign = v < 0 ? '−' : '';
  const abs = Math.abs(v);
  if (abs >= 1e6) return t('{0}${1} млн', [sign, fixed(abs / 1e6, 2)]);
  if (abs >= 1e4) return t('{0}${1} тыс.', [sign, fixed(abs / 1e3, 0)]);
  if (abs >= 1e3) return t('{0}${1} тыс.', [sign, fixed(abs / 1e3, 1)]);
  return `${sign}$${fixed(abs, abs < 100 && abs % 1 !== 0 ? 2 : 0)}`;
}

export function pct(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${fixed(v * 100, digits)}%`;
}

export function signedPct(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${v >= 0 ? '+' : '−'}${fixed(Math.abs(v * 100), digits)}%`;
}

export function num(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return fixed(v, digits);
}

export function ratio(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return v >= 100 ? '>100' : fixed(v, 1);
}

export function months(v: number): string {
  if (!Number.isFinite(v) || v > 99) return '∞';
  return t('{0} мес', [fixed(v, 1)]);
}
