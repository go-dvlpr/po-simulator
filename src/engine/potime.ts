// The product owner's own time: interviews, analysis and meetings are not free.
// Each turn gives a budget of hours; actions that need the PO personally spend it.

import type { Action } from './game.ts';
import type { GameState, Phase, ResearchMethod } from './types.ts';
import { t } from '../i18n/index.ts';

// Hours per turn after recurring meetings: a week in discovery, two weeks per sprint, a month after launch.
export const TURN_HOURS: Record<Phase, number> = {
  discovery: 32,
  strategy: 32,
  setup: 32,
  build: 64,
  launch: 32,
  growth: 120,
  end: 0,
};

const RESEARCH_HOURS: Record<ResearchMethod, number> = {
  desk: 3,
  competitors: 4,
  expert: 6,
  interviews: 0,
  survey: 5,
  smoke: 5,
  prototype: 10,
  concierge: 16,
};

const GROWTH_RESEARCH_HOURS: Record<string, number> = { pmf: 3, nps: 3, churn: 12, feature_survey: 3, usability: 10 };

export function researchHours(method: ResearchMethod, count = 10): number {
  return method === 'interviews' ? Math.round(count * 1.5) : RESEARCH_HOURS[method];
}

// Hours an action takes; 0 for routine settings.
export function actionHours(action: Action): number {
  switch (action.type) {
    case 'start_research':
      return researchHours(action.method, action.params.count);
    case 'order_research':
      return GROWTH_RESEARCH_HOURS[action.kind] ?? 4;
    case 'start_experiment':
      return 4;
    case 'set_okr':
      return 4;
    case 'hire':
      return 4;
    case 'pivot':
      return 16;
    case 'big_launch':
      return 8;
    case 'do_compliance':
      return 6;
    case 'expand_market':
      return 20;
    case 'raise_bridge':
      return 20;
    default:
      return 0;
  }
}

export function resetHours(s: GameState): void {
  s.poHours = TURN_HOURS[s.phase];
}

export function hoursError(s: GameState, hours: number): string | null {
  return hours > s.poHours ? t('Не хватает вашего времени: нужно {0} ч, осталось {1} ч на этот ход.', [hours, Math.round(s.poHours)]) : null;
}
