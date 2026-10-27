import { featureDef, monthlyPayroll, scenarioOf } from '../../engine/catalog.ts';
import { featureEffort, featureEstimate, mustFeatures } from '../../engine/product.ts';
import { compactMoney, num } from '../../format.ts';
import { Icon } from '../components/Icon.tsx';
import { PALETTE, StackedBars } from '../components/charts.tsx';
import { TurnSummary } from '../components/TurnSummary.tsx';
import { Badge, Button, Callout, Card, Empty, Kpi, Progress, TurnBar } from '../components/common.tsx';
import { useGame } from '../context.ts';
import { BacklogTable } from '../panels/Backlog.tsx';
import { TeamPanel } from '../panels/TeamPanel.tsx';
import { TechPanel } from '../panels/TechPanel.tsx';
import { AllocationControl, CapacityInfo } from '../panels/WorkPlan.tsx';
import { t } from '../../i18n/index.ts';

export function BuildScreen() {
  const { state, dispatch, section, confirm } = useGame();
  const sc = scenarioOf(state);
  const started = state.buildStartWeek ?? state.week;
  const elapsed = state.week - started;
  const commit = state.commitWeeks ?? 0;
  const allDone = state.mvpScope.every((id) => state.product.features[id]?.completed);
  const anyDone = Object.values(state.product.features).some((f) => f.completed);
  const devsReady = state.team.some((m) => m.role === 'developer' && m.joinWeek <= state.week);
  const doneCount = state.mvpScope.filter((id) => state.product.features[id]?.completed).length;

  const goLaunch = () => {
    if (allDone) {
      dispatch({ type: 'finish_build' });
      return;
    }
    confirm({
      title: t('Запустить неполный MVP?'),
      text: t('Готово {0} из {1} функций. Недоделанные функции можно закончить после запуска, но без обязательных пользователи будут уходить.', [doneCount, state.mvpScope.length]),
      confirmLabel: t('Перейти к запуску'),
      onConfirm: () => dispatch({ type: 'finish_build' }),
    });
  };

  return (
    <div className="stack-lg">
      {section === 'sprint' && (
        <>
          <TurnSummary title={t('Итоги спринта')} />
          <div className="kpi-grid">
            <Kpi label={t('Спринт')} term="sprint" value={state.sprints.length + 1} foot={t('по 2 недели')} />
            <Kpi
              label={t('До обещанного запуска')}
              value={elapsed > commit ? t('срок сорван') : t('{0} нед.', [commit - elapsed])}
              tone={elapsed > commit ? 'danger' : commit - elapsed <= 2 ? 'warning' : undefined}
              foot={t('прошло {0} из {1} нед.', [elapsed, commit])}
            />
            <Kpi label={t('Готово функций')} value={`${doneCount} / ${state.mvpScope.length}`} foot={allDone ? t('MVP готов к запуску') : t('в работе')} />
            <Kpi label={t('Сделано за всё время')} term="storyPoints" value={`${num(state.sprints.reduce((s, x) => s + x.featurePoints, 0))} SP`} />
          </div>
          {allDone && (
            <Callout tone="success" title={t('MVP готов')} icon="checkCircle">
              {t('Все функции из объёма MVP сделаны. Переходите к запуску: каждый лишний спринт сдвигает обещанный срок.{0}', [' '])}
              <button type="button" className="link" onClick={goLaunch}>
                {t('К запуску')}
              </button>
            </Callout>
          )}
          {!devsReady && (
            <Callout tone="warning" title={t('Разработчики ещё не вышли на работу')}>
              {t('Спринт пройдёт впустую, но зарплаты основателей идут. Можно дождаться выхода команды или нанять через аутсорс — он выходит за неделю.')}
            </Callout>
          )}
          <div className="split">
            <Card title={t('Прогресс MVP')} term="mvp" desc={t('Команда делает задачи сверху вниз. ★ — обязательная для сегмента функция')}>
              <div className="stack">
                {state.mvpScope.map((id, i) => {
                  const p = state.product.features[id];
                  const effort = featureEffort(state, id);
                  const ratio = p ? p.done / effort : 0;
                  const must = mustFeatures(sc, state.strategy?.segmentId ?? '').includes(id);
                  return (
                    <div key={id} className="stack-xs">
                      <div className="row-between">
                        <span className="row text-sm text-strong">
                          {p?.completed ? <Icon name="checkCircle" size={15} className="text-success" /> : <Icon name="clock" size={15} className="text-muted" />}
                          {featureDef(sc, id).name}
                          {must && <span className="text-warning">★</span>}
                        </span>
                        <span className="row">
                          <span className="text-xs text-muted num">{p?.completed ? t('готово') : t('{0} SP · оценка {1}', [num(p?.done ?? 0), featureEstimate(state, id)])}</span>
                          <Button variant="ghost" size="sm" icon="arrowUp" disabled={i === 0} onClick={() => dispatch({ type: 'move_scope', featureId: id, dir: -1 })} aria-label={t('Выше')} />
                          <Button variant="ghost" size="sm" icon="arrowDown" disabled={i === state.mvpScope.length - 1} onClick={() => dispatch({ type: 'move_scope', featureId: id, dir: 1 })} aria-label={t('Ниже')} />
                        </span>
                      </div>
                      <Progress value={Math.min(1, ratio)} max={1} tone={p?.completed ? 'success' : ratio > 0.99 ? 'warning' : 'info'} />
                    </div>
                  );
                })}
              </div>
            </Card>
            <div className="stack">
              <Card title={t('Планирование спринта')}>
                <AllocationControl />
              </Card>
              <Card title={t('Возможности команды')}>
                <CapacityInfo />
              </Card>
            </div>
          </div>
          <Card title={t('Velocity по спринтам')} term="velocity" desc={t('На что ушло время команды')}>
            {state.sprints.length === 0 ? (
              <Empty icon="zap" title={t('Спринтов ещё не было')}>
                {t('График появится после первого спринта.')}
              </Empty>
            ) : (
              <StackedBars
                labels={state.sprints.map((x) => t('С{0}', [x.index]))}
                series={[
                  { name: t('Функции'), color: PALETTE[0], values: state.sprints.map((x) => x.featurePoints) },
                  { name: t('Техдолг'), color: PALETTE[2], values: state.sprints.map((x) => x.debtPoints) },
                  { name: t('Баги'), color: PALETTE[3], values: state.sprints.map((x) => x.bugPoints) },
                  { name: t('Настройка и внеплановое'), color: PALETTE[8], values: state.sprints.map((x) => Math.max(0, x.capacity - x.featurePoints - x.debtPoints - x.bugPoints)) },
                ]}
                format={(v) => `${num(v)} SP`}
              />
            )}
          </Card>
        </>
      )}
      {section === 'scope' && (
        <Card title={t('Объём MVP')} desc={t('Убрать можно только неготовые функции. Каждая добавленная функция отодвигает запуск')} bodyClassName="flush">
          <BacklogTable ids={sc.features.map((f) => f.id)} mode="scope" selected={state.mvpScope} onToggle={(id) => dispatch({ type: 'toggle_scope', featureId: id })} />
        </Card>
      )}
      {section === 'team' && <TeamPanel />}
      {section === 'tech' && <TechPanel />}

      <TurnBar
        stats={[
          { label: t('Спринт'), value: `${state.sprints.length + 1}` },
          { label: t('Стоимость спринта'), value: compactMoney(monthlyPayroll(state) / 2) },
          { label: t('Готово'), value: `${doneCount} / ${state.mvpScope.length}` },
        ]}
        note={allDone ? <Badge tone="success">{t('MVP готов — можно запускать')}</Badge> : undefined}
      >
        <Button variant={allDone ? 'primary' : 'secondary'} icon="rocket" disabled={!anyDone} onClick={goLaunch}>
          {t('К запуску')}
        </Button>
        <Button variant={allDone ? 'secondary' : 'primary'} iconRight="arrowRight" onClick={() => dispatch({ type: 'run_sprint' })}>
          {t('Провести спринт')}
        </Button>
      </TurnBar>
    </div>
  );
}
