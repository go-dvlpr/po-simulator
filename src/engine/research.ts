// Discovery research: methods produce noisy (sometimes biased) observations of
// the hidden market truth, and hypotheses are evaluated against their criteria.

import { fixed, money, pct } from '../format.ts';
import { marketCondition } from '../data/context.ts';
import { criterionDef, researchMethodDef, researchPlan, RESEARCH_SLOTS } from '../data/research.ts';
import { channelDef, featureDef, hasRole, scenarioOf, segmentDef } from './catalog.ts';
import { nextId } from './effects.ts';
import { hoursError, researchHours } from './potime.ts';
import type { Rng } from './rng.ts';
import { binomial, noiseMult, normal, pick, shuffle, uniform } from './rng.ts';
import { clamp, priceAcceptance } from './stats.ts';
import type {
  CriterionDef,
  GameState,
  Hypothesis,
  ResearchMethod,
  ResearchParams,
  ResearchReport,
  ScenarioDef,
} from './types.ts';
import { intlLocale, t } from '../i18n/index.ts';

const LEADING_QUOTES = [
  t('«Звучит здорово, я бы точно попробовал!»'),
  t('«Да, идея классная — друзьям тоже понравится.»'),
  t('«Наверное, платил бы, если будет удобно.»'),
  t('«Если сделаете, начну пользоваться сразу!»'),
  t('«Конечно, это всем нужно.»'),
  t('«Да-да, это была бы очень полезная функция.»'),
];

const fmtMoney = (v: number) => money(v, v >= 100 ? 0 : 2);
const fmtPct = (v: number) => pct(v);

export function criterionThresholds(sc: ScenarioDef, c: CriterionDef): number[] {
  return c.id === 'c_smoke' ? sc.channelCplThresholds : c.thresholds;
}

// Landing conversion to email signup (true expected value).
export function smokeConversion(sc: ScenarioDef, severity: number, fit: number): number {
  return clamp(sc.funnel.smokeBaseCr + 0.11 * severity * (0.5 + fit), 0.005, 0.4);
}

export function smokeCpc(s: GameState, segmentId: string, channelId: string): number {
  const sc = scenarioOf(s);
  const affinity = segmentDef(sc, segmentId).affinity[channelId] ?? 1;
  return (s.world.channelCost[channelId] * sc.funnel.smokeCpcMult) / affinity;
}

export function expectedCpl(s: GameState, segmentId: string, channelId: string): number {
  const sc = scenarioOf(s);
  const seg = s.world.segments[segmentId];
  return smokeCpc(s, segmentId, channelId) / smokeConversion(sc, seg.severity, seg.fit);
}

// Whether the hypothesis is actually true in this game's hidden world.
export function hypothesisTruth(s: GameState, h: Hypothesis): boolean {
  const sc = scenarioOf(s);
  const seg = s.world.segments[h.segmentId];
  switch (h.kind) {
    case 'problem':
      return seg.severity >= 0.55;
    case 'wtp':
      return seg.wtp >= (h.price ?? 0);
    case 'solution':
      return seg.fit >= 0.55;
    case 'channel': {
      const c = criterionDef(h.criterionId);
      const limit = c.id === 'c_smoke' ? h.threshold : sc.channelCplThresholds[1];
      return h.channelId ? expectedCpl(s, h.segmentId, h.channelId) <= limit : false;
    }
  }
}

export function smokeChannels(sc: ScenarioDef): string[] {
  return sc.channels.filter((c) => c.kind === 'paid' && !c.requires).map((c) => c.id);
}

export function validateResearch(s: GameState, method: ResearchMethod, params: ResearchParams): string | null {
  const sc = scenarioOf(s);
  if (s.activeResearch.length >= RESEARCH_SLOTS) return t('Вы уже ведёте два исследования одновременно — дождитесь результатов.');
  const def = researchMethodDef(method);
  if (def.needsSegment && !params.segmentId) return t('Выберите сегмент.');
  if (method === 'smoke' && (!params.channelId || !smokeChannels(sc).includes(params.channelId))) return t('Выберите рекламный канал.');
  if ((method === 'smoke' || method === 'concierge') && !params.price) return t('Выберите цену.');
  if (method === 'concierge' && s.activeResearch.some((r) => r.method === 'concierge')) return t('Консьерж-MVP уже идёт.');
  const time = hoursError(s, researchHours(method, params.count));
  if (time) return time;
  const plan = researchPlan(method, params, sc.kind === 'b2b');
  if (plan.cost > s.cash) return t('Недостаточно денег.');
  return null;
}

