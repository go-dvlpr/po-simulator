import { useState } from 'react';
import { criterionDef } from '../../data/research.ts';
import { SCENARIO_ORDER } from '../../data/scenarios/index.ts';
import { dateLabel, scenarioOf } from '../../engine/catalog.ts';
import { ideaDef } from '../../engine/experiments.ts';
import { mustFeatures } from '../../engine/product.ts';
import { hypothesisTruth, segmentOpportunity } from '../../engine/research.ts';
import { CATEGORY_NAMES, finalScore, seriesACriteria } from '../../engine/scoring.ts';
import type { GameState, ScoreCategory } from '../../engine/types.ts';
import { newGame } from '../../engine/world.ts';
import { compactMoney, fixed, money, pct, ratio, signedPct } from '../../format.ts';
import { Icon } from '../components/Icon.tsx';
import { LineChart, PALETTE } from '../components/charts.tsx';
import { Badge, Button, Card, Empty, Progress, Ring, Tabs, Theory } from '../components/common.tsx';
import type { Checkpoint } from '../checkpoints.ts';
import { checkpointTitle, loadCheckpoints } from '../checkpoints.ts';
import { useGame } from '../context.ts';
import { LogList } from '../DecisionLog.tsx';
import { monthLabels } from '../growth/Overview.tsx';
import { CATEGORY_ARTICLES, loadHistory, topMistakes } from '../history.ts';
import { chartMarkers } from '../timeline.ts';
import { featureInsight } from '../panels/Backlog.tsx';
import { criterionText, hypothesisStatement, STATUS_TEXT } from '../texts.ts';
import { t } from '../../i18n/index.ts';

const QUALITY: Record<string, { text: string; tone: 'success' | 'warning' | 'danger' }> = {
  strong: { text: t('сильный критерий'), tone: 'success' },
  medium: { text: t('средний критерий'), tone: 'warning' },
  weak: { text: t('слабый критерий'), tone: 'danger' },
  invalid: { text: t('неопровержимый'), tone: 'danger' },
};

const KANO: Record<string, string> = { must: t('обязательная'), performance: t('чем больше, тем лучше'), delighter: t('вау-эффект'), indifferent: t('безразличная') };

export function EndScreen(props: { onRestart: (s: GameState) => void; onRestore: (c: Checkpoint) => void }) {
  const { section } = useGame();
  return (
    <div className="stack-lg">
      {section === 'summary' && <Summary onRestart={props.onRestart} onRestore={props.onRestore} />}
      {section === 'debrief' && <Debrief />}
      {section === 'log' && <LogSection />}
    </div>
  );
}

