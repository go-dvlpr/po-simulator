import { scenarioOf } from '../engine/catalog.ts';
import type { BenchmarkKey, GameState } from '../engine/types.ts';
import { fixed, pct } from '../format.ts';
import { t } from '../i18n/index.ts';

const PERCENT = new Set<BenchmarkKey>(['registrationRate', 'activationRate', 'conversionRate', 'retentionM1', 'churnRate', 'nrr']);

export function benchmarkRange(state: GameState, key: BenchmarkKey): string | null {
  const b = scenarioOf(state).benchmarks[key];
  if (!b) return null;
  if (PERCENT.has(key)) return `${fixed(b.low * 100, 0)}–${pct(b.high, 0)}`;
  return `${fixed(b.low, 0)}–${fixed(b.high, 0)}${key === 'payback' ? t(' мес') : ''}`;
}

// Compares a metric with the typical range for this market.
export function benchmark(state: GameState, key: BenchmarkKey, value: number | null | undefined): { text: string; tone: 'good' | 'ok' | 'bad' } | undefined {
  const b = scenarioOf(state).benchmarks[key];
  if (!b || value === null || value === undefined || !Number.isFinite(value)) return undefined;
  const range = t('норма {0}', [benchmarkRange(state, key)]);
  const better = b.better === 'up' ? value > b.high : value < b.low;
  const worse = b.better === 'up' ? value < b.low : value > b.high;
  if (worse) return { text: t('{0} · хуже нормы', [range]), tone: 'bad' };
  if (better) return { text: t('{0} · лучше нормы', [range]), tone: 'good' };
  return { text: t('{0} · в норме', [range]), tone: 'ok' };
}
