// Random events: selection, triggering and resolution.

import { ceoStyle } from '../data/context.ts';
import { EVENTS } from '../data/events.ts';
import { DIFFICULTY } from './catalog.ts';
import { judge, log, milestone, report } from './effects.ts';
import type { Rng } from './rng.ts';
import { chance, weightedPick } from './rng.ts';
import type { GameState, Phase, ScoreCategory } from './types.ts';
import { t } from '../i18n/index.ts';

export type EventData = Record<string, string | number>;

export interface EventOutcome {
  text: string;
  tone: 'good' | 'bad' | 'neutral';
  category?: ScoreCategory;
  points?: number;
}

export interface EventOption {
  label: string;
  hint?: string;
  available?: (s: GameState, data: EventData) => boolean;
  apply: (s: GameState, rng: Rng, data: EventData) => EventOutcome;
}

export interface GameEventDef {
  id: string;
  phases: Phase[];
  weight: number | ((s: GameState) => number);
  once?: boolean;
  cooldown?: number;
  manual?: boolean;
  condition?: (s: GameState) => boolean;
  prepare?: (s: GameState, rng: Rng) => EventData | null;
  title: string;
  text: (s: GameState, data: EventData) => string;
  options: EventOption[];
}

export function eventDef(id: string): GameEventDef {
  const def = EVENTS.find((e) => e.id === id);
  if (!def) throw new Error(`unknown event ${id}`);
  return def;
}

function eligible(s: GameState, def: GameEventDef, phase: Phase): boolean {
  if (def.manual || !def.phases.includes(phase)) return false;
  if (def.once && s.firedEvents.includes(def.id)) return false;
  if (s.pendingEvents.some((p) => p.eventId === def.id)) return false;
  const last = s.flags[`ev_${def.id}`];
  if (def.cooldown && last !== undefined && s.week - last < def.cooldown) return false;
  return def.condition ? def.condition(s) : true;
}

// Events the CEO starts; their frequency depends on the CEO's style.
const CEO_EVENTS = ['d_ceo_impatient', 'd_ceo_idea', 'd_friends', 'b_scope_creep', 'g_ceo_pet'];

function weightOf(s: GameState, def: GameEventDef): number {
  const base = typeof def.weight === 'function' ? def.weight(s) : def.weight;
  return CEO_EVENTS.includes(def.id) ? base * ceoStyle(s.world.ceo).ceoEvents : base;
}

export function triggerEvent(s: GameState, rng: Rng, id: string): boolean {
  const def = eventDef(id);
  const data = def.prepare ? def.prepare(s, rng) : {};
  if (data === null) return false;
  s.pendingEvents.push({ eventId: id, week: s.week, data });
  s.flags[`ev_${id}`] = s.week;
  if (!s.firedEvents.includes(id)) s.firedEvents.push(id);
  return true;
}

// Rolls up to `chances.length` random events; chances[i] is the probability of the i-th.
export function rollEvents(s: GameState, rng: Rng, phase: Phase, chances: number[]): void {
  const mult = DIFFICULTY[s.difficulty].events;
  for (const p of chances) {
    if (!chance(rng, Math.min(0.95, p * mult))) continue;
    const pool = EVENTS.filter((e) => eligible(s, e, phase));
    for (let attempt = 0; attempt < 3; attempt++) {
      const def = weightedPick(rng, pool, (e) => weightOf(s, e));
      if (!def) break;
      if (triggerEvent(s, rng, def.id)) break;
    }
  }
}

export function resolveEvent(s: GameState, rng: Rng, optionIndex: number): string | null {
  const pending = s.pendingEvents[0];
  if (!pending) return t('Нет активного события.');
  const def = eventDef(pending.eventId);
  const option = def.options[optionIndex];
  const data = pending.data ?? {};
  if (!option) return t('Нет такого варианта.');
  if (option.available && !option.available(s, data)) return t('Этот вариант сейчас недоступен.');
  s.pendingEvents.shift();
  const outcome = option.apply(s, rng, data);
  if (outcome.category && outcome.points) {
    judge(s, outcome.category, outcome.points, `${def.title}: ${option.label}`, outcome.text);
  } else {
    log(s, { title: `${def.title}: ${option.label}`, text: outcome.text, tone: outcome.tone });
  }
  report(s, `${def.title} → ${outcome.text}`, outcome.tone === 'neutral' ? 'info' : outcome.tone);
  if (s.phase === 'growth' && !def.manual && !def.id.startsWith('q_')) milestone(s, 'event', def.title);
  return null;
}