function Summary(props: { onRestart: (s: GameState) => void; onRestore: (c: Checkpoint) => void }) {
  const { state, setSection, confirm } = useGame();
  const [checkpoints] = useState(loadCheckpoints);
  const ending = state.ending;
  const score = finalScore(state);
  const criteria = seriesACriteria(state);
  const categories = Object.keys(CATEGORY_NAMES) as ScoreCategory[];
  const tone = ending?.kind === 'seriesA' ? 'success' : ending?.kind === 'bridge' ? 'warning' : 'danger';
  const ringColor = tone === 'success' ? 'var(--success)' : tone === 'warning' ? 'var(--warning)' : 'var(--danger)';
  const mistakes = topMistakes(state.log, 3);
  const played = loadHistory().filter((g) => g.scenarioId === state.scenarioId);
  const best = played.reduce((max, g) => Math.max(max, g.score), 0);

  return (
    <>
      <section className={`hero ${tone}`}>
        <div className="row-top gap-lg wrap">
          <Ring value={score.total / 100} size={136} stroke={12} color={ringColor}>
            <div>
              <div style={{ fontSize: 34, lineHeight: 1 }}>{score.total}</div>
              <div className="text-xs text-muted" style={{ fontWeight: 500 }}>
                {t('из 100')}
              </div>
            </div>
          </Ring>
          <div className="stack" style={{ flex: '1 1 320px', minWidth: 0 }}>
            <div className="stack-xs">
              <span className="eyebrow">{t('Итог 18 месяцев')}</span>
              <h2 style={{ fontSize: 26, letterSpacing: '-0.02em' }}>{ending?.title}</h2>
              <p className="text-2 text-lg">{ending?.text}</p>
            </div>
            <div className="row wrap">
              <Badge tone="accent">
                <Icon name="star" size={12} />
                {score.rank}
              </Badge>
              <Badge outline>{t('Результат бизнеса {0} / 50', [score.outcome])}</Badge>
              <Badge outline>{t('Качество решений {0} / 50', [score.decisions])}</Badge>
              <Badge outline>{t('Критериев раунда A: {0} / 4', [score.criteriaMet])}</Badge>
              {played.length > 1 && (
                <Badge outline>
                  {t('Партия №{0} в этом сценарии · лучший результат {1}', [played.length, best])}
                </Badge>
              )}
            </div>
            <div className="row wrap">
              <Button variant="primary" icon="restart" onClick={() => props.onRestart(newGame(state.scenarioId, state.difficulty, state.seed))}>
                {t('Переиграть этот рынок')}
              </Button>
              <Button icon="sparkles" onClick={() => props.onRestart(newGame(state.scenarioId, state.difficulty, Math.floor(Math.random() * 1e9)))}>
                {t('Новый рынок')}
              </Button>
              <Button icon="arrowRight" onClick={() => {
                  const others = SCENARIO_ORDER.filter((id) => id !== state.scenarioId);
                  props.onRestart(newGame(others[Math.floor(Math.random() * others.length)], state.difficulty, Math.floor(Math.random() * 1e9)));
                }}>
                {t('Другой сценарий')}
              </Button>
              <Button variant="ghost" icon="eye" onClick={() => setSection('debrief')}>
                {t('Разбор рынка')}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="grid cols-2">
        <Card title={t('Критерии раунда A')} term="seriesA">
          <div className="stack">
            {criteria.map((c) => {
              const actual = c.format === 'money' ? compactMoney(c.actual) : c.format === 'ratio' ? ratio(c.actual) : pct(c.actual);
              const target = c.format === 'money' ? compactMoney(c.target) : c.format === 'ratio' ? fixed(c.target, 1) : pct(c.target, 0);
              return (
                <div key={c.id} className="stack-xs">
                  <div className="row-between text-sm">
                    <span className="row">
                      <span className={`feed-icon ${c.met ? 'good' : 'bad'}`}>
                        <Icon name={c.met ? 'check' : 'x'} size={12} />
                      </span>
                      {c.label}
                    </span>
                    <span className="num">
                      <strong>{actual}</strong> <span className="text-muted">/ {target}</span>
                    </span>
                  </div>
                  <Progress value={Math.min(1, Math.max(0, (c.actual ?? 0) / c.target))} max={1} tone={c.met ? 'success' : 'danger'} />
                </div>
              );
            })}
          </div>
        </Card>
        <Card title={t('Оценка решений по областям')} desc={t('Сумма баллов из журнала решений')}>
          <div className="stack">
            {categories.map((c) => {
              const v = state.score[c];
              return (
                <div key={c} className="score-row">
                  <span className="text-2">{CATEGORY_NAMES[c]}</span>
                  <Progress value={Math.max(0, v + 10)} max={40} tone={v > 5 ? 'success' : v >= 0 ? 'warning' : 'danger'} />
                  <strong className={`num right ${v >= 0 ? 'text-success' : 'text-danger'}`}>
                    {v > 0 ? '+' : ''}
                    {v}
                  </strong>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card title={t('Главные ошибки и что почитать')} desc={t('Решения, которые стоили больше всего баллов')}>
        {mistakes.length === 0 ? (
          <Empty icon="checkCircle" title={t('Серьёзных ошибок не было')} />
        ) : (
          <div className="stack">
            {mistakes.map((m, i) => (
              <div key={i} className="row-top">
                <span className="feed-icon bad">
                  <Icon name="alert" size={12} />
                </span>
                <div className="grow stack-xs">
                  <div className="row-between wrap">
                    <strong className="text-sm">{m.title}</strong>
                    <Badge tone="danger">{m.points}</Badge>
                  </div>
                  <span className="text-sm text-2">{m.text}</span>
                  {m.category && (
                    <div>
                      <Theory article={CATEGORY_ARTICLES[m.category]} label={t('Теория: {0}', [CATEGORY_NAMES[m.category]])} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {checkpoints.length > 0 && (
        <Card title={t('Переиграть с контрольной точки')} desc={t('Вернитесь к важному моменту и попробуйте другое решение. Всё, что было после него, забудется')}>
          <div className="list">
            {checkpoints.map((c) => (
              <div key={`${c.phase}-${c.month}`} className="list-item">
                <span className="feed-icon info">
                  <Icon name="flag" size={12} />
                </span>
                <div className="grow stack-xs">
                  <span className="text-sm text-strong">{checkpointTitle(c)}</span>
                  <span className="text-xs text-muted">
                    {t('{0} · деньги {1} · доверие {2}', [dateLabel(c.week), compactMoney(c.state.cash), Math.round(c.state.trust)])}
                  </span>
                </div>
                <Button
                  size="sm"
                  icon="restart"
                  onClick={() =>
                    confirm({
                      title: t('Переиграть с этого момента?'),
                      text: t('Игра вернётся в состояние «{0}». Итог этой партии уже сохранён в истории.', [checkpointTitle(c)]),
                      confirmLabel: t('Переиграть'),
                      onConfirm: () => props.onRestore(c),
                    })
                  }
                >
                  {t('Переиграть отсюда')}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {state.history.length > 0 && (
        <div className="grid cols-2">
          <Card title={t('MRR по месяцам')}>
            <LineChart labels={monthLabels(state.history)} series={[{ name: 'MRR', color: PALETTE[0], values: state.history.map((r) => r.mrr) }]} format={compactMoney} markers={chartMarkers(state)} />
          </Card>
          <Card title={t('Деньги на счёте')}>
            <LineChart labels={monthLabels(state.history)} series={[{ name: t('Деньги'), color: PALETTE[1], values: state.history.map((r) => r.cash) }]} format={compactMoney} markers={chartMarkers(state)} />
          </Card>
        </div>
      )}
    </>
  );
}

type DebriefTab = 'segments' | 'hypotheses' | 'features' | 'experiments';

function Debrief() {
  const { state } = useGame();
  const sc = scenarioOf(state);
  const [tab, setTab] = useState<DebriefTab>('segments');
  const opp = segmentOpportunity(state);
  const ranked = Object.keys(opp).sort((a, b) => opp[b] - opp[a]);
  const segId = state.strategy?.segmentId ?? '';
  const musts = mustFeatures(sc, segId);
  const features = sc.features
    .filter((f) => !f.tags?.includes('cms'))
    .map((f) => ({ f, v: state.world.featureValue[f.id][segId] ?? 0 }))
    .sort((a, b) => b.v - a.v);

  return (
    <Card bodyClassName="stack">
      <Tabs
        tabs={[
          { id: 'segments', label: t('Сегменты') },
          { id: 'hypotheses', label: t('Гипотезы ({0})', [state.hypotheses.length]) },
          { id: 'features', label: t('Ценность функций') },
          { id: 'experiments', label: t('A/B-тесты ({0})', [state.experiments.length]) },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'segments' && (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Сегмент')}</th>
                  <th className="num">{t('Острота проблемы')}</th>
                  <th className="num">{t('Готовность платить')}</th>
                  <th className="num">{t('Попадание решения')}</th>
                  <th className="num">{t('Отток / мес')}</th>
                  <th className="num">{t('Перспективность')}</th>
                </tr>
              </thead>
              <tbody>
                {sc.segments.map((seg) => {
                  const truth = state.world.segments[seg.id];
                  return (
                    <tr key={seg.id} className={seg.id === segId ? 'is-selected' : ''}>
                      <td>
                        <div className="row">
                          <span className="table-title">{seg.name}</span>
                          {seg.id === segId && <Badge tone="accent">{t('ваш выбор')}</Badge>}
                        </div>
                      </td>
                      <td className="num">{pct(truth.severity, 0)}</td>
                      <td className="num">
                        {money(truth.wtp, 2)}
                        {sc.labels.priceUnit}
                      </td>
                      <td className="num">{pct(truth.fit, 0)}</td>
                      <td className="num">{pct(truth.churn)}</td>
                      <td className="num">
                        <Badge tone={ranked.indexOf(seg.id) === 0 ? 'success' : 'neutral'}>
                          {t('{0}-й из {1}', [ranked.indexOf(seg.id) + 1, ranked.length])}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted">
            {t('Гипотеза о проблеме верна при остроте ≥ 55%, о решении — при попадании ≥ 55%, о цене — если готовность платить не ниже цены гипотезы. Ваша итоговая цена: {0}.', [money(state.pricing.price, 2)])}
          </p>
        </>
      )}

      {tab === 'hypotheses' &&
        (state.hypotheses.length === 0 ? (
          <Empty icon="target" title={t('Вы не сформулировали ни одной гипотезы')} />
        ) : (
          <div className="stack-sm">
            {state.hypotheses.map((h) => {
              const truth = hypothesisTruth(state, h);
              const c = criterionDef(h.criterionId);
              const q = QUALITY[c.quality];
              let verdict = t('не проверена');
              if (h.status !== 'untested') {
                const said = h.status === 'supported';
                verdict = said === truth ? t('верный вывод') : said ? t('ложноположительный результат') : t('ложноотрицательный результат');
              }
              return (
                <div key={h.id} className={`hyp ${verdict === t('верный вывод') ? 'supported' : verdict === t('не проверена') ? '' : 'refuted'}`}>
                  <div className="row-between wrap">
                    <span className="hyp-statement">{hypothesisStatement(sc, h)}</span>
                    <Badge tone={verdict === t('верный вывод') ? 'success' : verdict === t('не проверена') ? 'neutral' : 'danger'}>{verdict}</Badge>
                  </div>
                  <div className="hyp-criterion">
                    <Icon name="target" size={13} />
                    {criterionText(h)}
                  </div>
                  <div className="row wrap">
                    <Badge tone={q.tone}>{q.text}</Badge>
                    <Badge outline>{t('ваш результат: {0}', [STATUS_TEXT[h.status].toLowerCase()])}</Badge>
                    <Badge outline>{t('на самом деле: {0}', [truth ? t('верна') : t('неверна')])}</Badge>
                  </div>
                  <p className="text-sm text-2">{c.lesson}</p>
                </div>
              );
            })}
          </div>
        ))}

      {tab === 'features' && (
        <p className="text-sm text-2">
          {t('Сравните реальную ценность функций с запросами во входящих: громкие просьбы часто не совпадают с тем, что удерживает клиентов.')}
        </p>
      )}
      {tab === 'features' && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('Функция для сегмента «{0}»', [sc.segments.find((x) => x.id === segId)?.short ?? ''])}</th>
                <th>{t('Реальная ценность')}</th>
                <th>{t('Категория Кано')}</th>
                <th className="num">{t('Ваша оценка')}</th>
                <th className="num">{t('Запросов во входящих')}</th>
                <th>{t('Статус')}</th>
              </tr>
            </thead>
            <tbody>
              {features.map(({ f, v }) => {
                const p = state.product.features[f.id];
                return (
                  <tr key={f.id}>
                    <td className="table-title">{f.name}</td>
                    <td style={{ minWidth: 140 }}>
                      <Progress value={v} max={1.5} tone={v > 0.9 ? 'success' : v > 0.5 ? 'info' : 'warning'} />
                    </td>
                    <td className="text-sm">{musts.includes(f.id) ? KANO.must : KANO[f.kano]}</td>
                    <td className="num">{featureInsight(state, f.id).impact ?? '?'}</td>
                    <td className="num">{state.inbox.filter((m) => m.featureId === f.id).length || '—'}</td>
                    <td>{p?.shipped ? <Badge tone="success">{t('выпущена')}</Badge> : p?.completed ? <Badge tone="info">{t('готова')}</Badge> : state.mvpScope.includes(f.id) ? <Badge>{t('в MVP')}</Badge> : null}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'experiments' &&
        (state.experiments.length === 0 ? (
          <Empty icon="split" title={t('Вы не провели ни одного A/B-теста')} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Тест')}</th>
                  <th className="num">{t('Наблюдали')}</th>
                  <th className="num">p-value</th>
                  <th className="num">{t('Реальный эффект')}</th>
                  <th>{t('Решение')}</th>
                </tr>
              </thead>
              <tbody>
                {state.experiments.map((e) => {
                  const idea = ideaDef(state, e.ideaId);
                  const real = idea.priceMult ? (1 + e.trueEffect) * idea.priceMult - 1 : e.trueEffect;
                  const novelty = state.world.experiments[idea.id]?.novelty ?? 0;
                  return (
                    <tr key={e.id}>
                      <td>
                        <div className="table-title">{idea.name}</div>
                        {idea.priceMult && <div className="table-sub">{t('для цены — эффект на выручку с пользователя')}</div>}
                        {idea.guardrail && <div className="table-sub">{t('скрытый побочный эффект: {0} к другой метрике', [signedPct(idea.guardrail.effect, 0)])}</div>}
                        {novelty > 0.01 && <div className="table-sub">{t('эффект новизны: {0} в первые недели', [signedPct(novelty, 0)])}</div>}
                      </td>
                      <td className="num">{signedPct(e.result?.uplift)}</td>
                      <td className="num">{e.result ? fixed(e.result.pValue, 3) : '—'}</td>
                      <td className={`num text-strong ${real > 0.005 ? 'text-success' : real < -0.005 ? 'text-danger' : ''}`}>{signedPct(real)}</td>
                      <td>
                        <Badge tone={e.status === 'shipped' ? 'success' : 'neutral'}>
                          {e.status === 'shipped' ? t('внедрён') : e.status === 'rejected' ? t('отклонён') : e.status === 'running' ? t('не завершён') : t('без решения')}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
    </Card>
  );
}

function LogSection() {
  const { state } = useGame();
  return (
    <Card title={t('Журнал решений')} desc={t('Каждое оценённое решение с объяснением')}>
      <LogList entries={state.log.filter((e) => e.points !== undefined || e.tone === 'bad' || e.tone === 'good')} />
    </Card>
  );
}
