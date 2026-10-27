import { COMPLIANCE } from '../../data/compliance.ts';
import { dateLabel, featureDef, scenarioOf } from '../../engine/catalog.ts';
import { competitivePressure, EXPANSION_COST, EXPANSION_DELAY_WEEKS, EXPANSION_POINTS, expansionLive, uniqueFeatures } from '../../engine/market.ts';
import { actionHours, hoursError } from '../../engine/potime.ts';
import { money, pct } from '../../format.ts';
import { Hint } from '../components/Hint.tsx';
import { Icon } from '../components/Icon.tsx';
import { Badge, Button, Callout, Card, Empty, Kpi, Progress } from '../components/common.tsx';
import { useGame } from '../context.ts';
import { t } from '../../i18n/index.ts';

export function CompetitionTab() {
  const { state, dispatch } = useGame();
  const sc = scenarioOf(state);
  const pressure = competitivePressure(state);
  const unique = uniqueFeatures(state);
  const applicable = COMPLIANCE.filter((c) => c.applies(state));
  const doneCount = applicable.filter((c) => state.compliance.includes(c.id)).length;
  const shippedMine = sc.features.filter((f) => state.product.features[f.id]?.shipped && f.kano !== 'must' && !f.enablesRevenue).map((f) => f.id);
  const live = expansionLive(state);

  return (
    <>
      <div className="kpi-grid">
        <Kpi label={t('Давление конкурентов')} term="pressure" value={pct(pressure, 0)} tone={pressure > 0.5 ? 'danger' : pressure > 0.4 ? 'warning' : undefined} foot={pressure > 0.45 ? t('конверсия ниже, реклама дороже') : t('обычный уровень')} />
        <Kpi label={t('Уникальные функции')} term="uniqueFeatures" value={unique.length} foot={t('нет ни у одного конкурента')} />
        <Kpi label={t('Регуляторика')} term="compliance" value={t('{0} из {1}', [doneCount, applicable.length])} tone={doneCount < applicable.length ? 'warning' : 'success'} foot={t('обязательных пунктов')} />
        <Kpi label={t('Новый рынок')} term="expansion" value={state.expandedWeek === null ? t('нет') : live ? t('работаем') : t('запуск')} foot={sc.flavor.expansionMarket} />
      </div>

      <Card title={t('Конкуренты')} term="pressure" desc={t('Сила конкурента, сколько ваших функций он уже повторил и что делает сейчас')} bodyClassName="flush">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('Конкурент')}</th>
                <th>{t('Сила')}</th>
                <th className="num">{t('Ваши функции у него')}</th>
                <th>{t('Сейчас')}</th>
              </tr>
            </thead>
            <tbody>
              {state.competitors.map((c, i) => {
                // Same order as the scenario: the saved name may be in another language.
                const def = sc.competitors[i];
                const copied = shippedMine.filter((id) => c.features.includes(id)).length;
                return (
                  <tr key={c.name}>
                    <td style={{ minWidth: 220 }}>
                      <div className="table-title">{def?.name ?? c.name}</div>
                      <div className="table-sub">{def?.description}</div>
                    </td>
                    <td style={{ minWidth: 120 }}>
                      <Progress value={c.strength} max={1} tone={c.strength > 0.65 ? 'danger' : c.strength > 0.45 ? 'warning' : 'info'} />
                    </td>
                    <td className="num">
                      {copied} / {shippedMine.length}
                    </td>
                    <td>{c.priceCutUntil > state.week ? <Badge tone="danger">{t('снизил цены')}</Badge> : c.features.length <= 1 ? <Badge outline>{t('статус-кво')}</Badge> : <Badge outline>{t('обычный режим')}</Badge>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid cols-2">
        <Card title={t('Уникальные функции')} term="uniqueFeatures" desc={t('То, что отличает вас от всех конкурентов')}>
          {unique.length === 0 ? (
            <Empty icon="star" title={t('Пока нечем отличаться')}>
              {t('Всё, что вы выпустили, есть хотя бы у одного конкурента. Ищите функции, которые важны вашему сегменту и которых нет у других.')}
            </Empty>
          ) : (
            <div className="row wrap">
              {unique.map((id) => (
                <Badge key={id} tone="success">
                  {featureDef(sc, id).name}
                </Badge>
              ))}
            </div>
          )}
        </Card>
        <Card title={t('Новости рынка')}>
          {state.competitorNews.length === 0 ? (
            <Empty icon="globe" title={t('Тихо')} />
          ) : (
            <div className="list">
              {[...state.competitorNews].reverse().slice(0, 8).map((n, i) => (
                <div key={i} className="list-item">
                  <span className="feed-icon action">
                    <Icon name="zap" size={12} />
                  </span>
                  <span className="grow text-sm">{n.text}</span>
                  <span className="text-xs text-muted nowrap">{dateLabel(n.week)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title={t('Регуляторика')} term="compliance" desc={t('Пункты, обязательные для вашего продукта. Стоят денег и времени команды')}>
        <div className="list">
          {applicable.map((c) => {
            const done = state.compliance.includes(c.id);
            return (
              <div key={c.id} className="list-item">
                <span className={`feed-icon ${done ? 'good' : 'bad'}`}>
                  <Icon name={done ? 'check' : 'alert'} size={12} />
                </span>
                <div className="grow stack-xs">
                  <span className="text-sm text-strong">
                    {c.name}
                    {c.id === 'soc2' && <Hint term="soc2" />}
                  </span>
                  <span className="text-sm text-2">{c.description}</span>
                  {!done && <span className="text-xs text-warning">{t('Риск: {0}', [c.risk])}</span>}
                </div>
                {done ? (
                  <Badge tone="success">{t('сделано')}</Badge>
                ) : (
                  <Button
                    size="sm"
                    disabled={state.cash < c.cost}
                    title={hoursError(state, actionHours({ type: 'do_compliance', id: c.id })) ?? undefined}
                    onClick={() => dispatch({ type: 'do_compliance', id: c.id })}
                  >
                    {t('Сделать · {0} + {1} SP · {2} ч', [money(c.cost), c.points, actionHours({ type: 'do_compliance', id: c.id })])}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card title={t('Выход на новый рынок: {0}', [sc.flavor.expansionMarket])} term="expansion">
        <div className="stack">
          <p className="text-sm text-2">
            {t('Локализация, платежи и поддержка займут около {0} месяцев. Потом рынок станет больше и каналы будут насыщаться медленнее, но реклама там дороже на 6%, а постоянные расходы вырастут на $2 000 в месяц. Окупается не сразу.', [EXPANSION_DELAY_WEEKS / 4])}
          </p>
          {state.expandedWeek === null ? (
            <div>
              <Button icon="globe" disabled={state.history.length < 3 || state.cash < EXPANSION_COST} onClick={() => dispatch({ type: 'expand_market' })}>
                {t('Начать выход · {0} + {1} SP · {2} ч', [money(EXPANSION_COST), EXPANSION_POINTS, actionHours({ type: 'expand_market' })])}
              </Button>
              {state.history.length < 3 && <p className="text-xs text-muted mt-sm">{t('Сначала докажите, что продукт работает на основном рынке: нужно хотя бы 3 месяца после запуска.')}</p>}
            </div>
          ) : (
            <Callout tone={live ? 'success' : 'info'}>{live ? t('Продукт работает на новом рынке.') : t('Запуск на новом рынке начнётся в {0}.', [dateLabel(state.expandedWeek + EXPANSION_DELAY_WEEKS)])}</Callout>
          )}
        </div>
      </Card>
    </>
  );
}
