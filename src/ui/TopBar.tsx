import { dateLabel } from '../engine/catalog.ts';
import { estimatedBurn, plannedBurn } from '../engine/growth.ts';
import { TURN_HOURS } from '../engine/potime.ts';
import { compactMoney, months } from '../format.ts';
import { Hint } from './components/Hint.tsx';
import { Icon } from './components/Icon.tsx';
import { GuideMenu } from './components/PhaseGuide.tsx';
import { Button, Progress } from './components/common.tsx';
import { useGame } from './context.ts';
import { PHASES, phaseIndex } from './navigation.ts';
import { t } from '../i18n/index.ts';

// Global status: where you are in the game and the numbers that can end it.
export function TopBar(props: { onMenu: () => void }) {
  const { state } = useGame();
  // Before launch, count everyone already hired: people who join later still need salaries.
  const prelaunch = state.phase !== 'growth' && state.phase !== 'end';
  const burn = prelaunch ? plannedBurn(state) : estimatedBurn(state);
  const runway = burn > 0 ? state.cash / burn : Infinity;
  const noTeam = !state.team.some((m) => m.role === 'developer');
  const runwayText = !prelaunch
    ? t('Расходы минус выручка: {0} в месяц при текущих настройках.', [compactMoney(Math.max(0, burn))])
    : noTeam
      ? t('Команда ещё не нанята: после найма расходы вырастут, а runway сократится.')
      : t('Расходы {0} в месяц со всеми нанятыми. После запуска добавится реклама.', [compactMoney(burn)]);
  const runwayTone = runway < 3 ? 'danger' : runway < 6 ? 'warning' : '';
  const trustTone = state.trust < 25 ? 'danger' : state.trust < 40 ? 'warning' : '';
  const index = phaseIndex(state.phase);
  const when = state.phase === 'growth' ? t('Месяц {0} · {1}', [state.history.length + 1, dateLabel(state.week)]) : t('Неделя {0} · {1}', [state.week + 1, dateLabel(state.week)]);

  return (
    <header className="topbar">
      <div className="row grow topbar-left">
        <Button className="menu-btn" variant="ghost" size="sm" icon="menu" onClick={props.onMenu} aria-label={t('Меню')} />
        <div className="topbar-where">
          <span className="topbar-phase">
            <span className="topbar-step">{index + 1}</span>
            {PHASES[index].label}
            <span className="text-muted">{' '}{t('· этап {0} из {1}', [index + 1, PHASES.length])}</span>
          </span>
          <span className="topbar-when">{when}</span>
        </div>
        <GuideMenu />
      </div>
      <div className="topbar-kpis">
        <div className="tkpi">
          <span className="tkpi-label">
            <Icon name="wallet" size={12} />
            {t('Деньги')}
          </span>
          <span className="tkpi-value">{compactMoney(state.cash)}</span>
        </div>
        <div className={`tkpi ${runwayTone}`}>
          <span className="tkpi-label">
            <Icon name="clock" size={12} />
            Runway
            <Hint term="runway" text={t('{0} Runway — на сколько месяцев хватит денег.', [runwayText])} />
          </span>
          <span className="tkpi-value">
            {months(runway)}
            {prelaunch && noTeam ? '*' : ''}
          </span>
        </div>
        {state.phase !== 'end' && (
          <div className={`tkpi optional ${state.poHours < 8 ? 'warning' : ''}`}>
            <span className="tkpi-label">
              <Icon name="clock" size={12} />
              {t('Ваше время')}
              <Hint term="poHours" />
            </span>
            <span className="tkpi-value">
              {Math.round(state.poHours)}
              <span className="text-muted text-xs">{' '}{t('/ {0} ч', [TURN_HOURS[state.phase]])}</span>
            </span>
          </div>
        )}
        <div className={`tkpi trust ${trustTone}`}>
          <span className="tkpi-label">
            <Icon name="briefcase" size={12} />
            {t('Доверие · {0}', [Math.round(state.trust)])}
            <Hint term="trust" />
          </span>
          <Progress value={state.trust} tone="auto" />
        </div>
        <div className="tkpi optional secondary">
          <span className="tkpi-label">
            <Icon name="heart" size={12} />
            {t('Мотивация · {0}', [Math.round(state.morale)])}
            <Hint term="morale" />
          </span>
          <Progress value={state.morale} tone="auto" />
        </div>
      </div>
    </header>
  );
}
