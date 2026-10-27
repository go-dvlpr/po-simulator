// Lookups into scenario and tech catalogs for a given game state.

import { roleDef } from '../data/roles.ts';
import { SCENARIOS } from '../data/scenarios/index.ts';
import {
  ANALYTICS_OPTIONS,
  AUTH_OPTIONS,
  BACKEND_OPTIONS,
  EXPERIMENT_OPTIONS,
  INFRA_OPTIONS,
  PRACTICES,
  PROCESSES,
} from '../data/tech.ts';
import type {
  Capability,
  ChannelDef,
  Difficulty,
  FeatureDef,
  GameState,
  ProcessDef,
  RoleId,
  ScenarioDef,
  SegmentDef,
  TechCategory,
  TechMods,
  TechOption,
} from './types.ts';
import { t } from '../i18n/index.ts';

export const DEADLINE_WEEKS = 72;
export const WEEKS_PER_MONTH = 4;
export const START_YEAR = 2026;
export const START_MONTH = 10; // November (0-based)

export const DIFFICULTY: Record<Difficulty, { name: string; cost: number; events: number; noise: number; description: string }> = {
  easy: { name: t('Лёгкий'), cost: 0.88, events: 0.7, noise: 0.7, description: t('Больше денег, дешевле реклама, реже неприятности, ниже планка раунда.') },
  normal: { name: t('Нормальный'), cost: 0.9, events: 1, noise: 1, description: t('Реалистичный баланс. Выиграть можно, но ошибки дорого стоят.') },
  hard: { name: t('Сложный'), cost: 1.12, events: 1.3, noise: 1.3, description: t('Мало денег, дорогой трафик, частые проблемы и высокие требования инвесторов.') },
};

export function scenarioOf(s: GameState): ScenarioDef {
  return SCENARIOS[s.scenarioId];
}

export function featureDef(sc: ScenarioDef, id: string): FeatureDef {
  const f = sc.features.find((x) => x.id === id);
  if (!f) throw new Error(`unknown feature ${id}`);
  return f;
}

export function channelDef(sc: ScenarioDef, id: string): ChannelDef {
  const c = sc.channels.find((x) => x.id === id);
  if (!c) throw new Error(`unknown channel ${id}`);
  return c;
}

export function segmentDef(sc: ScenarioDef, id: string): SegmentDef {
  const seg = sc.segments.find((x) => x.id === id);
  if (!seg) throw new Error(`unknown segment ${id}`);
  return seg;
}

export function techOptions(sc: ScenarioDef, category: TechCategory): TechOption[] {
  switch (category) {
    case 'platform':
      return sc.platformOptions;
    case 'payments':
      return sc.paymentOptions;
    case 'backend':
      return BACKEND_OPTIONS;
    case 'infra':
      return INFRA_OPTIONS;
    case 'analytics':
      return ANALYTICS_OPTIONS;
    case 'experiments':
      return EXPERIMENT_OPTIONS;
    case 'auth':
      return AUTH_OPTIONS;
  }
}

export function techOption(sc: ScenarioDef, category: TechCategory, id: string): TechOption {
  const option = techOptions(sc, category).find((o) => o.id === id);
  if (!option) throw new Error(`unknown ${category} option ${id}`);
  return option;
}

export function processDef(s: GameState): ProcessDef {
  return PROCESSES.find((p) => p.id === s.tech.process) ?? PROCESSES[0];
}

// All tech modifiers that currently apply (chosen options and practices).
export function activeTechMods(s: GameState): TechMods[] {
  const sc = scenarioOf(s);
  const platform = techOption(sc, 'platform', s.tech.platform);
  const categories: TechCategory[] = ['infra', 'analytics', 'experiments', 'payments', 'auth'];
  if (!platform.mods.disablesBackend) categories.push('backend');
  const mods = [platform.mods, ...categories.map((c) => techOption(sc, c, s.tech[c]).mods)];
  for (const id of s.tech.practices) {
    const practice = PRACTICES.find((p) => p.id === id);
    if (practice) mods.push(practice.mods);
  }
  return mods;
}

type MultKey = 'velocity' | 'bugs' | 'debt' | 'ux' | 'registration' | 'outage';
type SumKey = 'infraFixed' | 'infraPerUser' | 'monthly' | 'revenueFee';

export function techMult(s: GameState, key: MultKey): number {
  return activeTechMods(s).reduce((acc, m) => acc * (m[key] ?? 1), 1);
}

