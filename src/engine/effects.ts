// Small state mutators shared by the reducer and event definitions.
// All of them mutate the given (already cloned) state.

import { ceoStyle } from '../data/context.ts';
import { clamp } from './stats.ts';
import type { GameState, LogEntry, Milestone, Modifier, ReportLine, ScoreCategory } from './types.ts';

// Adds a line to the "what happened this turn" summary.
export function report(s: GameState, text: string, tone: ReportLine['tone'] = 'info', link?: ReportLine['link']): void {
  s.lastReport.push(link ? { text, tone, link } : { text, tone });
}

// Marks a moment on the timeline charts. Repeated changes of the same kind in one week collapse into one mark.
export function milestone(s: GameState, kind: Milestone['kind'], label: string): void {
  if (kind === 'price') s.milestones = s.milestones.filter((m) => !(m.kind === 'price' && m.week === s.week));
  s.milestones.push({ week: s.week, label, kind });
}

export function log(s: GameState, entry: Omit<LogEntry, 'week'>): void {
  s.log.push({ week: s.week, ...entry });
}

// Records a decision with its learning point and adjusts the decision score.
export function judge(s: GameState, category: ScoreCategory, points: number, title: string, text: string): void {
  s.score[category] += points;
  const tone = points > 0 ? 'good' : points < 0 ? 'bad' : 'neutral';
  log(s, { title, text, tone, category, points });
}

export function addTrust(s: GameState, delta: number): void {
  const ceo = ceoStyle(s.world.ceo);
  s.trust = clamp(s.trust + delta * (delta > 0 ? ceo.trustGain : ceo.trustLoss), 0, 100);
}

export function addMorale(s: GameState, delta: number): void {
  s.morale = clamp(s.morale + delta, 0, 100);
}

export function addCash(s: GameState, delta: number): void {
  s.cash += delta;
}

export function addBugs(s: GameState, delta: number): void {
  s.product.bugs = Math.max(0, s.product.bugs + delta);
}

export function addDebt(s: GameState, delta: number): void {
  s.product.debt = clamp(s.product.debt + delta, 0, 100);
}

export function losePoints(s: GameState, points: number): void {
  s.product.lostPoints += points;
}

export function addModifier(s: GameState, modifier: Omit<Modifier, 'untilWeek'>, weeks: number): void {
  s.modifiers = s.modifiers.filter((m) => m.id !== modifier.id);
  s.modifiers.push({ ...modifier, untilWeek: s.week + weeks });
}

export function modifierMult(s: GameState, lever: Modifier['lever']): number {
  return s.modifiers
    .filter((m) => m.lever === lever && m.untilWeek > s.week)
    .reduce((acc, m) => acc * m.mult, 1);
}

export function nextId(s: GameState, prefix: string): string {
  s.nextId += 1;
  return `${prefix}${s.nextId}`;
}
