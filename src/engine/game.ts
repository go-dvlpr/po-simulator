// The game reducer: every player action goes through here.
// Invalid actions are ignored; the UI validates before dispatching.

import { fixed, money, pct } from '../format.ts';
import { ceoStyle } from '../data/context.ts';
import { LAUNCH_CHECKLIST } from '../data/launch.ts';
import { PRACTICES } from '../data/tech.ts';
import {
  DEADLINE_WEEKS,
  featureDef,
  hasRole,
  monthlyPayroll,
  scenarioOf,
  segmentDef,
  techOption,
  techSetupPoints,
} from './catalog.ts';
import { judgeLaunch, judgeSetup, judgeStrategy } from './decisions.ts';
import { addModifier, addMorale, addTrust, judge, log, milestone, nextId, report } from './effects.ts';
import { resolveEvent, rollEvents, triggerEvent } from './events.ts';
import type { ExperimentConfig } from './experiments.ts';
import {
  canTestFeatures,
  closeHoldouts,
  decideExperiment,
  extendExperiment,
  ideaDef,
  resolveExperiment,
  startExperiment,
  startFeatureTest,
  validateExperiment,
} from './experiments.ts';
import { estimatedBurn, infraCost, retentionCurve, simulateMonth, toolsCost } from './growth.ts';
import { bridgeError, earlySeriesA, earlySeriesAReady, raiseBridge } from './fundraising.ts';
import { generateInbox } from './inbox.ts';
import { competitorMonth, complianceDef, EXPANSION_COST, EXPANSION_POINTS, missingCompliance } from './market.ts';
import { actionHours, resetHours } from './potime.ts';
import { addRelation, stakeholderMonth } from './stakeholders.ts';
import { GROWTH_RESEARCH, runGrowthResearch } from './insights.ts';
import { mrrGrowth } from './metrics.ts';
import { reviewQuarter, setOkr, validateOkr } from './okr.ts';
import { doWork, funnelRates, mustFeatures, pmfScore, productContext } from './product.ts';
import { runResearch, segmentOpportunity, startResearch, validateResearch } from './research.ts';
import type { Rng } from './rng.ts';
import { binomial, createRng, uniform } from './rng.ts';
import { endGame, finalEvaluation } from './scoring.ts';
import { fireMember, hireMember } from './team.ts';
import type {
  Allocation,
  GameState,
  Hypothesis,
  LaunchState,
  Level,
  OkrMetric,
  Pricing,
  ReportLink,
  ResearchMethod,
  ResearchParams,
  RoleId,
  Source,
  Strategy,
  TechChoices,
} from './types.ts';
import { newGame } from './world.ts';
import { t } from '../i18n/index.ts';

export type Action =
  | { type: 'new_game'; state: GameState }
  | { type: 'add_hypothesis'; hypothesis: Omit<Hypothesis, 'id' | 'status' | 'createdWeek'> }
  | { type: 'remove_hypothesis'; id: string }
  | { type: 'start_research'; method: ResearchMethod; params: ResearchParams }
  | { type: 'next_week' }
  | { type: 'finish_discovery' }
  | { type: 'back_to_discovery' }
  | { type: 'confirm_strategy'; strategy: Strategy; pricing: Pricing }
  | { type: 'set_tech'; patch: Partial<TechChoices> }
  | { type: 'toggle_scope'; featureId: string }
  | { type: 'move_scope'; featureId: string; dir: -1 | 1 }
  | { type: 'hire'; role: RoleId; level: Level; source: Source }
  | { type: 'fire'; memberId: string }
  | { type: 'start_build'; commitWeeks: number }
  | { type: 'set_plan'; allocation?: Allocation; overtime?: boolean }
  | { type: 'run_sprint' }
  | { type: 'finish_build' }
  | { type: 'run_beta' }
  | { type: 'launch'; strategy: LaunchState['strategy']; checklist: string[] }
  | { type: 'set_budget'; channelId: string; amount: number }
  | { type: 'refresh_creatives'; channelId: string }
  | { type: 'set_pricing'; patch: Partial<Pricing>; grandfather?: boolean }
  | { type: 'set_crm'; amount: number }
  | { type: 'set_okr'; goals: { metric: OkrMetric; target: number }[] }
  | { type: 'set_release_mode'; ab: boolean }
  | { type: 'ship_feature'; featureId: string }
  | { type: 'extend_experiment'; id: string }
  | { type: 'set_queue'; queue: string[] }
  | { type: 'start_experiment'; config: ExperimentConfig }
  | { type: 'decide_experiment'; id: string; ship: boolean; holdout?: boolean }
  | { type: 'do_compliance'; id: string }
  | { type: 'expand_market' }
  | { type: 'raise_bridge' }
  | { type: 'raise_series_a' }
  | { type: 'order_research'; kind: string }
  | { type: 'big_launch' }
  | { type: 'pivot'; segmentId: string; valuePropId: string }
  | { type: 'run_month' }
  | { type: 'resolve_event'; option: number };

