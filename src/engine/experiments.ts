// A/B tests: traffic-based sample sizes, noisy results, peeking, SRM,
// novelty effects and guardrail metrics.

import { fixed, signedPct } from '../format.ts';
import { capabilities, featureDef, hasRole, scenarioOf, techOption } from './catalog.ts';
import { addModifier, judge, log, milestone, nextId, report } from './effects.ts';
import { retentionCurve } from './growth.ts';
import { hoursError } from './potime.ts';
import type { FunnelRates } from './product.ts';
import { funnelRates, productContext } from './product.ts';
import type { Rng } from './rng.ts';
import { binomial, chance, normal, uniform } from './rng.ts';
import { normCdf, proportionTest, sampleSizePerGroup, srmPValue } from './stats.ts';
import type { Experiment, ExperimentIdeaDef, GameState, Lever, MonthRecord } from './types.ts';
import { t } from '../i18n/index.ts';

export const METRIC_NAMES: Record<Exclude<Lever, 'virality'>, string> = {
  registration: t('Конверсия в регистрацию'),
  activation: t('Активация'),
  conversion: t('Конверсия в оплату'),
  retention: t('Удержание 30-го дня'),
};

export const LEVER_NAMES: Record<Lever, string> = {
  ...METRIC_NAMES,
  virality: t('Виральность'),
};

export interface ExperimentConfig {
  ideaId: string;
  durationWeeks: number;
  allocation: number;
  peeking: boolean;
  guardrails: boolean;
  mde: number;
}

// Feature releases behind a feature flag are tested as experiments with this id prefix.
export const FEATURE_TEST_PREFIX = 'feature:';
export const EXTENSION_WEEKS = 2;

export function ideaDef(s: GameState, ideaId: string): ExperimentIdeaDef {
  if (ideaId.startsWith(FEATURE_TEST_PREFIX)) {
    const feature = featureDef(scenarioOf(s), ideaId.slice(FEATURE_TEST_PREFIX.length));
    const metric = s.experiments.find((e) => e.ideaId === ideaId)?.metric ?? 'activation';
    return {
      id: ideaId,
      name: t('Функция «{0}» за фича-флагом', [feature.name]),
      hypothesis: t('Если выпустить «{0}» всем, {1} вырастет. Половина пользователей видит функцию, половина — нет.', [feature.name, METRIC_NAMES[metric].toLowerCase()]),
      metric,
      mean: 0,
      sd: 0,
      effort: 0,
    };
  }
  const idea = scenarioOf(s).experiments.find((e) => e.id === ideaId);
  if (!idea) throw new Error(`unknown experiment ${ideaId}`);
  return idea;
}

// Ideas from research appear only after that research is done.
export function visibleIdeas(s: GameState): ExperimentIdeaDef[] {
  return scenarioOf(s).experiments.filter((i) => !i.source || s.unlockedIdeas.includes(i.id));
}

export function maxConcurrentTests(s: GameState): number {
  return 2 + (hasRole(s, 'analyst') ? 1 : 0) + (s.tech.experiments === 'platform' ? 1 : 0);
}

// Feature flags do not take a slot: they only split traffic for an already built feature.
export function runningTests(s: GameState): number {
  return s.experiments.filter((e) => e.status === 'running' && !e.featureId).length;
}

export function canTestFeatures(s: GameState): boolean {
  return s.tech.analytics !== 'none' && s.tech.experiments !== 'none';
}

// Users per week entering the funnel step the metric is measured on.
export function weeklyFlow(record: MonthRecord, metric: Experiment['metric']): number {
  const t = record.truth;
  const monthly =
    metric === 'registration' ? t.acquired : metric === 'activation' ? t.registered : t.activated;
  return (monthly ?? 0) / 4;
}

export function baselineRate(record: MonthRecord, metric: Experiment['metric']): number {
  const t = record.truth;
  const rate =
    metric === 'registration'
      ? t.registrationRate
      : metric === 'activation'
        ? t.activationRate
        : metric === 'conversion'
          ? t.conversionRate
          : t.retentionM1;
  return rate ?? 0;
}

export function plannedSample(s: GameState, metric: Experiment['metric'], weeks: number, allocation: number): number {
  const last = s.history[s.history.length - 1];
  if (!last) return 0;
  return Math.floor((weeklyFlow(last, metric) * weeks * allocation) / 2);
}

