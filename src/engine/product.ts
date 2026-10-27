// Product model: perceived value, funnel rates, effort estimates and team capacity.

import { LEVEL_BUGS, LEVEL_POINTS, sourceDef } from '../data/roles.ts';
import {
  capabilities,
  effortMult,
  featureDef,
  hasRole,
  processDef,
  scaleLimit,
  scenarioOf,
  techMult,
} from './catalog.ts';
import { modifierMult } from './effects.ts';
import { competitivePressure, pressureEffects } from './market.ts';
import { relationEffect } from './stakeholders.ts';
import type { Rng } from './rng.ts';
import { uniform } from './rng.ts';
import { clamp, priceAcceptance } from './stats.ts';
import type { Allocation, GameState, Lever, ScenarioDef, SegmentTruth } from './types.ts';
import { t } from '../i18n/index.ts';

const LEVERS: Lever[] = ['registration', 'activation', 'conversion', 'retention', 'virality'];

export interface ProductContext {
  segmentId: string;
  seg: SegmentTruth;
  value: number;
  vpMatch: number;
  lifts: Record<Lever, number>;
  quality: number;
  ux: number;
  mustMissing: string[];
  revenueEnabled: boolean;
  wtpEff: number;
}

export function targetSegmentId(s: GameState): string {
  return s.strategy?.segmentId ?? scenarioOf(s).segments[0].id;
}

export function mustFeatures(sc: ScenarioDef, segmentId: string): string[] {
  return sc.features.filter((f) => f.kano === 'must' || f.mustFor?.includes(segmentId)).map((f) => f.id);
}

export function liveFeatures(s: GameState, includeCompleted: boolean): string[] {
  return Object.entries(s.product.features)
    .filter(([, p]) => (includeCompleted ? p.completed : p.shipped))
    .map(([id]) => id);
}

export function lastMau(s: GameState): number {
  return s.history.length > 0 ? (s.history[s.history.length - 1].truth.mau ?? 0) : 0;
}

export function productContext(s: GameState, includeCompleted = false): ProductContext {
  const sc = scenarioOf(s);
  const segmentId = targetSegmentId(s);
  const seg = s.world.segments[segmentId];
  const vp = sc.valueProps.find((v) => v.id === s.strategy?.valuePropId);
  const vpMatch = vp?.match[segmentId] ?? 1;
  const live = liveFeatures(s, includeCompleted);
  const musts = mustFeatures(sc, segmentId);
  const mustMissing = musts.filter((id) => !live.includes(id));
  const coverage = musts.length > 0 ? (musts.length - mustMissing.length) / musts.length : 1;

  let bonus = 0;
  const lifts: Record<Lever, number> = { registration: 1, activation: 1, conversion: 1, retention: 1, virality: 1 };
  for (const id of live) {
    const def = featureDef(sc, id);
    const v = s.world.featureValue[id]?.[segmentId] ?? 0;
    if (!musts.includes(id)) bonus += v * 0.045;
    for (const lever of LEVERS) lifts[lever] *= 1 + (def.effects[lever] ?? 0) * v;
  }
  for (const lever of LEVERS) lifts[lever] *= s.product.leverMods[lever] * modifierMult(s, lever);

  const value = clamp(seg.fit * vpMatch * (0.55 + 0.45 * coverage) + Math.min(bonus, 0.35), 0.05, 1.4);
  let quality = 1 - (0.45 * s.product.bugs) / (s.product.bugs + 60);
  if (lastMau(s) > scaleLimit(s)) quality *= 0.85;
  const ux =
    techMult(s, 'ux') *
    (hasRole(s, 'designer') ? 1.08 : 1) *
    (1 + 0.025 * Math.min(s.knowledge.uxIssuesFound, 4)) *
    s.product.ux;
  const revenueEnabled = live.some((id) => featureDef(sc, id).enablesRevenue);
  const wtpEff = seg.wtp * (0.7 + 0.4 * value) * Math.sqrt(vpMatch);

  return { segmentId, seg, value, vpMatch, lifts, quality, ux, mustMissing, revenueEnabled, wtpEff };
}

