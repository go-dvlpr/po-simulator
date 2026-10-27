// Creates a new game: randomizes the hidden market truth for the scenario.

import { CEO_STYLES, MARKET_CONDITIONS, ceoStyle, marketCondition } from '../data/context.ts';
import { SCENARIOS } from '../data/scenarios/index.ts';
import { initCompetitors } from './market.ts';
import { TURN_HOURS } from './potime.ts';
import { DIFFICULTY } from './catalog.ts';
import type { Rng } from './rng.ts';
import { createRng, normal, uniform } from './rng.ts';
import { clamp } from './stats.ts';
import type { Difficulty, ExperimentIdeaDef, ExperimentTruth, GameState, Lever, ReportLine, ScenarioId, World } from './types.ts';
import { t } from '../i18n/index.ts';

export const STATE_VERSION = 3;

function experimentTruth(rng: Rng, e: ExperimentIdeaDef): ExperimentTruth {
  return {
    effect: e.sd > 0 ? normal(rng, e.mean, e.sd) : e.mean,
    novelty: (e.novelty ?? 0) * uniform(rng, 0.6, 1.4),
  };
}

function createWorld(scenarioId: ScenarioId, difficulty: Difficulty, seed: number): { world: World; rng: number } {
  const sc = SCENARIOS[scenarioId];
  const rng = createRng(seed);
  const spread = difficulty === 'hard' ? 1.2 : 1;

  const segments: World['segments'] = {};
  for (const seg of sc.segments) {
    segments[seg.id] = {
      severity: clamp(seg.severity * uniform(rng, 1 - 0.22 * spread, 1 + 0.25 * spread), 0.15, 0.95),
      wtp: seg.wtp * uniform(rng, 1 - 0.25 * spread, 1 + 0.35 * spread),
      fit: clamp(seg.fit * uniform(rng, 1 - 0.22 * spread, 1 + 0.25 * spread), 0.15, 0.95),
      churn: seg.churn * uniform(rng, 0.85, 1.2),
      stickiness: clamp(seg.stickiness * uniform(rng, 0.85, 1.15), 0.1, 0.9),
      size: Math.round(seg.size * uniform(rng, 0.8, 1.2)),
    };
  }

  const featureValue: World['featureValue'] = {};
  const featureEffortMult: World['featureEffortMult'] = {};
  for (const f of sc.features) {
    featureValue[f.id] = {};
    for (const seg of sc.segments) {
      featureValue[f.id][seg.id] = (f.value[seg.id] ?? 0) * uniform(rng, 0.7, 1.3);
    }
    // Teams tend to underestimate: the true effort is ~15% higher on average.
    featureEffortMult[f.id] = clamp(Math.exp(normal(rng, 0.12, 0.25)), 0.75, 2);
  }

  const channelCost: World['channelCost'] = {};
  for (const c of sc.channels) {
    channelCost[c.id] = c.cost * uniform(rng, 0.8, 1.25) * DIFFICULTY[difficulty].cost;
  }

  const experiments: World['experiments'] = {};
  for (const e of sc.experiments) experiments[e.id] = experimentTruth(rng, e);

  // Drawn last so the rest of the world stays the same for a seed.
  const market = MARKET_CONDITIONS[Math.floor(rng.next() * MARKET_CONDITIONS.length)];
  const ceo = CEO_STYLES[Math.floor(rng.next() * CEO_STYLES.length)];
  for (const seg of Object.values(segments)) {
    seg.wtp *= market.wtp;
    seg.churn *= market.churn;
  }

  return { world: { market: market.id, ceo: ceo.id, segments, featureValue, featureEffortMult, channelCost, experiments }, rng: rng.state() };
}