export function requiredSample(s: GameState, metric: Experiment['metric'], mde: number): number {
  const last = s.history[s.history.length - 1];
  if (!last) return Infinity;
  return sampleSizePerGroup(Math.max(0.001, baselineRate(last, metric)), mde);
}

export function validateExperiment(s: GameState, config: ExperimentConfig): string | null {
  if (config.ideaId.startsWith(FEATURE_TEST_PREFIX)) return t('Функции тестируются через фича-флаги при выпуске.');
  const idea = ideaDef(s, config.ideaId);
  if (idea.source && !s.unlockedIdeas.includes(idea.id)) return t('Эта идея ещё не найдена: её подскажет исследование.');
  if (s.tech.analytics === 'none') return t('Без продуктовой аналитики нечем измерять результат.');
  if (s.tech.experiments === 'none') return t('Нет инфраструктуры для A/B-тестов (раздел «Технологии»).');
  if (s.product.setupPoints > 0) return t('Команда ещё настраивает инфраструктуру — дождитесь конца месяца.');
  if (s.history.length === 0) return t('Нужен хотя бы месяц данных после запуска, чтобы знать базовую конверсию.');
  if (runningTests(s) >= maxConcurrentTests(s)) return t('Достигнут лимит параллельных тестов.');
  if (s.experiments.some((e) => e.ideaId === config.ideaId && (e.status === 'running' || e.status === 'shipped'))) {
    return t('Этот тест уже идёт или внедрён.');
  }
  if (idea.requires && !capabilities(s).has(idea.requires)) return t('Недоступно на вашей платформе.');
  if (config.durationWeeks < 1 || config.allocation <= 0 || config.allocation > 1) return t('Некорректные параметры.');
  const time = hoursError(s, 4);
  if (time) return time;
  return null;
}

// A running test on the same metric that would share users with a new test of this traffic share.
export function overlappingTest(s: GameState, metric: Experiment['metric'], allocation: number): Experiment | undefined {
  return s.experiments.find((e) => e.status === 'running' && !e.featureId && e.metric === metric && e.allocation + allocation > 1);
}

export function startExperiment(s: GameState, config: ExperimentConfig): Experiment {
  const idea = ideaDef(s, config.ideaId);
  let trueEffect = s.world.experiments[idea.id].effect;
  let variantPrice: number | undefined;
  if (idea.priceMult) {
    // Price tests follow the hidden willingness-to-pay curve.
    variantPrice = Math.round(s.pricing.price * idea.priceMult * 100) / 100;
    const ctx = productContext(s);
    const current = funnelRates(s, ctx).acceptance;
    const variant = funnelRates(s, ctx, variantPrice).acceptance;
    trueEffect = current > 0 ? variant / current - 1 : 0;
  }
  const exp: Experiment = {
    id: nextId(s, 'x'),
    ideaId: idea.id,
    metric: idea.metric,
    startWeek: s.week,
    durationWeeks: config.durationWeeks,
    resultWeek: s.week + config.durationWeeks + (idea.metric === 'retention' ? 4 : 0),
    allocation: config.allocation,
    peeking: config.peeking,
    guardrails: config.guardrails,
    mde: config.mde,
    status: 'running',
    variantPrice,
    trueEffect,
  };
  // Two tests on the same metric interfere when they share users; split traffic keeps them apart.
  const rival = overlappingTest(s, exp.metric, exp.allocation);
  if (rival) {
    exp.overlapWith = rival.id;
    rival.overlapWith ??= exp.id;
    judge(s, 'experiments', -1, t('Тест «{0}» пересекается с другим тестом', [idea.name]), t('Оба теста меняют {0} у тех же пользователей. Эффекты смешиваются, и результаты обоих становятся менее надёжными.', [METRIC_NAMES[exp.metric].toLowerCase()]));
  }
  s.experiments.push(exp);
  s.product.lostPoints += idea.effort;

  const planned = plannedSample(s, idea.metric, config.durationWeeks, config.allocation);
  const needed = requiredSample(s, idea.metric, config.mde);
  if (planned < needed * 0.5) {
    judge(s, 'experiments', -1, t('Тест «{0}» недобирает выборку', [idea.name]), t('Нужно ~{0} пользователей в группе, а будет ~{1}. Мощность теста низкая: даже реальный эффект, скорее всего, не будет значимым.', [fixed(needed, 0), fixed(planned, 0)]));
  }
  return exp;
}

