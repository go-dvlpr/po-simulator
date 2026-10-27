import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SCENARIO_ORDER, SCENARIOS } from '../data/scenarios/index.ts';
import { autoplay } from './autoplay.ts';
import type { Action } from './game.ts';
import { gameReducer } from './game.ts';
import { closeHoldouts, decideExperiment, extendExperiment, resolveExperiment, startExperiment, visibleIdeas } from './experiments.ts';
import { bridgeError, bridgeOffer } from './fundraising.ts';
import { competitivePressure, competitorMonth, initCompetitors, missingCompliance } from './market.ts';
import { TURN_HOURS } from './potime.ts';
import { finalScore } from './scoring.ts';
import { isCheckpoint } from '../ui/checkpoints.ts';
import { generateInbox } from './inbox.ts';
import { runGrowthResearch } from './insights.ts';
import { mvpEstimate } from './decisions.ts';
import { activeOkr } from './okr.ts';
import { hypothesisTruth, runResearch } from './research.ts';
import { createRng } from './rng.ts';
import { normCdf, normInv, priceAcceptance, proportionTest, sampleSizePerGroup, srmPValue } from './stats.ts';
import type { GameState, MonthRecord, ScenarioId } from './types.ts';
import { migrateState, newGame, STATE_VERSION } from './world.ts';

describe('stats', () => {
  it('normal CDF and its inverse agree', () => {
    for (const p of [0.025, 0.2, 0.5, 0.8, 0.975]) {
      assert.ok(Math.abs(normCdf(normInv(p)) - p) < 1e-4, `p=${p}`);
    }
    assert.ok(Math.abs(normInv(0.975) - 1.96) < 0.001);
  });

  it('sample size matches the textbook value', () => {
    // 5% -> 6% with alpha 0.05 and power 0.8 needs about 8,150 users per group.
    const n = sampleSizePerGroup(0.05, 0.2);
    assert.ok(n > 8000 && n < 8300, `n=${n}`);
  });

  it('proportion test detects a clear difference and ignores noise', () => {
    assert.ok(proportionTest(500, 10000, 600, 10000).pValue < 0.01);
    assert.ok(proportionTest(500, 10000, 505, 10000).pValue > 0.5);
    const t = proportionTest(100, 1000, 120, 1000);
    assert.ok(Math.abs(t.uplift - 0.2) < 1e-9);
    assert.ok(t.ciLow < t.uplift && t.uplift < t.ciHigh);
  });

  it('SRM check flags broken splits only', () => {
    assert.ok(srmPValue(5000, 5000) > 0.9);
    assert.ok(srmPValue(5000, 4600) < 0.001);
  });

  it('price acceptance is 50% at the median WTP and falls with price', () => {
    assert.ok(Math.abs(priceAcceptance(10, 10) - 0.5) < 1e-6);
    assert.ok(priceAcceptance(15, 10) < priceAcceptance(10, 10));
  });
});

describe('world', () => {
  it('is deterministic for a seed', () => {
    assert.deepEqual(newGame('b2c', 'normal', 42).world, newGame('b2c', 'normal', 42).world);
    assert.notDeepEqual(newGame('b2c', 'normal', 42).world, newGame('b2c', 'normal', 43).world);
  });

  it('randomizes which segment is the best opportunity', () => {
    const best = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const s = newGame('b2c', 'normal', seed);
      const ids = Object.keys(s.world.segments);
      best.add(ids.reduce((a, b) => (s.world.segments[a].severity * s.world.segments[a].fit > s.world.segments[b].severity * s.world.segments[b].fit ? a : b)));
    }
    assert.ok(best.size >= 2);
  });
});

