// Evaluation of key product decisions at phase gates. Each judgement adds a
// decision-log entry with an explanation, so the player learns why.

import { criterionDef } from '../data/research.ts';
import { featureDef, hasRole, scenarioOf, segmentDef, techSetupPoints } from './catalog.ts';
import { judge } from './effects.ts';
import { featureEstimate, mustFeatures, productContext, sprintCapacity } from './product.ts';
import { segmentOpportunity } from './research.ts';
import type { GameState } from './types.ts';
import { t } from '../i18n/index.ts';

export function judgeStrategy(s: GameState): void {
  const sc = scenarioOf(s);
  const strategy = s.strategy;
  if (!strategy) return;
  const segId = strategy.segmentId;
  const segName = segmentDef(sc, segId).name;

  // Discovery length.
  if (s.week < 3) {
    judge(s, 'discovery', -4, t('Слишком короткий discovery'), t('Меньше трёх недель — недостаточно, чтобы проверить ключевые риски. Ошибка в выборе сегмента стоит месяцев разработки.'));
  } else if (s.week <= 10) {
    judge(s, 'discovery', 2, t('Discovery в разумные сроки'), t('{0} недель: достаточно, чтобы снизить ключевые риски, и не слишком долго для runway.', [s.week]));
  } else {
    judge(s, 'discovery', -3, t('Затянутый discovery'), t('{0} недель исследований — деньги и время тают. Цель discovery — снизить главные риски, а не убрать все сомнения.', [s.week]));
  }

  // Hypothesis quality.
  const invalid = s.hypotheses.filter((h) => criterionDef(h.criterionId).quality === 'invalid');
  if (invalid.length > 0) {
    judge(s, 'discovery', -2 * invalid.length, t('Неопровержимые гипотезы'), t('{0} гипотез(ы) с критерием, который нельзя опровергнуть («нравится», «готовы платить»). Такие проверки ничего не доказывают.', [invalid.length]));
  }
  const tested = s.hypotheses.filter(
    (h) => h.segmentId === segId && h.status !== 'untested' && ['strong', 'medium'].includes(criterionDef(h.criterionId).quality),
  );
  const testedKinds = new Set(tested.map((h) => h.kind));
  if (testedKinds.size === 0) {
    judge(s, 'discovery', -8, t('Сегмент выбран без проверки'), t('Ни одна содержательная гипотеза про «{0}» не проверена. Решение принято на интуиции.', [segName]));
  } else {
    const pts = (testedKinds.has('problem') ? 3 : 0) + (testedKinds.has('wtp') ? 3 : 0) + (testedKinds.has('solution') ? 2 : 0) + (testedKinds.has('channel') ? 2 : 0);
    judge(s, 'discovery', pts, t('Проверенные гипотезы по выбранному сегменту'), t('Проверено: {0}. Самые рискованные допущения — проблема и деньги.', [[...testedKinds].map((k) => ({ problem: t('проблема'), wtp: t('готовность платить'), solution: t('решение'), channel: t('канал') })[k]).join(', ')]));
  }
  const refuted = tested.filter((h) => h.status === 'refuted' && (h.kind === 'problem' || h.kind === 'solution') && criterionDef(h.criterionId).quality === 'strong');
  if (refuted.length > 0) {
    judge(s, 'discovery', -4, t('Выбор вопреки данным'), t('Сильная гипотеза о проблеме или решении для этого сегмента была опровергнута, но вы всё равно его выбрали.'));
  }
  if (s.reports.some((r) => r.method === 'interviews' && r.params.script === 'leading')) {
    judge(s, 'discovery', -2, t('Наводящие вопросы в интервью'), t('Вопросы вида «Вам бы пригодилось…?» дают ложное подтверждение. Спрашивайте о прошлом опыте: когда последний раз, что делали, сколько потратили.'));
  }

  // Segment choice versus hidden opportunity.
  const opp = segmentOpportunity(s);
  const ranked = Object.keys(opp).sort((a, b) => opp[b] - opp[a]);
  const place = ranked.indexOf(segId);
  const points = [10, 4, -2, -6][place] ?? 0;
  judge(s, 'strategy', points, t('Выбор целевого сегмента'), place === 0 ? t('«{0}» — самый перспективный сегмент на этом рынке. Отличный выбор.', [segName]) : t('«{0}» — {1}-й по перспективности сегмент из {2}. Полную картину увидите в разборе в конце игры.', [segName, place + 1, ranked.length]));

  // Value proposition fit.
  const vpScores = sc.valueProps.map((v) => v.match[segId] ?? 1);
  const vpMatch = sc.valueProps.find((v) => v.id === strategy.valuePropId)?.match[segId] ?? 1;
  if (vpMatch >= Math.max(...vpScores)) {
    judge(s, 'strategy', 4, t('Ценностное предложение попадает в сегмент'), t('Позиционирование говорит на языке боли выбранного сегмента — выше CTR рекламы и активация.'));
  } else if (vpMatch < 0.95) {
    judge(s, 'strategy', -2, t('Слабое попадание позиционирования'), t('Ценностное предложение плохо отвечает на главную боль выбранного сегмента.'));
  }

  // North Star.
  const ns = sc.northStars.find((n) => n.id === strategy.northStarId);
  if (ns) judge(s, 'strategy', ns.quality === 'good' ? 4 : ns.quality === 'ok' ? 1 : -3, `North Star: ${ns.title}`, ns.lesson);

  // Price versus real willingness to pay.
  const wtp = s.world.segments[segId].wtp;
  const ratio = s.pricing.price / wtp;
  if (ratio >= 0.7 && ratio <= 1.3) {
    judge(s, 'strategy', 3, t('Цена в зоне готовности платить'), t('Цена близка к реальной готовности платить сегмента.'));
  } else if (ratio > 1.6) {
    judge(s, 'strategy', -3, t('Цена слишком высокая'), t('Большинство сегмента не готово платить столько — конверсия будет низкой, отток высоким.'));
  } else if (ratio < 0.5) {
    judge(s, 'strategy', -2, t('Цена слишком низкая'), t('Вы оставляете деньги на столе: сегмент готов платить заметно больше. Низкая цена режет LTV и бюджет на привлечение.'));
  }
}

