import { calendarMonth, channelAvailable, dateLabel, hasRole, scenarioOf, segmentDef } from '../../engine/catalog.ts';
import { marketCondition } from '../../data/context.ts';
import { dealCapacity } from '../../engine/growth.ts';
import { missingCompliance } from '../../engine/market.ts';
import { crmLift } from '../../engine/product.ts';
import { compactMoney, fixed, money, num, pct } from '../../format.ts';
import { Badge, Button, Callout, Card, Kpi, Progress, Segmented, Theory } from '../components/common.tsx';
import { useGame } from '../context.ts';
import { Hint } from '../components/Hint.tsx';
import { t } from '../../i18n/index.ts';

export function MarketingTab() {
  const { state, dispatch } = useGame();
  const sc = scenarioOf(state);
  const last = state.history[state.history.length - 1];
  const cal = calendarMonth(state.week);
  const total = Object.values(state.marketing.budgets).reduce((a, b) => a + b, 0);
  const marketer = hasRole(state, 'marketer');
  const activePaid = sc.channels.filter((c) => c.kind === 'paid' && state.marketing.budgets[c.id] > 0).length;
  const refreshCost = marketer ? 800 : 1500;
  const unattributed = last ? last.organic + sc.channels.reduce((s, c) => s + (last.acquiredBy[c.id] ?? 0) - (last.reportedBy[c.id] ?? 0), 0) : 0;
  const market = marketCondition(state.world.market);
  const demand = sc.seasonality.demand[cal] * market.demand;
  const cpm = sc.seasonality.cpm[cal] * market.cpm;

  return (
    <>
      <div className="kpi-grid">
        <Kpi label={t('Бюджет на месяц')} value={compactMoney(total)} foot={t('{0} платных каналов', [activePaid])} />
        <Kpi label={t('Органика и неатрибутированные')} term="attribution" value={last ? num(unattributed) : '—'} foot={t('в прошлом месяце')} />
        <Kpi label={t('CAC по кабинетам')} term="cacPaid" value={money(last?.obs.cacPaid)} />
        <Kpi label={t('Реальный blended CAC')} term="cacBlended" value={money(last?.obs.cacBlended)} />
      </div>

      <div className="grid cols-2">
        <Callout
          tone={demand >= 1.15 ? 'success' : cpm >= 1.2 || demand <= 0.85 ? 'warning' : 'info'}
          title={t('Следующий месяц: {0}', [dateLabel(state.week)])}
          icon="calendar"
        >
          {t('Спрос ×{0} · стоимость рекламы ×{1} с учётом сезона и обстановки «{2}». {3}', [fixed(demand, 2), fixed(cpm, 2), market.title, sc.seasonality.note])}
          <Hint term="seasonality" />
        </Callout>
        {!marketer ? (
          <Callout tone={activePaid > 2 ? 'warning' : 'info'} title={t('Без маркетолога')} icon="users">
            {t('Эффективно вести можно не больше двух платных каналов {0}.', [activePaid > 2 ? t(' — сейчас активно {0}, эффективность каждого снижена', [activePaid]) : ''])}
          </Callout>
        ) : (
          <Callout tone="success" title={t('Маркетолог в команде')} icon="users">
            {t('Реклама на ~12% дешевле, креативы выгорают медленнее, можно вести больше каналов.')}
          </Callout>
        )}
      </div>

      <Card
        title={t('Каналы привлечения')}
        term="saturation"
        desc={t('Бюджет действует, пока вы его не измените. У каждого канала убывающая отдача')}
        actions={
          <>
            <Theory article="performance-marketing" label={t('Перформанс')} />
            <Theory article="organic-growth" label={t('Органика')} />
          </>
        }
        bodyClassName="flush"
      >
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('Канал')}</th>
                <th>
                  {t('Бюджет в месяц')}
                  <Hint term="saturation" />
                </th>
                <th className="num">
                  {t('Пользователи')}
                  <Hint
                    title={t('Пользователи')}
                    text={t('Сколько людей канал привёл в прошлом месяце по данным кабинета. Часть платных пользователей кабинет не видит.')}
                  />
                </th>
                <th className="num">
                  {t('Целевые')}
                  <Hint term="targetShare" />
                </th>
                <th className="num">
                  {sc.kind === 'b2b' ? 'CPV' : 'CPI'}
                  <Hint term="cpi" />
                </th>
                <th className="num">{t('Платящие')}</th>
                <th className="num">
                  {t('CAC кабинета')}
                  <Hint term="cacPaid" />
                </th>
                <th>
                  {t('Креативы')}
                  <Hint term="creativeFatigue" />
                </th>
              </tr>
            </thead>
            <tbody>
              {sc.channels.map((c) => {
                const avail = channelAvailable(state, c);
                const spend = last?.spend[c.id] ?? 0;
                const users = last?.reportedBy[c.id] ?? 0;
                const paying = (last?.payingBy[c.id] ?? 0) * (c.kind === 'paid' ? c.attribution : 1);
                const budget = state.marketing.budgets[c.id];
                const target = last?.targetShareBy?.[c.id];
                return (
                  <tr key={c.id} className={avail.ok ? (budget > 0 ? 'is-selected' : '') : 'is-disabled'}>
                    <td style={{ minWidth: 240 }}>
                      <div className="table-title">{c.name}</div>
                      <div className="table-sub">{c.description}</div>
                      <div className="row wrap mt-sm">
                        {!avail.ok && <Badge tone="danger">{avail.reason}</Badge>}
                        {c.kind === 'organic' && <Badge tone="info">{t('органика · эффект копится')}</Badge>}
                      </div>
                    </td>
                    <td style={{ minWidth: 170 }}>
                      <div className="input-prefix">
                        <span>$</span>
                        <input
                          className="input input-sm"
                          type="number"
                          min={0}
                          step={500}
                          disabled={!avail.ok}
                          value={budget}
                          onChange={(e) =>
                            dispatch({
                              type: 'set_budget',
                              channelId: c.id,
                              amount: Number(e.target.value),
                            })
                          }
                          aria-label={t('Бюджет: {0}', [c.name])}
                        />
                      </div>
                      <div className="row mt-sm" style={{ gap: 4 }}>
                        {[0, 2000, 5000, 10000].map((v) => (
                          <button
                            key={v}
                            type="button"
                            className={`chip ${budget === v ? 'active' : ''}`}
                            disabled={!avail.ok}
                            onClick={() =>
                              dispatch({
                                type: 'set_budget',
                                channelId: c.id,
                                amount: v,
                              })
                            }
                          >
                            {v === 0 ? '0' : `${v / 1000}k`}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="num">{spend > 0 || users > 0 ? num(users) : '—'}</td>
                    <td className={`num ${target !== undefined && target < 0.55 ? 'text-warning' : ''}`}>
                      {target !== undefined && (spend > 0 || users > 0) ? pct(target, 0) : '—'}
                    </td>
                    <td className="num">{spend > 0 && users > 0 ? money(spend / users, 2) : '—'}</td>
                    <td className="num">{spend > 0 || paying > 0 ? num(paying) : '—'}</td>
                    <td className="num">{spend > 0 && paying > 0 ? money(spend / paying) : '—'}</td>
                    <td style={{ minWidth: 150 }}>
                      {c.fatigue ? (
                        <div className="stack-xs">
                          <Progress value={state.marketing.creative[c.id]} max={1.1} tone="auto" tip={t('Свежесть креативов')} />
                          <Button
                            size="sm"
                            variant="ghost"
                            icon="refresh"
                            disabled={!avail.ok}
                            onClick={() =>
                              dispatch({
                                type: 'refresh_creatives',
                                channelId: c.id,
                              })
                            }
                          >
                            {t('Обновить · {0}', [money(refreshCost)])}
                          </Button>
                        </div>
                      ) : c.kind === 'organic' ? (
                        <span className="text-sm">{t('накоплено {0}', [num(state.marketing.assets[c.id])])}</span>
                      ) : (
                        <span className="text-xs text-muted">{t('не выгорают')}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid cols-2">
        <Card
          title={t('CRM и удержание')}
          term="crm"
          desc={t('Письма, push-уведомления и возврат ушедших. Снижают отток, отдача убывает')}
          actions={<Theory article="retention" />}
        >
          <div className="stack">
            <Segmented
              options={[0, 500, 1500, 3000].map((v) => ({
                id: v,
                label: v === 0 ? t('Выкл.') : t('{0}/мес', [compactMoney(v)]),
              }))}
              value={[0, 500, 1500, 3000].includes(state.marketing.crm) ? state.marketing.crm : 0}
              onChange={(amount) => dispatch({ type: 'set_crm', amount })}
            />
            <p className="text-sm text-2">
              {state.marketing.crm > 0
                ? t('Отток платящих ниже примерно на {0}.{1}', [pct(crmLift(state), 0), marketer ? '' : t(' Без маркетолога кампании слабее.')])
                : t('Сейчас пользователям не пишут: забывшие о продукте уходят молча.')}
            </p>
          </div>
        </Card>
        {sc.kind === 'b2b' ? <SalesPipeline /> : <div />}
      </div>

      <Callout tone="info" title={t('Почему CAC в кабинетах выше реального')} icon="eye">
        {t('Рекламные кабинеты видят не все конверсии (iOS ATT, промокоды блогеров), поэтому часть платных пользователей попадает в «органику». Решения о бюджетах принимайте по общей картине и когортам.')}{' '}<Theory article="attribution" label={t('Атрибуция')} />
      </Callout>

      {state.launch && !state.launch.bigLaunchDone && (
        <Card
          title={t('Громкий запуск ещё впереди')}
          desc={t('Product Hunt, PR и посты в соцсетях дадут разовый всплеск трафика')}
          actions={
            <Button icon="megaphone" onClick={() => dispatch({ type: 'big_launch' })}>
              {t('Провести · $5 000')}
            </Button>
          }
        >
          <p className="text-sm text-2">
            {t('Лучше делать его, когда продукт стабилен и хорошо конвертирует. Иначе волна новых пользователей оставит плохие отзывы.')}
          </p>
        </Card>
      )}
    </>
  );
}

const DEAL_DISCOUNTS = [0, 0.1, 0.2];

function SalesPipeline() {
  const { state, dispatch } = useGame();
  const sc = scenarioOf(state);
  const last = state.history[state.history.length - 1];
  const seg = segmentDef(sc, state.strategy?.segmentId ?? sc.segments[0].id);
  const capacity = dealCapacity(state, seg.needsSales === true, state.pricing.model === 'demo');
  const reps = state.team.filter((m) => m.role === 'sales' && m.joinWeek <= state.week).length;
  const salesLed = seg.needsSales === true || state.pricing.model === 'demo';
  const noAudit = salesLed && missingCompliance(state).includes('soc2');
  return (
    <Card
      title={t('Воронка продаж')}
      term="salesStages"
      desc={t('В B2B сделка занимает время: компании ждут демо и согласований, часть остывает')}
      actions={<Theory article="b2b-saas" />}
    >
      <div className="stack">
        {noAudit && (
          <Callout tone="warning" title={t('Нет аудита SOC 2')} icon="alert">
            {t('Крупные клиенты требуют аудит безопасности: без него закрывается примерно на 40% меньше сделок. Аудит — в разделе «Рынок и конкуренты».')}
            <Hint term="soc2" />
          </Callout>
        )}
        {!last ? (
          <p className="text-sm text-muted">{t('Появится после первого месяца.')}</p>
        ) : (
          <dl className="kv">
            <dt>{sc.labels.registered}</dt>
            <dd>{last.obs.registered === null ? '—' : num(last.obs.registered)}</dd>
            <dt>{sc.labels.activated}</dt>
            <dd>{last.obs.activated === null ? '—' : num(last.obs.activated)}</dd>
            <dt>{t('В переговорах сейчас')}</dt>
            <dd>{num(last.pipeline ?? 0)}</dd>
            <dt>{t('Закрыто сделок за месяц')}</dt>
            <dd>{num(last.obs.newPaying)}</dd>
            <dt>{t('Менеджеров по продажам')}</dt>
            <dd>{reps}</dd>
            <dt>{t('Лимит сделок в месяц')}</dt>
            <dd>{Number.isFinite(capacity) ? `~${num(capacity)}` : t('без лимита (self-serve)')}</dd>
          </dl>
        )}
        <div className="stack-xs">
          <span className="text-sm text-strong">
            {t('Скидки в сделках')}
            <Hint term="dealDiscount" />
          </span>
          <Segmented
            options={DEAL_DISCOUNTS.map((v) => ({
              id: v,
              label: v === 0 ? t('Без скидок') : t('до {0}', [pct(v, 0)]),
            }))}
            value={DEAL_DISCOUNTS.includes(state.pricing.dealDiscount) ? state.pricing.dealDiscount : 0}
            onChange={(dealDiscount) => dispatch({ type: 'set_pricing', patch: { dealDiscount } })}
          />
          <span className="text-xs text-muted">{t('Скидка помогает закрыть больше сделок, но новые клиенты платят меньше.')}</span>
        </div>
      </div>
    </Card>
  );
}