describe('research', () => {
  it('leading questions inflate the observed pain', () => {
    let open = 0;
    let leading = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const s = newGame('b2c', 'normal', seed);
      const rng = createRng(seed);
      open += runResearch(s, rng, 'interviews', { segmentId: 'students', count: 15, script: 'open' }).observations.painShare ?? 0;
      leading += runResearch(s, rng, 'interviews', { segmentId: 'students', count: 15, script: 'leading' }).observations.painShare ?? 0;
    }
    assert.ok(leading / 60 > open / 60 + 10, `open=${open / 60} leading=${leading / 60}`);
  });

  it('evaluates hypotheses against their criteria and keeps the truth hidden', () => {
    const s = newGame('b2c', 'normal', 7);
    s.hypotheses.push({ id: 'h1', kind: 'problem', segmentId: 'parents', criterionId: 'p_like', threshold: 0, status: 'untested', createdWeek: 0 });
    s.hypotheses.push({ id: 'h2', kind: 'problem', segmentId: 'parents', criterionId: 'p_interview', threshold: 60, status: 'untested', createdWeek: 0 });
    runResearch(s, createRng(1), 'interviews', { segmentId: 'parents', count: 10, script: 'open' });
    assert.equal(s.hypotheses[0].status, 'supported', 'non-falsifiable criteria always pass');
    assert.notEqual(s.hypotheses[1].status, 'untested');
    assert.equal(typeof hypothesisTruth(s, s.hypotheses[1]), 'boolean');
  });
});

function growthState(seed: number): GameState {
  const s = newGame('b2c', 'normal', seed);
  s.phase = 'growth';
  s.strategy = { segmentId: 'parents', valuePropId: 'vp_time', northStarId: 'ns_weekly' };
  s.tech.analytics = 'product';
  s.tech.experiments = 'platform';
  const record = { truth: { acquired: 40000, registered: 30000, activated: 16000, registrationRate: 0.75, activationRate: 0.5, conversionRate: 0.1, retentionM1: 0.4 } } as unknown as MonthRecord;
  s.history.push(record);
  return s;
}

describe('experiments', () => {
  it('peeking inflates false positives for a zero effect', () => {
    let honest = 0;
    let peeked = 0;
    const runs = 120;
    for (let i = 0; i < runs; i++) {
      for (const peeking of [false, true]) {
        const s = growthState(i);
        s.world.experiments.new_home = { effect: 0, novelty: 0 };
        const exp = startExperiment(s, { ideaId: 'new_home', durationWeeks: 4, allocation: 1, peeking, guardrails: false, mde: 0.05 });
        s.tech.experiments = 'platform';
        resolveExperiment(s, createRng(i * 31 + (peeking ? 1 : 0)), exp);
        if ((exp.result?.pValue ?? 1) < 0.05) peeking ? peeked++ : honest++;
      }
    }
    assert.ok(honest / runs < 0.12, `honest=${honest / runs}`);
    assert.ok(peeked > honest * 2, `peeked=${peeked} honest=${honest}`);
  });

  it('shipping applies the true effect, not the observed one', () => {
    const s = growthState(3);
    s.world.experiments.social_proof = { effect: 0.05, novelty: 0 };
    const exp = startExperiment(s, { ideaId: 'social_proof', durationWeeks: 4, allocation: 1, peeking: false, guardrails: false, mde: 0.05 });
    resolveExperiment(s, createRng(5), exp);
    decideExperiment(s, exp, true);
    assert.ok(Math.abs(s.product.leverMods.conversion - 1.05) < 1e-9);
  });
});

describe('reducer', () => {
  it('ignores actions that do not fit the phase', () => {
    const s = newGame('b2c', 'normal', 1);
    assert.equal(gameReducer(s, { type: 'run_month' }), s);
    assert.equal(gameReducer(s, { type: 'run_sprint' }), s);
  });

  it('blocks other actions while an event is pending', () => {
    const s = newGame('b2c', 'normal', 1);
    s.pendingEvents.push({ eventId: 'd_friends', week: 0, data: {} });
    assert.equal(gameReducer(s, { type: 'next_week' }), s);
    const next = gameReducer(s, { type: 'resolve_event', option: 1 });
    assert.equal(next.pendingEvents.length, 0);
    assert.ok(next.score.discovery > 0);
  });

  it('does not mutate the previous state', () => {
    const s = newGame('b2c', 'normal', 1);
    const before = JSON.stringify(s);
    gameReducer(s, { type: 'start_research', method: 'desk', params: {} });
    assert.equal(JSON.stringify(s), before);
  });

  it('spends a week of burn per discovery week', () => {
    const s = newGame('b2c', 'normal', 1);
    const next = gameReducer(s, { type: 'next_week' });
    assert.equal(next.week, 1);
    assert.ok(next.cash < s.cash);
  });
});