export function createGame(scenarioId: GameState['scenarioId'], difficulty: GameState['difficulty'], seed: number): GameState {
  return newGame(scenarioId, difficulty, seed);
}

export function gameReducer(state: GameState, action: Action): GameState {
  if (action.type === 'new_game') return action.state;
  if (state.phase === 'end') return state;
  if (state.pendingEvents.length > 0 && action.type !== 'resolve_event') return state;
  // Actions that need the product owner personally spend this turn's hours.
  const hours = actionHours(action);
  if (hours > state.poHours) return state;
  const s = structuredClone(state);
  const rng = createRng(s.rng);
  const changed = apply(s, rng, action);
  if (!changed) return state;
  s.poHours = Math.max(0, s.poHours - hours);
  if (s.phase !== state.phase || TURN_ACTIONS.has(action.type)) resetHours(s);
  s.rng = rng.state();
  return s;
}

const TURN_ACTIONS = new Set<Action['type']>(['next_week', 'run_sprint', 'run_month', 'run_beta']);

function weeklyCost(s: GameState, prelaunch: boolean): number {
  const infra = prelaunch ? infraCost(s, 0) * 0.5 : infraCost(s, 0);
  return (monthlyPayroll(s) + toolsCost(s, 0) + infra) / 4;
}

function checkEnd(s: GameState): void {
  if (s.ending) return;
  if (s.cash < 0) return endGame(s, 'bankrupt');
  if (s.trust <= 0) return endGame(s, 'fired');
  if (s.week >= DEADLINE_WEEKS) {
    if (s.phase === 'growth') finalEvaluation(s);
    else endGame(s, 'stagnation');
  }
}

function maybeCashCrunch(s: GameState, rng: Rng): void {
  const burn = estimatedBurn(s);
  if (burn <= 0 || s.cash / burn >= 2.5) return;
  const last = s.flags.ev_g_cash_crunch;
  if (last !== undefined && s.week - last < 8) return;
  triggerEvent(s, rng, 'g_cash_crunch');
}

// Discovery research also runs after launch (continuous discovery).
function completeResearch(s: GameState, rng: Rng, link: ReportLink): void {
  const done = s.activeResearch.filter((r) => r.endWeek <= s.week);
  s.activeResearch = s.activeResearch.filter((r) => r.endWeek > s.week);
  for (const r of done) {
    const rep = runResearch(s, rng, r.method, r.params);
    s.reports.push(rep);
    report(s, t('Готов отчёт: {0}', [rep.title]), 'good', link);
  }
}

const researchPhase = (s: GameState) => s.phase === 'discovery' || s.phase === 'growth';

