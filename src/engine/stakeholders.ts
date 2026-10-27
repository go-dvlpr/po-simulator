// Team leads besides the CEO. Each has a relationship with the product owner
// that moves with your decisions and changes how well their area works.

import { scenarioOf } from './catalog.ts';
import { report } from './effects.ts';
import { clamp } from './stats.ts';
import type { GameState, StakeholderId } from './types.ts';
import { t } from '../i18n/index.ts';

export interface StakeholderDef {
  name: string;
  role: string;
  cares: string;
  low: string;
  high: string;
}

export const STAKEHOLDERS: Record<StakeholderId, StakeholderDef> = {
  cto: {
    name: 'CTO',
    role: t('Технический директор'),
    cares: t('Техдолг, качество кода, реалистичные сроки'),
    low: t('Команда работает медленнее, мотивация падает'),
    high: t('Команда работает чуть быстрее'),
  },
  sales: {
    name: t('Руководитель продаж'),
    role: t('Продажи и крупные клиенты'),
    cares: t('Функции для сделок, обещания клиентам, скидки'),
    low: t('Сделки закрываются хуже'),
    high: t('Сделки закрываются чуть лучше'),
  },
  marketing: {
    name: t('Руководитель маркетинга'),
    role: t('Каналы, бренд, креативы'),
    cares: t('Стабильный бюджет, громкие запуски, свобода экспериментов'),
    low: t('Реклама обходится дороже'),
    high: t('Реклама обходится чуть дешевле'),
  },
  support: {
    name: t('Руководитель поддержки'),
    role: t('Поддержка и успех клиентов'),
    cares: t('Мало багов, нормальная нагрузка, ответы клиентам'),
    low: t('Клиенты уходят чаще'),
    high: t('Клиенты уходят чуть реже'),
  },
};

export function stakeholderIds(s: GameState): StakeholderId[] {
  // A B2C product has no sales team to speak of.
  return scenarioOf(s).kind === 'b2b' ? ['cto', 'sales', 'marketing', 'support'] : ['cto', 'marketing', 'support'];
}

export function addRelation(s: GameState, id: StakeholderId, delta: number): void {
  s.stakeholders[id] = clamp(s.stakeholders[id] + delta, 0, 100);
}

// Multiplier for the area a stakeholder owns: below 30 hurts, above 75 helps a little.
export function relationEffect(s: GameState, id: StakeholderId, low: number, high: number): number {
  const v = s.stakeholders[id];
  if (v < 30) return low;
  if (v > 75) return high;
  return 1;
}

// Monthly drift: leads react to what happens in their area.
export function stakeholderMonth(s: GameState): void {
  const last = s.history[s.history.length - 1];
  const prev = s.history[s.history.length - 2];
  if (s.product.debt > 40) addRelation(s, 'cto', -3);
  else if (s.allocation.debt >= 0.15) addRelation(s, 'cto', 1);
  if (s.overtime) addRelation(s, 'cto', -2);
  if (last?.support && last.support.tickets > last.support.capacity) addRelation(s, 'support', -4);
  else if (s.product.bugs < 15) addRelation(s, 'support', 1);
  if (s.product.bugs > 30) addRelation(s, 'support', -2);
  if (last && prev) {
    const now = Object.values(last.spend).reduce((a, b) => a + b, 0);
    const before = Object.values(prev.spend).reduce((a, b) => a + b, 0);
    if (before > 0 && now < before * 0.7) addRelation(s, 'marketing', -3);
    else if (now >= before) addRelation(s, 'marketing', 1);
  }
  if (scenarioOf(s).kind === 'b2b' && last && (last.pipeline ?? 0) > (last.truth.newPaying ?? 0) * 1.5) addRelation(s, 'sales', -2);
  for (const id of stakeholderIds(s)) {
    if (s.stakeholders[id] < 30) report(s, t('{0}: отношения испорчены. {1}.', [STAKEHOLDERS[id].name, STAKEHOLDERS[id].low]), 'bad', 'team');
  }
}