// The real effect of a feature on each funnel step: the funnel with it minus the funnel without it.
function featureEffects(s: GameState, featureId: string): Record<Experiment['metric'], number> {
  const tau = scenarioOf(s).funnel.retentionTau;
  const retention = (r: FunnelRates) => retentionCurve(r.retentionFloor, tau, 1);
  const without = funnelRates(s, productContext(s));
  const withFeature = structuredClone(s);
  withFeature.product.features[featureId] = { ...withFeature.product.features[featureId], shipped: true };
  const withRates = funnelRates(withFeature, productContext(withFeature));
  return {
    registration: withRates.registration / without.registration - 1,
    activation: withRates.activation / without.activation - 1,
    conversion: without.conversion > 0 ? withRates.conversion / without.conversion - 1 : 0,
    retention: retention(withRates) / retention(without) - 1,
  };
}

// Releases a finished feature to half of the users and measures it on the step it moves most.
export function startFeatureTest(s: GameState, featureId: string): Experiment {
  const effects = featureEffects(s, featureId);
  const metrics = Object.keys(effects) as Experiment['metric'][];
  const metric = metrics.reduce((best, m) => (Math.abs(effects[m]) > Math.abs(effects[best]) + 0.002 ? m : best), 'retention');
  const exp: Experiment = {
    id: nextId(s, 'x'),
    ideaId: FEATURE_TEST_PREFIX + featureId,
    featureId,
    metric,
    startWeek: s.week,
    durationWeeks: 4,
    resultWeek: s.week + 4 + (metric === 'retention' ? 4 : 0),
    allocation: 1,
    peeking: false,
    guardrails: true,
    mde: 0.05,
    status: 'running',
    trueEffect: effects[metric],
  };
  s.experiments.push(exp);
  return exp;
}

// Runs the test longer after its result was seen. The new data is added to the old one.
export function extendExperiment(s: GameState, exp: Experiment): void {
  const idea = ideaDef(s, exp.ideaId);
  exp.firstResult = exp.result;
  exp.result = undefined;
  exp.extended = true;
  exp.status = 'running';
  exp.durationWeeks += EXTENSION_WEEKS;
  exp.resultWeek = s.week + EXTENSION_WEEKS + (exp.metric === 'retention' ? 4 : 0);
  judge(
    s,
    'experiments',
    -1,
    t('Продлили тест «{0}» после просмотра результата', [idea.name]),
    t('Продлевать тест, потому что p-value «почти» меньше 0,05, — разновидность подглядывания: шанс ложной победы растёт. Честный путь — заранее рассчитать выборку, а если мощности не хватило, перезапустить тест с новой, большей выборкой.'),
  );
}

