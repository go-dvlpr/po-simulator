import { createContext, useContext } from 'react';
import type { Action } from '../engine/game.ts';
import type { GameState } from '../engine/types.ts';

export interface ConfirmRequest {
  title: string;
  text: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
}

export interface GameContextValue {
  state: GameState;
  dispatch: (action: Action) => void;
  openArticle: (id: string) => void;
  section: string;
  setSection: (id: string) => void;
  confirm: (request: ConfirmRequest) => void;
}

export const GameContext = createContext<GameContextValue | null>(null);

// For components that also render outside a game (start screen).
export function useOptionalGame(): GameContextValue | null {
  return useContext(GameContext);
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside GameContext');
  return ctx;
}
