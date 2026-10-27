// Raising money during the game: a bridge from current investors costs a share of the company,
// and a strong company can close Series A before the deadline.

import { addTrust, judge, log, milestone } from './effects.ts';
import { lastRecord, mrrGrowth } from './metrics.ts';
import { seriesACriteria } from './scoring.ts';
import { clamp } from './stats.ts';
import type { GameState } from './types.ts';
import { t } from '../i18n/index.ts';

export interface BridgeOffer {
  amount: number;
  valuation: number;
  dilution: number;
}

export function bridgeOffer(s: GameState): BridgeOffer {
  const mrr = lastRecord(s)?.mrr ?? 0;
  const growth = Math.max(0, mrrGrowth(s, Math.min(3, Math.max(1, s.history.length - 1))) ?? 0);
  // Investors pay a multiple of yearly revenue that grows with the growth rate.
  const valuation = Math.max(4_000_000, mrr * 12 * (6 + 60 * growth));
  const amount = clamp(250_000 + mrr * 12, 250_000, 800_000);
  return { amount, valuation, dilution: amount / (valuation + amount) };
}

export function bridgeError(s: GameState): string | null {
  if (s.phase !== 'growth') return t('Деньги привлекают после запуска.');
  if (s.history.length < 3) return t('Нужны хотя бы три месяца метрик после запуска.');
  const last = s.flags.lastRaiseWeek;
  if (last !== undefined && s.week - last < 24) return t('Инвесторы готовы обсуждать новые деньги не чаще раза в полгода.');
  if (s.trust < 40) return t('Совет не доверяет вам настолько, чтобы дать ещё денег.');
  return null;
}

export function raiseBridge(s: GameState): void {
  const offer = bridgeOffer(s);
  s.cash += offer.amount;
  s.dilution = 1 - (1 - s.dilution) * (1 - offer.dilution);
  s.flags.lastRaiseWeek = s.week;
  addTrust(s, -3);
  milestone(s, 'event', t('Бридж-раунд'));
  log(s, {
    title: t('Привлечён бридж-раунд'),
    text: t('+${0} тыс. при оценке ${1} млн. Инвесторы получили {2}% компании. Деньги дают время, но каждая доля стоит дорого — особенно при низкой оценке.', [Math.round(offer.amount / 1000), (offer.valuation / 1e6).toFixed(1), Math.round(offer.dilution * 100)]),
    tone: 'neutral',
  });
}

// All four Series A criteria are met, with PMF measured by a survey rather than guessed.
export function earlySeriesAReady(s: GameState): boolean {
  if (s.phase !== 'growth' || s.history.length < 8) return false;
  const survey = [...s.growthResearch].reverse().find((g) => g.kind === 'pmf' && g.value !== undefined);
  const criteria = seriesACriteria(s);
  return criteria.every((c) => (c.id === 'pmf' ? (survey?.value ?? 0) >= c.target : c.met));
}

export function earlySeriesA(s: GameState): void {
  judge(s, 'finance', 4, t('Раунд A досрочно'), t('Вы подняли раунд, пока метрики на пике, и не стали ждать дедлайна. Привлекать деньги лучше, когда они ещё не нужны срочно.'));
}