export interface FunnelRates {
  registration: number;
  activation: number;
  conversion: number;
  acceptance: number;
  retentionFloor: number;
  churnMult: number;
  annualShare: number;
  proShare: number;
  arppu: number;
}

// Share of churn that lifecycle messaging (emails, push, win-back) removes. Diminishing returns.
export function crmLift(s: GameState): number {
  if (s.marketing.crm <= 0) return 0;
  const skill = hasRole(s, 'marketer') ? 1 : 0.7;
  const reach = capabilities(s).has('push') ? 1 : 0.8;
  return 0.16 * (1 - Math.exp(-s.marketing.crm / 1500)) * skill * reach;
}

export function funnelRates(s: GameState, ctx: ProductContext, price = s.pricing.price): FunnelRates {
  const sc = scenarioOf(s);
  const model = sc.pricingModels.find((m) => m.id === s.pricing.model) ?? sc.pricingModels[0];
  const segDef = sc.segments.find((x) => x.id === ctx.segmentId);
  const blockingMissing = ctx.mustMissing.filter((id) => !featureDef(sc, id).enablesRevenue).length;

  // Improvements compound with diminishing returns.
  const lift = (lever: Lever) => ctx.lifts[lever] ** 0.75;
  // People with a sharper problem try harder to get value and stay longer.
  const severity = 0.8 + 0.35 * ctx.seg.severity;
  const competition = pressureEffects(competitivePressure(s));
  const registration = clamp(
    sc.funnel.regRate * techMult(s, 'registration') * lift('registration') * model.regMult * Math.sqrt(ctx.ux),
    0.001,
    0.9,
  );
  const activation = clamp(
    sc.funnel.actRate * (0.45 + 0.6 * ctx.value) * lift('activation') * ctx.quality * ctx.ux * severity * 0.6 ** blockingMissing,
    0.01,
    sc.funnel.actMax,
  );
  const acceptance = priceAcceptance(price, ctx.wtpEff);
  const salesFactor = segDef?.needsSales && !hasRole(s, 'sales') ? 0.45 : 1;
  const modelFactor = model.needsRole && !hasRole(s, model.needsRole) ? 0.5 : 1;
  // A second, pricier plan adds a choice on the paywall: slightly fewer buyers, higher average check.
  const proShare = s.pricing.proTier ? clamp(0.08 + 0.3 * (ctx.value - 0.6), 0.05, 0.3) : 0;
  const conversion = ctx.revenueEnabled
    ? clamp(
        sc.funnel.payMax *
          acceptance *
          lift('conversion') *
          model.payMult *
          Math.sqrt(ctx.quality * ctx.ux) *
          salesFactor *
          modelFactor *
          (s.pricing.proTier ? 0.97 : 1) *
          competition.conversion *
          0.75 ** blockingMissing,
        0,
        sc.funnel.payMax * 1.25,
      )
    : 0;
  const crm = crmLift(s);
  const retentionFloor = clamp(
    ctx.seg.stickiness * 0.3 * ctx.value ** 0.8 * Math.sqrt(ctx.lifts.retention) * ctx.quality * severity * 0.75 ** blockingMissing * (1 + 0.5 * crm),
    0.02,
    0.6,
  );

  const priceChurn = price > ctx.wtpEff ? 1 + 0.5 * (price / ctx.wtpEff - 1) : 1;
  const annualShare = s.pricing.annual ? (sc.kind === 'b2c' ? 0.3 : 0.25) : 0;
  // An overloaded support team answers slowly, and some customers leave because of it.
  const load = s.history[s.history.length - 1]?.support;
  const overload = load ? Math.max(0, load.tickets / Math.max(1, load.capacity) - 1) : 0;
  const supportFactor = (overload > 0 ? 1 + 0.15 * Math.min(1, overload) : hasRole(s, 'support') ? 0.95 : 1) * relationEffect(s, 'support', 1.05, 0.98);
  const churnMult = clamp(
    ((1.6 - 0.6 * ctx.value) / ctx.lifts.retention ** 0.7) *
      (2 - ctx.quality) *
      priceChurn *
      (s.pricing.annual ? 0.8 : 1) *
      supportFactor *
      (1 - crm) *
      modifierMult(s, 'churn'),
    0.25,
    3,
  );
  const seats = segDef?.seats ?? 1;
  // Family or multi-location plans raise the average check when customers value them.
  const planBonus = sc.features.reduce((sum, f) => {
    if (!f.arppu || !s.product.features[f.id]?.shipped) return sum;
    return sum + f.arppu * Math.min(1.2, s.world.featureValue[f.id]?.[ctx.segmentId] ?? 0);
  }, 0);
  const arppu = price * seats * (1 - annualShare * sc.annualDiscount) * (1 + proShare) * (1 + planBonus);

  return { registration, activation, conversion, acceptance, retentionFloor, churnMult, annualShare, proShare, arppu };
}