// Returns false when the action was invalid and nothing changed.
function apply(s: GameState, rng: Rng, action: Action): boolean {
  const sc = scenarioOf(s);
  switch (action.type) {
    case 'add_hypothesis': {
      if (!researchPhase(s)) return false;
      const h = action.hypothesis;
      const same = s.hypotheses.some((x) => x.kind === h.kind && x.segmentId === h.segmentId && x.criterionId === h.criterionId && x.threshold === h.threshold && x.price === h.price && x.channelId === h.channelId);
      if (same) return false;
      s.hypotheses.push({ ...action.hypothesis, id: nextId(s, 'h'), status: 'untested', createdWeek: s.week });
      return true;
    }
    case 'remove_hypothesis': {
      s.hypotheses = s.hypotheses.filter((h) => h.id !== action.id);
      return true;
    }
    case 'start_research': {
      if (!researchPhase(s) || validateResearch(s, action.method, action.params)) return false;
      startResearch(s, action.method, action.params);
      return true;
    }
    case 'next_week': {
      if (s.phase !== 'discovery') return false;
      s.lastReport = [];
      s.week += 1;
      s.cash -= weeklyCost(s, true);
      completeResearch(s, rng, 'reports');
      const promised = s.flags.promisedStrategy;
      if (promised !== undefined && promised > 0 && s.week > promised) {
        addTrust(s, -8);
        s.flags.promisedStrategy = 0;
        log(s, { title: t('Обещание не выполнено'), text: t('Вы обещали CEO перейти к стратегии, но продолжаете исследования. Доверие упало.'), tone: 'bad' });
      }
      if (s.week > ceoStyle(s.world.ceo).patienceWeeks) addTrust(s, -1);
      rollEvents(s, rng, 'discovery', [0.18]);
      checkEnd(s);
      return true;
    }
    case 'finish_discovery': {
      if (s.phase !== 'discovery' || s.activeResearch.length > 0) return false;
      s.phase = 'strategy';
      s.flags.promisedStrategy = 0;
      return true;
    }
    case 'back_to_discovery': {
      if (s.phase !== 'strategy') return false;
      s.phase = 'discovery';
      return true;
    }
    case 'confirm_strategy': {
      if (s.phase !== 'strategy') return false;
      s.strategy = action.strategy;
      s.pricing = action.pricing;
      judgeStrategy(s);
      const musts = mustFeatures(sc, action.strategy.segmentId);
      s.mvpScope = [...new Set([...musts, ...s.mvpScope])];
      s.phase = 'setup';
      return true;
    }
    case 'set_tech': {
      if (!['setup', 'build', 'growth', 'launch'].includes(s.phase)) return false;
      const patch = { ...action.patch };
      if (s.phase !== 'setup') {
        // After setup only analytics, experiments, practices and process can change.
        delete patch.platform;
        delete patch.backend;
        delete patch.infra;
        delete patch.payments;
        delete patch.auth;
        if (patch.analytics && patch.analytics !== s.tech.analytics) {
          s.product.setupPoints += techOption(sc, 'analytics', patch.analytics).mods.setupPoints ?? 0;
        }
        if (patch.experiments && patch.experiments !== s.tech.experiments) {
          s.product.setupPoints += techOption(sc, 'experiments', patch.experiments).mods.setupPoints ?? 0;
        }
        for (const id of patch.practices ?? []) {
          if (!s.tech.practices.includes(id)) s.product.setupPoints += PRACTICES.find((p) => p.id === id)?.mods.setupPoints ?? 0;
        }
      }
      s.tech = { ...s.tech, ...patch };
      if (s.tech.platform === 'pwa') s.tech.payments = 'web_stripe';
      else if (s.tech.payments === 'web_stripe') s.tech.payments = sc.paymentOptions[0].id;
      return true;
    }
    case 'toggle_scope': {
      if (s.phase !== 'setup' && s.phase !== 'build') return false;
      if (s.mvpScope.includes(action.featureId)) {
        if (s.product.features[action.featureId]?.completed) return false;
        s.mvpScope = s.mvpScope.filter((id) => id !== action.featureId);
      } else {
        s.mvpScope.push(action.featureId);
      }
      return true;
    }
    case 'move_scope': {
      const i = s.mvpScope.indexOf(action.featureId);
      const j = i + action.dir;
      if (i < 0 || j < 0 || j >= s.mvpScope.length) return false;
      [s.mvpScope[i], s.mvpScope[j]] = [s.mvpScope[j], s.mvpScope[i]];
      return true;
    }
    case 'hire': {
      const result = hireMember(s, rng, action.role, action.level, action.source);
      if (typeof result === 'string') return false;
      log(s, { title: t('Найм: {0}', [result.name]), text: t('Выходит на работу на неделе {0}.', [result.joinWeek + 1]), tone: 'info' });
      return true;
    }
    case 'fire': {
      return fireMember(s, action.memberId, 'fired') !== undefined;
    }
    case 'start_build': {
      if (s.phase !== 'setup' || !s.team.some((m) => m.role === 'developer') || s.mvpScope.length === 0) return false;
      s.product.setupPoints = techSetupPoints(s);
      s.commitWeeks = action.commitWeeks;
      judgeSetup(s, action.commitWeeks);
      s.week += 1;
      s.cash -= weeklyCost(s, true);
      s.buildStartWeek = s.week;
      s.phase = 'build';
      for (const id of s.mvpScope) s.product.features[id] ??= { done: 0, completed: false, shipped: false };
      s.lastReport = [];
      report(s, t('Команда начала разработку. Вы пообещали запуск через {0} недель.', [action.commitWeeks]));
      checkEnd(s);
      return true;
    }
    case 'set_plan': {
      if (action.allocation) {
        const a = action.allocation;
        const total = a.features + a.debt + a.bugs;
        if (total <= 0) return false;
        s.allocation = { features: a.features / total, debt: a.debt / total, bugs: a.bugs / total };
      }
      if (action.overtime !== undefined) s.overtime = action.overtime;
      return true;
    }
    case 'run_sprint': {
      if (s.phase !== 'build') return false;
      s.lastReport = [];
      const work = doWork(s, rng, 1, s.mvpScope, s.allocation);
      s.cash -= weeklyCost(s, true) * 2;
      s.week += 2;
      updateMorale(s);
      s.sprints.push({
        index: s.sprints.length + 1,
        week: s.week,
        capacity: work.capacity,
        featurePoints: work.featurePoints,
        debtPoints: work.debtPoints,
        bugPoints: work.bugPoints,
        completed: work.completed,
        bugsAfter: s.product.bugs,
        debtAfter: s.product.debt,
      });
      report(s, t('Спринт {0}: команда сделала {1} SP (из них {2} — настройка и внеплановые задачи).', [s.sprints.length, fixed(work.capacity, 0), fixed(work.overhead, 0)]));
      for (const id of work.completed) report(s, t('Готово: {0}', [featureDef(sc, id).name]), 'good');
      rollEvents(s, rng, 'build', [0.45]);
      maybeCashCrunch(s, rng);
      checkEnd(s);
      return true;
    }
    case 'finish_build': {
      if (s.phase !== 'build' || !Object.values(s.product.features).some((f) => f.completed)) return false;
      s.phase = 'launch';
      return true;
    }
    case 'run_beta': {
      if (s.phase !== 'launch' || s.flags.betaDone) return false;
      runBeta(s, rng);
      checkEnd(s);
      return true;
    }
    case 'launch': {
      if (s.phase !== 'launch') return false;
      launch(s, action.strategy, action.checklist);
      checkEnd(s);
      return true;
    }
    case 'set_budget': {
      s.marketing.budgets[action.channelId] = Math.max(0, Math.round(action.amount));
      return true;
    }
    case 'refresh_creatives': {
      const cost = hasRole(s, 'marketer') ? 800 : 1500;
      s.marketing.refreshCosts += cost;
      s.marketing.creative[action.channelId] = uniform(rng, 0.95, 1.12);
      return true;
    }
    case 'set_pricing': {
      const old = s.pricing;
      s.pricing = { ...s.pricing, ...action.patch };
      if (s.pricing.proTier && !old.proTier && !s.flags.proTierBuilt) {
        // The second plan needs a paywall and billing change once.
        s.flags.proTierBuilt = 1;
        s.product.lostPoints += 5;
      }
      if (s.pricing.dunning && !old.dunning && !s.flags.dunningBuilt) {
        s.flags.dunningBuilt = 1;
        s.product.lostPoints += 3;
      }
      if (s.pricing.dealDiscount !== old.dealDiscount) addRelation(s, 'sales', s.pricing.dealDiscount > old.dealDiscount ? 4 : -4);
      if (s.phase !== 'growth' || s.pricing.price === old.price) return true;
      const price = s.pricing.price;
      milestone(s, 'price', t('Цена {0} → {1}', [money(old.price, 2), money(price, 2)]));
      if (price > old.price && action.grandfather) {
        log(s, { title: t('Цена повышена только для новых клиентов'), text: t('Текущие клиенты платят прежнюю цену (grandfathering): волны отписок не будет, а выручка с новых клиентов вырастет.'), tone: 'neutral' });
        return true;
      }
      for (const c of s.cohorts) c.price = price;
      if (price > old.price * 1.1) {
        addModifier(s, { id: 'price_raise', label: t('Повышение цены для текущих клиентов'), lever: 'churn', mult: 1.2 }, 4);
        log(s, { title: t('Цена повышена для всех клиентов'), text: t('Часть текущих клиентов отреагирует отпиской. Можно было оставить прежнюю цену текущим клиентам и проверить новую A/B-тестом.'), tone: 'neutral' });
      }
      return true;
    }
    case 'set_crm': {
      s.marketing.crm = Math.max(0, Math.round(action.amount));
      return true;
    }
    case 'set_okr': {
      if (validateOkr(s, action.goals)) return false;
      setOkr(s, action.goals);
      return true;
    }
    case 'set_release_mode': {
      s.releaseWithAb = action.ab;
      return true;
    }
    case 'ship_feature': {
      const progress = s.product.features[action.featureId];
      const testing = s.experiments.some((e) => e.featureId === action.featureId && (e.status === 'running' || e.status === 'done'));
      if (s.phase !== 'growth' || !progress?.completed || progress.shipped || testing) return false;
      progress.shipped = true;
      milestone(s, 'feature', t('Выпущена: {0}', [featureDef(sc, action.featureId).name]));
      return true;
    }
    case 'extend_experiment': {
      const exp = s.experiments.find((e) => e.id === action.id && e.status === 'done');
      if (!exp?.result || exp.extended || exp.result.pValue < 0.05 || exp.result.stoppedEarlyWeek !== undefined) return false;
      extendExperiment(s, exp);
      return true;
    }
    case 'set_queue': {
      const valid = new Set(sc.features.map((f) => f.id));
      s.featureQueue = action.queue.filter((id) => valid.has(id));
      return true;
    }
    case 'start_experiment': {
      if (s.phase !== 'growth' || validateExperiment(s, action.config)) return false;
      startExperiment(s, action.config);
      return true;
    }
    case 'decide_experiment': {
      const exp = s.experiments.find((e) => e.id === action.id && e.status === 'done');
      if (!exp) return false;
      decideExperiment(s, exp, action.ship, action.holdout);
      return true;
    }
    case 'do_compliance': {
      if ((s.phase !== 'growth' && s.phase !== 'launch') || !missingCompliance(s).includes(action.id)) return false;
      const def = complianceDef(action.id);
      if (s.cash < def.cost) return false;
      s.cash -= def.cost;
      s.product.lostPoints += def.points;
      s.compliance.push(def.id);
      log(s, { title: t('Сделано: {0}', [def.name]), text: def.description, tone: 'good' });
      return true;
    }
    case 'expand_market': {
      if (s.phase !== 'growth' || s.expandedWeek !== null || s.history.length < 3 || s.cash < EXPANSION_COST) return false;
      s.cash -= EXPANSION_COST;
      s.product.lostPoints += EXPANSION_POINTS;
      s.expandedWeek = s.week;
      milestone(s, 'marketing', t('Выход на рынок: {0}', [sc.flavor.expansionMarket]));
      log(s, { title: t('Выход на новый рынок: {0}', [sc.flavor.expansionMarket]), text: t('Локализация, платежи и поддержка займут около двух месяцев. Потом рынок станет больше, но реклама там чуть дороже, а постоянные расходы вырастут.'), tone: 'neutral' });
      return true;
    }
    case 'raise_bridge': {
      if (bridgeError(s)) return false;
      raiseBridge(s);
      return true;
    }
    case 'raise_series_a': {
      if (!earlySeriesAReady(s)) return false;
      earlySeriesA(s);
      s.flags.earlySeriesA = 1;
      endGame(s, 'seriesA');
      return true;
    }
    case 'order_research': {
      const def = GROWTH_RESEARCH.find((g) => g.id === action.kind);
      if (s.phase !== 'growth' || !def || s.pendingGrowthResearch.includes(def.id) || s.cash < def.cost) return false;
      s.cash -= def.cost;
      s.pendingGrowthResearch.push(def.id);
      return true;
    }
    case 'big_launch': {
      if (s.phase !== 'growth' || !s.launch || s.launch.bigLaunchDone) return false;
      s.cash -= 5000;
      s.launch.bigLaunchDone = true;
      milestone(s, 'marketing', t('Громкий запуск'));
      launchSpike(s);
      return true;
    }
    case 'pivot': {
      if (s.phase !== 'growth' || !s.strategy || action.segmentId === s.strategy.segmentId) return false;
      const opp = segmentOpportunity(s);
      const better = opp[action.segmentId] > opp[s.strategy.segmentId];
      s.strategy = { ...s.strategy, segmentId: action.segmentId, valuePropId: action.valuePropId };
      for (const k of Object.keys(s.marketing.creative)) s.marketing.creative[k] *= 0.8;
      for (const k of Object.keys(s.marketing.assets)) s.marketing.assets[k] *= 0.6;
      addTrust(s, -8);
      milestone(s, 'pivot', t('Пивот: {0}', [segmentDef(sc, action.segmentId).short]));
      judge(s, 'strategy', better ? 3 : -3, t('Пивот на сегмент «{0}»', [segmentDef(sc, action.segmentId).name]), better ? t('Новый сегмент перспективнее прежнего. Пивот — нормальная реакция на данные.') : t('Новый сегмент не лучше прежнего: пивот без данных — это потеря времени и наработок.'));
      return true;
    }
    case 'run_month': {
      if (s.phase !== 'growth') return false;
      runMonth(s, rng);
      return true;
    }
    case 'resolve_event': {
      if (resolveEvent(s, rng, action.option)) return false;
      checkEnd(s);
      return true;
    }
  }
  return false;
}

