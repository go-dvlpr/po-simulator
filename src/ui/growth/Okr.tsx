import { useState } from 'react';
import { dateLabel, scenarioOf } from '../../engine/catalog.ts';
import type { OkrMetricDef } from '../../engine/okr.ts';
import { activeOkr, ambition, OKR_METRICS, okrDueMonth, okrValue, validateOkr } from '../../engine/okr.ts';
import type { GameState, OkrGoal, OkrMetric } from '../../engine/types.ts';
import { compactMoney, num, pct } from '../../format.ts';
import { Icon } from '../components/Icon.tsx';
import { Badge, Button, Callout, Card, Empty, Modal, Progress, Segmented, Theory } from '../components/common.tsx';
import { useGame } from '../context.ts';
import { t } from '../../i18n/index.ts';

const LEVELS = [0.1, 0.2, 0.35];

function formatValue(def: OkrMetricDef, v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return def.format === 'money' ? compactMoney(v) : def.format === 'pct' ? pct(v) : num(v);
}

function metricLabel(state: GameState, metric: OkrMetric): string {
  if (metric !== 'northStar') return OKR_METRICS[metric].label;
  const ns = scenarioOf(state).northStars.find((n) => n.id === state.strategy?.northStarId);
  return ns ? `North Star: ${ns.title}` : 'North Star';
}

// Months are counted from launch: month N ends at history.length === N.
function boardDate(state: GameState, month: number): string {
  return dateLabel(state.week + (month - state.history.length) * 4);
}

function GoalProgress(props: { goal: OkrGoal; current: number | null }) {
  const { state } = useGame();
  const def = OKR_METRICS[props.goal.metric];
  const { goal } = props;
  const span = goal.target - goal.base;
  const progress = props.current === null || span === 0 ? 0 : (props.current - goal.base) / span;
  return (
    <div className="stack-xs">
      <div className="row-between text-sm">
        <span className="text-2">{metricLabel(state, goal.metric)}</span>
        <span className="num">
          <strong>{formatValue(def, props.current)}</strong>
          <span className="text-muted">
            {t('{0} · было {1} → цель {2}', [' ', formatValue(def, goal.base), formatValue(def, goal.target)])}
          </span>
        </span>
      </div>
      <Progress value={Math.max(0, Math.min(1, progress))} max={1} tone={progress >= 1 ? 'success' : 'info'} />
    </div>
  );
}

export function OkrCard() {
  const { state } = useGame();
  const [editing, setEditing] = useState(false);
  const okr = activeOkr(state);
  const last = state.history[state.history.length - 1];
  const previous = [...state.okrs].reverse().find((o) => o.evaluated);

  return (
    <Card
      title={t('Цели квартала')} term="okr"
      desc={okr ? t('Совет проверит их после {0}-го месяца ({1})', [okr.dueMonth, boardDate(state, okr.dueMonth)]) : t('Измеримые цели, которые вы обещаете совету директоров')}
      actions={<Theory article="okr" label="OKR" />}
    >
      {okr ? (
        <div className="stack">
          {okr.goals.map((g) => (
            <GoalProgress key={g.metric} goal={g} current={okrValue(last, g.metric)} />
          ))}
        </div>
      ) : (
        <Empty
          icon="flag"
          title={t('Целей на квартал нет')}
          action={
            <Button variant="primary" size="sm" icon="flag" disabled={!last} onClick={() => setEditing(true)}>
              {t('Поставить цели')}
            </Button>
          }
        >
          {last ? t('Совет проверит их на встрече после {0}-го месяца. Без целей доверие падает.', [okrDueMonth(state)]) : t('Цели можно поставить после первого месяца: нужны стартовые значения.')}
        </Empty>
      )}
      {previous && (
        <div className="stack-sm mt-md">
          <span className="eyebrow">{t('Прошлый квартал')}</span>
          {previous.goals.map((g) => (
            <div key={g.metric} className="row text-sm">
              <span className={`feed-icon ${g.met ? 'good' : 'bad'}`}>
                <Icon name={g.met ? 'check' : 'x'} size={12} />
              </span>
              <span className="grow text-2">{metricLabel(state, g.metric)}</span>
              <span className="num">
                {formatValue(OKR_METRICS[g.metric], g.actual)} / {formatValue(OKR_METRICS[g.metric], g.target)}
              </span>
            </div>
          ))}
        </div>
      )}
      {editing && <OkrModal onClose={() => setEditing(false)} />}
    </Card>
  );
}

