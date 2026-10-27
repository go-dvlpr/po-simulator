// SVG charts with hover tooltips: line/area chart and stacked bars.

import type { MouseEvent } from 'react';
import { useId, useState } from 'react';
import type { ChartMarker } from '../timeline.ts';
import { t } from '../../i18n/index.ts';

export interface Series {
  name: string;
  color: string;
  values: (number | null)[];
}

export const PALETTE = ['#6366f1', '#14b8a6', '#f59e0b', '#f43f5e', '#8b5cf6', '#0ea5e9', '#84cc16', '#ec4899', '#94a3b8'];

const W = 640;
const PAD = { left: 58, right: 14, top: 12, bottom: 28 };

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(v));
  const f = v / exp;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * exp;
}

function useHoverIndex(count: number, slot: (xPx: number) => number) {
  const [index, setIndex] = useState<number | null>(null);
  const onMove = (e: MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPx = ((e.clientX - rect.left) / rect.width) * W;
    const i = slot(xPx);
    setIndex(i < 0 || i >= count ? null : i);
  };
  return { index, onMove, onLeave: () => setIndex(null) };
}

function Tooltip(props: { x: number; title: string; rows: { name: string; color: string; value: string }[]; total?: string; notes?: string[] }) {
  const left = (props.x / W) * 100;
  const style = left > 60 ? { right: `${100 - left + 2}%` } : { left: `${left + 2}%` };
  return (
    <div className="chart-tip" style={style}>
      <div className="chart-tip-title">{props.title}</div>
      {props.rows.map((r) => (
        <div key={r.name} className="chart-tip-row">
          <span>
            <i className="swatch" style={{ background: r.color }} />
            {r.name}
          </span>
          <strong>{r.value}</strong>
        </div>
      ))}
      {props.total && (
        <div className="chart-tip-row">
          <span>{t('Всего')}</span>
          <strong>{props.total}</strong>
        </div>
      )}
      {props.notes?.map((n) => (
        <div key={n} className="chart-tip-note">
          <i className="swatch marker" />
          {n}
        </div>
      ))}
    </div>
  );
}

function Legend(props: { series: Series[] }) {
  if (props.series.length < 2) return null;
  return (
    <div className="legend">
      {props.series.map((s) => (
        <span key={s.name}>
          <i className="swatch" style={{ background: s.color }} />
          {s.name}
        </span>
      ))}
    </div>
  );
}

// markers: what the player changed or what happened, drawn as dashed lines on that month.
export function LineChart(props: { series: Series[]; labels: string[]; format: (v: number) => string; height?: number; area?: boolean; markers?: ChartMarker[] }) {
  const H = props.height ?? 210;
  const gid = useId().replace(/:/g, '');
  const n = props.labels.length;
  const all = props.series.flatMap((s) => s.values).filter((v): v is number => v !== null && Number.isFinite(v));
  const rawMin = all.length ? Math.min(0, ...all) : 0;
  const max = niceMax(all.length ? Math.max(...all) : 1);
  const min = rawMin < 0 ? -niceMax(-rawMin) : 0;
  const innerW = W - PAD.left - PAD.right;
  const x = (i: number) => PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => PAD.top + (1 - (v - min) / (max - min || 1)) * (H - PAD.top - PAD.bottom);
  const hover = useHoverIndex(n, (xPx) => (n <= 1 ? 0 : Math.round(((xPx - PAD.left) / innerW) * (n - 1))));

  if (all.length === 0) return <div className="chart-empty">{t('Данных пока нет')}</div>;
  const ticks = [min, min + (max - min) / 2, max];
  const step = Math.max(1, Math.ceil(n / 8));

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} onMouseMove={hover.onMove} onMouseLeave={hover.onLeave} role="img">
        <defs>
          {props.series.map((s, si) => (
            <linearGradient key={s.name} id={`${gid}-${si}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="grid-line" />
            <text x={PAD.left - 8} y={y(t) + 3.5} textAnchor="end" className="axis-text">
              {props.format(t)}
            </text>
          </g>
        ))}
        {props.labels.map((l, i) =>
          i % step === 0 || i === n - 1 ? (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="axis-text">
              {l}
            </text>
          ) : null,
        )}
        {props.markers?.map((m) => (
          <g key={m.index}>
            <line x1={x(m.index)} x2={x(m.index)} y1={PAD.top} y2={H - PAD.bottom} className="marker-line" />
            <circle cx={x(m.index)} cy={PAD.top + 3} r={3.5} className="marker-dot" />
          </g>
        ))}
        {props.series.map((s, si) => {
          const pts = s.values.map((v, i) => (v === null || !Number.isFinite(v) ? null : ([x(i), y(v)] as const)));
          const valid = pts.filter((p): p is readonly [number, number] => p !== null);
          if (valid.length === 0) return null;
          const line = valid.map(([px, py]) => `${px},${py}`).join(' ');
          const areaPath = `M${valid[0][0]},${y(Math.max(min, 0))} L${line.replace(/ /g, ' L')} L${valid[valid.length - 1][0]},${y(Math.max(min, 0))} Z`;
          return (
            <g key={s.name}>
              {props.area !== false && props.series.length === 1 && <path d={areaPath} fill={`url(#${gid}-${si})`} />}
              <polyline points={line} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {valid.length === 1 && <circle cx={valid[0][0]} cy={valid[0][1]} r={3.5} fill={s.color} />}
            </g>
          );
        })}
        {hover.index !== null && (
          <g>
            <line x1={x(hover.index)} x2={x(hover.index)} y1={PAD.top} y2={H - PAD.bottom} className="guide" />
            {props.series.map((s) => {
              const v = s.values[hover.index ?? 0];
              return v === null || v === undefined || !Number.isFinite(v) ? null : (
                <circle key={s.name} cx={x(hover.index ?? 0)} cy={y(v)} r={4} fill="var(--panel)" stroke={s.color} strokeWidth={2} />
              );
            })}
          </g>
        )}
        <rect x={PAD.left} y={PAD.top} width={innerW} height={H - PAD.top - PAD.bottom} fill="transparent" />
      </svg>
      {hover.index !== null && (
        <Tooltip
          x={x(hover.index)}
          title={props.labels[hover.index]}
          rows={props.series.map((s) => {
            const v = s.values[hover.index ?? 0];
            return { name: s.name, color: s.color, value: v === null || v === undefined ? '—' : props.format(v) };
          })}
          notes={props.markers?.find((m) => m.index === hover.index)?.labels}
        />
      )}
      <Legend series={props.series} />
      {props.markers && props.markers.length > 0 && (
        <div className="legend">
          <span>
            <i className="swatch marker" />
            {t('Ваши решения и события — наведите на месяц')}
          </span>
        </div>
      )}
    </div>
  );
}