// Share of active users who would be "very disappointed" without the product.
export function pmfScore(ctx: ProductContext): number {
  const mustPenalty = ctx.mustMissing.length > 0 ? 0.7 : 1;
  return clamp(
    0.08 + 0.38 * ctx.value ** 1.2 * ctx.quality * Math.min(1.3, Math.sqrt(ctx.lifts.retention)) * mustPenalty,
    0.02,
    0.75,
  );
}

// ---------- Effort ----------

function fibRound(x: number): number {
  const fib = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
  return fib.reduce((best, f) => (Math.abs(f - x) < Math.abs(best - x) ? f : best), fib[0]);
}

function cmsDiscount(s: GameState, featureId: string): number {
  const sc = scenarioOf(s);
  const def = featureDef(sc, featureId);
  return def.tags?.includes('content') && s.product.features.cms?.completed ? 0.75 : 1;
}

// The estimate the team gives (what the player sees).
export function featureEstimate(s: GameState, featureId: string): number {
  const def = featureDef(scenarioOf(s), featureId);
  return fibRound(def.effort * effortMult(s, def) * cmsDiscount(s, featureId));
}

// The real effort, revealed only while building.
export function featureEffort(s: GameState, featureId: string): number {
  const def = featureDef(scenarioOf(s), featureId);
  const noise = processDef(s).estimateNoise;
  const trueMult = 1 + (s.world.featureEffortMult[featureId] - 1) * noise;
  return def.effort * effortMult(s, def) * cmsDiscount(s, featureId) * Math.max(0.6, trueMult);
}

// ---------- Capacity ----------

export interface CapacityFactor {
  label: string;
  value: number;
}

export interface Capacity {
  total: number;
  devs: number;
  factors: CapacityFactor[];
}

// Story points per 2-week sprint. With rng = null returns the expected value
// for the full team (including people who have not started yet).
export function sprintCapacity(s: GameState, rng: Rng | null): Capacity {
  const devs = s.team.filter((m) => m.role === 'developer' && (rng === null || m.joinWeek <= s.week));
  const base = devs.reduce((sum, m) => {
    const ramp = rng && s.week - m.joinWeek < 4 ? 0.5 : 1;
    const skill = rng ? m.skill : 1;
    return sum + LEVEL_POINTS[m.level] * skill * sourceDef(m.source).productivity * ramp;
  }, 0);
  const factors: CapacityFactor[] = [];
  const add = (label: string, value: number) => {
    if (Math.abs(value - 1) > 0.005) factors.push({ label, value });
  };
  add(t('Технологии и практики'), techMult(s, 'velocity'));
  add(t('Процесс'), processDef(s).velocity);
  add(t('Координация большой команды'), devs.length > 4 ? Math.max(0.7, 1 - 0.05 * (devs.length - 4)) : 1);
  add(t('Мотивация команды'), clamp(0.7 + (0.3 * s.morale) / 70, 0.6, 1.1));
  add(t('Технический долг'), 1 - (0.5 * s.product.debt) / (s.product.debt + 60));
  add(t('Овертайм'), s.overtime ? 1.2 : 1);
  add(t('Отношения с CTO'), relationEffect(s, 'cto', 0.93, 1.03));
  const sc = scenarioOf(s);
  const contentFeatures = sc.features.some((f) => f.tags?.includes('cms'));
  if (contentFeatures && s.phase === 'growth' && !s.product.features.cms?.completed) {
    add(t('Контент выкладывают разработчики (нет CMS)'), 0.92);
  }
  let total = factors.reduce((acc, f) => acc * f.value, base);
  if (rng) total *= uniform(rng, 0.85, 1.1);
  return { total, devs: devs.length, factors };
}