export function resolveExperiment(s: GameState, rng: Rng, exp: Experiment): void {
  const idea = ideaDef(s, exp.ideaId);
  const last = s.history[s.history.length - 1];
  const base = Math.max(0.001, baselineRate(last, exp.metric));
  const novelty = (s.world.experiments[idea.id]?.novelty ?? 0) * Math.max(0, 1 - exp.durationWeeks / 8);
  // A parallel test on the same metric blurs the measured effect.
  const overlapping = exp.overlapWith !== undefined && s.experiments.some((e) => e.id === exp.overlapWith && e.startWeek < exp.resultWeek && e.resultWeek > exp.startWeek);
  const measured = (exp.trueEffect + novelty) * (overlapping ? 0.7 : 1) + (overlapping ? normal(rng, 0, 0.02) : 0);
  const variantRate = Math.min(0.99, base * (1 + measured));
  const total = weeklyFlow(last, exp.metric) * exp.durationWeeks * exp.allocation;
  const srmRisk = techOption(scenarioOf(s), 'experiments', s.tech.experiments).mods.srm ?? 0.05;
  let nA = Math.floor(total / 2);
  let nB = Math.floor(total / 2);
  if (chance(rng, srmRisk)) nB = Math.floor(nB * uniform(rng, 0.88, 0.95));

  let cA = 0;
  let cB = 0;
  let stoppedEarlyWeek: number | undefined;
  const first = exp.firstResult;
  if (first) {
    // Extension: new users join the data already collected, with the same split.
    const extra = Math.floor((weeklyFlow(last, exp.metric) * EXTENSION_WEEKS * exp.allocation) / 2);
    const extraB = Math.floor((extra * first.nB) / Math.max(1, first.nA));
    nA = first.nA + extra;
    nB = first.nB + extraB;
    cA = first.cA + binomial(rng, extra, base);
    cB = first.cB + binomial(rng, extraB, variantRate);
  } else if (exp.peeking) {
    const days = exp.durationWeeks * 7;
    let seenA = 0;
    let seenB = 0;
    for (let d = 1; d <= days; d++) {
      const dayA = Math.round(nA / days);
      const dayB = Math.round(nB / days);
      seenA += dayA;
      seenB += dayB;
      cA += binomial(rng, dayA, base);
      cB += binomial(rng, dayB, variantRate);
      if (d >= 3 && proportionTest(cA, seenA, cB, seenB).pValue < 0.05) {
        stoppedEarlyWeek = Math.ceil(d / 7);
        break;
      }
    }
    nA = seenA;
    nB = seenB;
  } else {
    cA = binomial(rng, nA, base);
    cB = binomial(rng, nB, variantRate);
  }

  const test = proportionTest(cA, nA, cB, nB);
  exp.result = {
    nA,
    cA,
    nB,
    cB,
    rateA: test.rateA,
    rateB: test.rateB,
    uplift: test.uplift,
    ciLow: test.ciLow,
    ciHigh: test.ciHigh,
    pValue: test.pValue,
    srmP: srmPValue(nA, nB),
    stoppedEarlyWeek,
  };
  // Slices by traffic source: the true effect differs a little, and each slice is noisier.
  const spread = uniform(rng, -0.6, 0.6);
  exp.result.subgroups = [
    { name: t('Платный трафик'), share: 0.6, effect: measured * (1 + spread) },
    { name: t('Органика и сарафан'), share: 0.4, effect: measured * (1 - 1.5 * spread) },
  ].map((g) => {
    const n1 = Math.floor(nA * g.share);
    const n2 = Math.floor(nB * g.share);
    const t = proportionTest(binomial(rng, n1, base), n1, binomial(rng, n2, Math.min(0.99, base * (1 + g.effect))), n2);
    return { name: g.name, uplift: t.uplift, pValue: t.pValue, n: n1 + n2 };
  });
  if (exp.variantPrice) {
    exp.result.revenuePerUserA = test.rateA * s.pricing.price;
    exp.result.revenuePerUserB = test.rateB * exp.variantPrice;
  }
  if (idea.guardrail && exp.guardrails) {
    const se = 1.2 / Math.sqrt(Math.max(50, Math.min(nA, nB) * 0.3));
    const uplift = idea.guardrail.effect + normal(rng, 0, se * 0.5);
    exp.result.guardrail = {
      lever: idea.guardrail.lever,
      uplift,
      pValue: 2 * (1 - normCdf(Math.abs(uplift) / (se * 0.5))),
    };
  }
  exp.status = 'done';
}

export const HOLDOUT_WEEKS = 12;

