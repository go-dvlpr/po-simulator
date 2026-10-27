import type { ButtonHTMLAttributes, ReactNode, RefObject } from 'react';
import { useEffect, useRef } from 'react';
import { fixed } from '../../format.ts';
import { useGame } from '../context.ts';
import type { GlossaryId } from '../glossary.ts';
import { Hint } from './Hint.tsx';
import type { IconName } from './Icon.tsx';
import { Icon } from './Icon.tsx';
import { t } from '../../i18n/index.ts';

export type Tone = 'success' | 'danger' | 'warning' | 'info' | 'accent' | 'neutral';

// ---------- Buttons ----------

export function Button(
  props: ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    icon?: IconName;
    iconRight?: IconName;
    block?: boolean;
  },
) {
  const { variant = 'secondary', size = 'md', icon, iconRight, block, className, children, ...rest } = props;
  const cls = [
    'btn',
    variant !== 'secondary' && `btn-${variant}`,
    size !== 'md' && `btn-${size}`,
    children === undefined && 'btn-icon',
    block && 'btn-block',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button type="button" className={cls} {...rest}>
      {icon && <Icon name={icon} size={size === 'lg' ? 18 : 16} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === 'lg' ? 18 : 16} />}
    </button>
  );
}

export function Theory(props: { article: string; label?: string }) {
  const { openArticle } = useGame();
  return (
    <button type="button" className="theory" onClick={() => openArticle(props.article)}>
      <Icon name="book" size={13} />
      {props.label ?? t('Теория')}
    </button>
  );
}

// ---------- Surfaces ----------

export function Card(props: {
  title?: ReactNode;
  term?: GlossaryId;
  help?: string;
  desc?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
  bordered?: boolean;
}) {
  const hasHeader = props.title || props.desc || props.actions;
  return (
    <section className={`card ${props.className ?? ''}`}>
      {hasHeader && (
        <header className={`card-header ${props.bordered ? 'bordered' : ''}`}>
          <div className="grow">
            {props.title && (
              <h3 className="card-title">
                {props.title}
                {(props.term || props.help) && <Hint term={props.term} text={props.help} title={props.term ? undefined : props.title} />}
              </h3>
            )}
            {props.desc && <p className="card-desc">{props.desc}</p>}
          </div>
          {props.actions && <div className="card-actions">{props.actions}</div>}
        </header>
      )}
      {props.children !== undefined && <div className={`card-body ${props.bodyClassName ?? ''}`}>{props.children}</div>}
      {props.footer && <footer className="card-footer">{props.footer}</footer>}
    </section>
  );
}

export function PageIntro(props: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-intro">
      <p>{props.children}</p>
      {props.actions && <div className="row wrap">{props.actions}</div>}
    </div>
  );
}

export function SectionTitle(props: { title: ReactNode; actions?: ReactNode }) {
  return (
    <div className="section-title">
      <h3>{props.title}</h3>
      {props.actions}
    </div>
  );
}

// ---------- Data display ----------

export function Kpi(props: {
  label: string;
  value: ReactNode;
  hint?: string;
  term?: GlossaryId;
  delta?: number | null;
  good?: 'up' | 'down';
  tone?: 'success' | 'danger' | 'warning';
  spark?: (number | null)[];
  sparkColor?: string;
  size?: 'sm' | 'md';
  inset?: boolean;
  foot?: ReactNode;
  bench?: { text: string; tone: 'good' | 'ok' | 'bad' };
}) {
  const { delta, good = 'up' } = props;
  const showDelta = delta !== undefined && delta !== null && Number.isFinite(delta);
  let deltaTone = '';
  if (showDelta && Math.abs(delta) > 0.0005) deltaTone = (delta > 0) === (good === 'up') ? 'good' : 'bad';
  const cls = ['kpi', props.size === 'sm' && 'sm', props.inset && 'inset', props.tone && `tone-${props.tone}`].filter(Boolean).join(' ');
  return (
    <div className={cls}>
      <div className="kpi-label">
        {props.label}
        {(props.hint || props.term) && <Hint term={props.term} text={props.hint} title={props.term ? undefined : props.label} />}
      </div>
      <div className="kpi-value">{props.value}</div>
      {(showDelta || props.spark || props.foot) && (
        <div className="kpi-foot">
          {showDelta ? (
            <span className={`delta ${deltaTone}`}>
              <Icon name={delta >= 0 ? 'arrowUp' : 'arrowDown'} size={11} strokeWidth={2.4} />
              {fixed(Math.abs(delta * 100), 1)}%
            </span>
          ) : (
            <span className="text-xs text-muted">{props.foot}</span>
          )}
          {props.spark && <Sparkline values={props.spark} color={props.sparkColor} />}
        </div>
      )}
      {props.bench && (
        <div className={`kpi-bench ${props.bench.tone}`}>
          <i />
          {props.bench.text}
        </div>
      )}
    </div>
  );
}

