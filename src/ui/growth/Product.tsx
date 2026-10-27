import { featureDef, scaleLimit, scenarioOf } from '../../engine/catalog.ts';
import { canTestFeatures } from '../../engine/experiments.ts';
import { lastMau } from '../../engine/product.ts';
import { fixed, num, pct } from '../../format.ts';
import { Icon } from '../components/Icon.tsx';
import { Badge, Button, Callout, Card, Empty, Kpi, Progress, Switch, Theory } from '../components/common.tsx';
import { Hint } from '../components/Hint.tsx';
import { useGame } from '../context.ts';
import { BacklogTable } from '../panels/Backlog.tsx';
import { AllocationControl, CapacityInfo } from '../panels/WorkPlan.tsx';
import { t } from '../../i18n/index.ts';

export function ProductTab() {
  const { state, dispatch } = useGame();
  const sc = scenarioOf(state);
  const queue = state.featureQueue.filter((id) => !state.product.features[id]?.completed);
  const shipped = sc.features.filter((f) => state.product.features[f.id]?.shipped);
  const limit = scaleLimit(state);
  const mau = lastMau(state);
  const testable = canTestFeatures(state);
  const usage = state.history[state.history.length - 1]?.featureUsage;
  const support = state.history[state.history.length - 1]?.support;
  const usageRows = usage ? Object.entries(usage).sort((a, b) => b[1].adoption - a[1].adoption) : [];
  const testing = (id: string) => state.experiments.some((e) => e.featureId === id && (e.status === 'running' || e.status === 'done'));
  const held = sc.features.filter((f) => {
    const p = state.product.features[f.id];
    return p?.completed && !p.shipped && !testing(f.id);
  });

  const move = (id: string, to: number) => {
    const next = queue.filter((x) => x !== id);
    next.splice(Math.max(0, Math.min(next.length, to)), 0, id);
    dispatch({ type: 'set_queue', queue: next });
  };

  return (
    <>
      <div className="kpi-grid">
        <Kpi label={t('Рейтинг')} term="rating" value={`${fixed(state.product.rating, 1)} ★`} tone={state.product.rating < 3.8 ? 'danger' : undefined} />
        <Kpi label={t('Открытые баги')} term="bugs" value={num(state.product.bugs)} tone={state.product.bugs > 35 ? 'danger' : state.product.bugs > 20 ? 'warning' : undefined} />
        <Kpi label={t('Техдолг')} term="techDebt" value={`${num(state.product.debt)} / 100`} tone={state.product.debt > 50 ? 'danger' : state.product.debt > 30 ? 'warning' : undefined} />
        <Kpi
          label={sc.kind === 'b2b' ? t('Активные компании') : 'MAU'}
          value={num(mau)}
          foot={Number.isFinite(limit) ? t('предел платформы ~{0}', [num(limit)]) : t('платформа масштабируется')}
          tone={mau > limit ? 'danger' : mau > limit * 0.7 ? 'warning' : undefined}
        />
      </div>
      {mau > limit && <Callout tone="danger">{t('Нагрузка выше предела платформы: продукт тормозит, качество падает.')}</Callout>}

      <div className="split">
        <Card
          title={t('Очередь разработки')} term="queue"
          desc={queue.length > 0 ? t('Первая в очереди: {0}. Готовые функции выходят в конце месяца', [featureDef(sc, queue[0]).name]) : undefined}
          actions={<Theory article="prioritization" label="ICE / RICE" />}
          bodyClassName="flush"
        >
          {queue.length === 0 ? (
            <div style={{ padding: '8px 20px 16px' }}>
              <Empty icon="box" title={t('Очередь пуста')}>
                {t('Команда занимается качеством: техдолгом и багами.')}
              </Empty>
            </div>
          ) : (
            <BacklogTable ids={queue} mode="queue" onMove={move} />
          )}
        </Card>
        <div className="stack sticky">
          <Card title={t('Как выпускать функции')} term="featureFlag" actions={<Theory article="feature-flags" label={t('Фича-флаги')} />}>
            <div className="stack-sm">
              <Switch
                checked={state.releaseWithAb}
                disabled={!testable}
                onChange={(ab) => dispatch({ type: 'set_release_mode', ab })}
                label={t('За фича-флагом с A/B-тестом')}
                desc={t('Готовая функция включается половине пользователей. Через месяц видно, помогает ли она')}
              />
              {!testable && <p className="text-xs text-muted">{t('Нужны продуктовая аналитика и инфраструктура A/B-тестов.')}</p>}
            </div>
          </Card>
          {held.length > 0 && (
            <Card title={t('Готово, но не выпущено')} desc={t('Откатили после теста или ждут решения')}>
              <div className="stack-sm">
                {held.map((f) => (
                  <div key={f.id} className="row-between">
                    <span className="text-sm">{f.name}</span>
                    <Button size="sm" onClick={() => dispatch({ type: 'ship_feature', featureId: f.id })}>
                      {t('Выпустить всем')}
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}
          {support && (
            <Card title={t('Поддержка')} term="supportLoad" desc={t('Обращения пользователей за прошлый месяц')}>
              <div className="stack-sm">
                <div className="row-between text-sm">
                  <span className="text-2">{t('Обращений / успевают обработать')}</span>
                  <strong className="num">
                    {num(support.tickets)} / {num(support.capacity)}
                  </strong>
                </div>
                <Progress value={support.tickets} max={Math.max(support.tickets, support.capacity)} tone={support.tickets > support.capacity ? 'danger' : support.tickets > support.capacity * 0.8 ? 'warning' : 'success'} />
                <div className="row-between text-sm">
                  <span className="text-2">
                    CSAT
                    <Hint term="csat" />
                  </span>
                  <strong className={`num ${support.csat < 0.8 ? 'text-danger' : ''}`}>{pct(support.csat, 0)}</strong>
                </div>
                {support.tickets > support.capacity && (
                  <p className="text-xs text-warning">{t('Поддержка не успевает: клиенты ждут ответа и уходят. Наймите специалиста поддержки или снизьте число багов.')}</p>
                )}
              </div>
            </Card>
          )}
          <Card title={t('Работа команды')} term="allocation" desc={t('Два спринта в месяц')}>
            <AllocationControl />
          </Card>
          <Card title={t('Возможности команды')}>
            <CapacityInfo />
          </Card>
          <Card title={t('Выпущено ({0})', [shipped.length])}>
            <div className="row wrap">
              {shipped.map((f) => (
                <Badge key={f.id} tone="success">
                  <Icon name="check" size={11} strokeWidth={3} />
                  {f.name}
                </Badge>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Card title={t('Использование функций')} term="featureUsage" desc={t('Доля активных пользователей, которые пользуются функцией, и их удержание')} actions={<Theory article="feature-flags" />} bodyClassName="flush">
        {usageRows.length === 0 ? (
          <div style={{ padding: '8px 20px 16px' }}>
            <Empty icon="activity" title={t('Данных пока нет')}>
              {state.tech.analytics === 'none' ? t('Без продуктовой аналитики не видно, кто чем пользуется.') : t('Появятся, когда выйдут функции сверх обязательных.')}
            </Empty>
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('Функция')}</th>
                    <th className="num">{t('Пользуются')}</th>
                    <th className="num">{t('Удержание с функцией')}</th>
                    <th className="num">{t('Без функции')}</th>
                  </tr>
                </thead>
                <tbody>
                  {usageRows.map(([id, u]) => (
                    <tr key={id}>
                      <td className="table-title">{featureDef(sc, id).name}</td>
                      <td className="num">{pct(u.adoption, 0)}</td>
                      <td className="num">{u.retentionWith === null ? '—' : pct(u.retentionWith, 0)}</td>
                      <td className="num">{u.retentionWithout === null ? '—' : pct(u.retentionWithout, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '12px 20px 16px' }}>
              <Callout tone="warning" title={t('Корреляция — не причина')}>
                {t('Те, кто пользуется функцией, почти всегда удерживаются лучше: активные люди просто пробуют больше функций. Настоящий эффект функции показывает только A/B-тест — выпускайте функции за фича-флагом.')}
              </Callout>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
