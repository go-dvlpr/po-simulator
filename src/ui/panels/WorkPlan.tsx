import { sprintCapacity } from '../../engine/product.ts';
import { fixed, num } from '../../format.ts';
import { Icon } from '../components/Icon.tsx';
import { Kpi, Switch, Theory } from '../components/common.tsx';
import { useGame } from '../context.ts';
import { t } from '../../i18n/index.ts';

const ROWS: { key: 'features' | 'debt' | 'bugs'; label: string; color: string }[] = [
  { key: 'features', label: t('Новые функции'), color: '#6366f1' },
  { key: 'debt', label: t('Технический долг'), color: '#f59e0b' },
  { key: 'bugs', label: t('Исправление багов'), color: '#f43f5e' },
];

export function AllocationControl() {
  const { state, dispatch } = useGame();
  const a = state.allocation;
  const set = (key: 'features' | 'debt' | 'bugs', value: number) => {
    const rest = 1 - value;
    const others = (['features', 'debt', 'bugs'] as const).filter((k) => k !== key);
    const otherSum = others.reduce((sum, k) => sum + a[k], 0) || 1;
    const next = { ...a, [key]: value };
    for (const k of others) next[k] = (a[k] / otherSum) * rest;
    dispatch({ type: 'set_plan', allocation: next });
  };
  return (
    <div className="stack">
      <div className="row-between">
        <span className="text-strong">{t('Распределение времени команды')}</span>
        <Theory article="tech-debt" />
      </div>
      <div style={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden', background: 'var(--fill)' }}>
        {ROWS.map((r) => (
          <div key={r.key} style={{ width: `${a[r.key] * 100}%`, background: r.color, transition: 'width .2s' }} />
        ))}
      </div>
      {ROWS.map((r) => (
        <div key={r.key} className="slider-field">
          <div className="slider-head">
            <span className="row">
              <i className="swatch" style={{ background: r.color }} />
              {r.label}
            </span>
            <strong>{Math.round(a[r.key] * 100)}%</strong>
          </div>
          <input className="range" type="range" min={0} max={100} step={5} value={Math.round(a[r.key] * 100)} onChange={(e) => set(r.key, Number(e.target.value) / 100)} />
        </div>
      ))}
      <Switch checked={state.overtime} onChange={(v) => dispatch({ type: 'set_plan', overtime: v })} label={t('Овертайм')} term="overtime" desc={t('+20% скорости, но больше багов и выгорание команды')} />
    </div>
  );
}

export function CapacityInfo() {
  const { state } = useGame();
  const cap = sprintCapacity(state, null);
  return (
    <div className="stack">
      <div className="grid cols-2" style={{ gap: 10 }}>
        <Kpi inset size="sm" label={t('Скорость')} term="velocity" value={`${num(cap.total)} SP`} hint={t('Ожидаемая скорость за спринт без случайности и адаптации новичков')} foot={t('{0} разработчиков', [cap.devs])} />
        <Kpi inset size="sm" label={t('Внеплановая работа')} term="setupPoints" value={`${num(state.product.setupPoints + state.product.lostPoints)} SP`} hint={t('Настройка инфраструктуры, события, эксперименты, чек-лист — съест часть ближайших спринтов')} />
        <Kpi inset size="sm" label={t('Открытые баги')} term="bugs" value={num(state.product.bugs)} tone={state.product.bugs > 40 ? 'danger' : state.product.bugs > 20 ? 'warning' : undefined} />
        <Kpi inset size="sm" label={t('Техдолг')} term="techDebt" value={`${num(state.product.debt)} / 100`} tone={state.product.debt > 50 ? 'danger' : state.product.debt > 30 ? 'warning' : undefined} />
      </div>
      {cap.factors.length > 0 && (
        <div className="stack-xs">
          <span className="eyebrow">{t('Что влияет на скорость')}</span>
          {cap.factors.map((f) => (
            <div key={f.label} className="row-between text-sm">
              <span className="row text-2">
                <Icon name={f.value >= 1 ? 'trending' : 'trendingDown'} size={14} className={f.value >= 1 ? 'text-success' : 'text-danger'} />
                {f.label}
              </span>
              <strong className={`num ${f.value >= 1 ? 'text-success' : 'text-danger'}`}>×{fixed(f.value, 2)}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
