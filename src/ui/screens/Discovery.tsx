import { useState } from 'react';
import { CRITERIA, HYPOTHESIS_KIND_HINTS, HYPOTHESIS_KIND_NAMES, RESEARCH_METHODS, RESEARCH_SLOTS, researchPlan } from '../../data/research.ts';
import { ceoStyle, marketCondition } from '../../data/context.ts';
import { channelDef, monthlyPayroll, scenarioOf, segmentDef } from '../../engine/catalog.ts';
import { researchHours } from '../../engine/potime.ts';
import { criterionThresholds, smokeChannels, validateResearch } from '../../engine/research.ts';
import type { HypothesisKind, ResearchMethod, ResearchParams, ResearchReport } from '../../engine/types.ts';
import { compactMoney, fixed, money } from '../../format.ts';
import { Hint } from '../components/Hint.tsx';
import { Icon } from '../components/Icon.tsx';
import type { IconName } from '../components/Icon.tsx';
import { TurnSummary } from '../components/TurnSummary.tsx';
import { Badge, Button, Callout, Card, Empty, Field, Inline, Kpi, Modal, Segmented, Theory, TurnBar } from '../components/common.tsx';
import { useGame } from '../context.ts';
import type { GlossaryId } from '../glossary.ts';
import { TeamPanel } from '../panels/TeamPanel.tsx';
import { criterionText, hypothesisStatement, observedText, STATUS_TEXT } from '../texts.ts';
import { t } from '../../i18n/index.ts';

const METHOD_TERMS: Record<ResearchMethod, GlossaryId> = {
  desk: 'desk',
  competitors: 'competitors',
  expert: 'expertInterviews',
  interviews: 'custdev',
  survey: 'survey',
  smoke: 'smoke',
  prototype: 'prototype',
  concierge: 'concierge',
};

export const METHOD_ICONS: Record<ResearchMethod, IconName> = {
  desk: 'globe',
  competitors: 'eye',
  expert: 'briefcase',
  interviews: 'message',
  survey: 'file',
  smoke: 'megaphone',
  prototype: 'layers',
  concierge: 'heart',
};

const SEGMENT_COLORS = ['#6366f1', '#14b8a6', '#f59e0b', '#f43f5e'];

export function DiscoveryScreen() {
  const { state, dispatch, section } = useGame();
  const weekly = monthlyPayroll(state) / 4;
  const active = state.activeResearch.length;

  return (
    <div className="stack-lg">
      {section === 'board' && <Board />}
      {section === 'reports' && <Reports reports={state.reports} />}
      {section === 'segments' && <Segments />}
      {section === 'team' && (
        <>
          <TeamPanel />
        </>
      )}

      <TurnBar
        stats={[
          { label: t('Неделя'), value: `${state.week + 1}` },
          { label: t('Стоимость недели'), value: compactMoney(weekly) },
          { label: t('Исследования'), value: t('{0} из {1}', [active, RESEARCH_SLOTS]) },
        ]}
        note={active > 0 ? t('Результаты придут, когда закончится срок исследования.') : t('Запустите исследование или завершите discovery.')}
      >
        <Button disabled={active > 0} title={active > 0 ? t('Дождитесь завершения текущих исследований') : undefined} onClick={() => dispatch({ type: 'finish_discovery' })}>
          {t('Перейти к стратегии')}
        </Button>
        <Button variant="primary" iconRight="arrowRight" onClick={() => dispatch({ type: 'next_week' })}>
          {t('Следующая неделя')}
        </Button>
      </TurnBar>
    </div>
  );
}

function Board() {
  const { state } = useGame();
  const tested = state.hypotheses.filter((h) => h.status !== 'untested');
  const supported = tested.filter((h) => h.status === 'supported').length;

  return (
    <>

      <TurnSummary title={t('Итоги недели')} />

      <div className="kpi-grid">
        <Kpi label={t('Гипотез на доске')} term="hypothesis" value={state.hypotheses.length} foot={t('проверено {0}', [tested.length])} />
        <Kpi label={t('Подтверждено')} value={supported} tone={supported > 0 ? 'success' : undefined} />
        <Kpi label={t('Опровергнуто')} value={tested.length - supported} />
        <Kpi label={t('Отчётов')} value={state.reports.length} foot={state.reports.length > 0 ? t('в разделе «Отчёты»') : t('пока нет')} />
      </div>

      <ResearchBoard reportsSection="reports" />
    </>
  );
}