export function startResearch(s: GameState, method: ResearchMethod, params: ResearchParams): void {
  const sc = scenarioOf(s);
  const plan = researchPlan(method, params, sc.kind === 'b2b');
  s.cash -= plan.cost;
  s.activeResearch.push({
    id: nextId(s, 'r'),
    method,
    params,
    startWeek: s.week,
    endWeek: s.week + plan.weeks,
    cost: plan.cost,
  });
}

function addFeatureSignal(s: GameState, segmentId: string, featureId: string, estimate: number, weight: number): void {
  const bySeg = s.knowledge.featureSignals[segmentId];
  const cur = bySeg[featureId] ?? { sum: 0, weight: 0 };
  bySeg[featureId] = { sum: cur.sum + estimate * weight, weight: cur.weight + weight };
}

function userFacingFeatures(sc: ScenarioDef): string[] {
  return sc.features.filter((f) => f.kano !== 'must' && !f.tags?.includes('cms')).map((f) => f.id);
}

export function runResearch(s: GameState, rng: Rng, method: ResearchMethod, params: ResearchParams): ResearchReport {
  const sc = scenarioOf(s);
  const segId = params.segmentId ?? '';
  const seg = segId ? s.world.segments[segId] : undefined;
  const segName = segId ? segmentDef(sc, segId).name : '';
  const report: ResearchReport = {
    id: nextId(s, 'rep'),
    method,
    params,
    week: s.week,
    title: researchMethodDef(method).name + (segName ? ` — ${segName}` : ''),
    summary: [],
    metrics: [],
    quotes: [],
    observations: {},
  };

  switch (method) {
    case 'desk': {
      for (const def of sc.segments) {
        const est = s.world.segments[def.id].size * uniform(rng, 0.65, 1.45);
        s.knowledge.marketSize[def.id] = est;
        const unit = sc.kind === 'b2b' ? t('компаний') : t('человек');
        report.metrics.push({ label: `TAM: ${def.short}`, value: t('≈ {0} млн {1}', [fixed(est / 1e6, est < 1e6 ? 2 : 1), unit]) });
      }
      report.summary.push(...sc.deskFacts);
      const market = marketCondition(s.world.market);
      report.summary.push(t('Обстановка на рынке: **{0}**. {1}', [market.title, market.text]));
      report.summary.push(t('Оценки размера рынка взяты из разных отчётов и расходятся в 1,5–2 раза. Это ориентир, а не факт.'));
      break;
    }
    case 'competitors': {
      s.knowledge.competitorsKnown = true;
      for (const c of sc.competitors) {
        report.summary.push(t('**{0}** — {1} Цена: {2}. Рейтинг: {3}. Сильные стороны: {4}. Слабые: {5}.', [c.name, c.description, c.price, c.rating, c.strengths, c.weaknesses]));
      }
      const direct = sc.competitors.filter((c) => c.features.length > 1);
      const common = sc.features.filter((f) => direct.filter((c) => c.features.includes(f.id)).length >= Math.ceil(direct.length * 0.66));
      report.metrics.push({ label: t('Есть у большинства конкурентов'), value: common.map((f) => f.name).join('; ') });
      report.summary.push(t('Функции, которые есть почти у всех конкурентов, пользователи считают само собой разумеющимися: без них продукт не воспримут всерьёз.'));
      break;
    }
    case 'expert': {
      if (!seg) break;
      const hints: Record<string, number> = {};
      const segDef = segmentDef(sc, segId);
      for (const c of sc.channels) {
        hints[c.id] = (segDef.affinity[c.id] ?? 1) * noiseMult(rng, 0.25);
      }
      s.knowledge.channelHints[segId] = hints;
      const ranked = sc.channels.map((c) => c.id).sort((a, b) => hints[b] - hints[a]);
      report.metrics.push({ label: t('Лучшие каналы по мнению экспертов'), value: ranked.slice(0, 2).map((id) => channelDef(sc, id).name).join(', ') });
      report.metrics.push({ label: t('Худшие каналы'), value: ranked.slice(-2).map((id) => channelDef(sc, id).name).join(', ') });
      report.summary.push(...sc.expertFacts);
      report.summary.push(t('Мнения экспертов субъективны: они опираются на свой опыт, а не на ваши данные.'));
      report.observations.channelPresence = 1;
      break;
    }
    case 'interviews': {
      if (!seg) break;
      const n = params.count ?? 10;
      const leading = params.script === 'leading';
      const pPain = leading ? clamp(0.4 + 0.55 * seg.severity, 0.05, 0.98) : clamp(0.05 + 0.9 * seg.severity, 0.02, 0.97);
      const painCount = binomial(rng, n, pPain);
      const like = leading ? uniform(rng, 0.85, 1) : uniform(rng, 0.55, 0.85);
      const wouldUse = leading
        ? clamp(uniform(rng, 0.75, 0.95), 0, 1)
        : clamp(0.3 + 0.5 * seg.severity * seg.fit + normal(rng, 0, 0.08), 0.05, 0.95);
      report.observations.painShare = (painCount / n) * 100;
      report.observations.likeShare = like * 100;
      report.observations.wouldUseShare = wouldUse * 100;
      report.metrics.push({ label: t('Описали проблему на своём опыте'), value: t('{0} из {1}', [painCount, n]) });
      report.metrics.push({ label: t('Сказали, что идея нравится'), value: t('{0} из {1}', [Math.round(like * n), n]) });
      report.metrics.push({ label: t('Сказали, что пользовались бы'), value: t('{0} из {1}', [Math.round(wouldUse * n), n]) });
      const segDef = segmentDef(sc, segId);
      if (leading) {
        report.quotes.push(...shuffle(rng, LEADING_QUOTES).slice(0, 3));
        if (painCount > n / 2) report.quotes.push(pick(rng, segDef.quotes.pain));
        report.summary.push(t('Собеседники охотно соглашались с вашими формулировками и много говорили о том, что будут делать в будущем.'));
        for (const id of shuffle(rng, userFacingFeatures(sc)).slice(0, 3)) addFeatureSignal(s, segId, id, uniform(rng, 0.7, 1.1), 0.3);
      } else {
        report.quotes.push(...shuffle(rng, segDef.quotes.pain).slice(0, Math.min(3, Math.round((painCount / n) * 4))));
        report.quotes.push(...shuffle(rng, segDef.quotes.noPain).slice(0, Math.min(2, Math.round(((n - painCount) / n) * 3))));
        const spend = seg.wtp * segDef.seats * uniform(rng, 0.6, 1.05);
        report.summary.push(t('Сейчас решают проблему так: {0}. Те, у кого проблема острая, тратят на это около {1} в месяц.', [segDef.spendHint, fmtMoney(spend)]));
        const ranked = userFacingFeatures(sc)
          .map((id) => ({ id, v: (s.world.featureValue[id][segId] ?? 0) * noiseMult(rng, 0.3) }))
          .sort((a, b) => b.v - a.v)
          .slice(0, 3);
        report.summary.push(t('Чаще всего упоминали потребности, которые закрывают: {0}.', [ranked.map((r) => featureDef(sc, r.id).name).join('; ')]));
        for (const r of ranked) addFeatureSignal(s, segId, r.id, r.v, Math.max(0.5, n / 10));
      }
      break;
    }
    case 'survey': {
      if (!seg) break;
      const n = params.count ?? 300;
      const noiseScale = Math.sqrt(300 / n);
      const statedPain = clamp(0.2 + 0.75 * seg.severity + normal(rng, 0, 0.03 * noiseScale), 0.05, 0.97);
      const segDef = segmentDef(sc, segId);
      const acceptable = seg.wtp * segDef.seats * uniform(rng, 1.45, 1.9) * noiseMult(rng, 0.12 * noiseScale);
      const wouldPay = clamp(0.5 + 0.3 * seg.severity + normal(rng, 0, 0.04), 0, 0.98);
      report.observations.surveyPainShare = statedPain * 100;
      report.observations.vwAcceptable = acceptable / segDef.seats;
      report.observations.wouldPayShare = wouldPay * 100;
      const unit = sc.kind === 'b2b' ? sc.labels.priceUnit.replace(t('/мес'), '') : '';
      report.metrics.push({ label: t('Острота проблемы 4–5 из 5'), value: fmtPct(statedPain) });
      report.metrics.push({ label: t('Van Westendorp: «слишком дёшево, подозрительно»'), value: fmtMoney((acceptable * 0.35) / segDef.seats) + unit });
      report.metrics.push({ label: t('Van Westendorp: приемлемая цена (оптимум)'), value: fmtMoney(acceptable / segDef.seats) + unit });
      report.metrics.push({ label: t('Van Westendorp: «дорого, но подумаю»'), value: fmtMoney((acceptable * 1.35) / segDef.seats) + unit });
      report.metrics.push({ label: t('Van Westendorp: «слишком дорого»'), value: fmtMoney((acceptable * 1.9) / segDef.seats) + unit });
      report.metrics.push({ label: t('Сказали «готов платить»'), value: fmtPct(wouldPay) });
      const stated = userFacingFeatures(sc)
        .map((id) => {
          const def = featureDef(sc, id);
          const value = s.world.featureValue[id][segId] ?? 0;
          return { id, v: (0.5 * value + 0.5 * (def.hype ?? 0.7)) * noiseMult(rng, 0.1) };
        })
        .sort((a, b) => b.v - a.v);
      report.summary.push(t('Самые важные функции по мнению респондентов: {0}.', [stated.slice(0, 5).map((r) => featureDef(sc, r.id).name).join('; ')]));
      report.summary.push(t('Панель респондентов: люди, которые проходят опросы за вознаграждение. Ответы — заявления, а не поведение.'));
      for (const r of stated.slice(0, 8)) addFeatureSignal(s, segId, r.id, r.v, 0.6);
      break;
    }
    case 'smoke': {
      if (!seg || !params.channelId || !params.price) break;
      const budget = params.budget ?? 2500;
      const cpc = smokeCpc(s, segId, params.channelId) * noiseMult(rng, 0.1);
      const visitors = Math.round(budget / cpc);
      const cr = smokeConversion(sc, seg.severity, seg.fit);
      const signups = binomial(rng, visitors, cr);
      const segDef = segmentDef(sc, segId);
      const buyRate = 0.06 * priceAcceptance(params.price * segDef.seats, seg.wtp * segDef.seats * 1.15);
      const buyClicks = binomial(rng, visitors, buyRate);
      const ctr = clamp(0.012 * (segDef.affinity[params.channelId] ?? 1) * noiseMult(rng, 0.2), 0.002, 0.06);
      const cpl = budget / Math.max(1, signups);
      s.knowledge.waitlist += signups;
      report.observations.smokeCr = (signups / Math.max(1, visitors)) * 100;
      report.observations.fakeDoorRate = (buyClicks / Math.max(1, visitors)) * 100;
      report.observations.smokeCpl = cpl;
      report.metrics.push({ label: t('Канал'), value: channelDef(sc, params.channelId).name });
      report.metrics.push({ label: t('Показы / CTR'), value: `${Math.round(visitors / ctr).toLocaleString(intlLocale)} / ${fmtPct(ctr)}` });
      report.metrics.push({ label: t('Посетители лендинга (CPC)'), value: `${visitors.toLocaleString(intlLocale)} (${fmtMoney(cpc)})` });
      report.metrics.push({ label: t('Оставили email'), value: `${signups} (${fmtPct(signups / Math.max(1, visitors))})` });
      report.metrics.push({ label: t('Стоимость лида (CPL)'), value: fmtMoney(cpl) });
      report.metrics.push({ label: t('Нажали «Купить за {0}»', [fmtMoney(params.price)]), value: `${buyClicks} (${fmtPct(buyClicks / Math.max(1, visitors))})` });
      report.summary.push(t('Лист ожидания пополнился на {0} контактов — их можно позвать в закрытую бету.', [signups]));
      report.summary.push(t('Это реальное поведение людей, а не их мнение. Но CPL на маленьком бюджете ниже, чем будет при масштабировании.'));
      break;
    }
    case 'prototype': {
      if (!seg) break;
      const designer = hasRole(s, 'designer') ? 1.1 : 1;
      const p = clamp(0.2 + 0.7 * seg.fit * designer, 0.05, 0.97);
      const success = binomial(rng, 8, p);
      const rating = clamp(2.4 + 2 * seg.fit + normal(rng, 0, 0.25), 1, 5);
      const issues = Math.round(uniform(rng, 3, 6));
      s.knowledge.uxIssuesFound += issues;
      report.observations.prototypeSuccess = (success / 8) * 100;
      report.metrics.push({ label: t('Прошли ключевой сценарий и оценили ценность на 4–5'), value: t('{0} из 8', [success]) });
      report.metrics.push({ label: t('Средняя оценка ценности'), value: t('{0} из 5', [fixed(rating, 1)]) });
      report.metrics.push({ label: t('Найдено проблем UX'), value: t('{0} — их исправят до разработки', [issues]) });
      const tested = shuffle(rng, userFacingFeatures(sc)).slice(0, 5);
      const ranked = tested
        .map((id) => ({ id, v: (s.world.featureValue[id][segId] ?? 0) * noiseMult(rng, 0.2) }))
        .sort((a, b) => b.v - a.v);
      report.summary.push(t('Из показанных функций больше всего зацепили: {0}. Меньше всего интереса: {1}.', [ranked.slice(0, 2).map((r) => featureDef(sc, r.id).name).join('; '), featureDef(sc, ranked[ranked.length - 1].id).name]));
      for (const r of ranked) addFeatureSignal(s, segId, r.id, r.v, 1);
      break;
    }
    case 'concierge': {
      if (!seg || !params.price) break;
      const segDef = segmentDef(sc, segId);
      const pActive = clamp(0.1 + 0.8 * seg.fit * (0.6 + 0.4 * seg.severity), 0.05, 0.95);
      const active = binomial(rng, 12, pActive);
      const paid = binomial(rng, 12, priceAcceptance(params.price, seg.wtp) * 0.85);
      report.observations.conciergeActive = (active / 12) * 100;
      report.observations.conciergePaid = (paid / 12) * 100;
      report.metrics.push({ label: t('Активны на 4-й неделе'), value: t('{0} из 12', [active]) });
      report.metrics.push({ label: t('Заплатили {0}{1}', [fmtMoney(params.price), sc.labels.priceUnit]), value: t('{0} из 12', [paid]) });
      const top = userFacingFeatures(sc)
        .map((id) => ({ id, v: s.world.featureValue[id][segId] ?? 0 }))
        .sort((a, b) => b.v - a.v)
        .slice(0, 3);
      report.summary.push(t('Работая с клиентами вручную, вы увидели, что для них действительно важно: {0}.', [top.map((t) => featureDef(sc, t.id).name).join('; ')]));
      report.summary.push(t('Выборка маленькая (12 человек): одна-две случайности сильно меняют проценты.'));
      report.quotes.push(...shuffle(rng, segDef.quotes.pain).slice(0, 2));
      for (const t of top) addFeatureSignal(s, segId, t.id, t.v * noiseMult(rng, 0.1), 2);
      break;
    }
  }

  evaluateHypotheses(s, report);
  return report;
}