describe('balance', () => {
  for (const scenario of SCENARIO_ORDER) {
    it(`${scenario}: good decisions can win and bad decisions cannot`, () => {
      let expertWins = 0;
      let naiveWins = 0;
      for (let seed = 1; seed <= 8; seed++) {
        if (autoplay(scenario, 'normal', seed * 7919, 'expert').ending?.kind === 'seriesA') expertWins++;
        const naive = autoplay(scenario, 'normal', seed * 7919, 'naive').ending?.kind;
        if (naive === 'seriesA' || naive === 'bridge') naiveWins++;
      }
      assert.ok(expertWins >= 1, `expert wins: ${expertWins}/8`);
      assert.equal(naiveWins, 0);
    });
  }

  it('every game reaches an ending', () => {
    for (const scenario of SCENARIO_ORDER) {
      for (const skill of ['expert', 'naive'] as const) {
        const s = autoplay(scenario, 'hard', 99, skill);
        assert.ok(s.ending !== null, `${scenario}/${skill} ended in phase ${s.phase}`);
      }
    }
  });
});

// Plays a sensible game up to the first month after launch. Pending events take their first option.
function launchedState(scenario: ScenarioId, seed: number): GameState {
  let s = newGame(scenario, 'normal', seed);
  const act = (a: Action) => {
    s = gameReducer(s, a);
    for (let i = 0; i < 10 && s.pendingEvents.length > 0; i++) s = gameReducer(s, { type: 'resolve_event', option: 0 });
  };
  for (const level of ['senior', 'middle', 'middle'] as const) act({ type: 'hire', role: 'developer', level, source: 'inhouse' });
  act({ type: 'finish_discovery' });
  const strategy = scenario === 'b2c' ? { segmentId: 'parents', northStarId: 'ns_weekly' } : { segmentId: 'cafes', northStarId: 'ns_schedules' };
  act({ type: 'confirm_strategy', strategy: { ...strategy, valuePropId: 'vp_time' }, pricing: { price: s.pricing.price, model: 'trial', annual: false, proTier: false, dunning: false, dealDiscount: 0 } });
  act({ type: 'set_tech', patch: { analytics: 'product', experiments: 'platform' } });
  act({ type: 'start_build', commitWeeks: mvpEstimate(s).weeks + 4 });
  for (let i = 0; i < 20 && s.phase === 'build'; i++) {
    if (s.mvpScope.every((id) => s.product.features[id]?.completed)) break;
    act({ type: 'run_sprint' });
  }
  act({ type: 'finish_build' });
  act({ type: 'launch', strategy: 'quiet', checklist: ['tracking', 'privacy'] });
  act({ type: 'set_budget', channelId: s.scenarioId === 'b2c' ? 'meta' : 'google', amount: 5000 });
  act({ type: 'run_month' });
  return s;
}

describe('save migration', () => {
  it('upgrades a version 1 save and keeps the game', () => {
    const v1 = newGame('b2c', 'normal', 5) as unknown as Record<string, unknown>;
    for (const key of ['milestones', 'okrs', 'inbox', 'unlockedIdeas', 'releaseWithAb']) delete v1[key];
    v1.version = 1;
    v1.lastReport = ['old line'];
    const world = v1.world as GameState['world'];
    delete world.experiments.pause_subscription;
    const s = migrateState(v1 as unknown as GameState);
    assert.ok(s);
    assert.equal(s.version, STATE_VERSION);
    assert.deepEqual(s.lastReport, [{ text: 'old line', tone: 'info' }]);
    assert.deepEqual(s.okrs, []);
    assert.equal(s.pricing.proTier, false);
    assert.ok(s.world.experiments.pause_subscription);
    assert.equal(migrateState({ ...s, version: 99 }), null);
  });
});