function updateMorale(s: GameState): void {
  if (s.overtime) {
    addMorale(s, -5);
    s.flags.overtimeStreak = (s.flags.overtimeStreak ?? 0) + 1;
  } else {
    if (s.morale < 75) addMorale(s, 1);
    s.flags.overtimeStreak = 0;
  }
  if (s.tech.process === 'adhoc') addMorale(s, -1);
}

function runBeta(s: GameState, rng: Rng): void {
  const sc = scenarioOf(s);
  const ctx = productContext(s, true);
  const rates = funnelRates(s, ctx);
  const users = Math.min(s.knowledge.waitlist, 400) + (sc.kind === 'b2c' ? 150 : 25);
  const activated = binomial(rng, users, rates.activation);
  const retained = binomial(rng, activated, retentionCurve(rates.retentionFloor, sc.funnel.retentionTau, 1));
  const wouldPay = binomial(rng, activated, rates.conversion);
  const bugsFound = Math.round(s.product.bugs * 0.45);
  s.product.bugs -= bugsFound;
  doWork(s, rng, 2, [...s.mvpScope, ...s.featureQueue], { features: 0.5, debt: 0.1, bugs: 0.4 });
  s.cash -= weeklyCost(s, true) * 4;
  s.week += 4;
  s.flags.betaDone = 1;
  updateMorale(s);

  const pmf = Math.min(0.9, Math.max(0, pmfScore(ctx) + (rng.next() - 0.5) * 0.16));
  const lines = [
    t('Участников: {0} (из листа ожидания: {1}).', [users, Math.min(s.knowledge.waitlist, 400)]),
    t('Дошли до «{0}»: {1} ({2}).', [sc.labels.aha, activated, pct(activated / users, 0)]),
    t('Активны через месяц: {0} из {1}.', [retained, activated]),
    ctx.revenueEnabled ? t('Оформили бы платную подписку: {0} из {1}.', [wouldPay, activated]) : t('Оплата в бете не работала — готовность платить не проверить.'),
    t('Тест Шона Эллиса на бете: «очень расстроятся» {0} (маленькая выборка, погрешность ±8%).', [pct(pmf, 0)]),
    t('Найдено и исправлено багов: {0}.', [bugsFound]),
  ];
  if (ctx.mustMissing.length > 0) lines.push(t('Бета-тестеры жалуются, что нет: {0}.', [ctx.mustMissing.map((id) => featureDef(sc, id).name).join(', ')]));
  const seg = ctx.segmentId;
  const wish = sc.features
    .filter((f) => !s.product.features[f.id]?.completed && !f.tags?.includes('cms'))
    .sort((a, b) => (s.world.featureValue[b.id][seg] ?? 0) - (s.world.featureValue[a.id][seg] ?? 0))[0];
  if (wish) lines.push(t('Чаще всего просили: {0}.', [wish.name]));
  if (rates.acceptance < 0.4) lines.push(t('Многие участники считают цену слишком высокой.'));
  s.growthResearch.push({ kind: 'beta', week: s.week, title: t('Итоги закрытой беты'), lines });
  s.lastReport = [];
  report(s, t('Закрытая бета завершена. Итоги будут в разделе «Аналитика» после запуска.'), 'good');
  for (const line of lines) report(s, line);
}

