import type { ReactNode } from 'react';
import { Fragment, useState } from 'react';
import { HYPOTHESIS_KIND_NAMES } from '../../data/research.ts';
import { scenarioOf } from '../../engine/catalog.ts';
import type { ObservationKey, Pricing, ResearchMethod } from '../../engine/types.ts';
import { fixed, money, pct } from '../../format.ts';
import { Icon } from '../components/Icon.tsx';
import { Badge, Button, Card, Choice, Field, Switch, TurnBar } from '../components/common.tsx';
import { Hint } from '../components/Hint.tsx';
import { useGame } from '../context.ts';
import type { GlossaryId } from '../glossary.ts';
import { STATUS_TEXT } from '../texts.ts';
import { t } from '../../i18n/index.ts';

const EVIDENCE: { method: ResearchMethod; key: ObservationKey; label: string; unit: '%' | '$'; term: GlossaryId }[] = [
  { method: 'interviews', key: 'painShare', label: t('Интервью: описали проблему'), unit: '%', term: 'custdev' },
  { method: 'survey', key: 'surveyPainShare', label: t('Опрос: острота 4–5'), unit: '%', term: 'survey' },
  { method: 'survey', key: 'vwAcceptable', label: t('Опрос: приемлемая цена'), unit: '$', term: 'vanWestendorp' },
  { method: 'smoke', key: 'smokeCr', label: t('Smoke: конверсия в email'), unit: '%', term: 'smoke' },
  { method: 'smoke', key: 'fakeDoorRate', label: t('Fake door: клики «Купить»'), unit: '%', term: 'fakeDoor' },
  { method: 'smoke', key: 'smokeCpl', label: 'Smoke: CPL', unit: '$', term: 'cpl' },
  { method: 'prototype', key: 'prototypeSuccess', label: t('Прототип: успех сценария'), unit: '%', term: 'prototype' },
  { method: 'concierge', key: 'conciergeActive', label: t('Консьерж: активны на 4-й нед.'), unit: '%', term: 'concierge' },
  { method: 'concierge', key: 'conciergePaid', label: t('Консьерж: заплатили'), unit: '%', term: 'concierge' },
];

function Step(props: { n: number; title: string; desc: string; done: boolean; term?: GlossaryId; children: ReactNode; actions?: ReactNode }) {
  return (
    <Card
      term={props.term}
      title={
        <>
          <span className="timeline-num" style={props.done ? { background: 'var(--success)', color: '#fff' } : undefined}>
            {props.done ? <Icon name="check" size={12} strokeWidth={3} /> : props.n}
          </span>
          {props.title}
        </>
      }
      desc={props.desc}
      actions={props.actions}
    >
      {props.children}
    </Card>
  );
}