describe('product loop', () => {
  it('shows research-based test ideas only after the research', () => {
    const s = growthState(4);
    assert.ok(!visibleIdeas(s).some((i) => i.id === 'onboarding_progress'));
    runGrowthResearch(s, createRng(1), 'usability');
    assert.ok(visibleIdeas(s).some((i) => i.id === 'onboarding_progress'));
  });

  it('extending a test adds new data to the first result', () => {
    const s = growthState(9);
    s.world.experiments.social_proof = { effect: 0, novelty: 0 };
    const exp = startExperiment(s, { ideaId: 'social_proof', durationWeeks: 2, allocation: 1, peeking: false, guardrails: false, mde: 0.05 });
    resolveExperiment(s, createRng(2), exp);
    const first = exp.result;
    assert.ok(first);
    extendExperiment(s, exp);
    assert.equal(exp.status, 'running');
    resolveExperiment(s, createRng(3), exp);
    assert.ok(exp.result && exp.result.nA > first.nA && exp.result.cA >= first.cA);
    assert.ok(s.score.experiments < 0, 'extending after a peek is judged');
  });

  it('raising the price only for new customers keeps old cohorts and avoids the churn wave', () => {
    const base = launchedState('b2c', 21);
    const oldPrice = base.pricing.price;
    const kept = gameReducer(base, { type: 'set_pricing', patch: { price: oldPrice * 1.5 }, grandfather: true });
    assert.ok(kept.cohorts.every((c) => c.price === oldPrice));
    assert.ok(!kept.modifiers.some((m) => m.id === 'price_raise'));
    const all = gameReducer(base, { type: 'set_pricing', patch: { price: oldPrice * 1.5 } });
    assert.ok(all.cohorts.every((c) => c.price === oldPrice * 1.5));
    assert.ok(all.modifiers.some((m) => m.id === 'price_raise'));
    assert.ok(all.milestones.some((m) => m.kind === 'price'));
  });

  it('feature flags turn a finished feature into an A/B test instead of a release', () => {
    let s = launchedState('b2c', 22);
    s = gameReducer(s, { type: 'set_release_mode', ab: true });
    for (let i = 0; i < 6 && !s.experiments.some((e) => e.featureId) && s.phase === 'growth'; i++) {
      s = gameReducer(s, { type: 'run_month' });
      for (let j = 0; j < 10 && s.pendingEvents.length > 0; j++) s = gameReducer(s, { type: 'resolve_event', option: 0 });
    }
    const exp = s.experiments.find((e) => e.featureId);
    assert.ok(exp, 'a feature test started');
    assert.equal(s.product.features[exp.featureId ?? ''].shipped, false);
    assert.ok(Number.isFinite(exp.trueEffect));
  });

  it('quarterly goals are checked at the board meeting', () => {
    let s = launchedState('b2c', 23);
    const last = s.history[s.history.length - 1];
    s = gameReducer(s, { type: 'set_okr', goals: [{ metric: 'mrr', target: last.mrr * 100 }] });
    const okr = activeOkr(s);
    assert.ok(okr);
    assert.equal(okr.dueMonth % 3, 0);
    for (let i = 0; i < 6 && activeOkr(s) && s.phase === 'growth'; i++) {
      s = gameReducer(s, { type: 'run_month' });
      for (let j = 0; j < 10 && s.pendingEvents.length > 0; j++) s = gameReducer(s, { type: 'resolve_event', option: 0 });
    }
    const done = s.okrs[0];
    assert.equal(done.evaluated, true);
    assert.equal(done.goals[0].met, false, 'a 100x MRR goal is missed');
  });

  it('research keeps running after launch', () => {
    let s = launchedState('b2c', 24);
    const reports = s.reports.length;
    s = gameReducer(s, { type: 'start_research', method: 'interviews', params: { segmentId: 'students', count: 5, script: 'open' } });
    assert.equal(s.activeResearch.length, 1);
    s = gameReducer(s, { type: 'run_month' });
    assert.equal(s.reports.length, reports + 1);
  });

  it('the inbox gets a few biased messages every month', () => {
    const s = growthState(30);
    const count = generateInbox(s, createRng(4));
    assert.ok(count >= 3 && count <= 5);
    assert.equal(s.inbox.length, count);
    assert.ok(s.inbox.every((m) => m.text.length > 0));
  });

  it('B2B tracks net revenue retention and an open pipeline', () => {
    let s = launchedState('b2b', 25);
    s = gameReducer(s, { type: 'run_month' });
    const last = s.history[s.history.length - 1];
    assert.ok(last.truth.nrr !== null && last.truth.nrr > 0);
    assert.ok((last.pipeline ?? -1) >= 0);
    assert.ok(last.truth.northStar !== null);
  });
});