function evaluateHypotheses(s: GameState, report: ResearchReport): void {
  const params = report.params;
  for (const h of s.hypotheses) {
    const c = criterionDef(h.criterionId);
    if (c.method !== report.method || h.segmentId !== params.segmentId) continue;
    if (report.method === 'smoke' && h.kind === 'channel' && h.channelId !== params.channelId) continue;
    if ((report.method === 'smoke' || report.method === 'concierge') && h.kind === 'wtp' && h.price !== params.price) continue;

    let observed = report.observations[c.observation];
    let supported: boolean;
    if (c.id === 'c_expert') {
      observed = (s.knowledge.channelHints[h.segmentId]?.[h.channelId ?? ''] ?? 0) * 100;
      supported = observed >= 80;
    } else if (observed === undefined) {
      continue;
    } else if (c.quality === 'invalid') {
      supported = true;
    } else if (c.id === 'w_survey') {
      supported = observed >= (h.price ?? 0);
    } else if (c.lowerIsBetter) {
      supported = observed <= h.threshold;
    } else {
      supported = observed >= h.threshold;
    }
    h.observed = observed;
    h.status = supported ? 'supported' : 'refuted';
    h.testedWeek = s.week;
  }
}

// Rough attractiveness of each segment (hidden), used for scoring and debrief.
export function segmentOpportunity(s: GameState): Record<string, number> {
  const sc = scenarioOf(s);
  const out: Record<string, number> = {};
  const refSize = sc.segments.reduce((sum, x) => sum + x.size, 0) / sc.segments.length;
  for (const def of sc.segments) {
    const t = s.world.segments[def.id];
    // Per-user costs of the features this segment cannot live without eat into the margin.
    const usersPerAccount = sc.kind === 'b2b' ? 15 : 1;
    const perUser = sc.features.filter((f) => f.perUserCost && (f.kano === 'must' || f.mustFor?.includes(def.id))).reduce((sum, f) => sum + (f.perUserCost ?? 0), 0);
    const margin = clamp(1 - sc.storeFee - (perUser * usersPerAccount) / Math.max(1, t.wtp * def.seats), 0.15, 1);
    const ltv = (t.wtp * def.seats * (0.7 + 0.4 * t.fit) * margin) / t.churn;
    const bestCpl = Math.min(...smokeChannels(sc).map((c) => expectedCpl(s, def.id, c)));
    // A sales rep costs ~$5.5k/month and closes ~6 deals: ~$900 per account.
    const cac = bestCpl * 8 + (def.needsSales ? 900 : 0);
    const scale = Math.min(1.2, Math.sqrt(t.size / refSize));
    out[def.id] = ((ltv * t.severity * t.fit * Math.min(1.2, t.stickiness * 1.6)) / cac) * scale;
  }
  return out;
}
