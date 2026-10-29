import { t } from '../../i18n/index.ts';
import { PHASES } from '../navigation.ts';

// The seven stages as a road on a map: passed stages are ticked, the current one glows, later ones are locked.

interface Stop {
  x: number;
  y: number;
  color: string;
  icon: string;
  caption: string;
}

const STOPS: Stop[] = [
  { x: 80, y: 270, color: '#5AA9FF', icon: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3', caption: t('1–8 недель') },
  { x: 280, y: 190, color: '#A89CFF', icon: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', caption: t('сегмент и цена') },
  { x: 480, y: 240, color: '#E879C6', icon: 'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5', caption: t('MVP, команда, стек') },
  { x: 680, y: 160, color: '#F5B544', icon: 'M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16', caption: t('спринты по 2 недели') },
  { x: 880, y: 220, color: '#FF7A6B', icon: 'M5 15c-1 2-1 4-1 5 1 0 3 0 5-1M9 15l-3-3c1-5 5-9 11-9 0 6-4 10-9 11z', caption: t('бета и чек-лист') },
  { x: 1080, y: 130, color: '#4FD1B5', icon: 'M3 17l6-6 4 4 8-8M15 7h6v6', caption: t('12–14 месяцев') },
  { x: 1270, y: 190, color: '#F5B544', icon: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4', caption: t('решение инвесторов') },
];

const ROAD = 'M80 270 C180 270 180 190 280 190 C380 190 380 240 480 240 C580 240 580 160 680 160 C780 160 780 220 880 220 C980 220 980 130 1080 130 C1180 130 1180 190 1270 190';
const LOCK = 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3';

export function JourneyMap(props: { current: number; details?: string[] }) {
  return (
    <svg viewBox="0 0 1340 380" width="100%" role="img" aria-label={t('Карта пути из семи этапов')} className="journey-map">
      <path d="M0 380 L0 320 Q120 270 240 310 T480 306 T720 320 T960 290 T1200 310 T1340 290 L1340 380 Z" className="journey-hills" />
      <path d="M520 120 L590 34 L660 120 Z" className="journey-mountain" />
      <path d="M610 120 L660 62 L710 120 Z" className="journey-mountain far" />
      <path d="M150 210 l16 -34 l16 34 z" fill="#2E7A68" />
      <path d="M176 214 l13 -28 l13 28 z" fill="#1F5A4E" />
      <rect x="1010" y="62" width="30" height="78" className="journey-city" />
      <rect x="1044" y="86" width="24" height="54" className="journey-city far" />
      <rect x="1126" y="70" width="28" height="70" className="journey-city" />
      <rect x="1016" y="74" width="6" height="6" fill="#F5B544" />
      <rect x="1134" y="86" width="6" height="6" fill="#F5B544" />
      <path d={ROAD} fill="none" className="journey-road-shadow" strokeWidth="40" strokeLinecap="round" transform="translate(0 6)" />
      <path d={ROAD} fill="none" className="journey-road" strokeWidth="40" strokeLinecap="round" />
      <path d={ROAD} fill="none" className="journey-road-line" strokeWidth="4" strokeLinecap="round" strokeDasharray="3 18" />

      {STOPS.map((stop, i) => {
        const state = i < props.current ? 'done' : i === props.current ? 'current' : 'locked';
        const last = i === STOPS.length - 1;
        const label = last ? t('Раунд A') : PHASES[i].label;
        return (
          <g key={i}>
            {props.details?.[i] && <title>{props.details[i]}</title>}
            <ellipse cx={stop.x} cy={stop.y + 32} rx="42" ry="11" className="journey-shadow" />
            {state === 'current' && <circle cx={stop.x} cy={stop.y} r="44" fill={stop.color} opacity="0.2" />}
            <circle cx={stop.x} cy={stop.y + 3} r="30" fill={state === 'locked' ? '#2A3558' : stop.color} opacity={state === 'locked' ? 1 : 0.55} />
            <circle cx={stop.x} cy={stop.y} r="30" fill={state === 'locked' ? '#35416C' : stop.color} stroke={state === 'locked' ? '#4A5788' : '#0E1220'} strokeWidth="3" />
            <g transform={`translate(${stop.x - 12} ${stop.y - 12})`}>
              <path d={state === 'done' ? 'M5 12l5 5 9-10' : stop.icon} fill="none" stroke={state === 'locked' ? stop.color : '#0E1220'} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </g>
            {state === 'locked' && (
              <g>
                <circle cx={stop.x + 23} cy={stop.y - 23} r="12" fill="#0E1220" stroke="#4A5788" strokeWidth="2" />
                <g transform={`translate(${stop.x + 16} ${stop.y - 30}) scale(0.6)`}>
                  <path d={LOCK} fill="none" stroke="#B3BCD1" strokeWidth="3" strokeLinejoin="round" />
                </g>
              </g>
            )}
            {state === 'current' && (
              <g>
                <rect x={stop.x - 40} y={stop.y - 78} width="80" height="24" rx="8" fill="#4FD1B5" />
                <path d={`M${stop.x - 8} ${stop.y - 54} l8 10 l8 -10 z`} fill="#4FD1B5" />
                <text x={stop.x} y={stop.y - 61} textAnchor="middle" className="journey-pin">
                  {props.current === 0 ? t('Старт тут') : t('Вы здесь')}
                </text>
              </g>
            )}
            <text x={stop.x} y={stop.y + 58} textAnchor="middle" className={`journey-label ${last ? 'final' : ''}`}>
              {label}
            </text>
            <text x={stop.x} y={stop.y + 74} textAnchor="middle" className="journey-caption">
              {stop.caption}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