export function Sparkline(props: { values: (number | null)[]; color?: string }) {
  const vals = props.values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (vals.length < 2) return null;
  const w = 72;
  const h = 22;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h - 2 - ((v - min) / span) * (h - 4)}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <polyline points={pts} fill="none" stroke={props.color ?? 'var(--accent)'} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function Badge(props: { tone?: Tone; dot?: boolean; outline?: boolean; children: ReactNode; tip?: string }) {
  const tone = props.tone && props.tone !== 'neutral' ? `badge-${props.tone}` : '';
  return (
    <span className={`badge ${tone} ${props.dot ? 'badge-dot' : ''} ${props.outline ? 'badge-outline' : ''}`} data-tip={props.tip}>
      {props.children}
    </span>
  );
}

export function Progress(props: { value: number; max?: number; tone?: 'success' | 'warning' | 'danger' | 'info' | 'auto'; lg?: boolean; tip?: string }) {
  const max = props.max ?? 100;
  const ratio = Math.max(0, Math.min(1, props.value / max));
  const tone = props.tone === 'auto' ? (ratio > 0.6 ? 'success' : ratio > 0.3 ? 'warning' : 'danger') : props.tone;
  return (
    <div className={`progress ${props.lg ? 'lg' : ''}`} data-tip={props.tip}>
      <div className={`progress-bar ${tone ?? ''}`} style={{ width: `${ratio * 100}%` }} />
    </div>
  );
}

export function Ring(props: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const size = props.size ?? 120;
  const stroke = props.stroke ?? 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, props.value));
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--fill-strong)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={props.color ?? 'var(--accent)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * v} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-label">{props.children}</div>
    </div>
  );
}

export function Tip(props: { text: string; term?: GlossaryId }) {
  return <Hint term={props.term} text={props.text} />;
}

export function Callout(props: { tone?: 'info' | 'warning' | 'danger' | 'success'; title?: ReactNode; children?: ReactNode; icon?: IconName }) {
  const tone = props.tone ?? 'info';
  const icon = props.icon ?? (tone === 'success' ? 'checkCircle' : tone === 'info' ? 'info' : 'alert');
  return (
    <div className={`callout callout-${tone}`}>
      <Icon name={icon} size={16} />
      <div>
        {props.title && <div className="callout-title">{props.title}</div>}
        {props.children}
      </div>
    </div>
  );
}

export function Empty(props: { icon?: IconName; title?: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name={props.icon ?? 'sparkles'} size={18} />
      </div>
      {props.title && <div className="empty-title">{props.title}</div>}
      {props.children && <div>{props.children}</div>}
      {props.action}
    </div>
  );
}

// Renders **bold** inline markup.
export function Inline(props: { text: string }) {
  const parts = props.text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>))}
    </>
  );
}

// ---------- Inputs ----------

export function Field(props: { label?: ReactNode; hint?: ReactNode; term?: GlossaryId; help?: string; children: ReactNode }) {
  return (
    <label className="field">
      {props.label && (
        <span className="label">
          {props.label}
          {(props.term || props.help) && <Hint term={props.term} text={props.help} title={props.term ? undefined : props.label} />}
        </span>
      )}
      {props.children}
      {props.hint && <span className="field-hint">{props.hint}</span>}
    </label>
  );
}