function launchSpike(s: GameState): void {
  const sc = scenarioOf(s);
  const ctx = productContext(s, true);
  s.flags.spike = (s.flags.spike ?? 0) + sc.launchSpike * (0.6 + 0.6 * ctx.value);
  if (ctx.quality < 0.8 || ctx.value < 0.7) {
    s.product.rating = Math.min(s.product.rating, 3.6);
    addTrust(s, -5);
    log(s, { title: t('Громкий запуск: сырой продукт'), text: t('Волна новых пользователей встретила баги и слабую ценность. Рейтинг упал до 3,6 ★.'), tone: 'bad' });
  } else {
    addTrust(s, 4);
    log(s, { title: t('Громкий запуск'), text: t('Product Hunt, PR и соцсети: в следующем месяце будет всплеск трафика.'), tone: 'good' });
  }
}

function launch(s: GameState, strategy: LaunchState['strategy'], checklist: string[]): void {
  const sc = scenarioOf(s);
  const items = LAUNCH_CHECKLIST.filter((i) => checklist.includes(i.id) && (!i.available || i.available(s)));
  const done = items.map((i) => i.id);
  s.cash -= items.reduce((sum, i) => sum + i.cost, 0);
  s.product.lostPoints += items.reduce((sum, i) => sum + i.points, 0);
  for (const f of Object.values(s.product.features)) if (f.completed) f.shipped = true;
  // A privacy policy with consents covers the GDPR basics.
  if (done.includes('privacy') && !s.compliance.includes('gdpr')) s.compliance.push('gdpr');
  s.launch = { strategy, checklist: done, beta: !!s.flags.betaDone, week: s.week, bigLaunchDone: strategy === 'big' };
  s.lastReport = [];

  if (done.includes('store_page')) s.product.leverMods.registration *= 1.06;
  if (done.includes('support_kb')) s.product.leverMods.retention *= 1.03;
  if (done.includes('onboarding_emails')) s.product.leverMods.activation *= 1.04;
  if (done.includes('regression')) s.product.bugs *= 0.75;
  if (done.includes('monitoring') && !s.tech.practices.includes('monitoring')) s.tech.practices.push('monitoring');
  if (!done.includes('tracking') && s.tech.analytics !== 'none') s.flags.trackingBroken = s.week + 12;
  if (!done.includes('privacy')) {
    if (sc.kind === 'b2c') {
      s.cash -= 1500;
      s.week += 1;
      report(s, t('App Store отклонил релиз: нет политики конфиденциальности. Пришлось сделать её за неделю.'), 'bad');
    } else {
      addModifier(s, { id: 'no_dpa', label: t('Нет политики данных — крупные клиенты сомневаются'), lever: 'conversion', mult: 0.92 }, 16);
    }
  }
  if (strategy === 'big') launchSpike(s);

  const actual = s.week - (s.buildStartWeek ?? s.week);
  const commit = s.commitWeeks ?? actual;
  if (actual <= commit) {
    addTrust(s, 8);
    judge(s, 'stakeholders', 3, t('Запуск в обещанный срок'), t('{0} недель при обещанных {1}. Предсказуемость — основа доверия стейкхолдеров.', [actual, commit]));
  } else if (actual <= commit * 1.25) {
    addTrust(s, -3);
    judge(s, 'stakeholders', -1, t('Небольшая задержка запуска'), t('{0} недель вместо {1}. Неприятно, но в пределах нормы.', [actual, commit]));
  } else {
    addTrust(s, -12);
    judge(s, 'stakeholders', -4, t('Запуск сильно задержан'), t('{0} недель вместо {1}. Обещания без буфера бьют по доверию сильнее, чем честный длинный срок.', [actual, commit]));
  }
  judgeLaunch(s);

  const remaining = s.mvpScope.filter((id) => !s.product.features[id]?.completed);
  const backlog = sc.features.map((f) => f.id).filter((id) => !s.mvpScope.includes(id));
  s.featureQueue = [...remaining, ...backlog];
  s.phase = 'growth';
  milestone(s, 'launch', t('Запуск продукта'));
  report(s, t('Продукт запущен! Стратегия: {0}. Настройте маркетинг и завершите первый месяц.', [strategy === 'soft' ? t('soft launch на тестовом рынке') : strategy === 'big' ? t('громкий запуск') : t('тихий запуск')]), 'action', 'marketing');
}

