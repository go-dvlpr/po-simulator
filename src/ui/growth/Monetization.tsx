import { useState } from 'react';
import { scenarioOf, storeFee, techSum } from '../../engine/catalog.ts';
import { funnelRates, productContext } from '../../engine/product.ts';
import { fixed, money, num, pct } from '../../format.ts';
import { Button, Callout, Card, Choice, Field, Kpi, Switch, Theory } from '../components/common.tsx';
import { useGame } from '../context.ts';
import { t } from '../../i18n/index.ts';

export function MonetizationTab() {
  const { state, dispatch, confirm } = useGame();
  const sc = scenarioOf(state);
  const last = state.history[state.history.length - 1];
  const [segmentId, setSegmentId] = useState(state.strategy?.segmentId ?? sc.segments[0].id);
  const [valuePropId, setValuePropId] = useState(state.strategy?.valuePropId ?? sc.valueProps[0].id);
  const fee = storeFee(state) + techSum(state, 'revenueFee');
  const prices = [...new Set([...sc.priceOptions, state.pricing.price])].sort((a, b) => a - b);
  const margin = last?.grossMargin ?? null;
  const [grandfather, setGrandfather] = useState(true);
  const proShare = funnelRates(state, productContext(state)).proShare;
  const onOldPrice = state.cohorts.filter((c) => c.price < state.pricing.price).reduce((sum, c) => sum + c.paying, 0);

  return (
    <>
      <div className="split">
        <Card title={t('Модель монетизации')} term="pricingModel" desc={t('Меняется сразу для новых клиентов')} actions={<Theory article="pricing" />}>
          <div className="stack">
            <Choice
              options={sc.pricingModels.map((m) => ({ id: m.id, title: m.name, text: m.description, foot: m.needsRole ? t('Нужен менеджер по продажам') : undefined }))}
              value={state.pricing.model}
              onChange={(model) => dispatch({ type: 'set_pricing', patch: { model } })}
            />
            <div className="grid cols-2">
              <Field label={t('Цена')} hint={grandfather ? t('Текущие клиенты сохранят прежнюю цену') : t('Повышение больше чем на 10% вызовет волну отписок у текущих клиентов')}>
                <select className="select" value={state.pricing.price} onChange={(e) => dispatch({ type: 'set_pricing', patch: { price: Number(e.target.value) }, grandfather })}>
                  {prices.map((p) => (
                    <option key={p} value={p}>
                      {money(p, 2)}
                      {sc.labels.priceUnit}
                    </option>
                  ))}
                </select>
              </Field>
              <Switch
                checked={state.pricing.annual}
                onChange={(annual) => dispatch({ type: 'set_pricing', patch: { annual } })}
                term="annualPlan"
                label={t('Годовой план со скидкой {0}', [pct(sc.annualDiscount, 0)])}
                desc={t('Меньше отток, ниже средний чек')}
              />
              <Switch
                checked={grandfather}
                onChange={setGrandfather}
                term="grandfathering"
                label={t('Повышать цену только для новых клиентов')}
                desc={onOldPrice >= 1 ? t('Сейчас на старой цене: {0} клиентов', [num(onOldPrice)]) : t('Текущие клиенты платят прежнюю цену (grandfathering)')}
              />
              <Switch
                checked={state.pricing.dunning}
                onChange={(dunning) => dispatch({ type: 'set_pricing', patch: { dunning } })}
                term="dunning"
                label={t('Повторные списания (dunning)')}
                desc={
                  last?.involuntary
                    ? t('В прошлом месяце не прошла оплата у {0} клиентов{1}', [num(last.involuntary), state.pricing.dunning ? t(', большинство вернули') : ''])
                    : state.flags.dunningBuilt
                      ? t('Уже настроено, включается бесплатно')
                      : t('Возвращает большую часть неудачных платежей. Настройка — 3 SP')
                }
              />
              <Switch
                checked={state.pricing.proTier}
                onChange={(proTier) => dispatch({ type: 'set_pricing', patch: { proTier } })}
                term="proTier"
                label={t('Тариф Pro за двойную цену')}
                desc={state.pricing.proTier ? t('Pro выбирают ~{0} покупателей. Чем ценнее продукт, тем больше', [pct(proShare, 0)]) : t('Выше средний чек, но выбор на пейволле чуть снижает покупки. Настройка — 5 SP')}
              />
            </div>
            <Callout tone="info">{t('Безопаснее сначала проверить новую цену A/B-тестом и смотреть на выручку на пользователя, а не на конверсию.')}</Callout>
          </div>
        </Card>

        <Card title={t('Как считается юнит-экономика')} term="ltv" desc={t('По данным прошлого месяца')} actions={<Theory article="unit-economics" />}>
          {last ? (
            <div className="stack">
              <div className="grid cols-2" style={{ gap: 10 }}>
                <Kpi inset size="sm" label="ARPPU" term="arppu" value={money(last.obs.arppu, 2)} />
                <Kpi inset size="sm" label={t('Маржа')} term="grossMargin" value={pct(margin, 0)} hint={t('Выручка минус комиссии ({0}) и расходы, которые растут с числом пользователей. Зарплаты и фиксированные расходы сюда не входят', [pct(fee, 0)])} />
                <Kpi inset size="sm" label={t('Отток в месяц')} term="churn" value={pct(last.obs.churnRate)} />
                <Kpi inset size="sm" label="CAC" term="cac" value={money(last.obs.cacBlended)} />
              </div>
              <pre className="formula" style={{ margin: 0 }}>
                {t('LTV = ARPPU × маржа / отток = {0}\nLTV / CAC = {1}   (здоровое значение ≥ 3)\nОкупаемость = CAC / (ARPPU × маржа) = {2}', [money(last.obs.ltv), last.obs.ltvCac ? fixed(last.obs.ltvCac, 2) : '—', last.obs.payback ? t('{0} мес.', [fixed(last.obs.payback, 1)]) : '—'])}
              </pre>
            </div>
          ) : (
            <p className="text-muted">{t('Появится после первого месяца.')}</p>
          )}
        </Card>
      </div>

      <Card title={t('Пивот')} term="pivot" desc={t('Смена целевого сегмента или позиционирования')} actions={<Theory article="segmentation" />}>
        <div className="stack">
          <p className="text-sm text-2">
            {t('Если данные показывают, что сегмент не работает, можно сменить фокус. Это дорого: креативы и накопленная органика частично обесценятся, доверие CEO снизится. Пивот без данных — потеря времени.')}
          </p>
          <div className="grid cols-3" style={{ alignItems: 'end' }}>
            <Field label={t('Сегмент')}>
              <select className="select" value={segmentId} onChange={(e) => setSegmentId(e.target.value)}>
                {sc.segments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('Ценностное предложение')}>
              <select className="select" value={valuePropId} onChange={(e) => setValuePropId(e.target.value)}>
                {sc.valueProps.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title}
                  </option>
                ))}
              </select>
            </Field>
            <Button
              variant="danger"
              icon="refresh"
              disabled={segmentId === state.strategy?.segmentId}
              onClick={() =>
                confirm({
                  title: t('Сделать пивот?'),
                  text: t('Креативы и органика частично обесценятся, доверие CEO снизится на 8 пунктов. Уже пришедшие клиенты останутся.'),
                  confirmLabel: t('Сделать пивот'),
                  danger: true,
                  onConfirm: () => dispatch({ type: 'pivot', segmentId, valuePropId }),
                })
              }
            >
              {t('Сделать пивот')}
            </Button>
          </div>
        </div>
      </Card>
    </>
  );
}
