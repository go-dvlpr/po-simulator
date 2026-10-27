// Aggregations over the monthly history.

import type { GameState, Metrics, MonthRecord } from './types.ts';

export function lastRecord(s: GameState): MonthRecord | undefined {
  return s.history[s.history.length - 1];
}

// Average month-over-month MRR growth over the last `months` months (geometric).
export function mrrGrowth(s: GameState, months: number): number | null {
  const h = s.history;
  if (h.length < months + 1) return null;
  const start = h[h.length - 1 - months].mrr;
  const end = h[h.length - 1].mrr;
  if (start <= 0) return end > 0 ? 1 : null;
  if (end <= 0) return -1;
  return (end / start) ** (1 / months) - 1;
}

export function avgTruth(s: GameState, key: keyof Metrics, months: number): number | null {
  const values = s.history
    .slice(-months)
    .map((r) => r.truth[key])
    .filter((v): v is number => v !== null && Number.isFinite(v));
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function runwayMonths(cash: number, burn: number): number {
  if (burn <= 0) return Infinity;
  return Math.max(0, cash / burn);
}
