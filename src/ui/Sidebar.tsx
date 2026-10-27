import { DEADLINE_WEEKS, dateLabel, scenarioOf } from '../engine/catalog.ts';
import { Hint } from './components/Hint.tsx';
import { Icon } from './components/Icon.tsx';
import { LanguageSelect } from './components/LanguageSelect.tsx';
import { ThemeToggle } from './components/ThemeToggle.tsx';
import { Progress } from './components/common.tsx';
import { useGame } from './context.ts';
import { GOAL_SHORT, goalRows } from './goals.ts';
import { PHASES, groupOf, navGroups, phaseIndex, sectionBadges } from './navigation.ts';
import { t } from '../i18n/index.ts';

export function Sidebar(props: { open: boolean; onClose: () => void; onHandbook: () => void; onLog: () => void; onNewGame: () => void }) {
  const { state, section, setSection } = useGame();
  const sc = scenarioOf(state);
  const current = phaseIndex(state.phase);
  const badges = sectionBadges(state);
  const goals = goalRows(state);
  const activeGroup = groupOf(state.phase, section).id;
  const judged = state.log.filter((e) => e.points !== undefined).length;

  return (
    <>
      <div className={`sidebar-backdrop ${props.open ? 'open' : ''}`} onClick={props.onClose} />
      <aside className={`sidebar ${props.open ? 'open' : ''}`}>
        <div className="sb-brand">
          <div className="sb-logo">
            <Icon name="sparkles" size={18} />
          </div>
          <div className="grow">
            <div className="sb-brand-name">{sc.productName}</div>
            <div className="sb-brand-sub">
              {sc.kind === 'b2c' ? 'B2C' : 'B2B'} · {sc.market}
            </div>
          </div>
        </div>

        <div className="sb-status">
          <div className="row-between text-xs">
            <span className="text-muted row" style={{ gap: 0 }}>
              {t('До совета инвесторов')}
              <Hint term="deadline" />
            </span>
            <strong className="num">{t('{0} нед.', [Math.max(0, DEADLINE_WEEKS - state.week)])}</strong>
          </div>
          <Progress value={Math.min(state.week, DEADLINE_WEEKS)} max={DEADLINE_WEEKS} tone="info" />
          <div className="row-between text-xs text-muted">
            <span>{t('Неделя {0}', [state.week + 1])}</span>
            <span>{dateLabel(state.week)}</span>
          </div>
          <div className="sb-goals">
            <div className="row-between text-xs">
              <span className="text-muted row" style={{ gap: 0 }}>
                {t('Цель — раунд A')}
                <Hint term="seriesA" />
              </span>
              <strong className="num">{goals.filter((g) => g.met).length} / 4</strong>
            </div>
            {goals.map((g) => (
              <div key={g.criterion.id} className="sb-goal" title={g.criterion.label}>
                <span className={`sb-goal-dot ${g.met ? 'met' : ''}`} />
                <span className="grow">{GOAL_SHORT[g.criterion.id]}</span>
                <span className="num">
                  <strong>{g.shown}</strong>
                  <span className="text-muted"> / {g.target}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <nav className="sb-nav" aria-label={t('Этапы и разделы')}>
          {PHASES.map((p, i) => {
            const status = i < current ? 'done' : i === current ? 'current' : 'locked';
            const groups = status === 'current' ? navGroups(p.id) : [];
            return (
              <div key={p.id}>
                <div className={`sb-phase ${status}`} aria-current={status === 'current' ? 'step' : undefined}>
                  <span className="sb-step">{status === 'done' ? <Icon name="check" size={12} strokeWidth={3} /> : i + 1}</span>
                  <span className="grow">{p.label}</span>
                  {status === 'locked' && <Icon name="lock" size={13} />}
                </div>
                {groups.length > 1 && (
                  <div className="sb-sub">
                    {groups.map((g) => {
                      const badge = g.sections.reduce((sum, s) => sum + (badges[s.id] ?? 0), 0);
                      return (
                        <button
                          key={g.id}
                          type="button"
                          className={`sb-item ${activeGroup === g.id ? 'active' : ''}`}
                          aria-current={activeGroup === g.id ? 'page' : undefined}
                          onClick={() => {
                            if (activeGroup !== g.id) setSection(g.sections[0].id);
                            props.onClose();
                          }}
                        >
                          <Icon name={g.icon} size={15} />
                          <span className="grow">{g.label}</span>
                          {badge > 0 && <span className="count">{badge}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="sb-footer">
          <button type="button" className="sb-item" onClick={props.onHandbook}>
            <Icon name="book" size={15} />
            <span className="grow">{t('Справочник PO')}</span>
          </button>
          <button type="button" className="sb-item" onClick={props.onLog}>
            <Icon name="compass" size={15} />
            <span className="grow">{t('Журнал решений')}</span>
            {judged > 0 && <span className="badge">{judged}</span>}
          </button>
          <ThemeToggle />
          <LanguageSelect />
          <button type="button" className="sb-item" onClick={props.onNewGame}>
            <Icon name="restart" size={15} />
            <span className="grow">{t('Новая игра')}</span>
          </button>
        </div>
      </aside>
    </>
  );
}
