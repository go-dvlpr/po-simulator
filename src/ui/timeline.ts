import type { GameState } from '../engine/types.ts';

export interface ChartMarker {
  index: number;
  labels: string[];
}

// Places timeline marks on the first month whose numbers they affect.
export function chartMarkers(state: GameState): ChartMarker[] {
  const byIndex = new Map<number, string[]>();
  for (const m of state.milestones) {
    const index = state.history.findIndex((h) => h.week >= m.week);
    if (index < 0) continue;
    const labels = byIndex.get(index) ?? [];
    labels.push(m.label);
    byIndex.set(index, labels);
  }
  return [...byIndex].map(([index, labels]) => ({ index, labels }));
}