export function newGame(scenarioId: ScenarioId, difficulty: Difficulty, seed: number): GameState {
  const sc = SCENARIOS[scenarioId];
  const { world, rng } = createWorld(scenarioId, difficulty, seed);
  const leverMods: Record<Lever, number> = { registration: 1, activation: 1, conversion: 1, retention: 1, virality: 1 };
  const featureSignals: Record<string, Record<string, { sum: number; weight: number }>> = {};
  const channelHints: Record<string, Record<string, number>> = {};
  for (const seg of sc.segments) {
    featureSignals[seg.id] = {};
    channelHints[seg.id] = {};
  }
  const budgets: Record<string, number> = {};
  const creative: Record<string, number> = {};
  const assets: Record<string, number> = {};
  for (const c of sc.channels) {
    budgets[c.id] = 0;
    creative[c.id] = 1;
    assets[c.id] = 0;
  }

  return {
    version: STATE_VERSION,
    seed,
    rng,
    scenarioId,
    difficulty,
    week: 0,
    phase: 'discovery',
    cash: sc.startCash[difficulty],
    trust: 60,
    morale: 75,
    world,
    hypotheses: [],
    activeResearch: [],
    reports: [],
    knowledge: {
      marketSize: {},
      competitorsKnown: false,
      featureSignals,
      channelHints,
      waitlist: 0,
      uxIssuesFound: 0,
    },
    strategy: null,
    pricing: { price: sc.defaultPrice, model: 'trial', annual: false, proTier: false, dunning: false, dealDiscount: 0 },
    tech: {
      platform: sc.flavor.defaultPlatform,
      backend: 'monolith',
      infra: 'paas',
      analytics: 'none',
      experiments: 'none',
      payments: sc.paymentOptions[0].id,
      auth: 'managed',
      practices: [],
      process: 'scrum',
    },
    team: [],
    mvpScope: [],
    commitWeeks: null,
    buildStartWeek: null,
    product: {
      features: {},
      bugs: 0,
      debt: 0,
      ux: 1,
      leverMods,
      setupPoints: 0,
      lostPoints: 0,
      rating: 4.5,
    },
    allocation: { features: 0.7, debt: 0.15, bugs: 0.15 },
    featureQueue: [],
    overtime: false,
    marketing: { budgets, creative, assets, disabledUntil: {}, refreshCosts: 0, crm: 0 },
    experiments: [],
    cohorts: [],
    history: [],
    sprints: [],
    growthResearch: [],
    pendingGrowthResearch: [],
    modifiers: [],
    pendingEvents: [],
    firedEvents: [],
    log: [],
    score: { discovery: 0, strategy: 0, delivery: 0, growth: 0, experiments: 0, finance: 0, stakeholders: 0 },
    flags: {},
    launch: null,
    lastReport: [
      { text: t('Рыночная обстановка: «{0}». {1}', [marketCondition(world.market).title, marketCondition(world.market).text]), tone: 'info' },
      { text: t('CEO {0}: стиль «{1}». {2}', [sc.ceoName, ceoStyle(world.ceo).title, ceoStyle(world.ceo).text]), tone: 'info' },
    ],
    milestones: [],
    okrs: [],
    inbox: [],
    unlockedIdeas: [],
    releaseWithAb: false,
    stakeholders: { cto: 60, sales: 60, marketing: 60, support: 60 },
    poHours: TURN_HOURS.discovery,
    competitors: initCompetitors(sc, seed),
    competitorNews: [],
    compliance: [],
    expandedWeek: null,
    dilution: 0,
    ending: null,
    nextId: 0,
  };
}

const toLine = (l: string | ReportLine): ReportLine => (typeof l === 'string' ? { text: l, tone: 'info' } : l);

// Upgrades a save from an older version. Returns null when the save cannot be used.
export function migrateState(raw: GameState): GameState | null {
  if (raw.version === STATE_VERSION) return raw;
  if (raw.version !== 1 && raw.version !== 2) return null;
  const s = structuredClone(raw);
  const sc = SCENARIOS[s.scenarioId];
  s.lastReport = (s.lastReport as (string | ReportLine)[]).map(toLine);
  s.pricing.proTier ??= false;
  s.marketing.crm ??= 0;
  s.milestones ??= [];
  s.okrs ??= [];
  s.inbox ??= [];
  s.unlockedIdeas ??= [];
  s.releaseWithAb ??= false;
  s.world.market ??= 'normal';
  s.world.ceo ??= 'balanced';
  s.pricing.dunning ??= false;
  s.pricing.dealDiscount ??= 0;
  s.stakeholders ??= { cto: 60, sales: 60, marketing: 60, support: 60 };
  s.poHours ??= TURN_HOURS[s.phase];
  s.competitors ??= initCompetitors(sc, s.seed);
  s.competitorNews ??= [];
  s.compliance ??= [];
  s.expandedWeek ??= null;
  s.dilution ??= 0;
  for (const c of s.cohorts) {
    c.price ??= s.pricing.price;
    c.seatMult ??= 1;
    c.quality ??= 1;
  }
  for (const h of s.history) {
    h.notes = (h.notes as (string | ReportLine)[]).map(toLine);
    for (const m of [h.truth, h.obs]) {
      m.nrr ??= null;
      m.northStar ??= null;
    }
  }
  // Experiment ideas added in this version need hidden effects.
  const rng = createRng(s.seed + 7777);
  for (const e of sc.experiments) s.world.experiments[e.id] ??= experimentTruth(rng, e);
  s.version = STATE_VERSION;
  return s;
}