// Hypotheses, running research and research methods. Used before and after launch.
export function ResearchBoard(props: { reportsSection?: string }) {
  const { state, setSection } = useGame();
  const [newHypothesis, setNewHypothesis] = useState(false);
  const [method, setMethod] = useState<ResearchMethod | null>(null);
  const sc = scenarioOf(state);

  return (
    <>
      {state.activeResearch.length > 0 && (
        <div className="running-grid">
          {state.activeResearch.map((r) => {
            const def = RESEARCH_METHODS.find((m) => m.id === r.method);
            const total = r.endWeek - r.startWeek;
            const left = r.endWeek - state.week;
            return (
              <div key={r.id} className="running">
                <span className="spinner" />
                <div className="grow">
                  <div className="text-strong text-sm">{def?.name}</div>
                  <div className="text-xs text-muted">
                    {r.params.segmentId ? segmentDef(sc, r.params.segmentId).name : t('Весь рынок')} · {money(r.cost)}
                  </div>
                </div>
                <Badge tone="accent">{left > 0 ? t('ещё {0} из {1} нед.', [left, total]) : t('в конце хода')}</Badge>
              </div>
            );
          })}
        </div>
      )}

      <Card
        title={t('Доска гипотез')}
        term="hypothesis"
        desc={t('Что вы предполагаете и как поймёте, что правы')}
        actions={
          <Button variant="primary" size="sm" icon="plus" onClick={() => setNewHypothesis(true)}>
            {t('Гипотеза')}
          </Button>
        }
      >
        {state.hypotheses.length === 0 ? (
          <Empty
            icon="target"
            title={t('Гипотез пока нет')}
            action={
              <Button size="sm" icon="plus" onClick={() => setNewHypothesis(true)}>
                {t('Сформулировать первую')}
              </Button>
            }
          >
            {t('Начните с самых рискованных допущений: есть ли проблема и готовы ли платить. Критерий успеха задаётся до исследования.')}
          </Empty>
        ) : (
          <div className="hyp-grid">
            {state.hypotheses.map((h) => (
              <HypothesisCard key={h.id} id={h.id} />
            ))}
          </div>
        )}
      </Card>

      <Card
        title={t('Методы исследования')}
        help={t('Каждый метод отвечает на свой вопрос и стоит денег и времени. Слова людей (интервью, опросы) дешевле, но менее надёжны, чем действия (smoke-тест, консьерж-MVP).')}
        desc={t('Параллельно можно вести {0} исследования. Выберите метод, чтобы настроить его', [RESEARCH_SLOTS])}
        actions={
          state.reports.length > 0 && props.reportsSection ? (
            <Button size="sm" variant="ghost" iconRight="arrowRight" onClick={() => setSection(props.reportsSection ?? '')}>
              {t('Отчёты ({0})', [state.reports.length])}
            </Button>
          ) : undefined
        }
      >
        <div className="method-grid">
          {RESEARCH_METHODS.map((m) => {
            const plan = researchPlan(m.id, { count: m.id === 'survey' ? 100 : 5, budget: 1000 }, sc.kind === 'b2b');
            return (
              <button key={m.id} type="button" className="method" onClick={() => setMethod(m.id)}>
                <div className="row-between">
                  <span className="method-icon">
                    <Icon name={METHOD_ICONS[m.id]} size={17} />
                  </span>
                  <Hint term={METHOD_TERMS[m.id]} />
                </div>
                <div className="method-title">{m.name}</div>
                <div className="method-text">{m.measures}</div>
                <span className="meta">
                  <Icon name="clock" size={12} />
                  {t('от {0} нед. · от {1} · {2} ч', [plan.weeks, compactMoney(plan.cost), researchHours(m.id, m.id === 'survey' ? 100 : 5)])}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {newHypothesis && <HypothesisModal onClose={() => setNewHypothesis(false)} />}
      {method && <ResearchModal method={method} onClose={() => setMethod(null)} />}
    </>
  );
}

function HypothesisCard(props: { id: string }) {
  const { state, dispatch } = useGame();
  const sc = scenarioOf(state);
  const h = state.hypotheses.find((x) => x.id === props.id);
  if (!h) return null;
  return (
    <div className={`hyp ${h.status}`}>
      <div className="row-between">
        <Badge tone="accent">{HYPOTHESIS_KIND_NAMES[h.kind]}</Badge>
        <div className="row">
          <Badge tone={h.status === 'supported' ? 'success' : h.status === 'refuted' ? 'danger' : 'neutral'} dot>
            {STATUS_TEXT[h.status]}
          </Badge>
          {h.status === 'untested' && <Button variant="ghost" size="sm" icon="x" onClick={() => dispatch({ type: 'remove_hypothesis', id: h.id })} aria-label={t('Удалить гипотезу')} />}
        </div>
      </div>
      <div className="hyp-statement">{hypothesisStatement(sc, h)}</div>
      <div className="hyp-criterion">
        <Icon name="target" size={13} />
        <span>
          {criterionText(h)}
          {h.kind === 'wtp' && h.price ? t(' · цена {0}', [money(h.price)]) : ''}
        </span>
      </div>
      {h.status !== 'untested' && <div className="text-sm text-strong">{observedText(h)}</div>}
    </div>
  );
}

function HypothesisModal(props: { onClose: () => void }) {
  const { state, dispatch } = useGame();
  const sc = scenarioOf(state);
  const [kind, setKind] = useState<HypothesisKind>('problem');
  const [segmentId, setSegmentId] = useState(sc.segments[0].id);
  const [channelId, setChannelId] = useState(smokeChannels(sc)[0]);
  const [price, setPrice] = useState(sc.defaultPrice);
  const criteria = CRITERIA.filter((c) => c.kind === kind);
  const [criterionId, setCriterionId] = useState(criteria[0].id);
  const criterion = criteria.find((c) => c.id === criterionId) ?? criteria[0];
  const thresholds = criterionThresholds(sc, criterion);
  const [threshold, setThreshold] = useState<number | null>(null);
  const chosen = threshold !== null && thresholds.includes(threshold) ? threshold : (thresholds[Math.floor(thresholds.length / 2)] ?? 0);
  const draft = { id: '', kind, segmentId, channelId, price, criterionId: criterion.id, threshold: chosen, status: 'untested' as const, createdWeek: 0 };

  const duplicate = state.hypotheses.some(
    (h) => h.kind === kind && h.segmentId === segmentId && h.criterionId === criterion.id && h.threshold === chosen && (kind !== 'wtp' || h.price === price) && (kind !== 'channel' || h.channelId === channelId),
  );
  const add = () => {
    dispatch({
      type: 'add_hypothesis',
      hypothesis: { kind, segmentId, criterionId: criterion.id, threshold: chosen, channelId: kind === 'channel' ? channelId : undefined, price: kind === 'wtp' ? price : undefined },
    });
    props.onClose();
  };

  return (
    <Modal
      size="lg"
      title={t('Новая гипотеза')}
      desc={t('Хорошая гипотеза опровергаема: у неё есть метрика, порог и способ проверки')}
      onClose={props.onClose}
      footer={
        <>
          <Button onClick={props.onClose}>{t('Отмена')}</Button>
          {duplicate && <span className="grow text-sm text-warning">{t('Такая гипотеза уже есть на доске')}</span>}
          <Button variant="primary" icon="plus" disabled={duplicate} onClick={add}>
            {t('Добавить на доску')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <Field label={t('Что проверяем')} term="hypothesis" hint={HYPOTHESIS_KIND_HINTS[kind]}>
          <Segmented
            options={(Object.keys(HYPOTHESIS_KIND_NAMES) as HypothesisKind[]).map((k) => ({ id: k, label: HYPOTHESIS_KIND_NAMES[k] }))}
            value={kind}
            onChange={(k) => {
              setKind(k);
              setCriterionId(CRITERIA.filter((c) => c.kind === k)[0].id);
              setThreshold(null);
            }}
          />
        </Field>
        <div className="grid cols-2">
          <Field label={t('Сегмент')} term="segment">
            <select className="select" value={segmentId} onChange={(e) => setSegmentId(e.target.value)}>
              {sc.segments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          {kind === 'channel' && (
            <Field label={t('Канал')}>
              <select className="select" value={channelId} onChange={(e) => setChannelId(e.target.value)}>
                {smokeChannels(sc).map((id) => (
                  <option key={id} value={id}>
                    {channelDef(sc, id).name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {kind === 'wtp' && (
            <Field label={t('Цена')}>
              <select className="select" value={price} onChange={(e) => setPrice(Number(e.target.value))}>
                {sc.priceOptions.map((p) => (
                  <option key={p} value={p}>
                    {money(p)}
                    {sc.labels.priceUnit}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
        <Field label={t('Критерий успеха — как поймём, что гипотеза верна')} term="criterion" hint={t('Чем больше критерий опирается на поведение, а не на мнения, тем ему можно доверять')}>
          <select
            className="select"
            value={criterion.id}
            onChange={(e) => {
              setCriterionId(e.target.value);
              setThreshold(null);
            }}
          >
            {criteria.map((c) => (
              <option key={c.id} value={c.id}>
                {c.template.replace('{t}', 'N')}
              </option>
            ))}
          </select>
        </Field>
        {thresholds.length > 1 && (
          <Field label={t('Порог')} term="threshold">
            <Segmented
              options={thresholds.map((v) => ({ id: v, label: criterion.unit === '$' ? money(v) : `${fixed(v, v % 1 ? 1 : 0)}${criterion.unit}` }))}
              value={chosen}
              onChange={setThreshold}
            />
          </Field>
        )}
        <div className="callout callout-info">
          <Icon name="target" size={16} />
          <div className="stack-xs">
            <span className="callout-title">{hypothesisStatement(sc, draft)}</span>
            <span>{t('Мы поймём, что правы, если: {0}.', [criterionText({ criterionId: criterion.id, threshold: chosen })])}</span>
            <span className="text-xs text-muted row" style={{ gap: 0 }}>
              {t('Проверяется методом «{0}»', [RESEARCH_METHODS.find((m) => m.id === criterion.method)?.name ?? ''])}
              <Hint term={METHOD_TERMS[criterion.method]} />
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
}

const SCRIPT_EXAMPLES = {
  open: t('«Расскажите, как вы решали эту задачу в последний раз. Что пробовали? Сколько это стоило? Что было самым неудобным?»'),
  leading: t('«Вам бы пригодилось приложение, которое решает эту проблему? Вы бы платили за него?»'),
};

function ResearchModal(props: { method: ResearchMethod; onClose: () => void }) {
  const { state, dispatch } = useGame();
  const sc = scenarioOf(state);
  const def = RESEARCH_METHODS.find((m) => m.id === props.method);
  const [params, setParams] = useState<ResearchParams>({
    segmentId: sc.segments[0].id,
    count: props.method === 'survey' ? 300 : 10,
    script: 'open',
    channelId: smokeChannels(sc)[0],
    budget: 2500,
    price: sc.defaultPrice,
  });
  if (!def) return null;
  // Market-wide methods must not carry a segment, or reports get a misleading title.
  const sent: ResearchParams = def?.needsSegment ? params : { ...params, segmentId: undefined };
  const plan = researchPlan(props.method, sent, sc.kind === 'b2b');
  const error = validateResearch(state, props.method, sent);
  const set = (patch: Partial<ResearchParams>) => setParams({ ...params, ...patch });

  return (
    <Modal
      size="lg"
      onClose={props.onClose}
      header={
        <div className="row-top gap-lg">
          <span className="method-icon">
            <Icon name={METHOD_ICONS[props.method]} size={18} />
          </span>
          <div className="stack-xs grow">
            <h2 className="modal-title">{def.name}</h2>
            <p className="modal-desc">{def.description}</p>
          </div>
        </div>
      }
      footer={
        <>
          <span className="grow text-sm text-muted">
            {t('{0} · {1} нед.', [money(plan.cost), plan.weeks])}
          </span>
          <Button onClick={props.onClose}>{t('Отмена')}</Button>
          <Button
            variant="primary"
            icon="play"
            disabled={!!error}
            onClick={() => {
              dispatch({ type: 'start_research', method: props.method, params: sent });
              props.onClose();
            }}
          >
            {t('Запустить')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <div className="row wrap">
          <Badge outline>{t('Даёт: {0}', [def.measures])}</Badge>
          <Hint term={METHOD_TERMS[props.method]} />
          <Theory article={def.article} />
        </div>
        {def.needsSegment && (
          <Field label={t('Сегмент')} term="segment">
            <select className="select" value={params.segmentId} onChange={(e) => set({ segmentId: e.target.value })}>
              {sc.segments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {props.method === 'interviews' && (
          <>
            <Field label={t('Количество интервью')} help={t('Больше интервью — точнее вывод, но дороже и дольше. 5 интервью дают сильный разброс, 15 — уже заметные закономерности.')}>
              <Segmented options={[5, 10, 15].map((n) => ({ id: n, label: `${n}` }))} value={params.count ?? 10} onChange={(count) => set({ count })} />
            </Field>
            <div className="field">
              <span className="label">
                {t('Сценарий вопросов')}
                <Hint term="leadingQuestions" />
              </span>
              <div className="stack-sm">
                {(['open', 'leading'] as const).map((id, i) => (
                  <button key={id} type="button" className={`option ${params.script === id ? 'selected' : ''}`} onClick={() => set({ script: id })}>
                    <div className="option-head">
                      <div className="option-title">{t('Вариант {0}', [i === 0 ? 'A' : 'B'])}</div>
                      <span className="radio-dot" />
                    </div>
                    <div className="option-text">{SCRIPT_EXAMPLES[id]}</div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        {props.method === 'survey' && (
          <Field label={t('Размер выборки')} help={t('Больше респондентов — меньше случайная погрешность. Но опрос всё равно измеряет слова, а не поведение.')}>
            <Segmented options={[100, 300, 1000].map((n) => ({ id: n, label: t('{0} респондентов', [n]) }))} value={params.count ?? 300} onChange={(count) => set({ count })} />
          </Field>
        )}
        {props.method === 'smoke' && (
          <div className="grid cols-2">
            <Field label={t('Рекламный канал для трафика')} help={t('Канал, из которого придут люди на лендинг. Покажет стоимость лида (CPL) — ориентир будущей стоимости привлечения.')}>
              <select className="select" value={params.channelId} onChange={(e) => set({ channelId: e.target.value })}>
                {smokeChannels(sc).map((id) => (
                  <option key={id} value={id}>
                    {channelDef(sc, id).name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('Рекламный бюджет')} help={t('Больше бюджет — больше посетителей и точнее конверсия, но дороже. $2 500 обычно хватает для первого вывода.')}>
              <Segmented options={[1000, 2500, 5000].map((b) => ({ id: b, label: compactMoney(b) }))} value={params.budget ?? 2500} onChange={(budget) => set({ budget })} />
            </Field>
          </div>
        )}
        {(props.method === 'smoke' || props.method === 'concierge') && (
          <Field label={t('Цена в оффере')} term="fakeDoor" hint={t('Должна совпадать с ценой гипотезы о готовности платить, чтобы её проверить')}>
            <select className="select" value={params.price} onChange={(e) => set({ price: Number(e.target.value) })}>
              {sc.priceOptions.map((p) => (
                <option key={p} value={p}>
                  {money(p)}
                  {sc.labels.priceUnit}
                </option>
              ))}
            </select>
          </Field>
        )}
        <dl className="kv">
          <dt>{t('Стоимость')}</dt>
          <dd>{money(plan.cost)}</dd>
          <dt>{t('Длительность')}</dt>
          <dd>{t('{0} нед.', [plan.weeks])}</dd>
          <dt>{t('Останется денег')}</dt>
          <dd>{compactMoney(state.cash - plan.cost)}</dd>
          <dt>{t('Ваше время')}</dt>
          <dd>{t('{0} ч (осталось {1} ч)', [researchHours(props.method, sent.count), Math.round(state.poHours)])}</dd>
        </dl>
        {error && <Callout tone="warning">{error}</Callout>}
      </div>
    </Modal>
  );
}

function Segments() {
  const { state } = useGame();
  const sc = scenarioOf(state);
  const market = marketCondition(state.world.market);
  const ceo = ceoStyle(state.world.ceo);
  return (
    <>
      <Card title={t('Условия этой партии')} help={t('Каждая партия получает случайную обстановку на рынке и характер CEO. Они меняют стоимость рекламы, готовность платить, отток и то, как CEO реагирует на ваши решения.')}>
        <div className="grid cols-2">
          <div className="row-top">
            <span className="method-icon">
              <Icon name="globe" size={16} />
            </span>
            <div className="stack-xs">
              <strong className="text-sm">{t('Рынок: {0}', [market.title])}</strong>
              <span className="text-sm text-2">{market.text}</span>
            </div>
          </div>
          <div className="row-top">
            <span className="method-icon">
              <Icon name="building" size={16} />
            </span>
            <div className="stack-xs">
              <strong className="text-sm">
                CEO {sc.ceoName}: {ceo.title}
              </strong>
              <span className="text-sm text-2">{ceo.text}</span>
            </div>
          </div>
        </div>
      </Card>
      <div className="grid cols-2">
        {sc.segments.map((seg, i) => {
          const size = state.knowledge.marketSize[seg.id];
          const hyps = state.hypotheses.filter((h) => h.segmentId === seg.id);
          const reports = state.reports.filter((r) => r.params.segmentId === seg.id).length;
          const supported = hyps.filter((h) => h.status === 'supported').length;
          const refuted = hyps.filter((h) => h.status === 'refuted').length;
          return (
            <div key={seg.id} className="persona">
              <div className="row">
                <span className="persona-avatar" style={{ background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}>
                  {seg.short[0]}
                </span>
                <div className="grow">
                  <div className="text-strong">{seg.name}</div>
                  <div className="text-xs text-muted">
                    {size ? t('TAM ≈ {0} млн {1}', [fixed(size / 1e6, size < 1e6 ? 2 : 1), sc.kind === 'b2b' ? t('компаний') : t('человек')]) : t('Размер рынка неизвестен')}
                  </div>
                </div>
              </div>
              <p className="text-sm text-2">{seg.persona}</p>
              <div className="row wrap">
                <Badge outline>{t('Гипотез: {0}', [hyps.length])}</Badge>
                <Badge outline>{t('Исследований: {0}', [reports])}</Badge>
                {supported > 0 && <Badge tone="success">{t('подтверждено {0}', [supported])}</Badge>}
                {refuted > 0 && <Badge tone="danger">{t('опровергнуто {0}', [refuted])}</Badge>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function Reports(props: { reports: ResearchReport[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (props.reports.length === 0) {
    return (
      <Empty icon="file" title={t('Отчётов пока нет')}>
        {t('Запустите исследование на доске — отчёт появится здесь, когда оно закончится.')}
      </Empty>
    );
  }
  const list = [...props.reports].reverse();
  const current = open ?? list[0]?.id;
  return (
    <div className="stack-sm">
      {list.map((r) => (
        <div key={r.id} className="accordion-item">
          <button type="button" className="accordion-head" onClick={() => setOpen(current === r.id ? '' : r.id)}>
            <span className="method-icon">
              <Icon name={METHOD_ICONS[r.method]} size={16} />
            </span>
            <span className="grow">
              <div className="text-strong">{r.title}</div>
              <div className="text-xs text-muted">{t('Неделя {0}', [r.week + 1])}</div>
            </span>
            <Icon name={current === r.id ? 'chevronUp' : 'chevronDown'} size={16} />
          </button>
          {current === r.id && (
            <div className="accordion-body">
              {r.metrics.length > 0 && (
                <div className="grid cols-auto" style={{ gap: 10 }}>
                  {r.metrics.map((m) => (
                    <div key={m.label} className="kpi inset sm">
                      <div className="kpi-label">{m.label}</div>
                      <div className="text-strong" style={{ fontSize: m.value.length > 40 ? 13 : 16 }}>
                        {m.value}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {r.summary.length > 0 && (
                <ul className="bullets">
                  {r.summary.map((line, i) => (
                    <li key={i}>
                      <span>
                        <Inline text={line} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {r.quotes.length > 0 && (
                <div className="stack-sm">
                  <span className="eyebrow">{t('Цитаты')}</span>
                  {r.quotes.map((q, i) => (
                    <blockquote key={i} className="quote">
                      {q}
                    </blockquote>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
