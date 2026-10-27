import { useState } from 'react';
import { featureDef, monthlyPayroll, scenarioOf, segmentDef, techSum } from '../../engine/catalog.ts';
import { BETA_WEEKS, mvpEstimate } from '../../engine/decisions.ts';
import { mustFeatures } from '../../engine/product.ts';
import { compactMoney, months } from '../../format.ts';
import { Icon } from '../components/Icon.tsx';
import { Button, Callout, Card, Kpi, TurnBar } from '../components/common.tsx';
import { useGame } from '../context.ts';
import { BacklogTable } from '../panels/Backlog.tsx';
import { TeamPanel } from '../panels/TeamPanel.tsx';
import { TechPanel } from '../panels/TechPanel.tsx';
import { t } from '../../i18n/index.ts';

export function SetupScreen() {
  const { state, dispatch, section, setSection } = useGame();
  const est = mvpEstimate(state);
  const [commit, setCommit] = useState<number | null>(null);
  const suggested = Number.isFinite(est.weeks) ? Math.ceil(est.weeks * 1.25) : 12;
  const commitWeeks = commit ?? suggested;
  const hasDevs = state.team.some((m) => m.role === 'developer');
  const problems: string[] = [];
  if (!hasDevs) problems.push(t('Наймите хотя бы одного разработчика.'));
  if (state.mvpScope.length === 0) problems.push(t('Выберите функции для MVP.'));

  return (
    <div className="stack-lg">
      {section === 'mvp' && <MvpSection />}
      {section === 'tech' && <TechPanel />}
      {section === 'team' && <TeamPanel />}
      {section === 'plan' && <PlanSection commit={commitWeeks} onCommit={setCommit} problems={problems} />}

      <TurnBar
        stats={[
          { label: t('Объём MVP'), value: `${est.points} SP` },
          { label: t('Разработчиков'), value: `${state.team.filter((m) => m.role === 'developer').length}` },
          { label: t('Оценка срока'), value: Number.isFinite(est.weeks) ? t('~{0} нед.', [est.weeks]) : '—' },
        ]}
        note={t('Подготовка займёт 1 неделю. Найм идёт параллельно.')}
      >
        {section !== 'plan' ? (
          <Button variant="primary" iconRight="arrowRight" onClick={() => setSection('plan')}>
            {t('Далее: план и срок')}
          </Button>
        ) : (
          <Button variant="primary" iconRight="arrowRight" disabled={problems.length > 0} onClick={() => dispatch({ type: 'start_build', commitWeeks })}>
            {t('Начать разработку')}
          </Button>
        )}
      </TurnBar>
    </div>
  );
}

function MvpSection() {
  const { state, dispatch } = useGame();
  const sc = scenarioOf(state);
  const est = mvpEstimate(state);
  const seg = state.strategy ? segmentDef(sc, state.strategy.segmentId) : null;
  const musts = mustFeatures(sc, state.strategy?.segmentId ?? '');
  const monthly = state.mvpScope.reduce((sum, id) => sum + (featureDef(sc, id).monthlyCost ?? 0), 0);

  return (
    <>
      <Callout tone="info" icon="target" title={t('Целевой сегмент: {0}', [seg?.name ?? '—'])}>
        {t('Impact и Confidence в таблице основаны на ваших исследованиях: чем больше вы узнали о сегменте, тем точнее оценки.')}
      </Callout>
      <div className="kpi-grid">
        <Kpi label={t('Объём MVP')} term="mvp" value={`${est.points} SP`} tone={est.points > 110 ? 'warning' : undefined} foot={est.points > 110 ? t('MVP выглядит раздутым') : t('оценка команды')} />
        <Kpi label={t('Функций')} value={state.mvpScope.length} foot={t('обязательных для сегмента: {0}', [musts.length])} />
        <Kpi label={t('Оценка срока')} term="estimate" value={Number.isFinite(est.weeks) ? t('~{0} нед.', [est.weeks]) : '—'} hint={t('С учётом найма и настройки инфраструктуры')} foot={Number.isFinite(est.weeks) ? undefined : t('нужны разработчики')} />
        <Kpi label={t('Ежемесячные расходы фич')} value={compactMoney(monthly)} foot={monthly > 0 ? t('контент и производство') : t('нет')} />
      </div>
      <Card title={t('Бэклог продукта')} term="ice" desc={t('Оценки трудоёмкости даёт команда — они обычно оптимистичны')} bodyClassName="flush">
        <BacklogTable ids={sc.features.map((f) => f.id)} mode="scope" selected={state.mvpScope} onToggle={(id) => dispatch({ type: 'toggle_scope', featureId: id })} />
      </Card>
    </>
  );
}

