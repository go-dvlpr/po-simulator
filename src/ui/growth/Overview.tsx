import { dateLabel, scenarioOf } from '../../engine/catalog.ts';
import { LEVER_NAMES } from '../../engine/experiments.ts';
import { ORGANIC } from '../../engine/growth.ts';
import type { Metrics, Milestone, MonthRecord } from '../../engine/types.ts';
import { compactMoney, fixed, money, num, pct, ratio } from '../../format.ts';
import { benchmark } from '../benchmarks.ts';
import type { IconName } from '../components/Icon.tsx';
import { Icon } from '../components/Icon.tsx';
import { LineChart, PALETTE, StackedBars } from '../components/charts.tsx';
import { TurnSummary } from '../components/TurnSummary.tsx';
import { Badge, Callout, Card, Empty, Kpi, Progress, Theory } from '../components/common.tsx';
import { useGame } from '../context.ts';
import { goalRows } from '../goals.ts';
import { chartMarkers } from '../timeline.ts';
import { Diagnostics } from './Diagnostics.tsx';
import { OkrCard } from './Okr.tsx';
import { t } from '../../i18n/index.ts';
import { OfficeScene } from './OfficeScene.tsx';

const MOD_LABELS: Record<string, string> = { ...LEVER_NAMES, acquisition: t('Привлечение'), cpi: t('Стоимость рекламы'), churn: t('Отток') };

const MILESTONE_ICONS: Record<Milestone['kind'], IconName> = {
  launch: 'rocket',
  price: 'dollar',
  experiment: 'split',
  feature: 'box',
  pivot: 'refresh',
  event: 'zap',
  marketing: 'megaphone',
};

export function monthLabels(history: MonthRecord[]): string[] {
  return history.map((h) => {
    const label = dateLabel(h.week);
    return `${label.slice(0, 3)} ${label.slice(-2)}`;
  });
}

function change(cur: number | null | undefined, prev: number | null | undefined): number | null {
  if (cur === null || cur === undefined || prev === null || prev === undefined || prev === 0) return null;
  return cur / prev - 1;
}

function series(history: MonthRecord[], key: keyof Metrics): (number | null)[] {
  return history.map((h) => h.obs[key]);
}

// Yearly net revenue retention estimated from the last three monthly values.
export function annualNrr(history: MonthRecord[]): number | null {
  const values = history
    .slice(-3)
    .map((h) => h.obs.nrr)
    .filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  return (values.reduce((a, b) => a + b, 0) / values.length) ** 12;
}

