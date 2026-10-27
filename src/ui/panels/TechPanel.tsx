import { useState } from 'react';
import { PRACTICES, PROCESSES, TECH_CATEGORY_NAMES } from '../../data/tech.ts';
import { scenarioOf, techOption, techOptions, techSetupPoints, techSum } from '../../engine/catalog.ts';
import type { PracticeId, TechCategory, TechOption } from '../../engine/types.ts';
import { money } from '../../format.ts';
import { Icon } from '../components/Icon.tsx';
import type { IconName } from '../components/Icon.tsx';
import { Callout, Card, Kpi, Switch, Theory } from '../components/common.tsx';
import { useGame } from '../context.ts';
import { t } from '../../i18n/index.ts';

type Item = TechCategory | 'practices' | 'process';

const ITEMS: { id: Item; icon: IconName }[] = [
  { id: 'platform', icon: 'layers' },
  { id: 'backend', icon: 'server' },
  { id: 'infra', icon: 'globe' },
  { id: 'payments', icon: 'card' },
  { id: 'auth', icon: 'shield' },
  { id: 'analytics', icon: 'activity' },
  { id: 'experiments', icon: 'split' },
  { id: 'practices', icon: 'shieldCheck' },
  { id: 'process', icon: 'refresh' },
];

const LOCKED_AFTER_SETUP: Item[] = ['platform', 'backend', 'infra', 'payments', 'auth'];

const ITEM_NAMES: Record<Item, string> = { ...TECH_CATEGORY_NAMES, practices: t('Инженерные практики'), process: t('Процесс разработки') };

function OptionCard(props: { option: TechOption; selected: boolean; disabled: boolean; onSelect: () => void }) {
  const o = props.option;
  return (
    <button type="button" className={`option ${props.selected ? 'selected' : ''}`} disabled={props.disabled} onClick={props.onSelect}>
      <div className="option-head">
        <div className="option-title">{o.name}</div>
        <span className="radio-dot" />
      </div>
      <div className="option-text">{o.description}</div>
      <ul className="proscons">
        {o.pros.map((p) => (
          <li key={p} className="pro">
            <Icon name="check" size={13} strokeWidth={2.4} />
            {p}
          </li>
        ))}
        {o.cons.map((c) => (
          <li key={c} className="con">
            <Icon name="x" size={13} strokeWidth={2.4} />
            {c}
          </li>
        ))}
      </ul>
    </button>
  );
}

export function TechPanel() {
  const { state, dispatch } = useGame();
  const sc = scenarioOf(state);
  const [item, setItem] = useState<Item>('platform');
  const setup = state.phase === 'setup';
  const platform = techOption(sc, 'platform', state.tech.platform);
  const locked = !setup && LOCKED_AFTER_SETUP.includes(item);

  const currentLabel = (id: Item): string => {
    if (id === 'practices') return state.tech.practices.length === 0 ? t('не выбраны') : t('{0} из {1}', [state.tech.practices.length, PRACTICES.length]);
    if (id === 'process') return PROCESSES.find((p) => p.id === state.tech.process)?.name ?? '';
    if (id === 'backend' && platform.mods.disablesBackend) return t('входит в no-code');
    return techOption(sc, id, state.tech[id]).name;
  };

  return (
    <div className="stack">
      <div className="kpi-grid">
        <Kpi label={t('Настройка перед разработкой')} term="setupPoints" value={`${setup ? techSetupPoints(state) : Math.round(state.product.setupPoints)} SP`} hint={t('Работа команды на инфраструктуру: аналитика, CI, кластер. Съест часть первых спринтов.')} />
        <Kpi label={t('Инфраструктура')} value={t('от {0}/мес', [money(techSum(state, 'infraFixed'))])} foot={t('плюс расходы на каждого пользователя')} />
        <Kpi label={t('Сервисы и подписки')} value={t('{0}/мес', [money(techSum(state, 'monthly'))])} />
      </div>

      {!setup && (
        <Callout tone="info" icon="lock">
          {t('После старта разработки можно менять только аналитику, A/B-платформу, практики и процесс. Каждое изменение добавляет работы команде.')}
        </Callout>
      )}

      <Card bodyClassName="flush">
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 280px) minmax(0, 1fr)' }} className="tech-layout">
          <nav style={{ borderRight: '1px solid var(--border)', padding: '8px' }}>
            {ITEMS.map((it) => {
              const isLocked = !setup && LOCKED_AFTER_SETUP.includes(it.id);
              return (
                <button key={it.id} type="button" className={`sb-item ${item === it.id ? 'active' : ''}`} style={{ alignItems: 'flex-start', padding: '9px 10px' }} onClick={() => setItem(it.id)}>
                  <Icon name={it.icon} size={16} />
                  <span className="grow stack-xs" style={{ gap: 1 }}>
                    <span>{ITEM_NAMES[it.id]}</span>
                    <span className="text-xs text-muted" style={{ fontWeight: 400 }}>
                      {currentLabel(it.id)}
                    </span>
                  </span>
                  {isLocked && <Icon name="lock" size={12} />}
                </button>
              );
            })}
          </nav>
          <div style={{ padding: '18px 20px 20px' }} className="stack">
            <div className="row-between">
              <div>
                <h3 className="card-title">{ITEM_NAMES[item]}</h3>
                <p className="card-desc">{t('Влияет на скорость разработки, баги, техдолг, расходы и доступные каналы')}</p>
              </div>
              <Theory article={item === 'practices' ? 'tech-debt' : item === 'process' ? 'agile' : item === 'analytics' ? 'analytics' : item === 'experiments' ? 'ab-testing' : 'tech-stack'} />
            </div>

            {item === 'practices' && (
              <div className="stack">
                {PRACTICES.map((p) => {
                  const on = state.tech.practices.includes(p.id);
                  return (
                    <Switch
                      key={p.id}
                      checked={on}
                      disabled={!setup && on}
                      label={p.name}
                      desc={p.description}
                      onChange={() => {
                        const next: PracticeId[] = on ? state.tech.practices.filter((x) => x !== p.id) : [...state.tech.practices, p.id];
                        dispatch({ type: 'set_tech', patch: { practices: next } });
                      }}
                    />
                  );
                })}
              </div>
            )}

            {item === 'process' && (
              <div className="option-grid">
                {PROCESSES.map((p) => (
                  <button key={p.id} type="button" className={`option ${state.tech.process === p.id ? 'selected' : ''}`} onClick={() => dispatch({ type: 'set_tech', patch: { process: p.id } })}>
                    <div className="option-head">
                      <div className="option-title">{p.name}</div>
                      <span className="radio-dot" />
                    </div>
                    <div className="option-text">{p.description}</div>
                  </button>
                ))}
              </div>
            )}

            {item !== 'practices' && item !== 'process' && (
              <>
                {item === 'backend' && platform.mods.disablesBackend ? (
                  <Callout tone="info">{t('На no-code платформе бэкенд входит в саму платформу.')}</Callout>
                ) : (
                  <div className="option-grid">
                    {techOptions(sc, item).map((o) => {
                      const invalid = item === 'payments' && (o.id === 'web_stripe') !== (state.tech.platform === 'pwa');
                      return (
                        <OptionCard
                          key={o.id}
                          option={o}
                          selected={state.tech[item] === o.id}
                          disabled={locked || invalid}
                          onSelect={() => dispatch({ type: 'set_tech', patch: { [item]: o.id } })}
                        />
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
