import { useState } from 'react';
import { dateLabel, scenarioOf } from '../../engine/catalog.ts';
import type { ExperimentConfig } from '../../engine/experiments.ts';
import {
  EXTENSION_WEEKS,
  LEVER_NAMES,
  METRIC_NAMES,
  ideaDef,
  maxConcurrentTests,
  overlappingTest,
  plannedSample,
  requiredSample,
  runningTests,
  validateExperiment,
  visibleIdeas,
  weeklyFlow,
} from '../../engine/experiments.ts';
import { normCdf, sampleSizePerGroup } from '../../engine/stats.ts';
import type { Experiment, ExperimentIdeaDef, Metrics } from '../../engine/types.ts';
import { fixed, money, num, pct, signedPct } from '../../format.ts';
import { Icon } from '../components/Icon.tsx';
import { Badge, Button, Callout, Card, Empty, Field, Kpi, Modal, Segmented, Switch, Theory } from '../components/common.tsx';
import { Hint } from '../components/Hint.tsx';
import { useGame } from '../context.ts';
import type { GlossaryId } from '../glossary.ts';
import { t } from '../../i18n/index.ts';

type Metric = Experiment['metric'];

const OBS_RATE: Record<Metric, keyof Metrics> = {
  registration: 'registrationRate',
  activation: 'activationRate',
  conversion: 'conversionRate',
  retention: 'retentionM1',
};

const STATUS: Record<Experiment['status'], { label: string; tone: 'info' | 'warning' | 'success' | 'neutral' }> = {
  running: { label: t('идёт'), tone: 'info' },
  done: { label: t('ждёт решения'), tone: 'warning' },
  shipped: { label: t('внедрён'), tone: 'success' },
  rejected: { label: t('отклонён'), tone: 'neutral' },
};

function approxPower(baseline: number, mde: number, n: number): number {
  if (n <= 0 || baseline <= 0) return 0;
  const p2 = baseline * (1 + mde);
  const se = Math.sqrt((baseline * (1 - baseline) + p2 * (1 - p2)) / n);
  return normCdf(Math.abs(p2 - baseline) / se - 1.96);
}

function formatP(p: number): string {
  return p < 0.001 ? '< 0,001' : fixed(p, 3);
}