export function bugRate(s: GameState): number {
  const devs = s.team.filter((m) => m.role === 'developer' && m.joinWeek <= s.week);
  const devBugs =
    devs.length > 0
      ? devs.reduce((sum, m) => sum + LEVEL_BUGS[m.level] * sourceDef(m.source).bugs, 0) / devs.length
      : 1;
  return (
    0.35 *
    techMult(s, 'bugs') *
    processDef(s).bugs *
    devBugs *
    (hasRole(s, 'qa') ? 0.6 : 1) *
    (s.overtime ? 1.3 : 1)
  );
}

export function debtRate(s: GameState): number {
  const devs = s.team.filter((m) => m.role === 'developer' && m.joinWeek <= s.week);
  const seniorShare = devs.length > 0 ? devs.filter((m) => m.level === 'senior').length / devs.length : 0;
  return (
    0.22 *
    techMult(s, 'debt') *
    (1 - 0.3 * seniorShare) *
    (s.overtime ? 1.2 : 1) *
    (s.tech.process === 'adhoc' ? 1.2 : 1)
  );
}

export interface WorkResult {
  capacity: number;
  overhead: number;
  featurePoints: number;
  debtPoints: number;
  bugPoints: number;
  completed: string[];
}

// Applies `sprints` sprints of team work to the product. Mutates `s`.
export function doWork(s: GameState, rng: Rng, sprints: number, queue: string[], allocation: Allocation): WorkResult {
  let capacity = 0;
  for (let i = 0; i < sprints; i++) capacity += sprintCapacity(s, rng).total;
  let points = capacity;

  const setup = Math.min(points, s.product.setupPoints);
  s.product.setupPoints -= setup;
  points -= setup;
  const lost = Math.min(points, s.product.lostPoints);
  s.product.lostPoints -= lost;
  points -= lost;

  const totalAlloc = allocation.features + allocation.debt + allocation.bugs || 1;
  let featurePoints = (points * allocation.features) / totalAlloc;
  let debtPoints = (points * allocation.debt) / totalAlloc;
  let bugPoints = (points * allocation.bugs) / totalAlloc;

  const completed: string[] = [];
  let used = 0;
  for (const id of queue) {
    if (featurePoints - used <= 0.01) break;
    const progress = (s.product.features[id] ??= { done: 0, completed: false, shipped: false });
    if (progress.completed) continue;
    const need = featureEffort(s, id) - progress.done;
    const take = Math.min(need, featurePoints - used);
    progress.done += take;
    used += take;
    if (progress.done >= featureEffort(s, id) - 0.01) {
      progress.completed = true;
      progress.completedWeek = s.week;
      completed.push(id);
    }
  }
  // Unused feature capacity goes to quality work.
  const spare = featurePoints - used;
  featurePoints = used;
  debtPoints += spare / 2;
  bugPoints += spare / 2;

  s.product.bugs = Math.max(0, s.product.bugs + featurePoints * bugRate(s) - bugPoints * 0.8);
  s.product.debt = clamp(s.product.debt + featurePoints * debtRate(s) - debtPoints * 0.9, 0, 100);

  return { capacity, overhead: setup + lost, featurePoints, debtPoints, bugPoints, completed };
}