export function decideExperiment(s: GameState, exp: Experiment, ship: boolean, holdout = false): void {
  const idea = ideaDef(s, exp.ideaId);
  const r = exp.result;
  exp.status = ship ? 'shipped' : 'rejected';
  exp.decidedWeek = s.week;
  if (!r) return;
  // 5% of users keep the old version for three months to measure the long-term effect.
  if (ship && holdout && !exp.featureId && !exp.variantPrice) {
    exp.holdout = true;
    exp.holdoutWeek = s.week + HOLDOUT_WEEKS;
  }
  const significant = r.pValue < 0.05;
  const srm = r.srmP < 0.01;
  const realEffect = idea.priceMult && exp.variantPrice ? (1 + exp.trueEffect) * idea.priceMult - 1 : exp.trueEffect;

  if (ship) {
    if (exp.featureId) {
      s.product.features[exp.featureId].shipped = true;
      milestone(s, 'feature', t('Выпущена всем: {0}', [featureDef(scenarioOf(s), exp.featureId).name]));
    } else if (exp.variantPrice) {
      s.pricing.price = exp.variantPrice;
      milestone(s, 'price', t('Цена из теста: {0}', [fixed(exp.variantPrice, 2)]));
    } else {
      s.product.leverMods[exp.metric] *= 1 + exp.trueEffect * (exp.holdout ? 0.95 : 1);
      milestone(s, 'experiment', t('Внедрён тест: {0}', [idea.name]));
      // The novelty seen in the test also shows up after the release, and then fades.
      const novelty = s.world.experiments[idea.id]?.novelty ?? 0;
      if (novelty > 0.01) addModifier(s, { id: `novelty_${exp.id}`, label: t('Эффект новизны: «{0}»', [idea.name]), lever: exp.metric, mult: 1 + novelty }, 8);
    }
    if (idea.guardrail) s.product.leverMods[idea.guardrail.lever] *= 1 + idea.guardrail.effect;
    if (idea.darkPattern) s.flags.darkPatterns = (s.flags.darkPatterns ?? 0) + 1;
  }

  const name = `«${idea.name}»`;
  // A built feature only has to prove it does no harm; requiring a significant win would discard useful work.
  if (exp.featureId) {
    const harmful = significant && r.uplift < 0;
    if (ship && srm) {
      judge(s, 'experiments', -2, t('Выпустили функцию после теста {0} с SRM', [name]), t('Группы разного размера — сплитование сломано, и результату нельзя доверять. Сначала чинят сплит.'));
    } else if (ship && harmful) {
      judge(s, 'experiments', -2, t('Выпустили функцию, которая ухудшила метрику: {0}', [name]), t('Тест показал значимое падение (p = {0}). Такую функцию откатывают и переделывают.', [fixed(r.pValue, 3)]));
    } else if (ship) {
      judge(s, 'experiments', 1, t('Выпустили функцию без вреда для метрик: {0}', [name]), t('Для функции, нужной по исследованиям, достаточно показать, что она не вредит. Значимый рост — приятный бонус.'));
    } else if (harmful) {
      judge(s, 'experiments', 2, t('Откатили вредную функцию {0}', [name]), t('Тест поймал ухудшение до того, как функция дошла до всех. Именно для этого и нужны фича-флаги.'));
    } else if (realEffect > 0.02) {
      judge(s, 'experiments', -1, t('Откатили полезную функцию {0}', [name]), t('Функция помогала, но тесту не хватило мощности, чтобы это доказать. Если функция нужна по исследованиям и не вредит метрикам, её можно выпускать.'));
    } else {
      log(s, { title: t('Функция откачена: {0}', [idea.name]), text: t('Эффекта на метрику не видно. Функция остаётся готовой — её можно выпустить позже.'), tone: 'neutral' });
    }
    return;
  }
  if (exp.variantPrice) {
    const revenueEffect = t('реальная выручка на пользователя {0}', [signedPct(realEffect, 0)]);
    if (ship && realEffect > 0) {
      judge(s, 'experiments', 3, t('Сменили цену по итогам теста {0}', [name]), t('Смотрели на выручку на пользователя, а не только на конверсию: {0}.', [revenueEffect]));
    } else if (ship) {
      judge(s, 'experiments', -3, t('Новая цена из теста {0} снизила выручку', [name]), t('Конверсия и цена вместе дали {0}. В ценовых тестах главная метрика — выручка на пользователя.', [revenueEffect]));
    } else if (realEffect > 0.05) {
      judge(s, 'experiments', -1, t('Отказались от выгодной цены в тесте {0}', [name]), t('Новая цена дала бы {0}.', [revenueEffect]));
    } else {
      judge(s, 'experiments', 1, t('Оставили текущую цену после теста {0}', [name]), t('Верно: {0}.', [revenueEffect]));
    }
    return;
  }
  if (ship && srm) {
    judge(s, 'experiments', -4, t('Внедрили тест {0} с SRM', [name]), t('Группы разного размера (p-value SRM = {0}). Сплитование сломано, результату нельзя доверять — тест нужно чинить и перезапускать.', [r.srmP.toExponential(1)]));
  } else if (!ship && srm) {
    judge(s, 'experiments', 2, t('Заметили SRM в тесте {0}', [name]), t('Правильно: при нарушении соотношения групп результат не интерпретируют.'));
  }
  if (ship && idea.darkPattern) {
    judge(s, 'experiments', -5, t('Внедрили тёмный паттерн {0}', [name]), t('Краткосрочный рост метрики, но больше возвратов, жалоб и отписок. Пользователи чувствуют обман — страдают удержание, рейтинг и бренд.'));
  }
  if (ship && idea.guardrail && idea.guardrail.effect < 0 && !exp.guardrails) {
    judge(s, 'experiments', -2, t('Тест {0} без guardrail-метрик', [name]), t('У изменения был скрытый негативный эффект на другую метрику. Guardrail-метрики помогли бы его увидеть до внедрения.'));
  }
  if (ship && !srm) {
    if (exp.extended && significant && realEffect <= 0.01) {
      judge(s, 'experiments', -3, t('Продление обмануло в тесте {0}', [name]), t('Тест продлевали, пока p-value не стал меньше 0,05. Значимость получилась, а реального эффекта нет — классический ложноположительный результат.'));
    } else if (exp.peeking && r.stoppedEarlyWeek && realEffect <= 0.01) {
      judge(s, 'experiments', -3, t('Подглядывание обмануло в тесте {0}', [name]), t('Тест остановили при первом p < 0.05. При ежедневных проверках шанс ложноположительного результата в разы выше 5%. Реального эффекта не было.'));
    } else if (significant && r.uplift > 0 && realEffect > 0) {
      judge(s, 'experiments', 3, t('Внедрили выигравший тест {0}', [name]), t('Статистически значимый рост (p = {0}), и эффект реальный.', [fixed(r.pValue, 3)]));
    } else if (!significant && realEffect <= 0) {
      judge(s, 'experiments', -3, t('Внедрили незначимый тест {0}', [name]), t('p = {0}: разница в пределах шума. Реальный эффект оказался {1}.', [fixed(r.pValue, 2), realEffect >= 0 ? t('нулевым') : t('отрицательным')]));
    } else if (realEffect < 0) {
      judge(s, 'experiments', -2, t('Тест {0} на деле ухудшил продукт', [name]), t('Внедрённое изменение снизило ключевую метрику. Бывает и при правильной методике — поэтому важны повторные тесты и мониторинг после релиза.'));
    } else {
      judge(s, 'experiments', 1, t('Внедрили {0}', [name]), t('Эффект оказался положительным, хотя тест не дал строгого доказательства.'));
    }
  }
  if (!ship && !srm && significant && r.uplift > 0 && realEffect > 0.02 && !idea.darkPattern) {
    judge(s, 'experiments', -1, t('Отклонили выигравший тест {0}', [name]), t('Тест показал значимый рост, и эффект был реальным. Хорошие изменения тоже нужно внедрять.'));
  }
  if (!ship && !srm && !significant) {
    judge(s, 'experiments', 1, t('Не стали внедрять {0} без доказательств', [name]), t('Незначимый результат — не повод внедрять. Можно перезапустить с большей выборкой, если гипотеза важна.'));
  }
}

// A holdout ends: report the long-term effect and give the last 5% of users the change.
export function closeHoldouts(s: GameState, rng: Rng): void {
  for (const exp of s.experiments) {
    if (!exp.holdout || exp.holdoutWeek === undefined || exp.holdoutWeek > s.week) continue;
    const idea = ideaDef(s, exp.ideaId);
    const longTerm = exp.trueEffect + normal(rng, 0, 0.012);
    s.product.leverMods[exp.metric] *= (1 + exp.trueEffect) / (1 + exp.trueEffect * 0.95);
    exp.holdout = false;
    const shortTerm = exp.result?.uplift ?? 0;
    report(s, t('Holdout по тесту «{0}»: долгосрочный эффект {1} (в тесте было {2}).', [idea.name, signedPct(longTerm), signedPct(shortTerm)]), 'info', 'experiments');
    if (!s.flags.holdoutJudged) {
      s.flags.holdoutJudged = 1;
      judge(s, 'experiments', 1, t('Измерили долгосрочный эффект через holdout'), t('Тест показал {0}, а через три месяца эффект {1}. Короткие тесты часто завышают эффект из-за новизны.', [signedPct(shortTerm), signedPct(longTerm)]));
    }
  }
}