function runMonth(s: GameState, rng: Rng): void {
  const sc = scenarioOf(s);
  s.lastReport = [];
  const record = simulateMonth(s, rng);
  s.history.push(record);

  const work = doWork(s, rng, 2, s.featureQueue, s.allocation);
  // With feature flags a finished feature goes to half of the users as an A/B test.
  const flagged = s.releaseWithAb && canTestFeatures(s) ? work.completed : [];
  const released = work.completed.filter((id) => !flagged.includes(id));
  for (const id of released) {
    s.product.features[id].shipped = true;
    report(s, t('Выпущена функция: {0}', [featureDef(sc, id).name]), 'good', 'product');
  }
  s.featureQueue = s.featureQueue.filter((id) => !s.product.features[id]?.completed);
  s.week += 4;
  for (const id of released) milestone(s, 'feature', t('Выпущена: {0}', [featureDef(sc, id).name]));
  updateMorale(s);
  updateMorale(s);

  for (const exp of s.experiments) {
    if (exp.status === 'running' && exp.resultWeek <= s.week) {
      resolveExperiment(s, rng, exp);
      report(s, t('Готовы результаты A/B-теста «{0}» — нужно решение.', [ideaDef(s, exp.ideaId).name]), 'action', 'experiments');
    }
  }
  for (const id of flagged) {
    startFeatureTest(s, id);
    report(s, t('Функция «{0}» готова и включена для половины пользователей. Результат теста — через месяц.', [featureDef(sc, id).name]), 'info', 'experiments');
  }
  if (flagged.length > 0 && !s.flags.featureFlagJudged) {
    s.flags.featureFlagJudged = 1;
    judge(s, 'delivery', 2, t('Выпуск функций за фича-флагом'), t('Новая функция сначала идёт на часть пользователей, а эффект измеряется A/B-тестом. Так видно, приносит ли функция пользу, а неудачную легко откатить.'));
  }
  for (const kind of s.pendingGrowthResearch) {
    const result = runGrowthResearch(s, rng, kind);
    s.growthResearch.push(result);
    report(s, t('Готово исследование: {0}.', [result.title]), 'good', 'analytics');
  }
  s.pendingGrowthResearch = [];
  completeResearch(s, rng, 'research');
  closeHoldouts(s, rng);
  competitorMonth(s, rng);
  stakeholderMonth(s);
  if (s.stakeholders.cto < 30) addMorale(s, -2);
  // Unhappy people leave.
  const staff = s.team.filter((m) => m.joinWeek <= s.week);
  if (s.morale < 40 && staff.length > 1 && rng.next() < 0.12) {
    const leaver = staff[Math.floor(rng.next() * staff.length)];
    fireMember(s, leaver.id, 'left');
    report(s, t('{0} уволился: мотивация в команде слишком низкая.', [leaver.name]), 'bad', 'team');
  }
  s.modifiers = s.modifiers.filter((m) => m.untilWeek > s.week);

  const growth = mrrGrowth(s, 1);
  if (growth !== null && s.history.length >= 2) {
    if (growth > 0.1) addTrust(s, 2);
    else if (growth < 0) addTrust(s, -3);
  }
  const team = s.team.filter((m) => m.source === 'freelance' && m.joinWeek <= s.week);
  for (const m of team) {
    if (rng.next() < 0.04) {
      fireMember(s, m.id, 'left');
      report(s, t('Фрилансер {0} внезапно перестал(а) отвечать.', [m.name]), 'bad', 'team');
    }
  }

  s.lastReport.push(...record.notes);
  const messages = generateInbox(s, rng);
  report(s, t('Во входящих {0} {1} от пользователей и команды.', [messages, messages < 5 ? t('новых сообщения') : t('новых сообщений')]), 'info', 'inbox');
  reviewQuarter(s);
  if (s.history.length % 3 === 0) triggerEvent(s, rng, 'board_meeting');
  rollEvents(s, rng, 'growth', [0.8, 0.35]);
  maybeCashCrunch(s, rng);
  checkEnd(s);
}
