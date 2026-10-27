import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Action } from './engine/game.ts';
import { gameReducer } from './engine/game.ts';
import { actionHours, hoursError } from './engine/potime.ts';
import type { GameState, LogEntry, Phase } from './engine/types.ts';
import { migrateState } from './engine/world.ts';
import { Button, Modal } from './ui/components/common.tsx';
import type { Checkpoint } from './ui/checkpoints.ts';
import { clearCheckpoints, isCheckpoint, keepCheckpointsUpTo, saveCheckpoint } from './ui/checkpoints.ts';
import type { ConfirmRequest } from './ui/context.ts';
import { GameContext } from './ui/context.ts';
import { DecisionLog } from './ui/DecisionLog.tsx';
import { EventDialog } from './ui/EventModal.tsx';
import { Handbook } from './ui/Handbook.tsx';
import { PageHeader } from './ui/PageHeader.tsx';
import { recordGame } from './ui/history.ts';
import { SECTIONS } from './ui/navigation.ts';
import { BuildScreen } from './ui/screens/Build.tsx';
import { DiscoveryScreen } from './ui/screens/Discovery.tsx';
import { EndScreen } from './ui/screens/End.tsx';
import { GrowthScreen } from './ui/screens/Growth.tsx';
import { LaunchScreen } from './ui/screens/Launch.tsx';
import { NewGameScreen } from './ui/screens/NewGame.tsx';
import { SetupScreen } from './ui/screens/Setup.tsx';
import { StrategyScreen } from './ui/screens/Strategy.tsx';
import { Sidebar } from './ui/Sidebar.tsx';
import { TopBar } from './ui/TopBar.tsx';
import { t } from './i18n/index.ts';

const SAVE_KEY = 'po-simulator-save';

function loadSave(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return migrateState(JSON.parse(raw) as GameState);
  } catch {
    return null;
  }
}

function writeSave(state: GameState | null): void {
  try {
    if (state) localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    else localStorage.removeItem(SAVE_KEY);
  } catch {
    // Saving is a convenience; the game works without it.
  }
}

export function App() {
  const [state, setState] = useState<GameState | null>(loadSave);
  const [sections, setSections] = useState<Partial<Record<Phase, string>>>({});
  const [article, setArticle] = useState<string | null>(null);
  const [handbookOpen, setHandbookOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [outcome, setOutcome] = useState<LogEntry | null>(null);
  const awaitingOutcome = useRef<number | null>(null);
  const prevState = useRef<GameState | null>(state);
  const currentState = useRef<GameState | null>(state);
  currentState.current = state;
  const [notice, setNotice] = useState<string | null>(null);
  const phase = state?.phase;
  const section = phase ? (sections[phase] ?? SECTIONS[phase][0].id) : '';

  // A save that failed to load stays in storage until the player starts a new game.
  useEffect(() => {
    if (!state) return;
    writeSave(state);
    if (state.phase === 'end') recordGame(state);
    const prev = prevState.current;
    prevState.current = state;
    if (prev && prev !== state && isCheckpoint(prev, state)) saveCheckpoint(state);
  }, [state]);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [phase, section]);
  useEffect(() => {
    if (state && awaitingOutcome.current !== null && state.log.length > awaitingOutcome.current) {
      setOutcome(state.log[state.log.length - 1]);
      awaitingOutcome.current = null;
    }
  }, [state]);

  const dispatch = useCallback((action: Action) => {
    // The reducer ignores actions the PO has no time for; tell the player why nothing happened.
    const cur = currentState.current;
    const tooLong = cur && cur.pendingEvents.length === 0 ? hoursError(cur, actionHours(action)) : null;
    if (tooLong) {
      setNotice(t('{0} Часы обновятся на следующем ходу.', [tooLong]));
      return;
    }
    setState((prev) => (action.type === 'new_game' ? action.state : prev ? gameReducer(prev, action) : prev));
  }, []);

  const openArticle = useCallback((id: string) => {
    setArticle(id);
    setHandbookOpen(true);
  }, []);

  const setSection = useCallback(
    (id: string) => {
      if (phase) setSections((prev) => ({ ...prev, [phase]: id }));
    },
    [phase],
  );

  const startGame = useCallback((s: GameState | null) => {
    setSections({});
    setOutcome(null);
    if (!s) writeSave(null);
    clearCheckpoints();
    prevState.current = s;
    setState(s);
  }, []);

  const restoreCheckpoint = useCallback((c: Checkpoint) => {
    setSections({});
    setOutcome(null);
    keepCheckpointsUpTo(c.week);
    prevState.current = c.state;
    setState(c.state);
  }, []);

  const ctx = useMemo(
    () => (state ? { state, dispatch, openArticle, section, setSection, confirm: setConfirmRequest } : null),
    [state, dispatch, openArticle, section, setSection],
  );

  if (!state || !ctx) {
    return <NewGameScreen onStart={startGame} />;
  }

  return (
    <GameContext.Provider value={ctx}>
      <div className="app">
        <Sidebar
          open={navOpen}
          onClose={() => setNavOpen(false)}
          onHandbook={() => setHandbookOpen(true)}
          onLog={() => setLogOpen(true)}
          onNewGame={() =>
            setConfirmRequest({
              title: t('Начать новую игру?'),
              text: t('Текущий прогресс будет потерян. Сохранение в браузере перезапишется.'),
              confirmLabel: t('Начать заново'),
              danger: true,
              onConfirm: () => startGame(null),
            })
          }
        />
        <div className="main">
          <TopBar onMenu={() => setNavOpen(true)} />
          <main className="content">
            <PageHeader />
            {state.phase === 'discovery' && <DiscoveryScreen />}
            {state.phase === 'strategy' && <StrategyScreen />}
            {state.phase === 'setup' && <SetupScreen />}
            {state.phase === 'build' && <BuildScreen />}
            {state.phase === 'launch' && <LaunchScreen />}
            {state.phase === 'growth' && <GrowthScreen />}
            {state.phase === 'end' && <EndScreen onRestart={startGame} onRestore={restoreCheckpoint} />}
          </main>
        </div>
      </div>

      {(outcome || state.pendingEvents.length > 0) && (
        <EventDialog outcome={outcome} onResolve={() => (awaitingOutcome.current = state.log.length)} onCloseOutcome={() => setOutcome(null)} />
      )}
      {handbookOpen && <Handbook articleId={article} onOpen={setArticle} onClose={() => setHandbookOpen(false)} />}
      {logOpen && <DecisionLog entries={state.log} onClose={() => setLogOpen(false)} />}
      {notice && (
        <Modal
          title={t('Не хватает вашего времени')}
          onClose={() => setNotice(null)}
          footer={
            <Button variant="primary" autoFocus onClick={() => setNotice(null)}>
              {t('Понятно')}
            </Button>
          }
        >
          <p className="text-2">{notice}</p>
        </Modal>
      )}
      {confirmRequest && (
        <Modal
          title={confirmRequest.title}
          onClose={() => setConfirmRequest(null)}
          footer={
            <>
              <Button onClick={() => setConfirmRequest(null)}>{t('Отмена')}</Button>
              <Button
                variant={confirmRequest.danger ? 'danger' : 'primary'}
                autoFocus
                onClick={() => {
                  confirmRequest.onConfirm();
                  setConfirmRequest(null);
                }}
              >
                {confirmRequest.confirmLabel}
              </Button>
            </>
          }
        >
          <p className="text-2">{confirmRequest.text}</p>
        </Modal>
      )}
    </GameContext.Provider>
  );
}
