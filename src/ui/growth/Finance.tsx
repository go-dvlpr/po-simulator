import { dateLabel } from '../../engine/catalog.ts';
import { bridgeError, bridgeOffer, earlySeriesAReady } from '../../engine/fundraising.ts';
import { estimatedBurn } from '../../engine/growth.ts';
import type { Costs } from '../../engine/types.ts';
import { compactMoney, money, months } from '../../format.ts';
import { LineChart, PALETTE } from '../components/charts.tsx';
import { Button, Callout, Card, Empty, Kpi, Theory } from '../components/common.tsx';
import { Hint } from '../components/Hint.tsx';
import { useGame } from '../context.ts';
import { chartMarkers } from '../timeline.ts';
import { monthLabels } from './Overview.tsx';
import { t } from '../../i18n/index.ts';

const COST_ROWS: { key: keyof Costs; label: string }[] = [
  { key: 'salaries', label: t('Зарплаты') },
  { key: 'marketing', label: t('Маркетинг') },
  { key: 'infra', label: t('Инфраструктура') },
  { key: 'tools', label: t('Сервисы и подписки') },
  { key: 'content', label: t('Производство контента') },
  { key: 'other', label: t('Прочее (разовые)') },
];

const total = (c: Costs) => Object.values(c).reduce((a, b) => a + b, 0);

function Fundraising() {
  const { state, dispatch, confirm } = useGame();
  const offer = bridgeOffer(state);
  const error = bridgeError(state);
  const ready = earlySeriesAReady(state);
  return (
    <Card title={t('Привлечение денег')} term="bridge" desc={t('Деньги лучше просить, когда они ещё не нужны срочно')}>
      <div className="stack">
        <div className="grid cols-3" style={{ gap: 10 }}>
          <Kpi inset size="sm" label={t('Можно привлечь')} value={compactMoney(offer.amount)} />
          <Kpi inset size="sm" label={t('Оценка компании')} term="valuation" value={compactMoney(offer.valuation)} />
          <Kpi inset size="sm" label={t('Доля инвесторам')} term="dilution" value={`${Math.round(offer.dilution * 100)}%`} foot={state.dilution > 0 ? t('уже отдано {0}%', [Math.round(state.dilution * 100)]) : undefined} />
        </div>
        <div className="row wrap">
          <Button
            icon="wallet"
            disabled={!!error}
            onClick={() =>
              confirm({
                title: t('Привлечь бридж-раунд?'),
                text: t('+{0} при оценке {1}. Инвесторы получат {2}% компании, совет будет внимательнее следить за метриками. Займёт 20 часов вашего времени.', [compactMoney(offer.amount), compactMoney(offer.valuation), Math.round(offer.dilution * 100)]),
                confirmLabel: t('Привлечь'),
                onConfirm: () => dispatch({ type: 'raise_bridge' }),
              })
            }
          >
            {t('Привлечь бридж')}
          </Button>
          {ready && (
            <Button
              variant="primary"
              icon="trophy"
              onClick={() =>
                confirm({
                  title: t('Поднять раунд A сейчас?'),
                  text: t('Все четыре критерия выполнены, PMF подтверждён опросом. Игра закончится победой — раньше срока.'),
                  confirmLabel: t('Поднять раунд A'),
                  onConfirm: () => dispatch({ type: 'raise_series_a' }),
                })
              }
            >
              {t('Поднять раунд A досрочно')}
            </Button>
          )}
        </div>
        {error && <p className="text-xs text-muted">{error}</p>}
        <p className="text-xs text-muted">
          {t('Оценка растёт с выручкой и темпом роста: чем позже и сильнее вы приходите к инвесторам, тем меньшую долю отдаёте. Каждый процент доли немного снижает итоговый результат.')}
        </p>
      </div>
    </Card>
  );
}

export function FinanceTab() {
  const { state } = useGame();
  const h = state.history.slice(-8);
  const burn = estimatedBurn(state);
  const runway = burn > 0 ? state.cash / burn : Infinity;
  const last = state.history[state.history.length - 1];

  return (
    <>
      <div className="kpi-grid">
        <Kpi label={t('Деньги')} value={compactMoney(state.cash)} spark={state.history.map((r) => r.cash)} sparkColor={PALETTE[1]} />
        <Kpi label={t('Ожидаемый burn')} term="burn" value={compactMoney(Math.max(0, burn))} foot={t('в месяц: расходы минус выручка')} />
        <Kpi label="Runway" term="runway" value={months(runway)} tone={runway < 4 ? 'danger' : runway < 8 ? 'warning' : undefined} />
        <Kpi label={t('Выручка прошлого месяца')} value={compactMoney(last?.revenue)} foot={t('после комиссий')} />
      </div>
      <Fundraising />
      <Callout tone="info" title={t('Default alive или default dead?')} icon="wallet">
        {t('Компания «default alive», если при текущем росте выручки выйдет в плюс раньше, чем закончатся деньги. Привлечение денег занимает 3–6 месяцев — начинать нужно задолго до конца runway.')}{' '}<Theory article="finance" />
      </Callout>
      {h.length === 0 ? (
        <Empty icon="wallet" title={t('Отчёт о прибылях и убытках появится после первого месяца')} />
      ) : (
        <>
          <Card title={t('Выручка и расходы')}>
            <LineChart
              labels={monthLabels(state.history)}
              series={[
                { name: t('Выручка после комиссий'), color: PALETTE[1], values: state.history.map((r) => r.revenue) },
                { name: t('Расходы'), color: PALETTE[3], values: state.history.map((r) => total(r.costs)) },
              ]}
              format={compactMoney}
              markers={chartMarkers(state)}
            />
          </Card>
          <Card title={t('P&L по месяцам')} bodyClassName="flush">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th />
                    {h.map((r) => (
                      <th key={r.month} className="num">
                        {dateLabel(r.week)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="table-title">{t('Выручка после комиссий')}</td>
                    {h.map((r) => (
                      <td key={r.month} className="num text-success">
                        {money(r.revenue)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="text-2">
                      {t('В том числе возвраты')}
                      <Hint term="refunds" />
                    </td>
                    {h.map((r) => (
                      <td key={r.month} className="num text-muted">
                        {r.refunds ? `−${money(Math.round(r.refunds))}` : '—'}
                      </td>
                    ))}
                  </tr>
                  {COST_ROWS.map((row) => (
                    <tr key={row.key}>
                      <td className="text-2">{row.label}</td>
                      {h.map((r) => (
                        <td key={r.month} className="num text-muted">
                          {r.costs[row.key] > 0 ? `−${money(r.costs[row.key])}` : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <td className="table-title">{t('Чистый денежный поток')}</td>
                    {h.map((r) => {
                      const net = r.revenue - total(r.costs);
                      return (
                        <td key={r.month} className={`num text-strong ${net >= 0 ? 'text-success' : 'text-danger'}`}>
                          {money(net)}
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td className="table-title">{t('Деньги на конец месяца')}</td>
                    {h.map((r) => (
                      <td key={r.month} className="num text-strong">
                        {compactMoney(r.cash)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