export function ExperimentsTab() {
  const { state, setSection } = useGame();
  const sc = scenarioOf(state);
  const [configIdea, setConfigIdea] = useState<string | null>(null);
  const running = state.experiments.filter((e) => e.status === 'running');
  const ideas = visibleIdeas(state);
  const hidden = sc.experiments.length - ideas.length;
  const done = state.experiments.filter((e) => e.status === 'done');
  const decided = state.experiments.filter((e) => e.status === 'shipped' || e.status === 'rejected');
  const blocked = state.tech.analytics === 'none' ? t('Без аналитики нельзя измерить результат теста.') : state.tech.experiments === 'none' ? t('Нет инфраструктуры для A/B-тестов.') : null;

  return (
    <>
      <div className="kpi-grid">
        <Kpi label={t('Идут сейчас')} value={`${runningTests(state)} / ${maxConcurrentTests(state)}`} foot={running.length > runningTests(state) ? t('+{0} фича-флаг', [running.length - runningTests(state)]) : t('лимит параллельных тестов')} />
        <Kpi label={t('Ждут решения')} term="abTest" value={done.length} tone={done.length > 0 ? 'warning' : undefined} />
        <Kpi label={t('Внедрено')} value={state.experiments.filter((e) => e.status === 'shipped').length} />
        <Kpi label={t('Инфраструктура')} value={blocked ? t('не готова') : t('готова')} tone={blocked ? 'danger' : 'success'} foot={state.tech.experiments === 'platform' ? t('платформа экспериментов') : state.tech.experiments === 'homegrown' ? t('свои фича-флаги') : t('нет')} />
      </div>

      {blocked && (
        <Callout tone="danger" title={t('A/B-тесты недоступны')}>
          {t('{0} Подключите в разделе «Технологии» — команде понадобится время на настройку.{1}', [blocked, ' '])}
          <button type="button" className="link" onClick={() => setSection('tech')}>
            {t('Открыть технологии')}
          </button>
        </Callout>
      )}

      {done.length > 0 && (
        <div className="stack">
          <div className="section-title">
            <h3>{t('Готовы результаты')}</h3>
            <Theory article="ab-pitfalls" label={t('Как не ошибиться')} />
          </div>
          {done.map((e) => (
            <ExperimentResultView key={e.id} exp={e} />
          ))}
        </div>
      )}

      <div className="split">
        <Card
          title={t('Идеи для тестов')} term="abTest"
          desc={t('Реальный эффект каждой идеи скрыт: он может быть положительным, нулевым или отрицательным.{0}', [hidden > 0 ? t(' Ещё {0} идеи подскажут исследования в разделе «Аналитика»: юзабилити-тест, интервью с ушедшими, NPS.', [hidden]) : ''])}
          actions={<Theory article="ab-testing" label={t('Основы')} />}
          bodyClassName="flush"
        >
          <div className="table-wrap">
            <table className="table">
              <tbody>
                {ideas.map((idea) => {
                  const existing = [...state.experiments].reverse().find((e) => e.ideaId === idea.id);
                  const busy = existing?.status === 'running' || existing?.status === 'shipped' || existing?.status === 'done';
                  return (
                    <tr key={idea.id}>
                      <td>
                        <div className="table-title">{idea.name}</div>
                        <div className="table-sub">{idea.hypothesis}</div>
                        <div className="row wrap mt-sm">
                          <Badge outline>{METRIC_NAMES[idea.metric]}</Badge>
                          <Badge outline>{t('{0} SP на вариант', [idea.effort])}</Badge>
                          {idea.priceMult && <Badge tone="accent">{t('новая цена {0}', [money(state.pricing.price * idea.priceMult, 2)])}</Badge>}
                          {idea.source && <Badge tone="success">{t('из исследования')}</Badge>}
                          {existing && <Badge tone={STATUS[existing.status].tone}>{STATUS[existing.status].label}</Badge>}
                        </div>
                      </td>
                      <td className="right" style={{ width: 130 }}>
                        <Button size="sm" disabled={!!blocked || busy} onClick={() => setConfigIdea(idea.id)}>
                          {t('Настроить')}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="stack sticky">
          <SampleSizeCalculator />
          <Card title={t('Идут сейчас')}>
            {running.length === 0 ? (
              <Empty icon="split" title={t('Нет запущенных тестов')} />
            ) : (
              <div className="stack-sm">
                {running.map((e) => (
                  <div key={e.id} className="running">
                    <span className="spinner" />
                    <div className="grow">
                      <div className="text-sm text-strong">{ideaDef(state, e.ideaId).name}</div>
                      <div className="text-xs text-muted">
                        {t('{0} нед. · {1} трафика{2} {3} {4}', [e.durationWeeks, pct(e.allocation, 0), e.peeking ? t(' · с подглядыванием') : '', e.extended ? t(' · продлён') : '', e.featureId ? t(' · фича-флаг') : ''])}
                      </div>
                    </div>
                    <Badge tone="accent">{t('ещё {0} нед.', [Math.max(0, e.resultWeek - state.week)])}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {decided.length > 0 && (
        <Card title={t('История решений')} desc={t('Настоящие эффекты станут известны в разборе после игры')} bodyClassName="flush">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Тест')}</th>
                  <th className="num">{t('Наблюдаемый эффект')}</th>
                  <th className="num">p-value</th>
                  <th>{t('Решение')}</th>
                </tr>
              </thead>
              <tbody>
                {decided.map((e) => (
                  <tr key={e.id}>
                    <td className="table-title">{ideaDef(state, e.ideaId).name}</td>
                    <td className="num">{signedPct(e.result?.uplift)}</td>
                    <td className="num">{e.result ? formatP(e.result.pValue) : '—'}</td>
                    <td>
                      <div className="row wrap">
                        <Badge tone={e.status === 'shipped' ? 'success' : 'neutral'}>{e.status === 'shipped' ? t('внедрён') : t('отклонён')}</Badge>
                        {e.holdout && e.holdoutWeek !== undefined && <Badge tone="info">{t('holdout до {0}', [dateLabel(e.holdoutWeek)])}</Badge>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {configIdea && <ExperimentModal idea={ideaDef(state, configIdea)} onClose={() => setConfigIdea(null)} />}
    </>
  );
}

function SampleSizeCalculator() {
  const { state } = useGame();
  const last = state.history[state.history.length - 1];
  const [metric, setMetric] = useState<Metric>('conversion');
  const [mde, setMde] = useState(0.1);
  const baseline = last ? (last.obs[OBS_RATE[metric]] as number | null) : null;
  const n = baseline ? sampleSizePerGroup(baseline, mde) : null;
  const flow = last ? weeklyFlow(last, metric) : 0;
  const weeks = n && flow > 0 ? Math.ceil((n * 2) / flow) : null;
  return (
    <Card title={t('Калькулятор размера выборки')} term="sampleSize" desc={t('α = 0,05 · мощность 80%')}>
      <div className="stack">
        <Field label={t('Метрика')}>
          <select className="select" value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
            {(Object.keys(METRIC_NAMES) as Metric[]).map((m) => (
              <option key={m} value={m}>
                {METRIC_NAMES[m]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('MDE — минимальный эффект, который хотим поймать')} term="mde">
          <Segmented options={[0.05, 0.1, 0.2, 0.3].map((v) => ({ id: v, label: pct(v, 0) }))} value={mde} onChange={setMde} />
        </Field>
        <dl className="kv">
          <dt>{t('Базовое значение')}</dt>
          <dd>{pct(baseline)}</dd>
          <dt>{t('Нужно в каждой группе')}</dt>
          <dd>{n ? num(n) : '—'}</dd>
          <dt>{t('Поток на шаге воронки')}</dt>
          <dd>{t('~{0} / нед.', [num(flow)])}</dd>
          <dt>{t('Длительность при 100% трафика')}</dt>
          <dd>{weeks ? t('{0} нед.', [weeks]) : '—'}</dd>
        </dl>
        <p className="text-xs text-muted">{t('Вдвое меньший эффект требует примерно вчетверо большей выборки.')}</p>
      </div>
    </Card>
  );
}

function ExperimentModal(props: { idea: ExperimentIdeaDef; onClose: () => void }) {
  const { state, dispatch } = useGame();
  const { idea } = props;
  const [config, setConfig] = useState<ExperimentConfig>({ ideaId: idea.id, durationWeeks: 4, allocation: 1, peeking: false, guardrails: true, mde: 0.1 });
  const error = validateExperiment(state, config);
  const rival = overlappingTest(state, idea.metric, config.allocation);
  const planned = plannedSample(state, idea.metric, config.durationWeeks, config.allocation);
  const needed = requiredSample(state, idea.metric, config.mde);
  const last = state.history[state.history.length - 1];
  const baseline = last ? ((last.obs[OBS_RATE[idea.metric]] as number | null) ?? 0) : 0;
  const power = approxPower(baseline, config.mde, planned);
  const powerTone = power < 0.5 ? 'danger' : power < 0.8 ? 'warning' : 'success';

  return (
    <Modal
      size="lg"
      title={idea.name}
      desc={idea.hypothesis}
      onClose={props.onClose}
      footer={
        <>
          <Button onClick={props.onClose}>{t('Отмена')}</Button>
          <Button
            variant="primary"
            icon="play"
            disabled={!!error}
            onClick={() => {
              dispatch({ type: 'start_experiment', config });
              props.onClose();
            }}
          >
            {t('Запустить тест')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <div className="row wrap">
          <Badge outline>{t('Метрика: {0}', [METRIC_NAMES[idea.metric]])}</Badge>
          <Badge outline>{t('Разработка варианта: {0} SP', [idea.effort])}</Badge>
          {idea.metric === 'retention' && <Badge tone="warning">{t('результат на 4 недели позже')}</Badge>}
        </div>
        <div className="grid cols-3">
          <Field label={t('Длительность')} help={t('Дольше тест — больше пользователей и выше мощность, но результат придёт позже. Короткие тесты завышают эффект новизны.')}>
            <select className="select" value={config.durationWeeks} onChange={(e) => setConfig({ ...config, durationWeeks: Number(e.target.value) })}>
              {[1, 2, 3, 4, 6, 8].map((w) => (
                <option key={w} value={w}>
                  {t('{0} нед.', [w])}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('Доля трафика')} term="trafficShare">
            <select className="select" value={config.allocation} onChange={(e) => setConfig({ ...config, allocation: Number(e.target.value) })}>
              {[0.2, 0.5, 1].map((a) => (
                <option key={a} value={a}>
                  {pct(a, 0)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('Ожидаемый эффект (MDE)')} term="mde">
            <select className="select" value={config.mde} onChange={(e) => setConfig({ ...config, mde: Number(e.target.value) })}>
              {[0.03, 0.05, 0.1, 0.2, 0.3].map((v) => (
                <option key={v} value={v}>
                  {pct(v, 0)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Switch checked={config.peeking} onChange={(peeking) => setConfig({ ...config, peeking })} label={t('Смотреть результат каждый день')} term="peeking" desc={t('Остановить тест, как только p-value станет меньше 0,05')} />
        <Switch checked={config.guardrails} onChange={(guardrails) => setConfig({ ...config, guardrails })} label={t('Guardrail-метрики')} term="guardrail" desc={t('Следить за метриками, которые изменение может случайно ухудшить')} />
        <div className="grid cols-3">
          <Kpi inset size="sm" label={t('Будет в группе')} term="sampleSize" value={num(planned)} />
          <Kpi inset size="sm" label={t('Нужно для MDE')} term="sampleSize" value={Number.isFinite(needed) ? num(needed) : '—'} />
          <Kpi inset size="sm" label={t('Мощность теста')} term="power" value={pct(power, 0)} tone={powerTone} />
        </div>
        {rival && (
          <Callout tone="warning" title={t('Тест пересечётся с другим')}>
            {t('Сейчас идёт «{0}» на ту же метрику ({1} трафика). Уменьшите долю трафика, чтобы группы не пересекались, или дождитесь его окончания.', [ideaDef(state, rival.ideaId).name, pct(rival.allocation, 0)])}
            <Hint term="overlap" />
          </Callout>
        )}
        {error && <Callout tone="warning">{error}</Callout>}
      </div>
    </Modal>
  );
}

// Relative uplift with its 95% confidence interval on an axis around zero.
function IntervalPlot(props: { low: number; mid: number; high: number }) {
  const span = Math.max(0.1, Math.abs(props.low), Math.abs(props.high)) * 1.15;
  const x = (v: number) => 50 + (v / span) * 46;
  const crossesZero = props.low < 0 && props.high > 0;
  const color = crossesZero ? 'var(--text-3)' : props.mid > 0 ? 'var(--success)' : 'var(--danger)';
  return (
    <svg viewBox="0 0 100 18" width="100%" height="44" preserveAspectRatio="none" aria-hidden="true">
      <line x1={50} x2={50} y1={1} y2={17} stroke="var(--border-strong)" strokeDasharray="1.5 1.5" vectorEffect="non-scaling-stroke" />
      <rect x={x(props.low)} y={7} width={Math.max(0.6, x(props.high) - x(props.low))} height={4} rx={2} fill={color} opacity={0.35} />
      <circle cx={x(props.mid)} cy={9} r={2.3} fill={color} />
    </svg>
  );
}

function ExperimentResultView(props: { exp: Experiment }) {
  const { state, dispatch } = useGame();
  const { exp } = props;
  const idea = ideaDef(state, exp.ideaId);
  const r = exp.result;
  if (!r) return null;
  const significant = r.pValue < 0.05;
  const srm = r.srmP < 0.01;
  const canExtend = !exp.extended && !significant && r.stoppedEarlyWeek === undefined && !srm;
  const canHoldout = !exp.featureId && !exp.variantPrice;
  const rival = exp.overlapWith !== undefined ? state.experiments.find((e) => e.id === exp.overlapWith) : undefined;
  const checks: { ok: boolean; label: string; text: string; term?: GlossaryId }[] = [
    { ok: significant, term: 'pValue', label: `p-value ${formatP(r.pValue)}`, text: significant ? t('статистически значимо при α = 0,05') : t('не значимо: разница может быть случайной') },
    { ok: !srm, term: 'srm', label: t('Соотношение групп (SRM)'), text: srm ? t('нарушено (p = {0}) — сплитование сломано', [r.srmP.toExponential(1)]) : t('в порядке') },
    ...(r.stoppedEarlyWeek !== undefined ? [{ ok: false, term: 'peeking' as GlossaryId, label: t('Ранняя остановка'), text: t('тест остановлен на неделе {0} из {1} при первом p < 0,05', [r.stoppedEarlyWeek, exp.durationWeeks]) }] : []),
    ...(r.guardrail ? [{ ok: Math.abs(r.guardrail.uplift) < 0.02 || r.guardrail.uplift > 0, term: 'guardrail' as GlossaryId, label: `Guardrail «${LEVER_NAMES[r.guardrail.lever]}»`, text: `${signedPct(r.guardrail.uplift)} (p = ${formatP(r.guardrail.pValue)})` }] : []),
    ...(exp.guardrails && !r.guardrail ? [{ ok: true, term: 'guardrail' as GlossaryId, label: t('Guardrail-метрики'), text: t('без значимых изменений') }] : []),
    ...(rival
      ? [{ ok: false, term: 'overlap' as GlossaryId, label: t('Пересечение тестов'), text: t('одновременно шёл тест «{0}» на ту же метрику — эффекты смешались', [ideaDef(state, rival.ideaId).name]) }]
      : []),
    ...(exp.extended ? [{ ok: false, term: 'extendTest' as GlossaryId, label: t('Тест продлевали'), text: t('решение продлить принято после просмотра результата — риск ложной победы выше') }] : []),
  ];

  return (
    <Card
      title={idea.name}
      desc={idea.hypothesis}
      footer={
        <div className="row-end wrap">
          {canExtend && (
            <Button variant="ghost" icon="clock" onClick={() => dispatch({ type: 'extend_experiment', id: exp.id })} title={t('Добавить ещё две недели данных к текущему результату')}>
              {t('Продлить на {0} нед.', [EXTENSION_WEEKS])}
            </Button>
          )}
          <Button onClick={() => dispatch({ type: 'decide_experiment', id: exp.id, ship: false })}>{exp.featureId ? t('Откатить функцию') : t('Оставить A')}</Button>
          {canHoldout && (
            <Button icon="split" onClick={() => dispatch({ type: 'decide_experiment', id: exp.id, ship: true, holdout: true })} title={t('5% пользователей останутся на старой версии ещё 3 месяца')}>
              {t('Внедрить с holdout 5%')}
            </Button>
          )}
          <Button variant="primary" icon="check" onClick={() => dispatch({ type: 'decide_experiment', id: exp.id, ship: true })}>
            {exp.featureId ? t('Выпустить всем') : t('Внедрить вариант B')}
          </Button>
        </div>
      }
    >
      <div className="split-even">
        <div className="stack">
          <div className="grid cols-2" style={{ gap: 10 }}>
            {[
              { name: t('A · контроль'), n: r.nA, c: r.cA, rate: r.rateA, rev: r.revenuePerUserA },
              { name: t('B · вариант{0}', [exp.variantPrice ? ` (${money(exp.variantPrice, 2)})` : '']), n: r.nB, c: r.cB, rate: r.rateB, rev: r.revenuePerUserB },
            ].map((g) => (
              <div key={g.name} className="kpi inset">
                <div className="kpi-label">{g.name}</div>
                <div className="kpi-value">{pct(g.rate, 2)}</div>
                <div className="text-xs text-muted">
                  {t('{0} из {1}', [num(g.c), num(g.n)])}
                  {g.rev !== undefined && t(' · {0} на пользователя', [money(g.rev, 2)])}
                </div>
              </div>
            ))}
          </div>
          <div>
            <div className="row-between text-sm">
              <span className="text-2">{t('Разница B vs A')}</span>
              <strong className={`num ${significant ? (r.uplift > 0 ? 'text-success' : 'text-danger') : ''}`}>{signedPct(r.uplift)}</strong>
            </div>
            <IntervalPlot low={r.ciLow} mid={r.uplift} high={r.ciHigh} />
            <div className="row-between text-xs text-muted">
              <span>{t('95% ДИ: {0}', [signedPct(r.ciLow)])}</span>
              <span>0</span>
              <span>{signedPct(r.ciHigh)}</span>
            </div>
          </div>
        </div>
        <div className="stack-sm">
          {checks.map((c) => (
            <div key={c.label} className="row-top text-sm">
              <span className={`feed-icon ${c.ok ? 'good' : 'bad'}`}>
                <Icon name={c.ok ? 'check' : 'alert'} size={12} />
              </span>
              <div>
                <div className="text-strong">
                  {c.label}
                  {c.term && <Hint term={c.term} />}
                </div>
                <div className="text-muted">{c.text}</div>
              </div>
            </div>
          ))}
          {r.subgroups && r.subgroups.length > 0 && (
            <div className="stack-xs">
              <div className="text-sm text-strong">
                {t('Срезы')}
                <Hint term="subgroups" />
              </div>
              {r.subgroups.map((g) => (
                <div key={g.name} className="row-between text-sm">
                  <span className="text-2">
                    {g.name} · {num(g.n)}
                  </span>
                  <span className={`num ${g.pValue < 0.05 ? (g.uplift > 0 ? 'text-success' : 'text-danger') : 'text-muted'}`}>
                    {signedPct(g.uplift)} · p = {formatP(g.pValue)}
                  </span>
                </div>
              ))}
            </div>
          )}
          {exp.featureId && (
            <Callout tone="info" title={t('Как решать по функции')}>
              {t('Функция уже сделана. Если она нужна по исследованиям и тест не показал значимого ухудшения, её можно выпускать. Откатывают функции, которые вредят метрикам.')}
            </Callout>
          )}
          {r.revenuePerUserA !== undefined && r.revenuePerUserB !== undefined && (
            <Callout tone="info" title={t('Для ценовых тестов главное — выручка на пользователя')}>
              A: {money(r.revenuePerUserA, 2)} · B: {money(r.revenuePerUserB, 2)}
            </Callout>
          )}
        </div>
      </div>
    </Card>
  );
}
