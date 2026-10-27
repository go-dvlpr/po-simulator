import { dateLabel, featureDef, scenarioOf } from '../../engine/catalog.ts';
import { INBOX_TOPICS } from '../../engine/inbox.ts';
import type { InboxItem } from '../../engine/types.ts';
import type { IconName } from '../components/Icon.tsx';
import { Icon } from '../components/Icon.tsx';
import { Badge, Button, Callout, Card, Empty, Kpi, Progress, Theory } from '../components/common.tsx';
import { useGame } from '../context.ts';
import { t } from '../../i18n/index.ts';

const SOURCES: Record<InboxItem['source'], { label: string; icon: IconName }> = {
  review: { label: t('Отзыв'), icon: 'star' },
  support: { label: t('Поддержка'), icon: 'message' },
  sales: { label: t('Продажи'), icon: 'briefcase' },
  ceo: { label: 'CEO', icon: 'building' },
};

export function InboxTab() {
  const { state, dispatch } = useGame();
  const sc = scenarioOf(state);
  const items = [...state.inbox].reverse();
  const fresh = state.inbox.filter((m) => m.week === state.week).length;
  const recent = state.inbox.filter((m) => m.week > state.week - 12);
  const topics = Object.keys(INBOX_TOPICS).map((t) => ({ topic: t, count: recent.filter((m) => m.topic === t).length }));
  const requests = new Map<string, number>();
  for (const m of recent) if (m.featureId) requests.set(m.featureId, (requests.get(m.featureId) ?? 0) + 1);
  const topRequests = [...requests].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const queue = state.featureQueue.filter((id) => !state.product.features[id]?.completed);

  const raise = (id: string) => dispatch({ type: 'set_queue', queue: [id, ...queue.filter((x) => x !== id)] });

  return (
    <>
      <div className="kpi-grid">
        <Kpi label={t('Новых за месяц')} value={fresh} />
        <Kpi label={t('За 3 месяца')} value={recent.length} />
        <Kpi label={t('Запросов функций')} term="inbox" value={topics.find((t) => t.topic === 'feature')?.count ?? 0} foot={t('за 3 месяца')} />
        <Kpi label={t('Жалоб на баги')} value={topics.find((t) => t.topic === 'bugs')?.count ?? 0} tone={(topics.find((t) => t.topic === 'bugs')?.count ?? 0) > 4 ? 'warning' : undefined} foot={t('за 3 месяца')} />
      </div>

      <Callout tone="warning" title={t('Входящие — смещённая выборка')} icon="eye">
        {t('Пишут самые активные и самые недовольные. Громкий запрос не значит, что функция нужна большинству. Проверяйте запросы опросом о функциях или интервью, прежде чем менять планы.')}{' '}<Theory article="feedback" label={t('Обратная связь')} />
      </Callout>

      <div className="split">
        <Card title={t('Сообщения')} term="inbox" desc={t('Отзывы в сторе, обращения в поддержку, запросы продаж и CEO')} bodyClassName="flush">
          {items.length === 0 ? (
            <div style={{ padding: '8px 20px 16px' }}>
              <Empty icon="inbox" title={t('Пока пусто')}>
                {t('Сообщения появятся после первого месяца.')}
              </Empty>
            </div>
          ) : (
            <div className="inbox-list">
              {items.slice(0, 30).map((m) => {
                const src = SOURCES[m.source];
                const inQueue = m.featureId ? queue.indexOf(m.featureId) : -1;
                return (
                  <div key={m.id} className={`inbox-item ${m.week === state.week ? 'fresh' : ''}`}>
                    <span className="feed-icon info">
                      <Icon name={src.icon} size={13} />
                    </span>
                    <div className="grow stack-xs">
                      <div className="row wrap" style={{ gap: 6 }}>
                        <span className="text-xs text-strong">{src.label}</span>
                        {m.stars !== undefined && <span className="stars">{'★'.repeat(m.stars)}{'☆'.repeat(5 - m.stars)}</span>}
                        <Badge outline>{INBOX_TOPICS[m.topic]}</Badge>
                        <span className="text-xs text-muted">{dateLabel(m.week)}</span>
                      </div>
                      <span className="text-sm">{m.text}</span>
                    </div>
                    {m.featureId && inQueue > 0 && (
                      <Button size="sm" variant="ghost" icon="arrowTop" onClick={() => raise(m.featureId ?? '')}>
                        {t('Поднять в очереди')}
                      </Button>
                    )}
                    {m.featureId && inQueue === 0 && <Badge tone="accent">{t('первая в очереди')}</Badge>}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
        <div className="stack sticky">
          <Card title={t('Темы за 3 месяца')}>
            <div className="stack-sm">
              {topics.map((t) => (
                <div key={t.topic} className="stack-xs">
                  <div className="row-between text-sm">
                    <span className="text-2">{INBOX_TOPICS[t.topic]}</span>
                    <strong className="num">{t.count}</strong>
                  </div>
                  <Progress value={t.count} max={Math.max(1, recent.length)} tone={t.topic === 'praise' ? 'success' : t.topic === 'feature' ? 'info' : 'warning'} />
                </div>
              ))}
            </div>
          </Card>
          <Card title={t('Чаще всего просят')}>
            {topRequests.length === 0 ? (
              <p className="text-sm text-muted">{t('Запросов функций пока нет.')}</p>
            ) : (
              <div className="stack-sm">
                {topRequests.map(([id, count]) => (
                  <div key={id} className="row-between text-sm">
                    <span>{featureDef(sc, id).name}</span>
                    <Badge outline>{count}</Badge>
                  </div>
                ))}
                <p className="text-xs text-muted">{t('В разборе после игры будет видно, насколько эти запросы совпали с реальной ценностью.')}</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