describe('scenarios', () => {
  it('every scenario wires the ids the engine relies on', () => {
    for (const id of SCENARIO_ORDER) {
      const sc = SCENARIOS[id];
      const features = new Set(sc.features.map((f) => f.id));
      assert.equal(sc.id, id);
      assert.ok(sc.pricingModels.some((m) => m.id === 'trial'), `${id}: trial model`);
      assert.ok(sc.priceOptions.includes(sc.defaultPrice), `${id}: default price`);
      assert.equal(sc.channels[0].kind, 'paid', `${id}: first channel is paid`);
      assert.ok(!sc.channels[0].requires, `${id}: first channel has no requirements`);
      assert.ok(sc.channels.some((c) => c.id === 'content'), `${id}: content channel`);
      assert.ok(sc.features.some((f) => f.enablesRevenue), `${id}: payment feature`);
      assert.ok(features.has(sc.flavor.ceoPetFeature) && features.has(sc.flavor.reminderFeature), `${id}: flavor features`);
      assert.ok(sc.platformOptions.some((p) => p.id === sc.flavor.defaultPlatform), `${id}: default platform`);
      assert.ok(sc.platformOptions.some((p) => p.id === sc.flavor.codePlatform), `${id}: code platform`);
      assert.ok(sc.flavor.badReviews.includes('{rating}') && sc.flavor.influencer.includes('{cost}'), `${id}: event templates`);
      assert.equal(sc.seasonality.demand.length, 12);
      assert.equal(sc.seasonality.cpm.length, 12);
      for (const seg of sc.segments) {
        for (const c of sc.channels) assert.ok(seg.affinity[c.id] !== undefined, `${id}/${seg.id}: affinity for ${c.id}`);
      }
      for (const f of sc.features) {
        for (const seg of sc.segments) assert.ok(f.value[seg.id] !== undefined, `${id}/${f.id}: value for ${seg.id}`);
      }
      assert.equal(sc.experiments.filter((e) => e.source).length, 4, `${id}: research ideas`);
    }
  });

  it('draws a market condition and a CEO style for every game', () => {
    const markets = new Set<string>();
    const ceos = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const s = newGame('b2c', 'normal', seed);
      markets.add(s.world.market);
      ceos.add(s.world.ceo);
    }
    assert.ok(markets.size >= 3 && ceos.size >= 3);
  });
});