export function mvpEstimate(s: GameState): { points: number; capacity: number; weeks: number; hiringWeeks: number } {
  const points = s.mvpScope.reduce((sum, id) => sum + featureEstimate(s, id), 0);
  const capacity = sprintCapacity(s, null).total;
  const setup = s.phase === 'setup' ? techSetupPoints(s) : s.product.setupPoints;
  const joins = s.team.filter((m) => m.role === 'developer').map((m) => m.joinWeek - s.week);
  const hiringWeeks = joins.length > 0 ? Math.max(0, Math.round(joins.reduce((a, b) => a + b, 0) / joins.length)) : 0;
  const weeks = capacity > 0 ? hiringWeeks + Math.ceil(((points + setup) / (capacity * 0.75)) * 2) : Infinity;
  return { points, capacity, weeks, hiringWeeks };
}

export const BETA_WEEKS = 4;

export function judgeSetup(s: GameState, commitWeeks: number): void {
  const sc = scenarioOf(s);
  const segId = s.strategy?.segmentId ?? sc.segments[0].id;

  // Analytics and experimentation.
  if (s.tech.analytics === 'none') {
    judge(s, 'delivery', -5, t('Продукт без аналитики'), t('После запуска вы не увидите воронку, удержание и когорты. Решения будут приниматься вслепую.'));
  } else if (s.tech.analytics === 'basic') {
    judge(s, 'delivery', 1, t('Базовая аналитика'), t('Лучше, чем ничего, но без когорт и с погрешностью данных.'));
  } else {
    judge(s, 'delivery', 3, t('Продуктовая аналитика с первого дня'), t('Трекинг-план до запуска — одно из самых окупаемых решений PO.'));
  }

  // Architecture.
  if (s.tech.backend === 'microservices' && s.tech.platform !== 'nocode') {
    judge(s, 'delivery', -4, t('Микросервисы для MVP'), t('Преждевременная оптимизация: сложность и медленная разработка ради нагрузки, которой ещё нет.'));
  } else {
    judge(s, 'delivery', 2, t('Простая архитектура для старта'), t('Монолит или BaaS позволяют быстро проверить продукт на рынке.'));
  }
  if (s.tech.infra === 'iaas' && !s.team.some((m) => m.role === 'devops')) {
    judge(s, 'delivery', -3, t('Kubernetes без DevOps'), t('Своя инфраструктура без инженера по эксплуатации — путь к частым падениям.'));
  }
  if (s.tech.auth === 'own') judge(s, 'delivery', -2, t('Своя авторизация'), t('Build vs buy: авторизацию дешевле и безопаснее купить. Тратьте время команды на уникальную ценность.'));
  if (s.tech.payments === 'own_iap' || s.tech.payments === 'invoice') {
    judge(s, 'delivery', -2, t('Свой биллинг'), t('Платежи — сложная и рискованная область. Готовые решения экономят недели и снижают число ошибок с деньгами.'));
  }
  if (s.tech.process === 'adhoc') {
    judge(s, 'delivery', -3, t('Без процесса'), t('Без ритма планирования и ретро сроки непредсказуемы, а команда быстрее выгорает.'));
  }
  const practices = s.tech.practices;
  if (practices.length === 0) {
    judge(s, 'delivery', -2, t('Без инженерных практик'), t('Ни ревью, ни тестов, ни мониторинга: техдолг и баги накопятся быстро.'));
  } else if (practices.includes('codereview') || practices.includes('autotests')) {
    judge(s, 'delivery', 2, t('Инженерные практики'), t('Код-ревью и автотесты немного замедляют сейчас, но экономят месяцы на багах и долге.'));
  }

  // MVP scope.
  const musts = mustFeatures(sc, segId);
  const missing = musts.filter((id) => !s.mvpScope.includes(id));
  if (missing.length > 0) {
    judge(s, 'strategy', -4 * missing.length, t('В MVP нет обязательных функций'), t('Без {0} продукт не воспримут всерьёз (must-be по Кано).', [missing.map((id) => t('«{0}»', [featureDef(sc, id).name])).join(', ')]));
  }
  const indifferent = s.mvpScope.filter((id) => featureDef(sc, id).kano === 'indifferent');
  if (indifferent.length > 0) {
    judge(s, 'strategy', -2 * indifferent.length, t('Лишнее в MVP'), t('{0} почти не влияют на ценность для пользователей, но отнимают время.', [indifferent.map((id) => t('«{0}»', [featureDef(sc, id).name])).join(', ')]));
  }
  const top = sc.features
    .filter((f) => f.kano !== 'must' && f.kano !== 'indifferent')
    .sort((a, b) => (s.world.featureValue[b.id][segId] ?? 0) - (s.world.featureValue[a.id][segId] ?? 0))
    .slice(0, 3)
    .map((f) => f.id);
  const hits = top.filter((id) => s.mvpScope.includes(id));
  if (hits.length > 0) {
    judge(s, 'strategy', 2 * hits.length, t('Самые ценные функции в MVP'), t('В MVP есть {0} из 3 самых ценных для сегмента функций.', [hits.length]));
  }
  const estimate = mvpEstimate(s);
  if (estimate.points > 110) {
    judge(s, 'strategy', -4, t('Раздутый MVP'), t('{0} SP — это не минимальный продукт. Чем дольше до запуска, тем позже вы узнаете правду от рынка.', [estimate.points]));
  }

  // Commitment to the CEO.
  if (Number.isFinite(estimate.weeks)) {
    if (commitWeeks < estimate.weeks * 0.9) {
      judge(s, 'stakeholders', -3, t('Нереалистичное обещание'), t('Оценка команды — около {0} недель, а вы пообещали {1}. Без буфера срыв почти гарантирован.', [estimate.weeks, commitWeeks]));
    } else if (commitWeeks <= estimate.weeks * 1.6 + BETA_WEEKS) {
      // A closed beta takes 4 more weeks, so a buffer that covers it is still reasonable.
      judge(s, 'stakeholders', 3, t('Срок с буфером'), t('Вы заложили запас на неопределённость — оценки разработки почти всегда оптимистичны.'));
    } else {
      judge(s, 'stakeholders', -1, t('Слишком большой запас'), t('CEO смущает такой длинный срок. Буфер должен быть разумным: 20–50%.'));
    }
  }

  // Team composition sanity.
  if (!s.team.some((m) => m.role === 'developer')) {
    judge(s, 'delivery', -5, t('Нет разработчиков'), t('Без разработчиков MVP не появится.'));
  }
}

