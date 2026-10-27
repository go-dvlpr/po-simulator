// Scripted players used by tests to check that the game is winnable with good
// decisions and losable with bad ones.

import { channelAvailable, scenarioOf } from './catalog.ts';
import { eventDef } from './events.ts';
import { mvpEstimate } from './decisions.ts';
import { estimatedBurn } from './growth.ts';
import { lastRecord } from './metrics.ts';
import { overlappingTest } from './experiments.ts';
import { bridgeError } from './fundraising.ts';
import { missingCompliance } from './market.ts';
import { activeOkr } from './okr.ts';
import { mustFeatures } from './product.ts';
import { segmentOpportunity } from './research.ts';
import type { Action } from './game.ts';
import { gameReducer } from './game.ts';
import type { Difficulty, GameState, ScenarioId } from './types.ts';
import { newGame } from './world.ts';

export type Skill = 'expert' | 'naive';

// Preferred option per event for the expert player (default: first available).
const EXPERT_CHOICES: Record<string, number> = {
  d_ceo_impatient: 0,
  d_ceo_idea: 0,
  d_friends: 1,
  b_scope_creep: 1,
  b_estimate_wrong: 2,
  b_microservices: 1,
  b_burnout: 0,
  b_redesign: 1,
  g_competitor_price: 1,
  g_influencer: 1,
  g_ceo_pet: 1,
  g_big_client: 1,
  g_sales_promise: 1,
  g_data_bug: 0,
  g_payment_bug: 0,
  g_breach: 0,
  g_cash_crunch: 0,
  g_acquihire: 1,
  g_support_overload: 0,
  g_nocode_limits: 0,
  board_meeting: 0,
  g_privacy_fine: 0,
  g_coppa: 0,
  g_bank_audit: 0,
  s_cto_debt: 1,
  s_marketing_campaign: 1,
  s_support_help: 0,
  s_priority_conflict: 2,
  s_sales_discount: 1,
};

function resolveEvents(s: GameState, skill: Skill): GameState {
  let cur = s;
  for (let guard = 0; guard < 10 && cur.pendingEvents.length > 0; guard++) {
    const pending = cur.pendingEvents[0];
    const def = eventDef(pending.eventId);
    const preferred = skill === 'expert' ? (EXPERT_CHOICES[def.id] ?? 0) : def.options.length - 1;
    const order = [preferred, ...def.options.map((_, i) => i)];
    for (const i of order) {
      const next = gameReducer(cur, { type: 'resolve_event', option: i });
      if (next !== cur) {
        cur = next;
        break;
      }
    }
  }
  return cur;
}

function bestPrice(s: GameState, segmentId: string): number {
  const sc = scenarioOf(s);
  const wtp = s.world.segments[segmentId].wtp;
  return sc.priceOptions.reduce((best, p) => (Math.abs(p - wtp * 0.9) < Math.abs(best - wtp * 0.9) ? p : best), sc.priceOptions[0]);
}

