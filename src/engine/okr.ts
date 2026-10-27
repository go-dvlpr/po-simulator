// Quarterly goals (OKR) the product owner commits to before the next board meeting.

import { fixed } from '../format.ts';
import { addTrust, judge, log, report } from './effects.ts';
import { hoursError } from './potime.ts';
import type { GameState, Metrics, MonthRecord, Okr, OkrGoal, OkrMetric } from './types.ts';
import { t } from '../i18n/index.ts';

export interface OkrMetricDef {
  label: string;
  better: 'up' | 'down';
  format: 'money' | 'num' | 'pct';
}

export const OKR_METRICS: Record<OkrMetric, OkrMetricDef> = {
  mrr: { label: 'MRR', better: 'up', format: 'money' },
  paying: { label: t('Платящие клиенты'), better: 'up', format: 'num' },
  activation: { label: t('Активация'), better: 'up', format: 'pct' },
  retention: { label: t('Удержание 30-го дня'), better: 'up', format: 'pct' },
  churn: { label: t('Отток платящих'), better: 'down', format: 'pct' },
  northStar: { label: 'North Star', better: 'up', format: 'num' },
};

const OBS_KEY: Record<Exclude<OkrMetric, 'mrr'>, keyof Metrics> = {
  paying: 'paying',
  activation: 'activationRate',
  retention: 'retentionM1',
  churn: 'churnRate',
  northStar: 'northStar',
};

export function okrValue(record: MonthRecord | undefined, metric: OkrMetric): number | null {
  if (!record) return null;
  return metric === 'mrr' ? record.mrr : record.obs[OBS_KEY[metric]];
}

export function activeOkr(s: GameState): Okr | undefined {
  return s.okrs.find((o) => !o.evaluated);
}

// Goals are checked at the first board meeting that is at least two months away.
export function okrDueMonth(s: GameState): number {
  return Math.ceil((s.history.length + 2) / 3) * 3;
}

export function validateOkr(s: GameState, goals: { metric: OkrMetric; target: number }[]): string | null {
  if (s.phase !== 'growth') return t('Цели ставятся после запуска.');
  if (s.history.length === 0) return t('Нужен хотя бы месяц данных, чтобы знать стартовые значения.');
  if (activeOkr(s)) return t('Цели на этот квартал уже поставлены.');
  if (goals.length === 0 || goals.length > 3) return t('Выберите от одной до трёх целей.');
  const time = hoursError(s, 4);
  if (time) return time;
  if (new Set(goals.map((g) => g.metric)).size !== goals.length) return t('Цели не должны повторяться.');
  const last = s.history[s.history.length - 1];
  for (const g of goals) {
    if (okrValue(last, g.metric) === null) return t('Метрика «{0}» сейчас не измеряется.', [OKR_METRICS[g.metric].label]);
    if (!Number.isFinite(g.target) || g.target <= 0) return t('Некорректное целевое значение.');
  }
  return null;
}

export function setOkr(s: GameState, goals: { metric: OkrMetric; target: number }[]): void {
  const last = s.history[s.history.length - 1];
  s.okrs.push({
    setWeek: s.week,
    dueMonth: okrDueMonth(s),
    goals: goals.map((g): OkrGoal => ({ metric: g.metric, base: okrValue(last, g.metric) ?? 0, target: g.target })),
    evaluated: false,
  });
}

// How far the target is from the starting value, in the "good" direction.
export function ambition(goal: OkrGoal): number {
  if (goal.base <= 0) return 0;
  return OKR_METRICS[goal.metric].better === 'up' ? goal.target / goal.base - 1 : 1 - goal.target / goal.base;
}

// Checks goals that are due. At board months, having no goals at all costs trust.
export function reviewQuarter(s: GameState): void {
  const okr = activeOkr(s);
  const last = s.history[s.history.length - 1];
  if (okr && s.history.length >= okr.dueMonth) {
    for (const g of okr.goals) {
      const actual = okrValue(last, g.metric);
      g.actual = actual ?? undefined;
      g.met = actual !== null && (OKR_METRICS[g.metric].better === 'up' ? actual >= g.target : actual <= g.target);
    }
    okr.evaluated = true;
    const met = okr.goals.filter((g) => g.met).length;
    const total = okr.goals.length;
    addTrust(s, met * 2 - (total - met) * 3);
    const avgAmbition = okr.goals.reduce((sum, g) => sum + ambition(g), 0) / total;
    if (met === total && avgAmbition < 0.05) {
      judge(s, 'stakeholders', 1, t('Квартальные цели выполнены, но они были слишком осторожными'), t('В среднем цели требовали улучшения всего на {0}%. Совет ценит выполнение, но заниженные цели не двигают компанию.', [fixed(avgAmbition * 100, 0)]));
    } else if (met === total) {
      judge(s, 'stakeholders', 3, t('Квартальные цели выполнены'), t('Вы пообещали измеримый результат и сделали его. Точный прогноз — лучший способ заработать доверие совета.'));
    } else if (met > 0) {
      judge(s, 'stakeholders', 1, t('Квартальные цели выполнены частично: {0} из {1}', [met, total]), t('В OKR нормально выполнять амбициозные цели на 60–70%. Важно объяснить, почему остальное не получилось и что меняете.'));
    } else {
      judge(s, 'stakeholders', -3, t('Квартальные цели провалены'), t('Ни одна цель не выполнена. Либо цели были нереалистичными, либо план не сработал — в обоих случаях совет перестаёт верить прогнозам.'));
    }
    report(s, t('Итоги квартальных целей: выполнено {0} из {1}.', [met, total]), met === total ? 'good' : met > 0 ? 'info' : 'bad', 'overview');
    report(s, t('Поставьте цели на следующий квартал: совет проверит их через три месяца.'), 'action', 'overview');
    return;
  }
  if (!okr && s.history.length % 3 === 2) {
    report(s, t('Через месяц квартальный совет, а целей на квартал нет. Поставьте их на обзоре.'), 'action', 'overview');
  }
  if (s.history.length % 3 === 0 && !okr) {
    addTrust(s, -4);
    log(s, { title: t('У продукта нет целей на квартал'), text: t('Совет спрашивает, каких результатов ждать от продукта. Без измеримых целей сложно оценить вашу работу — доверие снижается.'), tone: 'bad' });
    report(s, t('Совет директоров: у продукта нет целей на квартал. Поставьте цели на обзоре.'), 'action', 'overview');
  }
}