export function judgeLaunch(s: GameState): void {
  const sc = scenarioOf(s);
  const ctx = productContext(s, true);
  if (ctx.mustMissing.length > 0) {
    judge(s, 'delivery', -3 * ctx.mustMissing.length, t('Запуск без обязательных функций'), t('Не готово: {0}. Пользователи будут уходить в первые дни.', [ctx.mustMissing.map((id) => featureDef(sc, id).name).join(', ')]));
  }
  if (!ctx.revenueEnabled) {
    judge(s, 'strategy', -3, t('Запуск без монетизации'), t('Без платёжной функции вы не узнаете главное — готовы ли люди платить.'));
  }
  if (s.launch?.beta) judge(s, 'delivery', 3, t('Закрытая бета перед запуском'), t('Бета нашла баги и проблемы до того, как их увидели тысячи людей.'));
  if (s.launch?.strategy === 'soft') {
    judge(s, 'growth', 3, 'Soft launch', t('Сначала тестовый рынок и небольшой трафик: можно исправить воронку до больших трат.'));
  }
  if (s.launch?.strategy === 'big') {
    if (ctx.quality < 0.8 || ctx.value < 0.7) {
      judge(s, 'growth', -4, t('Громкий запуск сырого продукта'), t('Большая волна трафика встретила сырой продукт: плохие отзывы и сожжённая аудитория. Второго первого впечатления не будет.'));
    } else {
      judge(s, 'growth', 2, t('Громкий запуск готового продукта'), t('Продукт был готов к вниманию — волна трафика конвертируется в пользователей.'));
    }
  }
  const skipped = ['tracking', 'payments_test', 'privacy'].filter((id) => !s.launch?.checklist.includes(id));
  if (skipped.length > 0) {
    judge(s, 'delivery', -skipped.length, t('Пропущены пункты чек-листа'), t('Трекинг, проверка платежей и политика конфиденциальности — дешёвая страховка от дорогих проблем.'));
  }
  if (!hasRole(s, 'qa') && !s.tech.practices.includes('autotests') && s.product.bugs > 30) {
    judge(s, 'delivery', -2, t('Много багов на запуске'), t('{0} открытых багов. Без QA и автотестов дефекты доходят до пользователей.', [Math.round(s.product.bugs)]));
  }
}
