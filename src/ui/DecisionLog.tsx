import { useState } from 'react';
import { monthIndex } from '../engine/catalog.ts';
import { CATEGORY_NAMES } from '../engine/scoring.ts';
import type { LogEntry } from '../engine/types.ts';
import { Icon } from './components/Icon.tsx';
import { Badge, Drawer, Empty, Segmented } from './components/common.tsx';
import { t } from '../i18n/index.ts';

type Filter = 'all' | 'good' | 'bad';

export function LogList(props: { entries: LogEntry[]; filter?: Filter }) {
  const filter = props.filter ?? 'all';
  const entries = [...props.entries].reverse().filter((e) => filter === 'all' || e.tone === filter);
  if (entries.length === 0) return <Empty icon="compass" title={t('Пока пусто')}>{t('Здесь появятся ваши решения и их оценка.')}</Empty>;
  return (
    <div className="list">
      {entries.map((e, i) => {
        const icon = e.tone === 'good' ? 'checkCircle' : e.tone === 'bad' ? 'alert' : 'info';
        const tone = e.tone === 'good' ? 'good' : e.tone === 'bad' ? 'bad' : 'info';
        return (
          <div key={i} className="log-entry">
            <div className={`feed-icon ${tone}`}>
              <Icon name={icon} size={14} />
            </div>
            <div className="grow">
              <div className="row-between">
                <span className="log-title">{e.title}</span>
                {e.points !== undefined && e.points !== 0 && (
                  <Badge tone={e.points > 0 ? 'success' : 'danger'}>
                    {e.points > 0 ? '+' : ''}
                    {e.points}
                  </Badge>
                )}
              </div>
              <div className="log-text">{e.text}</div>
              <div className="row wrap mt-sm">
                <span className="meta">
                  <Icon name="calendar" size={12} />
                  {t('Неделя {0} · месяц {1}', [e.week + 1, monthIndex(e.week) + 1])}
                </span>
                {e.category && <Badge outline>{CATEGORY_NAMES[e.category]}</Badge>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DecisionLog(props: { entries: LogEntry[]; onClose: () => void }) {
  const [filter, setFilter] = useState<Filter>('all');
  const judged = props.entries.filter((e) => e.points !== undefined);
  const good = judged.filter((e) => (e.points ?? 0) > 0).length;
  const bad = judged.filter((e) => (e.points ?? 0) < 0).length;
  const total = judged.reduce((sum, e) => sum + (e.points ?? 0), 0);
  return (
    <Drawer title={t('Журнал решений')} desc={t('Каждое важное решение и почему оно хорошее или плохое')} onClose={props.onClose}>
      <div className="stack">
        <div className="grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
          <div className="kpi inset sm">
            <div className="kpi-label">{t('Хорошие')}</div>
            <div className="kpi-value text-success">{good}</div>
          </div>
          <div className="kpi inset sm">
            <div className="kpi-label">{t('Ошибки')}</div>
            <div className="kpi-value text-danger">{bad}</div>
          </div>
          <div className="kpi inset sm">
            <div className="kpi-label">{t('Сумма баллов')}</div>
            <div className="kpi-value">
              {total > 0 ? '+' : ''}
              {total}
            </div>
          </div>
        </div>
        <Segmented
          options={[
            { id: 'all', label: t('Все') },
            { id: 'good', label: t('Хорошие') },
            { id: 'bad', label: t('Ошибки') },
          ]}
          value={filter}
          onChange={setFilter}
        />
        <LogList entries={props.entries} filter={filter} />
      </div>
    </Drawer>
  );
}