function PlanSection(props: { commit: number; onCommit: (v: number) => void; problems: string[] }) {
  const { state } = useGame();
  const est = mvpEstimate(state);
  // Burn once everyone hired has started (pre-launch infra runs at half load).
  const burn = monthlyPayroll(state, Infinity) + techSum(state, 'monthly') + techSum(state, 'infraFixed') * 0.5;
  const ratio = Number.isFinite(est.weeks) && est.weeks > 0 ? props.commit / est.weeks : 1;
  const verdict =
    ratio < 0.9
      ? { tone: 'danger' as const, text: t('Срок короче оценки команды — срыв почти гарантирован.') }
      : ratio <= 1.6
        ? { tone: 'success' as const, text: t('Срок с разумным буфером на неопределённость. Если планируете закрытую бету, добавьте ещё 4 недели.') }
        : props.commit <= est.weeks * 1.6 + BETA_WEEKS
          ? { tone: 'success' as const, text: t('Буфер с учётом закрытой беты (4 недели). Если беты не будет, запас великоват.') }
          : { tone: 'warning' as const, text: t('Слишком большой запас — CEO будет недоволен.') };

  return (
    <>
      <div className="kpi-grid">
        <Kpi label={t('Объём MVP')} term="mvp" value={`${est.points} SP`} />
        <Kpi label={t('Скорость команды')} term="velocity" value={`~${Math.round(est.capacity)} SP`} foot={t('за спринт, полный состав')} />
        <Kpi label={t('Ожидание найма')} value={t('{0} нед.', [est.hiringWeeks])} />
        <Kpi label={t('Оценка срока')} term="estimate" value={Number.isFinite(est.weeks) ? t('{0} нед.', [est.weeks]) : '—'} />
        <Kpi label={t('Burn с полной командой')} term="burn" value={`${compactMoney(burn)}`} foot={t('в месяц')} />
        <Kpi label="Runway" term="runway" value={months(burn > 0 ? state.cash / burn : Infinity)} />
      </div>
      <div className="split">
        <Card title={t('Обещание CEO')} term="commitment" desc={t('Срок запуска, который вы назовёте стейкхолдерам')}>
          <div className="stack">
            <div className="row-between">
              <span className="text-2">{t('Запуск через')}</span>
              <span style={{ fontSize: 28, fontWeight: 700 }} className="num">
                {t('{0} нед.', [props.commit])}
              </span>
            </div>
            <input className="range" type="range" min={4} max={40} value={props.commit} onChange={(e) => props.onCommit(Number(e.target.value))} />
            <div className="row-between text-xs text-muted">
              <span>{t('4 недели')}</span>
              <span>{t('неделя {0} от старта компании', [state.week + 1 + props.commit])}</span>
              <span>{t('40 недель')}</span>
            </div>
            <Callout tone={verdict.tone}>{verdict.text}</Callout>
            <dl className="kv">
              <dt>{t('Стоимость разработки до запуска')}</dt>
              <dd>≈ {compactMoney((burn / 4) * props.commit)}</dd>
            </dl>
          </div>
        </Card>
        <Card title={t('Готовность к старту')}>
          <div className="stack-sm">
            {[
              { ok: state.team.some((m) => m.role === 'developer'), text: t('В команде есть разработчики') },
              { ok: state.mvpScope.length > 0, text: t('Выбран объём MVP') },
              { ok: state.tech.analytics !== 'none', text: t('Подключена аналитика') },
              { ok: state.tech.practices.length > 0, text: t('Выбраны инженерные практики') },
            ].map((c) => (
              <div key={c.text} className="row text-sm">
                <span className={`feed-icon ${c.ok ? 'good' : ''}`}>
                  <Icon name={c.ok ? 'check' : 'x'} size={12} />
                </span>
                <span className={c.ok ? '' : 'text-muted'}>{c.text}</span>
              </div>
            ))}
            {props.problems.map((p) => (
              <Callout key={p} tone="warning">
                {p}
              </Callout>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
