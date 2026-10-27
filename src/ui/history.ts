import { finalScore } from '../engine/scoring.ts';
import type { Difficulty, Ending, GameState, LogEntry, ScenarioId, ScoreCategory } from '../engine/types.ts';

export interface PlayedGame {
  id: string;
  date: string;
  scenarioId: ScenarioId;
  difficulty: Difficulty;
  seed: number;
  score: number;
  rank: string;
  ending: Ending['kind'];
  endingTitle: string;
  mistakes: string[];
}

const KEY = 'po-simulator-history';
const LIMIT = 50;

// The handbook article that explains mistakes of each kind.
export const CATEGORY_ARTICLES: Record<ScoreCategory, string> = {
  discovery: 'hypotheses',
  strategy: 'value-prop',
  delivery: 'tech-debt',
  growth: 'performance-marketing',
  experiments: 'ab-pitfalls',
  finance: 'unit-economics',
  stakeholders: 'stakeholders',
};

export function topMistakes(log: LogEntry[], count: number): LogEntry[] {
  return log
    .filter((e) => (e.points ?? 0) < 0)
    .sort((a, b) => (a.points ?? 0) - (b.points ?? 0))
    .slice(0, count);
}

export function loadHistory(): PlayedGame[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as PlayedGame[]) : [];
  } catch {
    return [];
  }
}

// Saves a finished game once; returns the updated list.
export function recordGame(s: GameState): PlayedGame[] {
  const history = loadHistory();
  if (!s.ending) return history;
  const id = `${s.scenarioId}-${s.difficulty}-${s.seed}-${s.ending.week}-${s.log.length}`;
  if (history.some((g) => g.id === id)) return history;
  const score = finalScore(s);
  const entry: PlayedGame = {
    id,
    date: new Date().toISOString(),
    scenarioId: s.scenarioId,
    difficulty: s.difficulty,
    seed: s.seed,
    score: score.total,
    rank: score.rank,
    ending: s.ending.kind,
    endingTitle: s.ending.title,
    mistakes: topMistakes(s.log, 3).map((e) => e.title),
  };
  const next = [...history, entry].slice(-LIMIT);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // History is a convenience; the game works without it.
  }
  return next;
}