describe('realism', () => {
  it('actions that need the PO personally spend the hours of the turn', () => {
    let s = newGame('b2c', 'normal', 41);
    assert.equal(s.poHours, TURN_HOURS.discovery);
    const tooMany = gameReducer(s, { type: 'start_research', method: 'interviews', params: { segmentId: 'students', count: 30, script: 'open' } });
    assert.equal(tooMany, s, '45 hours of interviews do not fit into a 32-hour week');
    s = gameReducer(s, { type: 'start_research', method: 'interviews', params: { segmentId: 'students', count: 10, script: 'open' } });
    assert.equal(s.poHours, TURN_HOURS.discovery - 15);
    s = gameReducer(s, { type: 'next_week' });
    for (let i = 0; i < 10 && s.pendingEvents.length > 0; i++) s = gameReducer(s, { type: 'resolve_event', option: 0 });
    assert.equal(s.poHours, TURN_HOURS.discovery, 'hours reset every turn');
  });

  it('compliance costs money and team time and closes the risk', () => {
    const base = launchedState('b2b', 42);
    assert.ok(missingCompliance(base).includes('soc2'));
    const s = gameReducer(base, { type: 'do_compliance', id: 'soc2' });
    assert.ok(!missingCompliance(s).includes('soc2'));
    assert.equal(s.cash, base.cash - 25000);
    assert.equal(s.product.lostPoints, base.product.lostPoints + 8);
    assert.equal(gameReducer(s, { type: 'do_compliance', id: 'soc2' }), s, 'cannot be done twice');
  });

  it('a bridge round gives cash for a share of the company and lowers the final result', () => {
    let s = launchedState('b2c', 43);
    for (let i = 0; i < 3 && s.phase === 'growth'; i++) {
      s = gameReducer(s, { type: 'run_month' });
      for (let j = 0; j < 10 && s.pendingEvents.length > 0; j++) s = gameReducer(s, { type: 'resolve_event', option: 0 });
    }
    s.trust = 60;
    assert.equal(bridgeError(s), null);
    const offer = bridgeOffer(s);
    const raised = gameReducer(s, { type: 'raise_bridge' });
    assert.equal(raised.cash, s.cash + offer.amount);
    assert.ok(raised.dilution > 0 && raised.dilution < 0.2);
    assert.ok(bridgeError(raised), 'investors wait half a year before the next round');
    assert.ok(finalScore(raised).outcome <= finalScore(s).outcome);
  });

  it('tests on the same metric overlap only when they share users', () => {
    const s = growthState(44);
    const first = startExperiment(s, { ideaId: 'paywall_timing', durationWeeks: 4, allocation: 0.5, peeking: false, guardrails: false, mde: 0.1 });
    const split = startExperiment(s, { ideaId: 'social_proof', durationWeeks: 4, allocation: 0.5, peeking: false, guardrails: false, mde: 0.1 });
    assert.equal(split.overlapWith, undefined, 'two halves of the traffic do not overlap');
    const shared = startExperiment(s, { ideaId: 'annual_default', durationWeeks: 4, allocation: 1, peeking: false, guardrails: false, mde: 0.1 });
    assert.equal(shared.overlapWith, first.id);
    assert.equal(first.overlapWith, shared.id);
  });

  it('a holdout keeps 5% on the old version and reports the long-term effect later', () => {
    const s = growthState(45);
    s.world.experiments.new_home = { effect: 0.1, novelty: 0 };
    const exp = startExperiment(s, { ideaId: 'new_home', durationWeeks: 4, allocation: 1, peeking: false, guardrails: false, mde: 0.05 });
    resolveExperiment(s, createRng(5), exp);
    const before = s.product.leverMods.activation;
    decideExperiment(s, exp, true, true);
    assert.equal(exp.holdout, true);
    assert.ok(Math.abs(s.product.leverMods.activation / before - (1 + 0.1 * 0.95)) < 1e-9);
    s.week = exp.holdoutWeek ?? 0;
    closeHoldouts(s, createRng(6));
    assert.equal(exp.holdout, false);
    assert.ok(Math.abs(s.product.leverMods.activation / before - 1.1) < 1e-9, 'the last 5% get the change');
    assert.ok(exp.result?.subgroups?.length === 2);
  });

  it('competitors are deterministic per seed and react over time', () => {
    const sc = SCENARIOS.b2c;
    assert.deepEqual(initCompetitors(sc, 7), initCompetitors(sc, 7));
    const s = launchedState('b2c', 46);
    const pressure = competitivePressure(s);
    assert.ok(pressure > 0 && pressure < 1);
    const rng = createRng(9);
    for (let i = 0; i < 12; i++) competitorMonth(s, rng);
    assert.ok(s.competitorNews.length > 0, 'competitors make moves during a year');
  });

  it('upgrades a version 2 save with the new mechanics', () => {
    const v2 = newGame('b2b', 'normal', 47) as unknown as Record<string, unknown>;
    for (const key of ['stakeholders', 'poHours', 'competitors', 'competitorNews', 'compliance', 'expandedWeek', 'dilution']) delete v2[key];
    const pricing = v2.pricing as Record<string, unknown>;
    delete pricing.dunning;
    delete pricing.dealDiscount;
    v2.version = 2;
    const s = migrateState(v2 as unknown as GameState);
    assert.ok(s);
    assert.equal(s.version, STATE_VERSION);
    assert.equal(s.dilution, 0);
    assert.equal(s.pricing.dunning, false);
    assert.equal(s.pricing.dealDiscount, 0);
    assert.ok(s.competitors.length > 0);
    assert.equal(s.stakeholders.cto, 60);
  });

  it('checkpoints are taken on phase changes and board meetings only', () => {
    const s = newGame('b2c', 'normal', 48);
    assert.equal(isCheckpoint(s, { ...s, week: 1 }), false);
    assert.equal(isCheckpoint(s, { ...s, phase: 'strategy' }), true);
    assert.equal(isCheckpoint(s, { ...s, phase: 'end' }), false);
    const growth = { ...s, phase: 'growth' as const, history: [{}, {}] as MonthRecord[] };
    assert.equal(isCheckpoint(growth, { ...growth, history: [{}, {}, {}] as MonthRecord[] }), true);
    assert.equal(isCheckpoint(growth, { ...growth, history: [{}] as MonthRecord[] }), false);
  });
});