export function OverviewTab() {
  const { state } = useGame();
  const sc = scenarioOf(state);
  const h = state.history;
  const last = h[h.length - 1];
  const prev = h[h.length - 2];
  const mods = state.modifiers.filter((m) => m.untilWeek > state.week);
  const markers = chartMarkers(state);
  const ns = sc.northStars.find((n) => n.id === state.strategy?.northStarId);
  const nsFormat = (v: number | null) => (v === null ? '—' : ns?.unit === '$' ? compactMoney(v) : `${num(v)} ${ns?.unit ?? ''}`);
  const nrr = annualNrr(h);

  return (
    <>
      <TurnSummary title={h.length > 0 ? t('Итоги месяца') : t('Продукт запущен')} />

      {!last ? (
        <>
          <Card title={t('Первый месяц после запуска')}>
            <Empty icon="activity" title={t('Данные появятся после завершения месяца')}>
              {t('Задайте бюджеты в разделе «Маркетинг», проверьте очередь разработки и нажмите «Завершить месяц» внизу экрана.')}
            </Empty>
          </Card>
          <OfficeScene />
        </>
      ) : (
        <>
          <div className="kpi-grid five">
            <Kpi label="MRR" term="mrr" value={compactMoney(last.mrr)} delta={change(last.mrr, prev?.mrr)} spark={h.map((r) => r.mrr)} />
            <Kpi label={sc.labels.paying} value={num(last.obs.paying)} delta={change(last.obs.paying, prev?.obs.paying)} spark={series(h, 'paying')} sparkColor={PALETTE[1]} />
            <Kpi label={t('Новые платящие')} term="conversion" value={num(last.obs.newPaying)} delta={change(last.obs.newPaying, prev?.obs.newPaying)} spark={series(h, 'newPaying')} sparkColor={PALETTE[4]} />
            <Kpi
              label={t('Отток платящих')} term="churn"
              value={pct(last.obs.churnRate)}
              good="down"
              delta={change(last.obs.churnRate, prev?.obs.churnRate)}
              spark={series(h, 'churnRate')}
              sparkColor={PALETTE[3]}
              bench={benchmark(state, 'churnRate', last.obs.churnRate)}
            />
            <Kpi
              label="North Star" term="northStar"
              value={nsFormat(last.obs.northStar)}
              hint={ns ? t('{0}. Главная метрика ценности, которую вы выбрали в стратегии', [ns.title]) : undefined}
              delta={change(last.obs.northStar, prev?.obs.northStar)}
              spark={series(h, 'northStar')}
              sparkColor={PALETTE[2]}
              foot={last.obs.northStar === null ? t('нужна продуктовая аналитика') : undefined}
            />
          </div>

          <OfficeScene />

          <Diagnostics />

          <Card title={t('Юнит-экономика и продукт')} desc={t('Рядом с метриками — типичный диапазон для этого рынка')} actions={<Theory article="unit-economics" label={t('Юнит-экономика')} />}>
            <div className="kpi-grid">
              <Kpi inset size="sm" label="CAC (blended)" term="cacBlended" value={money(last.obs.cacBlended)} good="down" delta={change(last.obs.cacBlended, prev?.obs.cacBlended)} />
              <Kpi
                inset
                size="sm"
                label="LTV" term="ltv"
                value={money(last.obs.ltv)}
                delta={change(last.obs.ltv, prev?.obs.ltv)}
                bench={last.mrr > 0 && (last.grossMargin ?? 1) <= 0 ? { text: t('маржа ≤ 0: расходы на пользователя выше выручки'), tone: 'bad' } : undefined}
              />
              <Kpi
                inset
                size="sm"
                label="LTV / CAC" term="ltvCac"
                value={ratio(last.obs.ltvCac)}
                tone={(last.obs.ltvCac ?? 0) >= 3 ? 'success' : (last.obs.ltvCac ?? 0) < 1 ? 'danger' : 'warning'}
                bench={benchmark(state, 'ltvCac', last.obs.ltvCac)}
              />
              <Kpi inset size="sm" label={t('Окупаемость CAC')} term="payback" value={last.obs.payback ? t('{0} мес', [fixed(last.obs.payback, 1)]) : '—'} bench={benchmark(state, 'payback', last.obs.payback)} />
              <Kpi inset size="sm" label="ARPPU" term="arppu" value={money(last.obs.arppu, 2)} />
              {sc.kind === 'b2b' && (
                <Kpi inset size="sm" label={t('NRR за год (оценка)')} term="nrr" value={pct(nrr)} bench={benchmark(state, 'nrr', nrr)} />
              )}
              <Kpi inset size="sm" label={t('Регистрация')} term="registration" value={pct(last.obs.registrationRate)} hint={t('Доля от «{0}»', [sc.labels.acquired.toLowerCase()])} bench={benchmark(state, 'registrationRate', last.obs.registrationRate)} />
              <Kpi inset size="sm" label={t('Активация')} term="activation" value={pct(last.obs.activationRate)} hint={t('Доля зарегистрированных, кто {0}', [sc.labels.aha])} bench={benchmark(state, 'activationRate', last.obs.activationRate)} />
              <Kpi inset size="sm" label={t('Конверсия в оплату')} term="conversion" value={pct(last.obs.conversionRate)} bench={benchmark(state, 'conversionRate', last.obs.conversionRate)} />
              <Kpi inset size="sm" label={t('Удержание 30-го дня')} term="retention" value={pct(last.obs.retentionM1)} bench={benchmark(state, 'retentionM1', last.obs.retentionM1)} />
              <Kpi inset size="sm" label={sc.kind === 'b2b' ? t('Активные компании') : 'MAU'} value={num(last.obs.mau)} />
              <Kpi inset size="sm" label={t('Рейтинг')} term="rating" value={`${fixed(state.product.rating, 1)} ★`} tone={state.product.rating < 3.8 ? 'danger' : undefined} />
            </div>
            {last.obs.activationRate === null && (
              <div className="mt-md">
                <Callout tone="warning" title={t('Аналитика не подключена')}>
                  {t('Воронка, удержание и A/B-тесты не видны. Подключите аналитику в разделе «Технологии».')}
                </Callout>
              </div>
            )}
          </Card>

          <div className="grid cols-2">
            <Card title={t('MRR и расходы')} desc={t('Пунктир — ваши решения и события. Наведите, чтобы связать причину и следствие')}>
              <LineChart
                labels={monthLabels(h)}
                series={[
                  { name: 'MRR', color: PALETTE[0], values: h.map((r) => r.mrr) },
                  { name: t('Расходы'), color: PALETTE[3], values: h.map((r) => Object.values(r.costs).reduce((a, b) => a + b, 0)) },
                ]}
                format={compactMoney}
                markers={markers}
              />
            </Card>
            <Card title={ns ? `North Star: ${ns.title}` : t('Деньги на счёте')}>
              {ns && last.obs.northStar !== null ? (
                <LineChart labels={monthLabels(h)} series={[{ name: 'North Star', color: PALETTE[2], values: series(h, 'northStar') }]} format={(v) => nsFormat(v)} markers={markers} />
              ) : (
                <LineChart labels={monthLabels(h)} series={[{ name: t('Деньги'), color: PALETTE[1], values: h.map((r) => r.cash) }]} format={compactMoney} markers={markers} />
              )}
            </Card>
          </div>

          <div className="grid cols-2">
            <Card title={t('{0} по каналам', [sc.labels.acquired])} desc={t('По данным рекламных кабинетов')} actions={<Theory article="attribution" label={t('Атрибуция')} />}>
              <StackedBars
                labels={monthLabels(h)}
                series={[
                  ...sc.channels.map((c, i) => ({ name: c.name.split(' (')[0], color: PALETTE[i % PALETTE.length], values: h.map((r) => r.reportedBy[c.id] ?? 0) })),
                  {
                    name: t('Органика и неатрибутированные'),
                    color: PALETTE[8],
                    values: h.map((r) => (r.acquiredBy[ORGANIC] ?? 0) + sc.channels.reduce((sum, c) => sum + (r.acquiredBy[c.id] ?? 0) - (r.reportedBy[c.id] ?? 0), 0)),
                  },
                ]}
                format={(v) => num(v)}
              />
            </Card>
            <Card title={t('Воронка прошлого месяца')} term="funnel" actions={<Theory article="aarrr" label="AARRR" />}>
              <Funnel record={last} />
            </Card>
          </div>
        </>
      )}

      <div className="grid cols-2">
        <OkrCard />
        <Card title={t('Цели раунда A')} term="seriesA" desc={t('Инвесторы проверят их в конце 18-го месяца')} actions={<Theory article="pmf" label="PMF" />}>
          <div className="stack">
            {goalRows(state).map((g) => (
              <div key={g.criterion.id} className="stack-xs">
                <div className="row-between text-sm">
                  <span className="text-2">{g.criterion.label}</span>
                  <span className="row">
                    <strong className="num">{g.shown}</strong>
                    <span className="text-muted num">/ {g.target}</span>
                    {g.progress !== null && <Badge tone={g.met ? 'success' : 'neutral'}>{g.met ? t('выполнено') : `${Math.round(Math.min(g.progress, 1) * 100)}%`}</Badge>}
                  </span>
                </div>
                {g.progress !== null && <Progress value={Math.min(g.progress, 1)} max={1} tone={g.met ? 'success' : 'info'} />}
              </div>
            ))}
            <p className="text-xs text-muted">{t('PMF замеряется опросом Шона Эллиса в разделе «Аналитика».')}</p>
          </div>
        </Card>
      </div>

      <div className="grid cols-2">
        <Card title={t('Действующие эффекты')} desc={t('Временные последствия событий и решений')}>
          {mods.length === 0 ? (
            <Empty icon="checkCircle" title={t('Ничего не мешает')}>
              {t('Временных эффектов сейчас нет.')}
            </Empty>
          ) : (
            <div className="list">
              {mods.map((m) => (
                <div key={m.id} className="list-item">
                  <span className={`feed-icon ${(m.lever === 'churn' || m.lever === 'cpi') === m.mult > 1 ? 'bad' : 'good'}`}>
                    <Icon name={m.mult > 1 ? 'arrowUp' : 'arrowDown'} size={12} />
                  </span>
                  <div className="grow">
                    <div className="text-sm text-strong">{m.label}</div>
                    <div className="text-xs text-muted">
                      {t('{0} ×{1} · ещё {2} нед.', [MOD_LABELS[m.lever] ?? m.lever, fixed(m.mult, 2), m.untilWeek - state.week])}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card title={t('Хронология')} desc={t('Последние решения и события — те же отметки, что на графиках')}>
          {state.milestones.length === 0 ? (
            <Empty icon="calendar" title={t('Пока пусто')} />
          ) : (
            <div className="list">
              {[...state.milestones]
                .reverse()
                .slice(0, 8)
                .map((m, i) => (
                  <div key={i} className="list-item">
                    <span className="feed-icon action">
                      <Icon name={MILESTONE_ICONS[m.kind]} size={12} />
                    </span>
                    <span className="grow text-sm">{m.label}</span>
                    <span className="text-xs text-muted nowrap">{dateLabel(m.week)}</span>
                  </div>
                ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function Funnel(props: { record: MonthRecord }) {
  const { state } = useGame();
  const sc = scenarioOf(state);
  const o = props.record.obs;
  const steps = [
    { label: sc.labels.acquired, value: o.acquired },
    { label: sc.labels.registered, value: o.registered },
    { label: sc.labels.activated, value: o.activated },
    { label: t('Новые платящие'), value: o.newPaying },
  ];
  const max = steps[0].value ?? 1;
  return (
    <div className="funnel">
      {steps.map((s, i) => {
        const prevValue = i > 0 ? steps[i - 1].value : null;
        const conv = s.value !== null && prevValue ? s.value / prevValue : null;
        return (
          <div key={s.label} className="funnel-row">
            <span className="text-2">{s.label}</span>
            <div className="funnel-track">
              <div className="funnel-fill" style={{ width: s.value === null ? '0%' : `${Math.max(2, (s.value / max) * 100)}%` }} />
            </div>
            <span className="num right text-strong">{s.value === null ? '—' : num(s.value)}</span>
            <span className="num right text-muted text-xs">{i > 0 ? pct(conv) : ''}</span>
          </div>
        );
      })}
      {o.registered === null && <p className="text-xs text-muted">{t('Без аналитики видны только верх и низ воронки.')}</p>}
    </div>
  );
}