export function StackedBars(props: { series: Series[]; labels: string[]; format: (v: number) => string; height?: number }) {
  const H = props.height ?? 210;
  const n = Math.max(1, props.labels.length);
  const totals = props.labels.map((_, i) => props.series.reduce((sum, s) => sum + Math.max(0, s.values[i] ?? 0), 0));
  const max = niceMax(Math.max(1, ...totals));
  const innerW = W - PAD.left - PAD.right;
  const slotW = innerW / n;
  const bw = Math.min(34, slotW * 0.62);
  const y = (v: number) => PAD.top + (1 - v / max) * (H - PAD.top - PAD.bottom);
  const cx = (i: number) => PAD.left + slotW * i + slotW / 2;
  const hover = useHoverIndex(props.labels.length, (xPx) => Math.floor((xPx - PAD.left) / slotW));
  const step = Math.max(1, Math.ceil(n / 8));
  const visible = props.series.filter((s) => s.values.some((v) => (v ?? 0) > 0));

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} onMouseMove={hover.onMove} onMouseLeave={hover.onLeave} role="img">
        {[0, max / 2, max].map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="grid-line" />
            <text x={PAD.left - 8} y={y(t) + 3.5} textAnchor="end" className="axis-text">
              {props.format(t)}
            </text>
          </g>
        ))}
        {props.labels.map((l, i) => {
          let acc = 0;
          const dim = hover.index !== null && hover.index !== i;
          return (
            <g key={i} opacity={dim ? 0.45 : 1}>
              {visible.map((s, si) => {
                const v = Math.max(0, s.values[i] ?? 0);
                if (v <= 0) return null;
                const top = y(acc + v);
                const h = y(acc) - top;
                acc += v;
                const isTop = si === visible.length - 1 || visible.slice(si + 1).every((o) => (o.values[i] ?? 0) <= 0);
                return <rect key={s.name} x={cx(i) - bw / 2} y={top} width={bw} height={Math.max(0, h)} fill={s.color} rx={isTop ? 3 : 0} />;
              })}
              {(i % step === 0 || i === n - 1) && (
                <text x={cx(i)} y={H - 8} textAnchor="middle" className="axis-text">
                  {l}
                </text>
              )}
            </g>
          );
        })}
        <rect x={PAD.left} y={PAD.top} width={innerW} height={H - PAD.top - PAD.bottom} fill="transparent" />
      </svg>
      {hover.index !== null && (
        <Tooltip
          x={cx(hover.index)}
          title={props.labels[hover.index]}
          rows={visible
            .filter((s) => (s.values[hover.index ?? 0] ?? 0) > 0)
            .map((s) => ({ name: s.name, color: s.color, value: props.format(s.values[hover.index ?? 0] ?? 0) }))}
          total={props.format(totals[hover.index])}
        />
      )}
      <Legend series={visible} />
    </div>
  );
}
