import type { GameState } from '../engine/types.ts';
import { migrateState } from '../engine/world.ts';
import { PHASES } from './navigation.ts';
import { t } from '../i18n/index.ts';

// Snapshots at key moments, so the player can replay one decision instead of the whole game.
const KEY = 'po-simulator-checkpoints';
const MAX = 8;

// The title is built when shown, so it follows the current language.
export interface Checkpoint {
  phase: GameState['phase'];
  month: number;
  week: number;
  state: GameState;
}

export function loadCheckpoints(): Checkpoint[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const out: Checkpoint[] = [];
    for (const c of JSON.parse(raw) as Checkpoint[]) {
      const state = migrateState(c.state);
      if (state && c.phase) out.push({ ...c, state });
    }
    return out;
  } catch {
    return [];
  }
}

function write(list: Checkpoint[]): void {
  // Snapshots are large: drop the oldest until they fit into storage.
  for (let start = 0; start <= list.length; start++) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list.slice(start)));
      return;
    } catch {
      // Over quota: retry with fewer snapshots.
    }
  }
}

export function clearCheckpoints(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Storage is optional.
  }
}

// A phase change or a board meeting (every third month after launch) is worth a snapshot.
export function isCheckpoint(prev: GameState, next: GameState): boolean {
  if (next.phase === 'end') return false;
  if (next.phase !== prev.phase) return true;
  return next.phase === 'growth' && next.history.length > prev.history.length && next.history.length % 3 === 0;
}

export function checkpointTitle(c: Checkpoint): string {
  if (c.phase === 'growth' && c.month > 0) return t('Совет директоров после месяца {0}', [c.month]);
  return t('Начало этапа «{0}»', [PHASES.find((p) => p.id === c.phase)?.label ?? c.phase]);
}

export function saveCheckpoint(state: GameState): void {
  const month = state.history.length;
  const list = loadCheckpoints().filter((c) => c.phase !== state.phase || c.month !== month);
  list.push({ phase: state.phase, month, week: state.week, state });
  write(list.slice(-MAX));
}

// Replaying from a snapshot makes the later ones obsolete.
export function keepCheckpointsUpTo(week: number): void {
  write(loadCheckpoints().filter((c) => c.week <= week));
}
