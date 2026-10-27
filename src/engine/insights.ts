// Post-launch research the player can order: NPS, PMF survey, churn
// interviews, usability tests and in-product feature surveys.

import { pct } from '../format.ts';
import { featureDef, scenarioOf } from './catalog.ts';
import { lastRecord } from './metrics.ts';
import { funnelRates, productContext } from './product.ts';
import type { Rng } from './rng.ts';
import { noiseMult, normal } from './rng.ts';
import { clamp } from './stats.ts';
import type { GameState, GrowthResearchResult } from './types.ts';
import { t } from '../i18n/index.ts';

export interface GrowthResearchDef {
  id: string;
  name: string;
  description: string;
  cost: number;
  article: string;
}

export const GROWTH_RESEARCH: GrowthResearchDef[] = [
  { id: 'pmf', name: t('Опрос Шона Эллиса (PMF)'), description: t('«Как вы расстроитесь, если продукт исчезнет?» — 200 активных пользователей.'), cost: 300, article: 'pmf' },
  { id: 'nps', name: t('NPS-опрос'), description: t('Готовность рекомендовать и главные жалобы.'), cost: 300, article: 'retention' },
  { id: 'churn', name: t('Интервью с ушедшими клиентами'), description: t('10 разговоров с теми, кто отменил подписку: почему ушли и чего не хватило.'), cost: 800, article: 'custdev' },
  { id: 'feature_survey', name: t('Опрос о функциях внутри продукта'), description: t('Что важно реальным пользователям (меньше искажений, чем у панели).'), cost: 250, article: 'prioritization' },
  { id: 'usability', name: t('Юзабилити-тест продукта'), description: t('6 сессий с записью экрана: где люди путаются в воронке.'), cost: 1200, article: 'mvp-types' },
];

function topUnbuilt(s: GameState, count: number): string[] {
  const sc = scenarioOf(s);
  const seg = s.strategy?.segmentId ?? sc.segments[0].id;
  return sc.features
    .filter((f) => !s.product.features[f.id]?.shipped && !f.tags?.includes('cms'))
    .sort((a, b) => (s.world.featureValue[b.id][seg] ?? 0) - (s.world.featureValue[a.id][seg] ?? 0))
    .slice(0, count)
    .map((f) => f.id);
}

export function runGrowthResearch(s: GameState, rng: Rng, kind: string): GrowthResearchResult {
  const sc = scenarioOf(s);
  const ctx = productContext(s);
  const def = GROWTH_RESEARCH.find((g) => g.id === kind);
  const lines: string[] = [];
  const last = lastRecord(s);
  let value: number | undefined;

  switch (kind) {
    case 'pmf': {
      const very = clamp((last?.pmf ?? 0.1) + normal(rng, 0, 0.035), 0, 0.9);
      value = very;
      const somewhat = clamp(0.35 + normal(rng, 0, 0.04), 0.1, 0.6);
      lines.push(t('Очень расстроятся: {0}', [pct(very, 0)]));
      lines.push(t('Немного расстроятся: {0}', [pct(Math.min(somewhat, 1 - very), 0)]));
      lines.push(t('Не расстроятся: {0}', [pct(Math.max(0, 1 - very - somewhat), 0)]));
      lines.push(very >= 0.4 ? t('Порог 40% пройден — это сильный сигнал product-market fit.') : t('Ниже порога 40%: продукт пока «приятно иметь», а не «нужно».'));
      break;
    }
    case 'nps': {
      const nps = Math.round((last?.truth.nps ?? 0) + normal(rng, 0, 4));
      lines.push(`NPS: ${nps}`);
      const complaints: string[] = [];
      if (s.product.bugs > 25) complaints.push(t('баги и нестабильность'));
      if (s.pricing.price > ctx.wtpEff) complaints.push(t('цена'));
      if (ctx.mustMissing.length > 0) complaints.push(t('нет базовых функций'));
      if (ctx.value < 0.8) complaints.push(t('мало ценности, однообразие'));
      lines.push(complaints.length > 0 ? t('Главные жалобы: {0}.', [complaints.join(', ')]) : t('Серьёзных жалоб почти нет, пользователи хвалят продукт.'));
      break;
    }
    case 'churn': {
      const rates = funnelRates(s, ctx);
      const forgetFeature = sc.flavor.reminderFeature;
      const weights: Record<string, number> = {
        price: Math.max(0, s.pricing.price / ctx.wtpEff - 0.85) * 3,
        bugs: s.product.bugs / 40,
        value: Math.max(0, 1.05 - ctx.value) * 2,
        forget: s.product.features[forgetFeature]?.shipped ? 0.15 : 0.6,
        must: ctx.mustMissing.length * 0.8,
        closed: sc.kind === 'b2b' ? 0.35 : 0.2,
      };
      const total = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
      const ranked = Object.entries(weights)
        .map(([k, w]) => [k, (w / total) * noiseMult(rng, 0.15)] as const)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
      for (const [k, w] of ranked) lines.push(`${Math.round(w * 100)}% — ${sc.churnReasons[k]}`);
      lines.push(t('Чего не хватало: {0}.', [topUnbuilt(s, 2).map((id) => featureDef(sc, id).name).join('; ')]));
      if (rates.acceptance < 0.4) lines.push(t('Многие говорят, что цена не соответствует ценности.'));
      break;
    }
    case 'feature_survey': {
      const seg = s.strategy?.segmentId ?? sc.segments[0].id;
      const ranked = sc.features
        .filter((f) => !s.product.features[f.id]?.shipped && f.kano !== 'must' && !f.tags?.includes('cms'))
        .map((f) => ({ id: f.id, v: (0.75 * (s.world.featureValue[f.id][seg] ?? 0) + 0.25 * (f.hype ?? 0.7)) * noiseMult(rng, 0.12) }))
        .sort((a, b) => b.v - a.v);
      const signals = s.knowledge.featureSignals[seg];
      for (const r of ranked) {
        const cur = signals[r.id] ?? { sum: 0, weight: 0 };
        signals[r.id] = { sum: cur.sum + r.v * 1.5, weight: cur.weight + 1.5 };
      }
      lines.push(t('Самые востребованные: {0}.', [ranked.slice(0, 4).map((r) => featureDef(sc, r.id).name).join('; ')]));
      lines.push(t('Наименее важные: {0}.', [ranked.slice(-2).map((r) => featureDef(sc, r.id).name).join('; ')]));
      lines.push(t('Оценки ценности в бэклоге обновлены.'));
      break;
    }
    case 'usability': {
      const done = s.flags.usabilityTests ?? 0;
      if (done < 2) {
        s.product.ux *= 1.03;
        s.flags.usabilityTests = done + 1;
        lines.push(t('Нашли 5 мест, где пользователи путаются в онбординге и оплате. Исправления войдут в продукт — активация и конверсия немного вырастут.'));
      } else {
        lines.push(t('Серьёзных проблем больше не найдено: основные сценарии понятны.'));
      }
      break;
    }
  }
  for (const idea of sc.experiments.filter((i) => i.source === kind && !s.unlockedIdeas.includes(i.id))) {
    s.unlockedIdeas.push(idea.id);
    lines.push(t('Новая идея для A/B-теста: «{0}». Идеи из данных о пользователях срабатывают чаще, чем идеи «из головы».', [idea.name]));
  }
  return { kind, week: s.week, title: def?.name ?? kind, lines, value };
}
