import { useState } from 'react';
import { roleDef } from '../../data/roles.ts';
import { dateLabel, hasCohorts, scenarioOf } from '../../engine/catalog.ts';
import { GROWTH_RESEARCH } from '../../engine/insights.ts';
import type { Cohort, MonthSettings, RoleId, ScenarioDef } from '../../engine/types.ts';
import { compactMoney, money, num, pct, signedPct } from '../../format.ts';
import { benchmarkRange } from '../benchmarks.ts';
import { Icon } from '../components/Icon.tsx';
import type { IconName } from '../components/Icon.tsx';
import { Badge, Button, Card, Empty, Segmented, Theory } from '../components/common.tsx';
import { useGame } from '../context.ts';
import { Hint } from '../components/Hint.tsx';
import { t } from '../../i18n/index.ts';

const RESEARCH_ICONS: Record<string, IconName> = { pmf: 'heart', nps: 'thumbsUp', churn: 'message', feature_survey: 'file', usability: 'eye' };

export function AnalyticsTab() {
  const { state, dispatch } = useGame();
  const sc = scenarioOf(state);
  const h = state.history.slice(-8);
  const cohortsAvailable = hasCohorts(state);
  const [cohortView, setCohortView] = useState<'active' | 'paying'>('active');

  return (
    <>
      <Card title={t('Воронка по месяцам')} term="funnel" actions={<Theory article="analytics" />} bodyClassName="flush">
        {h.length === 0 ? (
          <div style={{ padding: '8px 20px 16px' }}>
            <Empty icon="activity" title={t('Данных пока нет')}>
              {t('Появятся после первого месяца.')}
            </Empty>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Месяц')}</th>
                  <th className="num">{sc.labels.acquired}</th>
                  <th className="num">
                    {t('→ Регистрация')}
                    <Hint term="registration" />
                  </th>
                  <th className="num">
                    {t('→ Активация')}
                    <Hint term="activation" />
                  </th>
                  <th className="num">
                    {t('→ Оплата')}
                    <Hint term="conversion" />
                  </th>
                  <th className="num">{t('Новые платящие')}</th>
                  <th className="num">
                    {t('Отток')}
                    <Hint term="churn" />
                  </th>
                  <th className="num">MRR</th>
                </tr>
              </thead>
              <tbody>
                {h.map((r) => (
                  <tr key={r.month}>
                    <td className="table-title">{dateLabel(r.week)}</td>
                    <td className="num">{num(r.obs.acquired)}</td>
                    <td className="num">{pct(r.obs.registrationRate)}</td>
                    <td className="num">{pct(r.obs.activationRate)}</td>
                    <td className="num">{pct(r.obs.conversionRate)}</td>
                    <td className="num">{num(r.obs.newPaying)}</td>
                    <td className="num">{pct(r.obs.churnRate)}</td>
                    <td className="num text-strong">{money(r.mrr)}</td>
                  </tr>
                ))}
                <tr className="norm-row">
                  <td>
                    {t('Норма рынка')}
                    <Hint term="benchmark" />
                  </td>
                  <td />
                  <td className="num">{benchmarkRange(state, 'registrationRate')}</td>
                  <td className="num">{benchmarkRange(state, 'activationRate')}</td>
                  <td className="num">{benchmarkRange(state, 'conversionRate')}</td>
                  <td />
                  <td className="num">{benchmarkRange(state, 'churnRate')}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title={t('Когортный анализ')} term="cohort"
        desc={t('Строка — пользователи, пришедшие в этом месяце. Столбец — сколько месяцев прошло. Плато кривой — признак найденной аудитории')}
        actions={
          <>
            <Segmented
              options={[
                { id: 'active', label: t('Активные') },
                { id: 'paying', label: t('Платящие') },
              ]}
              value={cohortView}
              onChange={setCohortView}
            />
            <Theory article="retention" />
          </>
        }
      >
        {!cohortsAvailable ? (
          <Empty icon="lock" title={t('Когорты недоступны')}>
            {t('Ваш инструмент аналитики не строит когорты. Нужна продуктовая аналитика (Amplitude/Mixpanel) или своё хранилище.')}
          </Empty>
        ) : state.cohorts.length === 0 ? (
          <Empty icon="grid" title={t('Когорты появятся после первого месяца')} />
        ) : (
          <CohortTable
            cohorts={state.cohorts}
            value={cohortView === 'active' ? (c, i) => (c.activated > 0 ? (c.active[i] ?? 0) / c.activated : null) : (c, i) => (c.newPaying > 0 ? (c.payingHistory[i] ?? 0) / c.newPaying : null)}
          />
        )}
      </Card>

      <Card title={t('Исследования после запуска')} desc={t('Результат приходит в конце месяца')}>
        <div className="grid cols-auto" style={{ gap: 10 }}>
          {GROWTH_RESEARCH.map((g) => {
            const pending = state.pendingGrowthResearch.includes(g.id);
            return (
              <div key={g.id} className="method" style={{ cursor: 'default' }}>
                <div className="row-between">
                  <span className="method-icon">
                    <Icon name={RESEARCH_ICONS[g.id] ?? 'file'} size={16} />
                  </span>
                  <Theory article={g.article} />
                </div>
                <div className="method-title">{g.name}</div>
                <div className="method-text">{g.description}</div>
                <Button size="sm" variant={pending ? 'ghost' : 'secondary'} icon={pending ? 'clock' : 'plus'} disabled={pending || state.cash < g.cost} onClick={() => dispatch({ type: 'order_research', kind: g.id })}>
                  {pending ? t('В конце месяца') : t('Заказать · {0}', [money(g.cost)])}
                </Button>
              </div>
            );
          })}
        </div>
        {state.growthResearch.length > 0 && (
          <div className="stack-sm mt-md">
            <span className="eyebrow">{t('Результаты')}</span>
            {[...state.growthResearch].reverse().map((r, i) => (
              <div key={i} className="card inset">
                <div className="card-header">
                  <div className="card-title">
                    <Icon name={RESEARCH_ICONS[r.kind] ?? 'users'} size={15} />
                    {r.title}
                  </div>
                  <Badge outline>{dateLabel(r.week)}</Badge>
                </div>
                <div className="card-body">
                  <ul className="bullets">
                    {r.lines.map((l, j) => (
                      <li key={j}>
                        <span>{l}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <ChangeLog />
    </>
  );
}

function CohortTable(props: { cohorts: Cohort[]; value: (c: Cohort, age: number) => number | null }) {
  const cohorts = props.cohorts.slice(-9);
  const maxAge = Math.max(...cohorts.map((c) => c.active.length));
  const ages = Array.from({ length: Math.min(maxAge, 10) }, (_, i) => i);
  return (
    <div className="table-wrap">
      <table className="table cohort">
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>{t('Когорта')}</th>
            <th className="nowrap">
              {t('Целевые')}
              <Hint term="targetShare" />
            </th>
            {ages.map((a) => (
              <th key={a}>{t('М{0}', [a])}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((c) => (
            <tr key={`${c.month}-${c.week}`}>
              <td className="nowrap" style={{ textAlign: 'left' }}>
                {dateLabel(c.week)}
              </td>
              <td className={`num ${c.quality < 0.6 ? 'text-warning' : 'text-muted'}`}>{Math.round(c.quality * 100)}%</td>
              {ages.map((a) => {
                const v = a < c.active.length ? props.value(c, a) : null;
                return (
                  <td key={a} className="num" style={v === null ? undefined : { background: `color-mix(in srgb, var(--accent) ${Math.round(Math.min(1, v) * 85)}%, var(--panel-2))`, color: v > 0.5 ? '#fff' : undefined }}>
                    {v === null ? '' : `${Math.round(v * 100)}%`}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function teamChanges(prev: MonthSettings['team'], cur: MonthSettings['team']): string[] {
  const out: string[] = [];
  const roles = new Set([...Object.keys(prev), ...Object.keys(cur)] as RoleId[]);
  for (const role of roles) {
    const d = (cur[role] ?? 0) - (prev[role] ?? 0);
    if (d !== 0) out.push(`${d > 0 ? '+' : '−'}${Math.abs(d)} ${roleDef(role).name.toLowerCase()}`);
  }
  return out;
}

// What the player changed between two months.
function settingChanges(sc: ScenarioDef, prev: MonthSettings, cur: MonthSettings): string[] {
  const out: string[] = [];
  for (const c of sc.channels) {
    const a = prev.budgets[c.id] ?? 0;
    const b = cur.budgets[c.id] ?? 0;
    if (a !== b) out.push(`${c.name.split(' (')[0]}: ${compactMoney(a)} → ${compactMoney(b)}`);
  }
  if (prev.price !== cur.price) out.push(t('Цена: {0} → {1}', [money(prev.price, 2), money(cur.price, 2)]));
  if (prev.model !== cur.model) out.push(t('Модель: {0}', [sc.pricingModels.find((m) => m.id === cur.model)?.name ?? cur.model]));
  if (prev.annual !== cur.annual) out.push(t('Годовой план {0}', [cur.annual ? t('включён') : t('выключен')]));
  if (prev.proTier !== cur.proTier) out.push(t('Тариф Pro {0}', [cur.proTier ? t('включён') : t('выключен')]));
  if (prev.crm !== cur.crm) out.push(`CRM: ${compactMoney(prev.crm)} → ${compactMoney(cur.crm)}`);
  if (Math.abs(prev.allocation.features - cur.allocation.features) >= 0.05) out.push(t('Время на функции: {0} → {1}', [pct(prev.allocation.features, 0), pct(cur.allocation.features, 0)]));
  if (prev.analytics !== cur.analytics) out.push(t('Сменили инструмент аналитики'));
  return [...out, ...teamChanges(prev.team, cur.team)];
}

function ChangeLog() {
  const { state } = useGame();
  const sc = scenarioOf(state);
  // Price changes already show up in the settings diff.
  const monthOf = (week: number) => state.history.findIndex((h) => h.week >= week);
  const rows = state.history
    .map((r, i) => {
      const prev = state.history[i - 1];
      const changes = prev?.settings && r.settings ? settingChanges(sc, prev.settings, r.settings) : [];
      const events = state.milestones.filter((m) => m.kind !== 'price' && monthOf(m.week) === i).map((m) => m.label);
      const growth = prev && prev.mrr > 0 ? r.mrr / prev.mrr - 1 : null;
      return { r, changes, events, growth };
    })
    .filter((x) => x.changes.length > 0 || x.events.length > 0)
    .reverse();
  return (
    <Card title={t('Что менялось по месяцам')} desc={t('Ваши настройки и события рядом с результатом месяца. Так проще понять, что сработало')} bodyClassName="flush">
      {rows.length === 0 ? (
        <div style={{ padding: '8px 20px 16px' }}>
          <Empty icon="history" title={t('Изменений пока нет')} />
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('Месяц')}</th>
                <th>{t('Решения и события')}</th>
                <th className="num">MRR</th>
                <th className="num">{t('Изменение')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ r, changes, events, growth }) => (
                <tr key={r.month}>
                  <td className="table-title nowrap">{dateLabel(r.week)}</td>
                  <td>
                    <div className="row wrap" style={{ gap: 6 }}>
                      {changes.map((c) => (
                        <Badge key={c} outline>
                          {c}
                        </Badge>
                      ))}
                      {events.map((e) => (
                        <Badge key={e} tone="warning">
                          {e}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="num">{money(r.mrr)}</td>
                  <td className={`num ${growth === null ? '' : growth >= 0 ? 'text-success' : 'text-danger'}`}>{signedPct(growth)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
