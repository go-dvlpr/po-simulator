import { useState } from 'react';
import { LAUNCH_CHECKLIST } from '../../data/launch.ts';
import { featureDef, scenarioOf } from '../../engine/catalog.ts';
import { productContext } from '../../engine/product.ts';
import type { LaunchState } from '../../engine/types.ts';
import { money, num } from '../../format.ts';
import { Icon } from '../components/Icon.tsx';
import { TurnSummary } from '../components/TurnSummary.tsx';
import { Badge, Button, Callout, Card, Choice, Kpi, TurnBar } from '../components/common.tsx';
import { useGame } from '../context.ts';
import { t } from '../../i18n/index.ts';

const STRATEGIES: { id: LaunchState['strategy']; title: string; text: string }[] = [
  {
    id: 'soft',
    title: t('Soft launch на тестовом рынке'),
    text: t('Первые 2 месяца — небольшой рынок с дешёвым трафиком. Можно отладить воронку, а громкий запуск провести позже.'),
  },
  {
    id: 'big',
    title: t('Громкий запуск'),
    text: t('Product Hunt, PR, соцсети. Большая волна внимания сразу: отлично для готового продукта, опасно для сырого.'),
  },
  {
    id: 'quiet',
    title: t('Тихий запуск'),
    text: t('Выкладываем продукт и включаем рекламу. Без всплеска, но и без риска сжечь первое впечатление.'),
  },
];

export function LaunchScreen() {
  const { state, dispatch } = useGame();
  const sc = scenarioOf(state);
  const ctx = productContext(state, true);
  const [strategy, setStrategy] = useState<LaunchState['strategy']>('soft');
  const items = LAUNCH_CHECKLIST.filter((i) => !i.available || i.available(state));
  const [checked, setChecked] = useState<string[]>(items.map((i) => i.id));
  const selected = items.filter((i) => checked.includes(i.id));
  const cost = selected.reduce((sum, i) => sum + i.cost, 0);
  const points = selected.reduce((sum, i) => sum + i.points, 0);
  const done = Object.entries(state.product.features).filter(([, f]) => f.completed).map(([id]) => id);
  const beta = state.growthResearch.find((g) => g.kind === 'beta');
  const launch = () => dispatch({ type: 'launch', strategy, checklist: selected.map((i) => i.id) });
  const elapsed = state.week - (state.buildStartWeek ?? state.week);
  const commit = state.commitWeeks ?? elapsed;
  const late = elapsed > commit;

  return (
    <div className="stack-lg">
      <TurnSummary title={beta ? t('Итоги беты') : t('Что произошло')} />

      <div className="kpi-grid">
        <Kpi
          label={t('Срок запуска')}
          value={t('{0} из {1} нед.', [elapsed, commit])}
          tone={late ? 'danger' : commit - elapsed < 4 ? 'warning' : undefined}
          foot={late ? t('обещанный срок уже сорван') : t('запас {0} нед.', [commit - elapsed])}
          term="commitment"
        />
        <Kpi label={t('Готово функций')} value={done.length} />
        <Kpi label={t('Открытые баги')} value={num(state.product.bugs)} term="bugs" tone={state.product.bugs > 30 ? 'danger' : state.product.bugs > 15 ? 'warning' : undefined} />
        <Kpi label={t('Лист ожидания')} value={num(state.knowledge.waitlist)} term="waitlist" />
      </div>

      <div className="split">
        <div className="stack">
          <Card title={t('Чек-лист запуска')} term="checklist" desc={t('Снимите галочку, чтобы сэкономить. Под пунктом появится риск, который вы принимаете')}>
            <div className="list">
              {items.map((i) => {
                const on = checked.includes(i.id);
                return (
                  <label key={i.id} className="list-item" style={{ cursor: 'pointer' }}>
                    <input type="checkbox" className="check" checked={on} onChange={() => setChecked(on ? checked.filter((x) => x !== i.id) : [...checked, i.id])} />
                    <div className="grow stack-xs">
                      <div className="row-between">
                        <span className="text-strong">{i.name}</span>
                        <Badge outline>{[i.cost > 0 ? money(i.cost) : '', i.points > 0 ? `${i.points} SP` : ''].filter(Boolean).join(' + ') || t('бесплатно')}</Badge>
                      </div>
                      <span className="text-sm text-2">{i.description}</span>
                      {!on && (
                        <span className="row text-xs text-warning">
                          <Icon name="alert" size={12} />
                          {i.skipRisk}
                        </span>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </Card>
          <Card title={t('Стратегия запуска')} term="launchStrategy">
            <Choice options={STRATEGIES.map((x) => ({ id: x.id, title: x.title, text: x.text }))} value={strategy} onChange={setStrategy} />
          </Card>
        </div>

        <div className="stack sticky">
          <Card title={t('Готовность продукта')}>
            <div className="stack-sm">
              {done.map((id) => (
                <div key={id} className="row text-sm">
                  <Icon name="checkCircle" size={15} className="text-success" />
                  {featureDef(sc, id).name}
                </div>
              ))}
              {ctx.mustMissing.length > 0 && (
                <Callout tone="danger" title={t('Не готовы обязательные функции')}>
                  {t('{0}. Без них сегмент не воспримет продукт.', [ctx.mustMissing.map((id) => featureDef(sc, id).name).join(', ')])}
                </Callout>
              )}
              {!ctx.revenueEnabled && <Callout tone="danger">{t('Платёжная функция не готова — продукт не сможет зарабатывать.')}</Callout>}
            </div>
          </Card>
          <Card title={t('Закрытая бета')} term="beta" desc={t('4 недели, до 400 человек из листа ожидания')}>
            {beta ? (
              <ul className="bullets">
                {beta.lines.map((l, i) => (
                  <li key={i}>
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="stack">
                <p className="text-sm text-2">
                  {t('Бета находит баги, показывает первые метрики активации и удержания и даёт обратную связь до публичного запуска. Команда продолжит работать над продуктом.')}
                </p>
                <Callout tone={elapsed + 4 > commit ? 'warning' : 'info'} icon="clock">
                  {t('Запуск сдвинется на 4 недели: будет {0} из обещанных {1} нед. {2}', [elapsed + 4, commit, elapsed + 4 > commit ? t(' Срок будет сорван — доверие CEO упадёт.') : ''])}
                </Callout>
                <Button icon="users" onClick={() => dispatch({ type: 'run_beta' })}>
                  {t('Провести бету · 4 недели')}
                </Button>
              </div>
            )}
          </Card>
          <Card title={t('Итого к запуску')}>
            <dl className="kv">
              <dt>{t('Пункты чек-листа')}</dt>
              <dd>
                {t('{0} из {1}', [selected.length, items.length])}
              </dd>
              <dt>{t('Деньги')}</dt>
              <dd>{money(cost)}</dd>
              <dt>{t('Работа команды')}</dt>
              <dd>{points} SP</dd>
              <dt>{t('Стратегия')}</dt>
              <dd>{STRATEGIES.find((x) => x.id === strategy)?.title.split(' ')[0]}</dd>
            </dl>
          </Card>
        </div>
      </div>

      <TurnBar stats={[{ label: t('Чек-лист'), value: t('{0} из {1}', [selected.length, items.length]) }, { label: t('Стоимость'), value: money(cost) }]} note={t('Деньги спишутся сразу, а работа команды — в первый месяц после запуска.')}>
        <Button variant="primary" size="lg" icon="rocket" disabled={cost > state.cash} onClick={launch}>
          {t('Запустить продукт')}
        </Button>
      </TurnBar>
    </div>
  );
}
