import type { Criterion } from '../engine/scoring.ts';
import { seriesACriteria } from '../engine/scoring.ts';
import type { GameState } from '../engine/types.ts';
import { compactMoney, fixed, pct, ratio } from '../format.ts';
import { t } from '../i18n/index.ts';

export interface GoalRow {
  criterion: Criterion;
  shown: string;
  target: string;
  progress: number | null;
  met: boolean;
}

// Series A goals as the player can see them: PMF is known only from a survey.
export function goalRows(state: GameState): GoalRow[] {
  const survey = [...state.growthResearch].reverse().find((g) => g.kind === 'pmf' && g.value !== undefined);
  return seriesACriteria(state).map((c) => {
    const target = c.format === 'money' ? compactMoney(c.target) : c.format === 'ratio' ? fixed(c.target, 1) : pct(c.target, 0);
    // After the game the real PMF is revealed together with the other results.
    if (c.id === 'pmf' && state.phase !== 'end') {
      const v = survey?.value ?? null;
      return { criterion: c, shown: v === null ? t('не измерено') : pct(v, 0), target, progress: v === null ? null : v / c.target, met: v !== null && v >= c.target };
    }
    if (state.history.length === 0) return { criterion: c, shown: '—', target, progress: null, met: false };
    const shown = c.format === 'money' ? compactMoney(c.actual) : c.format === 'ratio' ? ratio(c.actual) : pct(c.actual);
    return { criterion: c, shown, target, progress: Math.max(0, (c.actual ?? 0) / c.target), met: c.met };
  });
}

export const GOAL_SHORT: Record<Criterion['id'], string> = {
  mrr: 'MRR',
  ltvCac: 'LTV / CAC',
  growth: t('Рост MRR в мес.'),
  pmf: 'PMF',
};
