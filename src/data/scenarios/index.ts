import type { ScenarioDef, ScenarioId } from '../../engine/types.ts';
import { B2B } from './b2b.ts';
import { B2C } from './b2c.ts';
import { DEVTOOL } from './devtool.ts';
import { EDTECH } from './edtech.ts';
import { FINTECH } from './fintech.ts';

export const SCENARIOS: Record<ScenarioId, ScenarioDef> = {
  b2c: B2C,
  b2b: B2B,
  edtech: EDTECH,
  fintech: FINTECH,
  devtool: DEVTOOL,
};

// Order on the start screen.
export const SCENARIO_ORDER: ScenarioId[] = ['b2c', 'b2b', 'edtech', 'fintech', 'devtool'];