export function Segmented<T extends string | number>(props: { options: { id: T; label: ReactNode; disabled?: boolean }[]; value: T; onChange: (id: T) => void }) {
  return (
    <div className="segmented" role="radiogroup">
      {props.options.map((o) => (
        <button
          key={String(o.id)}
          type="button"
          role="radio"
          aria-checked={o.id === props.value}
          className={o.id === props.value ? 'active' : ''}
          disabled={o.disabled}
          onClick={() => props.onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch(props: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; desc?: ReactNode; disabled?: boolean; term?: GlossaryId }) {
  const toggle = () => {
    if (!props.disabled) props.onChange(!props.checked);
  };
  return (
    <div className="switch-row" onClick={toggle}>
      <button
        type="button"
        role="switch"
        aria-checked={props.checked}
        disabled={props.disabled}
        className={`switch ${props.checked ? 'on' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
      />
      <div className="switch-text">
        <strong>
          {props.label}
          {props.term && <Hint term={props.term} />}
        </strong>
        {props.desc && <span>{props.desc}</span>}
      </div>
    </div>
  );
}

export function Choice<T extends string>(props: {
  options: { id: T; title: ReactNode; text?: ReactNode; foot?: ReactNode; badge?: ReactNode; disabled?: boolean }[];
  value: T | null;
  onChange: (id: T) => void;
  wide?: boolean;
}) {
  return (
    <div className={`option-grid ${props.wide ? 'two' : ''}`} role="radiogroup">
      {props.options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={props.value === o.id}
          disabled={o.disabled}
          className={`option ${props.value === o.id ? 'selected' : ''}`}
          onClick={() => props.onChange(o.id)}
        >
          <div className="option-head">
            <div className="option-title">{o.title}</div>
            {o.badge ?? <span className="radio-dot" />}
          </div>
          {o.text && <div className="option-text">{o.text}</div>}
          {o.foot && <div className="option-foot">{o.foot}</div>}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>(props: { tabs: { id: T; label: ReactNode }[]; active: T; onChange: (id: T) => void }) {
  return (
    <nav className="tabs">
      {props.tabs.map((t) => (
        <button key={t.id} type="button" className={t.id === props.active ? 'tab active' : 'tab'} onClick={() => props.onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </nav>
  );
}

// ---------- Overlays ----------

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Moves focus into a dialog, keeps Tab inside it, closes on Escape and returns focus on close.
// Only the dialog that holds focus reacts, so stacked dialogs close one at a time.
export function useDialog(ref: RefObject<HTMLElement | null>, onClose?: () => void) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!node.contains(document.activeElement)) node.focus();
    const onKey = (e: KeyboardEvent) => {
      if (!node.contains(document.activeElement)) return;
      if (e.key === 'Escape' && close.current) {
        e.preventDefault();
        close.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === node)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (previous && document.contains(previous)) previous.focus();
    };
  }, [ref]);
}

export function Modal(props: {
  title?: ReactNode;
  desc?: ReactNode;
  header?: ReactNode;
  onClose?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg' | 'xl';
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDialog(ref, props.onClose);
  return (
    <div className="overlay" onClick={props.onClose}>
      <div ref={ref} tabIndex={-1} className={`modal ${props.size ?? ''}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {(props.title || props.header || props.onClose) && (
          <header className="modal-header">
            <div className="grow">
              {props.header}
              {props.title && <h2 className="modal-title">{props.title}</h2>}
              {props.desc && <p className="modal-desc">{props.desc}</p>}
            </div>
            {props.onClose && <Button variant="ghost" size="sm" icon="x" onClick={props.onClose} aria-label={t('Закрыть')} />}
          </header>
        )}
        <div className="modal-body">{props.children}</div>
        {props.footer && <footer className="modal-footer">{props.footer}</footer>}
      </div>
    </div>
  );
}

export function Drawer(props: { title: ReactNode; desc?: ReactNode; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useDialog(ref, props.onClose);
  return (
    <>
      <div className="drawer-overlay" onClick={props.onClose} />
      <aside ref={ref} tabIndex={-1} className="drawer" role="dialog" aria-modal="true">
        <header className="drawer-header row-between">
          <div>
            <h2 className="modal-title">{props.title}</h2>
            {props.desc && <p className="modal-desc">{props.desc}</p>}
          </div>
          <Button variant="ghost" size="sm" icon="x" onClick={props.onClose} aria-label={t('Закрыть')} />
        </header>
        <div className="drawer-body">{props.children}</div>
      </aside>
    </>
  );
}

// ---------- Turn bar ----------

export function TurnBar(props: { stats?: { label: string; value: ReactNode }[]; note?: ReactNode; children: ReactNode }) {
  return (
    <footer className="turnbar">
      <div className="turnbar-info">
        {props.stats?.map((s) => (
          <div key={s.label} className="turnbar-meta">
            <span>{s.label}</span>
            <strong>{s.value}</strong>
          </div>
        ))}
        {props.note && <div className="turnbar-note">{props.note}</div>}
      </div>
      <div className="turnbar-actions">{props.children}</div>
    </footer>
  );
}