export function techSum(s: GameState, key: SumKey): number {
  return activeTechMods(s).reduce((acc, m) => acc + (m[key] ?? 0), 0);
}

export function capabilities(s: GameState): Set<Capability> {
  const sc = scenarioOf(s);
  return new Set(techOption(sc, 'platform', s.tech.platform).mods.caps ?? []);
}

export function scaleLimit(s: GameState): number {
  const limit = activeTechMods(s).reduce((acc, m) => Math.min(acc, m.scaleLimit ?? Infinity), Infinity);
  return limit * (s.flags.scaleBoost ?? 1);
}

export function storeFee(s: GameState): number {
  const sc = scenarioOf(s);
  const platform = techOption(sc, 'platform', s.tech.platform);
  return platform.mods.storeFee ?? sc.storeFee;
}

// Tech setup work (analytics instrumentation, CI, cluster, ...), in story points.
export function techSetupPoints(s: GameState): number {
  return activeTechMods(s).reduce((acc, m) => acc + (m.setupPoints ?? 0), 0);
}

export function effortMult(s: GameState, feature: FeatureDef): number {
  let mult = 1;
  for (const tag of feature.tags ?? []) {
    for (const m of activeTechMods(s)) mult *= m.effort?.[tag] ?? 1;
  }
  return mult;
}

export function membersWithRole(s: GameState, role: RoleId): number {
  return s.team.filter((m) => m.role === role && m.joinWeek <= s.week).length;
}

export function hasRole(s: GameState, role: RoleId): boolean {
  return membersWithRole(s, role) > 0;
}

// Relative noise of observed product metrics; null when nothing is tracked.
export function analyticsNoise(s: GameState): number | null {
  if (s.tech.analytics === 'none') return null;
  const sc = scenarioOf(s);
  let noise = techOption(sc, 'analytics', s.tech.analytics).mods.noise ?? 0.1;
  if (s.tech.analytics === 'dwh' && !hasRole(s, 'analyst')) noise = 0.1;
  if (hasRole(s, 'analyst')) noise *= 0.7;
  if ((s.flags.trackingBroken ?? 0) > s.week) noise += 0.2;
  return noise * DIFFICULTY[s.difficulty].noise;
}

export function hasCohorts(s: GameState): boolean {
  const sc = scenarioOf(s);
  return techOption(sc, 'analytics', s.tech.analytics).mods.cohorts === true;
}

export function channelAvailable(s: GameState, channel: ChannelDef): { ok: boolean; reason?: string } {
  const req = channel.requires;
  if (req?.capability && !capabilities(s).has(req.capability)) {
    return { ok: false, reason: t('Недоступно на выбранной платформе (нет приложения в App Store)') };
  }
  if (req?.feature && !s.product.features[req.feature]?.shipped) {
    const name = scenarioOf(s).features.find((f) => f.id === req.feature)?.name ?? req.feature;
    return { ok: false, reason: t('Нужна выпущенная функция «{0}»', [name]) };
  }
  if (req?.role && !hasRole(s, req.role)) {
    return { ok: false, reason: t('Нужен сотрудник в команде: {0}', [roleDef(req.role).name.toLowerCase()]) };
  }
  if ((s.marketing.disabledUntil[channel.id] ?? 0) > s.week) {
    return { ok: false, reason: t('Канал временно заблокирован') };
  }
  return { ok: true };
}

export function monthIndex(week: number): number {
  return Math.floor(week / WEEKS_PER_MONTH);
}

export function calendarMonth(week: number): number {
  return (START_MONTH + monthIndex(week)) % 12;
}

const MONTH_NAMES = [t('Январь'), t('Февраль'), t('Март'), t('Апрель'), t('Май'), t('Июнь'), t('Июль'), t('Август'), t('Сентябрь'), t('Октябрь'), t('Ноябрь'), t('Декабрь')];

export function dateLabel(week: number): string {
  const total = START_MONTH + monthIndex(week);
  return `${MONTH_NAMES[total % 12]} ${START_YEAR + Math.floor(total / 12)}`;
}

export function monthlyPayroll(s: GameState, atWeek = s.week): number {
  const team = s.team.filter((m) => m.joinWeek <= atWeek).reduce((sum, m) => sum + m.salary, 0);
  return scenarioOf(s).baseMonthlyCost + team;
}