function OkrModal(props: { onClose: () => void }) {
  const { state, dispatch } = useGame();
  const last = state.history[state.history.length - 1];
  const metrics = (Object.keys(OKR_METRICS) as OkrMetric[]).filter((m) => okrValue(last, m) !== null);
  const [levels, setLevels] = useState<Partial<Record<OkrMetric, number>>>({ mrr: 0.2 });
  const chosen = metrics.filter((m) => levels[m] !== undefined);
  const goals = chosen.map((metric) => {
    const base = okrValue(last, metric) ?? 0;
    const level = levels[metric] ?? 0;
    return { metric, target: OKR_METRICS[metric].better === 'up' ? base * (1 + level) : base * (1 - level) };
  });
  const error = validateOkr(state, goals);
  const avg = goals.length > 0 ? goals.reduce((sum, g) => sum + ambition({ ...g, base: okrValue(last, g.metric) ?? 0 }), 0) / goals.length : 0;

  return (
    <Modal
      size="lg"
      title={t('Цели на квартал')}
      desc={t('Выберите до трёх метрик. Совет проверит их после {0}-го месяца', [okrDueMonth(state)])}
      onClose={props.onClose}
      footer={
        <>
          <Button onClick={props.onClose}>{t('Отмена')}</Button>
          <Button
            variant="primary"
            icon="flag"
            disabled={!!error}
            onClick={() => {
              dispatch({ type: 'set_okr', goals });
              props.onClose();
            }}
          >
            {t('Пообещать совету')}
          </Button>
        </>
      }
    >
      <div className="stack">
        {metrics.map((m) => {
          const def = OKR_METRICS[m];
          const on = levels[m] !== undefined;
          const base = okrValue(last, m) ?? 0;
          const level = levels[m] ?? LEVELS[1];
          const target = def.better === 'up' ? base * (1 + level) : base * (1 - level);
          return (
            <div key={m} className={`okr-row ${on ? 'on' : ''}`}>
              <label className="row grow" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  className="check"
                  checked={on}
                  disabled={!on && chosen.length >= 3}
                  onChange={(e) => {
                    const next = { ...levels };
                    if (e.target.checked) next[m] = LEVELS[1];
                    else delete next[m];
                    setLevels(next);
                  }}
                />
                <span className="stack-xs grow">
                  <strong>{metricLabel(state, m)}</strong>
                  <span className="text-xs text-muted">
                    {t('Сейчас {0}', [formatValue(def, base)])}
                    {on && t(' → цель {0}', [formatValue(def, target)])}
                  </span>
                </span>
              </label>
              {on && (
                <Segmented
                  options={LEVELS.map((l) => ({ id: l, label: `${def.better === 'up' ? '+' : '−'}${Math.round(l * 100)}%` }))}
                  value={level}
                  onChange={(l) => setLevels({ ...levels, [m]: l })}
                />
              )}
            </div>
          );
        })}
        <Callout tone="info" title={t('Как ставить цели')}>
          {t('Цель должна быть амбициозной, но достижимой. Выполнили всё с запасом — цели были слишком осторожными. Провалили всё — совет перестанет верить прогнозам. Нормальный результат для OKR — 60–70%.')}
        </Callout>
        {goals.length > 0 && (
          <div className="row">
            <Badge tone={avg < 0.05 ? 'warning' : avg > 0.3 ? 'danger' : 'success'}>
              {avg < 0.05 ? t('слишком осторожно') : avg > 0.3 ? t('очень амбициозно') : t('реалистично-амбициозно')}
            </Badge>
          </div>
        )}
        {error && <Callout tone="warning">{error}</Callout>}
      </div>
    </Modal>
  );
}
