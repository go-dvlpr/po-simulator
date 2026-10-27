// Hiring and firing team members.

import { money } from '../format.ts';
import { FIRST_NAMES, roleDef, sourceDef } from '../data/roles.ts';
import { addCash, addDebt, addMorale, log, nextId } from './effects.ts';
import type { Rng } from './rng.ts';
import { intBetween, normal, pick } from './rng.ts';
import { clamp } from './stats.ts';
import type { GameState, Level, RoleId, Source, TeamMember } from './types.ts';
import { t } from '../i18n/index.ts';

export function hireCost(role: RoleId, level: Level, source: Source): { salary: number; fee: number } {
  const salary = Math.round(roleDef(role).salary[level] * sourceDef(source).costMult);
  return { salary, fee: Math.round(roleDef(role).salary[level] * sourceDef(source).feeMonths) };
}

export function hireMember(s: GameState, rng: Rng, role: RoleId, level: Level, source: Source): TeamMember | string {
  const def = roleDef(role);
  const lvl = def.levels.includes(level) ? level : def.levels[0];
  const { salary, fee } = hireCost(role, lvl, source);
  if (fee > s.cash) return t('Недостаточно денег на комиссию рекрутеру.');
  const src = sourceDef(source);
  const used = new Set(s.team.map((m) => m.name));
  const free = FIRST_NAMES.filter((n) => !used.has(n));
  const spread = source === 'freelance' ? 0.22 : 0.15;
  const member: TeamMember = {
    id: nextId(s, 'm'),
    name: free.length > 0 ? pick(rng, free) : t('Сотрудник {0}', [s.nextId]),
    role,
    level: lvl,
    source,
    salary,
    skill: clamp(normal(rng, 1, spread), 0.7, 1.3),
    joinWeek: s.week + intBetween(rng, src.minDelay, src.maxDelay),
  };
  addCash(s, -fee);
  s.team.push(member);
  return member;
}

export function fireMember(s: GameState, memberId: string, reason: 'fired' | 'left'): TeamMember | undefined {
  const member = s.team.find((m) => m.id === memberId);
  if (!member) return undefined;
  s.team = s.team.filter((m) => m.id !== memberId);
  const joined = member.joinWeek <= s.week;
  if (reason === 'fired' && member.source === 'inhouse' && joined) addCash(s, -member.salary);
  if (joined) addMorale(s, reason === 'fired' ? (member.source === 'inhouse' ? -6 : -1) : -3);
  if (member.role === 'developer' && joined) addDebt(s, 3);
  log(s, {
    title: reason === 'fired' ? t('{0} покидает команду', [member.name]) : t('{0} уходит из команды', [member.name]),
    text: reason === 'fired' && member.source === 'inhouse' && joined ? t('Выходное пособие: {0}.', [money(member.salary)]) : t('Часть знаний о коде уходит вместе с человеком.'),
    tone: 'neutral',
  });
  return member;
}

// Hidden skill becomes visible after a month of work together.
export function skillLabel(s: GameState, m: TeamMember): string {
  if (s.week - m.joinWeek < 4) return t('ещё не ясно');
  if (m.skill >= 1.12) return t('сильный');
  if (m.skill <= 0.88) return t('слабый');
  return t('средний');
}