export function StrategyScreen() {
  const { state, dispatch } = useGame();
  const sc = scenarioOf(state);
  const [segmentId, setSegmentId] = useState<string | null>(null);
  const [valuePropId, setValuePropId] = useState<string | null>(null);
  const [northStarId, setNorthStarId] = useState<string | null>(null);
  const [pricing, setPricing] = useState<Pricing>(state.pricing);
  const ready = segmentId && valuePropId && northStarId;
  const confirm = () => {
    if (ready) dispatch({ type: 'confirm_strategy', strategy: { segmentId, valuePropId, northStarId }, pricing });
  };
  const seg = sc.segments.find((s) => s.id === segmentId);
  const vp = sc.valueProps.find((v) => v.id === valuePropId);
  const ns = sc.northStars.find((n) => n.id === northStarId);
  const model = sc.pricingModels.find((m) => m.id === pricing.model);

  return (
    <div className="stack-lg">

      <div className="split">
        <div className="stack">
          <Step n={1} term="segment" title={t('Целевой сегмент')} desc={t('Под каждым сегментом — всё, что вы о нём узнали')} done={!!segmentId}>
            <Choice
              wide
              value={segmentId}
              onChange={setSegmentId}
              options={sc.segments.map((s) => {
                const hyps = state.hypotheses.filter((h) => h.segmentId === s.id && h.status !== 'untested');
                const evidence = EVIDENCE.flatMap((e) => {
                  const report = [...state.reports].reverse().find((r) => r.method === e.method && r.params.segmentId === s.id && r.observations[e.key] !== undefined);
                  if (!report) return [];
                  const v = report.observations[e.key] ?? 0;
                  const extra = e.method === 'interviews' && report.params.script === 'leading' ? t(' (вариант B)') : '';
                  return [{ label: e.label + extra, term: e.term, value: e.unit === '$' ? money(v) : `${fixed(v, 1)}%` }];
                });
                return {
                  id: s.id,
                  title: s.name,
                  text: s.persona,
                  foot:
                    hyps.length === 0 && evidence.length === 0 ? (
                      <span className="text-muted">{t('Нет данных исследований')}</span>
                    ) : (
                      <div className="stack-sm">
                        {hyps.map((h) => (
                          <div key={h.id} className="row-top">
                            <Badge tone={h.status === 'supported' ? 'success' : 'danger'} dot>
                              {STATUS_TEXT[h.status]}
                            </Badge>
                            <span className="text-xs">{HYPOTHESIS_KIND_NAMES[h.kind]}</span>
                          </div>
                        ))}
                        {evidence.length > 0 && (
                          <dl className="kv text-xs">
                            {evidence.map((e) => (
                              <Fragment key={e.label}>
                                <dt>
                                  {e.label}
                                  <Hint term={e.term} />
                                </dt>
                                <dd>{e.value}</dd>
                              </Fragment>
                            ))}
                          </dl>
                        )}
                      </div>
                    ),
                };
              })}
            />
          </Step>

          <Step n={2} term="valueProp" title={t('Ценностное предложение')} desc={t('Что вы обещаете сегменту. Влияет на CTR рекламы и активацию')} done={!!valuePropId}>
            <Choice options={sc.valueProps.map((v) => ({ id: v.id, title: v.title, text: v.text }))} value={valuePropId} onChange={setValuePropId} wide />
          </Step>

          <Step n={3} term="northStar" title="North Star Metric" desc={t('Одна метрика, которая отражает ценность для пользователя и ведёт к выручке')} done={!!northStarId}>
            <Choice options={sc.northStars.map((n) => ({ id: n.id, title: n.title }))} value={northStarId} onChange={setNorthStarId} wide />
          </Step>

          <Step n={4} term="pricingModel" title={t('Монетизация')} desc={t('Модель, цена и годовой план')} done>
            <div className="stack">
              <Choice
                options={sc.pricingModels.map((m) => ({
                  id: m.id,
                  title: m.name,
                  text: m.description,
                  foot: m.needsRole ? t('Нужен менеджер по продажам в команде') : undefined,
                }))}
                value={pricing.model}
                onChange={(id) => setPricing({ ...pricing, model: id })}
              />
              <div className="grid cols-2">
                <Field label={t('Цена')} help={t('Цена в месяц. Ориентируйтесь на готовность платить из исследований и цены конкурентов: слишком высокая режет конверсию, слишком низкая — LTV.')} hint={state.knowledge.competitorsKnown ? t('Конкуренты: {0}', [sc.competitors.map((c) => c.price).join(' · ')]) : t('Цены конкурентов покажет их анализ')}>
                  <select className="select" value={pricing.price} onChange={(e) => setPricing({ ...pricing, price: Number(e.target.value) })}>
                    {sc.priceOptions.map((p) => (
                      <option key={p} value={p}>
                        {money(p)}
                        {sc.labels.priceUnit}
                      </option>
                    ))}
                  </select>
                </Field>
                <Switch
                  checked={pricing.annual}
                  onChange={(annual) => setPricing({ ...pricing, annual })}
                  term="annualPlan"
                  label={t('Годовой план со скидкой {0}', [pct(sc.annualDiscount, 0)])}
                  desc={t('Меньше отток, но ниже средний чек')}
                />
              </div>
            </div>
          </Step>
        </div>

        <div className="sticky">
          <Card title={t('Ваша стратегия')} desc={t('Проверьте перед утверждением')}>
            <div className="stack">
              {[
                { label: t('Сегмент'), value: seg?.name },
                { label: t('Ценностное предложение'), value: vp?.title },
                { label: 'North Star', value: ns?.title },
                { label: t('Монетизация'), value: model ? `${model.name} · ${money(pricing.price)}${sc.labels.priceUnit}${pricing.annual ? t(' · есть годовой план') : ''}` : undefined },
              ].map((row) => (
                <div key={row.label} className="row-top">
                  <span className={`feed-icon ${row.value ? 'good' : ''}`}>
                    <Icon name={row.value ? 'check' : 'clock'} size={12} />
                  </span>
                  <div className="stack-xs grow">
                    <span className="text-xs text-muted">{row.label}</span>
                    <span className={row.value ? 'text-sm text-strong' : 'text-sm text-muted'}>{row.value ?? t('не выбрано')}</span>
                  </div>
                </div>
              ))}
              <hr className="divider" />
              <p className="text-xs text-muted">{t('После утверждения вернуться к исследованиям будет нельзя. Сегмент можно поменять позже через пивот — это дорого.')}</p>
              <Button variant="primary" block disabled={!ready} onClick={confirm}>
                {t('Утвердить стратегию')}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <TurnBar note={t('Стратегия не занимает игрового времени.')}>
        <Button icon="arrowLeft" onClick={() => dispatch({ type: 'back_to_discovery' })}>
          {t('К исследованиям')}
        </Button>
        <Button variant="primary" iconRight="arrowRight" disabled={!ready} onClick={confirm}>
          {t('Утвердить стратегию')}
        </Button>
      </TurnBar>
    </div>
  );
}
