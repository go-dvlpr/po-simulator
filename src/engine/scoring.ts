// Endings, final evaluation against Series A criteria and the final score.

import { scenarioOf } from './catalog.ts';
import { log } from './effects.ts';
import { avgTruth, lastRecord, mrrGrowth } from './metrics.ts';
import { clamp } from './stats.ts';
import type { Ending, GameState, ScoreCategory } from './types.ts';
import { t } from '../i18n/index.ts';

export interface Criterion {
  id: 'mrr' | 'ltvCac' | 'growth' | 'pmf';
  label: string;
  target: number;
  actual: number | null;
  met: boolean;
  format: 'money' | 'ratio' | 'pct';
}

export function seriesACriteria(s: GameState): Criterion[] {
  const targets = scenarioOf(s).targets[s.difficulty];
  const last = lastRecord(s);
  const mrr = last?.mrr ?? 0;
  const ltvCac = avgTruth(s, 'ltvCac', 3);
  const growth = mrrGrowth(s, Math.min(3, Math.max(1, s.history.length - 1)));
  const pmf = last?.pmf ?? null;
  return [
    { id: 'mrr', label: 'MRR', target: targets.mrr, actual: mrr, met: mrr >= targets.mrr, format: 'money' },
    { id: 'ltvCac', label: t('LTV / CAC (среднее за 3 мес.)'), target: targets.ltvCac, actual: ltvCac, met: (ltvCac ?? 0) >= targets.ltvCac, format: 'ratio' },
    { id: 'growth', label: t('Рост MRR за последние 3 мес. (в месяц)'), target: targets.growth, actual: growth, met: (growth ?? -1) >= targets.growth, format: 'pct' },
    { id: 'pmf', label: t('PMF: «очень расстроятся» (тест Шона Эллиса)'), target: targets.pmf, actual: pmf, met: (pmf ?? 0) >= targets.pmf, format: 'pct' },
  ];
}

const ENDING_TEXT: Record<Ending['kind'], { title: string; text: string }> = {
  seriesA: {
    title: t('Раунд A привлечён!'),
    text: t('Фонды увидели product-market fit, здоровую юнит-экономику и устойчивый рост. Компания получает деньги на масштабирование.'),
  },
  bridge: {
    title: t('Бридж от текущих инвесторов'),
    text: t('Метрики не дотянули до раунда A, но прогресс есть. Текущие инвесторы дают немного денег, чтобы вы доказали остальное.'),
  },
  stagnation: {
    title: t('Инвесторы не продлевают'),
    text: t('Прошло 18 месяцев, но бизнес не показал ни роста, ни экономики. Новых денег не будет — компанию придётся закрыть или продать.'),
  },
  bankrupt: {
    title: t('Деньги закончились'),
    text: t('Компания не смогла выплатить зарплаты и закрылась. Runway закончился раньше, чем продукт нашёл рынок.'),
  },
  fired: {
    title: t('Вас уволили'),
    text: t('Доверие CEO и совета директоров упало до нуля. Компания ищет нового продакт-оунера.'),
  },
  acquired: {
    title: 'Acqui-hire',
    text: t('Команду и технологию купила крупная компания. Продукт закрыт, инвесторы вернули часть денег. Мягкая посадка, но не победа.'),
  },
};

export function endGame(s: GameState, kind: Ending['kind']): void {
  if (s.ending) return;
  s.ending = { kind, week: s.week, ...ENDING_TEXT[kind] };
  s.phase = 'end';
  s.pendingEvents = [];
  log(s, { title: ENDING_TEXT[kind].title, text: ENDING_TEXT[kind].text, tone: kind === 'seriesA' ? 'good' : kind === 'bridge' ? 'neutral' : 'bad' });
}

// Investors give a bridge when at least two criteria are met and MRR reached this share of the target.
export const BRIDGE_MRR_SHARE = 0.4;

export function finalEvaluation(s: GameState): void {
  const criteria = seriesACriteria(s);
  const met = criteria.filter((c) => c.met).length;
  const mrr = criteria.find((c) => c.id === 'mrr');
  const meaningful = mrr !== undefined && (mrr.actual ?? 0) >= mrr.target * BRIDGE_MRR_SHARE;
  endGame(s, met === 4 ? 'seriesA' : met >= 2 && meaningful ? 'bridge' : 'stagnation');
}

export const CATEGORY_NAMES: Record<ScoreCategory, string> = {
  discovery: t('Исследования и гипотезы'),
  strategy: t('Стратегия и продукт'),
  delivery: t('Разработка и качество'),
  growth: t('Рост и маркетинг'),
  experiments: t('A/B-тесты'),
  finance: t('Финансы'),
  stakeholders: t('Стейкхолдеры'),
};

export interface FinalScore {
  outcome: number;
  decisions: number;
  total: number;
  rank: string;
  criteriaMet: number;
}

export function finalScore(s: GameState): FinalScore {
  const criteria = seriesACriteria(s);
  const criteriaMet = criteria.filter((c) => c.met).length;
  const progress = criteria.reduce((sum, c) => sum + clamp((c.actual ?? 0) / c.target, 0, 1.5), 0) / criteria.length;
  let outcome: number;
  switch (s.ending?.kind) {
    case 'seriesA':
      outcome = 38 + clamp((progress - 1) * 24, 0, 12);
      break;
    case 'bridge':
      outcome = 20 + criteriaMet * 3 + progress * 6;
      break;
    case 'acquired':
      outcome = 12 + progress * 6;
      break;
    case 'stagnation':
      outcome = 6 + progress * 10;
      break;
    default:
      outcome = progress * 10;
  }
  // Every share sold in bridges makes the same result worth less to the founders.
  outcome -= s.dilution * 20;
  outcome = clamp(Math.round(outcome), 0, 50);
  const raw = Object.values(s.score).reduce((a, b) => a + b, 0);
  const decisions = clamp(Math.round(25 + raw * 0.4), 0, 50);
  const total = outcome + decisions;
  const rank =
    total >= 90 ? 'Head of Product' : total >= 78 ? 'Lead Product Owner' : total >= 64 ? 'Senior Product Owner' : total >= 50 ? 'Middle Product Owner' : total >= 35 ? 'Junior Product Owner' : t('Стажёр');
  return { outcome, decisions, total, rank, criteriaMet };
}
