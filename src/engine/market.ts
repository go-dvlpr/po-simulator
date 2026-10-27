// The world around the product: live competitors, regulation and new markets.

import { COMPLIANCE } from '../data/compliance.ts';
import { featureDef, scenarioOf } from './catalog.ts';
import { report } from './effects.ts';
import type { Rng } from './rng.ts';
import { chance, createRng, pick, uniform } from './rng.ts';
import { clamp } from './stats.ts';
import type { CompetitorState, GameState, ScenarioDef } from './types.ts';
import { t } from '../i18n/index.ts';

// Competitive pressure of a typical market: effects are neutral around it.
const TYPICAL_PRESSURE = 0.38;

export function initCompetitors(sc: ScenarioDef, seed: number): CompetitorState[] {
  // A separate stream keeps the hidden world the same for a seed.
  const rng = createRng(seed + 4242);
  return sc.competitors.map((c) => ({
    name: c.name,
    // "Excel + WhatsApp"-like status quo has no real product and does not move.
    strength: c.features.length <= 1 ? 0.3 : uniform(rng, 0.35, 0.75),
    features: [...c.features],
    priceCutUntil: 0,
  }));
}

function userFacing(s: GameState): string[] {
  const sc = scenarioOf(s);
  return sc.features
    .filter((f) => s.product.features[f.id]?.shipped && f.kano !== 'must' && !f.enablesRevenue && !f.tags?.some((t) => t === 'cms' || t === 'auth'))
    .map((f) => f.id);
}

// 0 — no one competes with you, 1 — strong rivals offer the same and cut prices.
export function competitivePressure(s: GameState): number {
  const mine = userFacing(s);
  const rivals = s.competitors.filter((c) => c.features.length > 1);
  if (rivals.length === 0) return 0;
  const total = rivals.reduce((sum, c) => {
    const overlap = mine.length === 0 ? 1 : mine.filter((id) => c.features.includes(id)).length / mine.length;
    return sum + c.strength * (0.4 + 0.6 * overlap) * (c.priceCutUntil > s.week ? 1.3 : 1);
  }, 0);
  return clamp(total / rivals.length, 0, 1);
}

// How pressure changes conversion and ad prices, relative to a typical market.
export function pressureEffects(pressure: number): { conversion: number; cpi: number } {
  return {
    conversion: clamp(1 - 0.3 * (pressure - TYPICAL_PRESSURE), 0.85, 1.12),
    cpi: clamp(1 + 0.25 * (pressure - TYPICAL_PRESSURE), 0.9, 1.15),
  };
}

// Your features no competitor has: the core of differentiation.
export function uniqueFeatures(s: GameState): string[] {
  return userFacing(s).filter((id) => !s.competitors.some((c) => c.features.includes(id)));
}

function news(s: GameState, text: string): void {
  s.competitorNews.push({ week: s.week, text });
  s.competitorNews = s.competitorNews.slice(-20);
}

// Competitors copy what works, cut prices and raise money.
export function competitorMonth(s: GameState, rng: Rng): void {
  const sc = scenarioOf(s);
  const mine = userFacing(s);
  s.competitors.forEach((c, i) => {
    if (c.features.length <= 1) return;
    // The scenario holds the name in the current language; the save may have another one.
    const name = sc.competitors[i]?.name ?? c.name;
    const missing = mine.filter((id) => !c.features.includes(id));
    if (missing.length > 0 && chance(rng, 0.06 + 0.1 * c.strength)) {
      const id = pick(rng, missing);
      c.features.push(id);
      news(s, t('{0} выпустил свою версию функции «{1}».', [name, featureDef(sc, id).name]));
      report(s, t('Конкурент {0} скопировал вашу функцию «{1}». Уникальных функций стало меньше.', [name, featureDef(sc, id).name]), 'bad', 'marketing');
    } else if (c.priceCutUntil <= s.week && chance(rng, 0.035)) {
      c.priceCutUntil = s.week + 8;
      news(s, t('{0} снизил цены на два месяца.', [name]));
      report(s, t('{0} снизил цены: следующие два месяца конвертировать будет тяжелее.', [name]), 'bad', 'marketing');
    } else if (c.strength < 0.85 && chance(rng, 0.025)) {
      c.strength = clamp(c.strength + 0.15, 0, 0.9);
      news(s, t('{0} привлёк инвестиции и усилил маркетинг.', [name]));
    }
  });
}

export function complianceDef(id: string) {
  const def = COMPLIANCE.find((c) => c.id === id);
  if (!def) throw new Error(`unknown compliance ${id}`);
  return def;
}

// Requirements that apply to this game and are not done yet.
export function missingCompliance(s: GameState): string[] {
  return COMPLIANCE.filter((c) => c.applies(s) && !s.compliance.includes(c.id)).map((c) => c.id);
}

export const EXPANSION_COST = 30000;
export const EXPANSION_POINTS = 20;
export const EXPANSION_DELAY_WEEKS = 8;

// After localization the reachable market is bigger, but ads there cost a bit more.
export function expansionLive(s: GameState): boolean {
  return s.expandedWeek !== null && s.week >= s.expandedWeek + EXPANSION_DELAY_WEEKS;
}