export function autoplay(scenarioId: ScenarioId, difficulty: Difficulty, seed: number, skill: Skill): GameState {
  let s = newGame(scenarioId, difficulty, seed);
  const sc = scenarioOf(s);
  const expert = skill === 'expert';
  const act = (a: Action) => {
    s = resolveEvents(gameReducer(s, a), skill);
  };

  // ---------- Discovery ----------
  const opp = segmentOpportunity(s);
  const segIds = sc.segments.map((x) => x.id);
  const segmentId = expert ? segIds.sort((a, b) => opp[b] - opp[a])[0] : segIds[seed % segIds.length];
  if (expert) {
    for (const level of ['senior', 'middle', 'middle'] as const) act({ type: 'hire', role: 'developer', level, source: 'inhouse' });
    const price = bestPrice(s, segmentId);
    act({ type: 'add_hypothesis', hypothesis: { kind: 'problem', segmentId, criterionId: 'p_interview', threshold: 60 } });
    act({ type: 'add_hypothesis', hypothesis: { kind: 'wtp', segmentId, criterionId: 'w_fakedoor', threshold: 3.5, price } });
    act({ type: 'add_hypothesis', hypothesis: { kind: 'solution', segmentId, criterionId: 's_concierge', threshold: 45 } });
    act({ type: 'start_research', method: 'competitors', params: {} });
    act({ type: 'start_research', method: 'interviews', params: { segmentId, count: 10, script: 'open' } });
    act({ type: 'next_week' });
    act({ type: 'next_week' });
    act({ type: 'start_research', method: 'smoke', params: { segmentId, channelId: sc.channels[0].id, budget: 2500, price } });
    act({ type: 'start_research', method: 'concierge', params: { segmentId, price } });
    for (let i = 0; i < 4; i++) act({ type: 'next_week' });
  } else {
    act({ type: 'next_week' });
  }
  act({ type: 'finish_discovery' });

  const vp = sc.valueProps.reduce((best, v) => ((v.match[segmentId] ?? 1) > (best.match[segmentId] ?? 1) ? v : best));
  act({
    type: 'confirm_strategy',
    strategy: {
      segmentId,
      valuePropId: expert ? vp.id : sc.valueProps[0].id,
      northStarId: expert ? sc.northStars[0].id : sc.northStars[1].id,
    },
    pricing: { price: expert ? bestPrice(s, segmentId) : sc.priceOptions[sc.priceOptions.length - 1], model: 'trial', annual: expert, proTier: false, dunning: false, dealDiscount: 0 },
  });

  // ---------- Setup ----------
  if (expert) {
    act({ type: 'set_tech', patch: { analytics: 'product', experiments: 'platform', practices: ['codereview', 'cicd', 'monitoring'], process: 'scrum' } });
    act({ type: 'hire', role: 'qa', level: 'middle', source: 'inhouse' });
    const musts = mustFeatures(sc, segmentId);
    const top = sc.features
      .filter((f) => !musts.includes(f.id) && f.kano !== 'indifferent' && f.effort <= 13 && !f.monthlyCost)
      .sort((a, b) => (s.world.featureValue[b.id][segmentId] ?? 0) / b.effort - (s.world.featureValue[a.id][segmentId] ?? 0) / a.effort)
      .slice(0, 3);
    for (const f of top) if (!s.mvpScope.includes(f.id)) act({ type: 'toggle_scope', featureId: f.id });
  } else {
    act({ type: 'set_tech', patch: { backend: 'microservices', practices: [], process: 'adhoc' } });
    for (let i = 0; i < 4; i++) act({ type: 'hire', role: 'developer', level: 'junior', source: 'freelance' });
    for (const f of sc.features.filter((x) => x.kano === 'indifferent').slice(0, 3)) act({ type: 'toggle_scope', featureId: f.id });
  }
  const est = mvpEstimate(s).weeks;
  act({ type: 'start_build', commitWeeks: expert ? Math.ceil(est * 1.3) : Math.max(4, Math.floor(est * 0.6)) });

  // ---------- Build ----------
  for (let i = 0; i < 20 && s.phase === 'build'; i++) {
    const allDone = s.mvpScope.every((id) => s.product.features[id]?.completed);
    if (allDone) {
      act({ type: 'finish_build' });
      break;
    }
    act({ type: 'run_sprint' });
  }
  if (s.phase === 'build') act({ type: 'finish_build' });

  // ---------- Launch ----------
  if (s.phase === 'launch') {
    if (expert) act({ type: 'run_beta' });
    act({ type: 'launch', strategy: expert ? 'soft' : 'big', checklist: expert ? ['tracking', 'payments_test', 'privacy', 'store_page', 'support_kb', 'regression', 'onboarding_emails'] : [] });
  }

  // ---------- Growth ----------
  if (expert) act({ type: 'set_pricing', patch: { dunning: true } });
  let budget = sc.kind === 'b2c' ? 10000 : 8000;
  const segDef = sc.segments.find((x) => x.id === segmentId)!;
  for (let month = 0; month < 30 && s.phase === 'growth'; month++) {
    if (expert && month === 1) act({ type: 'hire', role: 'marketer', level: 'middle', source: 'inhouse' });
    if (expert && month === 3) act({ type: 'hire', role: 'designer', level: 'middle', source: 'inhouse' });
    // Post-launch research reveals better test ideas; lifecycle messaging cuts churn.
    const research: Record<number, string> = { 1: 'usability', 2: 'churn', 3: 'nps' };
    if (expert && research[month]) act({ type: 'order_research', kind: research[month] });
    if (expert && month === 2) act({ type: 'set_crm', amount: 1500 });
    // Compliance that blocks deals or risks fines.
    if (expert && month >= 1) for (const id of missingCompliance(s)) act({ type: 'do_compliance', id });
    // Raise a bridge before the money runs out.
    if (expert) {
      const burnNow = estimatedBurn(s);
      if (burnNow > 0 && s.cash / burnNow < 4 && !bridgeError(s)) act({ type: 'raise_bridge' });
    }
    if (expert && segDef.needsSales && month === 1) act({ type: 'hire', role: 'sales', level: 'middle', source: 'inhouse' });

    const last = lastRecord(s);
    if (expert && last?.support && last.support.tickets > last.support.capacity && !s.team.some((m) => m.role === 'support')) {
      act({ type: 'hire', role: 'support', level: 'middle', source: 'inhouse' });
    }
    if (expert && last && !activeOkr(s)) {
      act({ type: 'set_okr', goals: [{ metric: 'mrr', target: last.mrr * 1.15 }, { metric: 'paying', target: (last.obs.paying ?? 0) * 1.1 }] });
    }
    if (expert && last) {
      const ltvCac = last.truth.ltvCac ?? 0;
      const burn = estimatedBurn(s);
      const runway = burn > 0 ? s.cash / burn : 99;
      if (ltvCac > 2 && runway > 5) budget *= 1.25;
      else if (ltvCac < 1.2 || runway < 2.5) budget *= 0.8;
      budget = Math.max(4000, Math.min(budget, 60000));
    }
    const channels = sc.channels
      .filter((c) => c.kind === 'paid' && channelAvailable(s, c).ok)
      .sort((a, b) => (segDef.affinity[b.id] ?? 1) * b.intent / s.world.channelCost[b.id] - (segDef.affinity[a.id] ?? 1) * a.intent / s.world.channelCost[a.id]);
    const chosen = expert ? channels.slice(0, s.team.some((m) => m.role === 'marketer') ? 3 : 2) : channels.slice(0, 4);
    for (const c of sc.channels) act({ type: 'set_budget', channelId: c.id, amount: chosen.includes(c) ? budget / chosen.length : 0 });
    if (expert) {
      const content = sc.channels.find((c) => c.id === 'content');
      if (content && month >= 1) act({ type: 'set_budget', channelId: content.id, amount: 1500 });
      for (const c of chosen) if (c.fatigue && s.marketing.creative[c.id] < 0.8) act({ type: 'refresh_creatives', channelId: c.id });
      const queue = [...s.featureQueue].filter((id) => !sc.features.find((f) => f.id === id)?.monthlyCost).sort((a, b) => (s.world.featureValue[b][segmentId] ?? 0) - (s.world.featureValue[a][segmentId] ?? 0));
      act({ type: 'set_queue', queue });
      for (const exp of s.experiments.filter((e) => e.status === 'done')) {
        const r = exp.result!;
        const ship = r.pValue < 0.05 && r.uplift > 0 && r.srmP > 0.01 && !(scenarioOf(s).experiments.find((i) => i.id === exp.ideaId)?.darkPattern);
        act({ type: 'decide_experiment', id: exp.id, ship });
      }
      // One full-traffic test per metric at a time: overlapping tests blur each other.
      for (const idea of sc.experiments.filter((i) => !i.darkPattern && !i.priceMult)) {
        if (overlappingTest(s, idea.metric, 1)) continue;
        act({ type: 'start_experiment', config: { ideaId: idea.id, durationWeeks: 4, allocation: 1, peeking: false, guardrails: true, mde: 0.1 } });
      }
    } else {
      for (const exp of s.experiments.filter((e) => e.status === 'done')) act({ type: 'decide_experiment', id: exp.id, ship: true });
    }
    act({ type: 'run_month' });
  }
  return s;
}
