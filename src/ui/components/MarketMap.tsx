import { scenarioOf } from '../../engine/catalog.ts';
import { t } from '../../i18n/index.ts';
import { useGame } from '../context.ts';

// The four segments as hex regions under a fog. Each report on a segment clears part of its fog;
// the map shows only how much you have researched, never the hidden truth.

const COLORS = [
  { top: '#2F9C86', side: '#1D6556', ring: '#4FD1B5' },
  { top: '#3B78C9', side: '#264E85', ring: '#5AA9FF' },
  { top: '#B8559A', side: '#7E3A69', ring: '#E879C6' },
  { top: '#C98A2E', side: '#86591B', ring: '#F5B544' },
];
const FOG = { top: '#262E4C', side: '#181E36' };
const W = 700;
const H = 440;

function hexPoints(cx: number, cy: number, dy = 0): string {
  return [
    [cx, cy - 50 + dy],
    [cx + 43, cy - 25 + dy],
    [cx + 43, cy + 25 + dy],
    [cx, cy + 50 + dy],
    [cx - 43, cy + 25 + dy],
    [cx - 43, cy - 25 + dy],
  ]
    .map((p) => p.join(','))
    .join(' ');
}

export function MarketMap() {
  const { state } = useGame();
  const sc = scenarioOf(state);
  const segments = sc.segments.slice(0, 4);
  const reports = segments.map((seg) => state.reports.filter((r) => r.params.segmentId === seg.id).length);
  const researching = segments.map((seg) => state.activeResearch.some((r) => r.params.segmentId === seg.id));
  const opened = reports.map((n) => Math.min(6, n * 3));

  const cells: { points: string; base: string; top: string; side: string; cloud: boolean; cx: number; cy: number }[] = [];
  const seen = [0, 0, 0, 0];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 6; c++) {
      const seg = (r < 2 ? 0 : 2) + (c < 3 ? 0 : 1);
      const cx = 103 + c * 90 + (r % 2) * 45;
      const cy = 112 + r * 76;
      const open = seen[seg] < opened[seg];
      seen[seg]++;
      const color = open ? COLORS[seg] : FOG;
      cells.push({ points: hexPoints(cx, cy), base: hexPoints(cx, cy, 6), top: color.top, side: color.side, cloud: !open && (r + c) % 2 === 0, cx, cy });
    }
  }

  // Label positions: the middle of each 3×2 block of hexes.
  const anchors = [
    { x: 30.7, y: 4 },
    { x: 69.3, y: 4 },
    { x: 30.7, y: 92 },
    { x: 69.3, y: 92 },
  ];
  const tokens = [
    { x: 30, y: 37 },
    { x: 69, y: 37 },
    { x: 30, y: 72 },
    { x: 69, y: 72 },
  ];
  const researched = opened.reduce((a, b) => a + b, 0);

  return (
    <section className="card market-map">
      <header className="card-header">
        <div className="grow">
          <h3 className="card-title">{t('Карта рынка')}</h3>
          <p className="card-desc">{t('Туман — то, чего вы ещё не знаете. Его снимают исследования сегментов, а не догадки')}</p>
        </div>
        <span className="badge badge-success">{t('Разведано {0} из 24 клеток', [researched])}</span>
      </header>
      <div className="card-body">
        <div className="market-map-board">
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" aria-hidden="true">
            {cells.map((cell, i) => (
              <g key={i}>
                <polygon points={cell.base} fill={cell.side} />
                <polygon points={cell.points} fill={cell.top} className="hex" />
                {cell.cloud && <path d={`M${cell.cx - 18} ${cell.cy + 10}h34a10 10 0 0 0 0-20 14 14 0 0 0-27-3 9 9 0 0 0-7 23z`} fill="#3A4570" />}
              </g>
            ))}
          </svg>
          {segments.map((seg, i) => (
            <span key={seg.id} className={`market-banner ${opened[i] === 6 ? 'open' : opened[i] > 0 ? 'partial' : ''}`} style={{ left: `${anchors[i].x}%`, top: `${anchors[i].y}%`, borderColor: opened[i] > 0 ? COLORS[i].ring : undefined }}>
              {seg.short}
              <small>{reports[i] > 0 ? t('отчётов: {0}', [reports[i]]) : t('туман')}</small>
            </span>
          ))}
          {segments.map((seg, i) =>
            researching[i] ? (
              <span key={seg.id} className="market-token" style={{ left: `${tokens[i].x}%`, top: `${tokens[i].y}%` }} title={t('Здесь идёт исследование')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2F6FB8" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true">
                  <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3" />
                </svg>
              </span>
            ) : null,
          )}
        </div>
      </div>
    </section>
  );
}
