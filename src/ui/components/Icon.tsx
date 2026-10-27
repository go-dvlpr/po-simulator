// Inline stroke icons (24×24 grid), so the app needs no icon dependency.

const PATHS = {
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  monitor: 'M4 4h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z M8 20h8 M12 16v4',
  inbox: 'M3 13l2.5-8h13L21 13 M3 13v6a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-6 M3 13h5l1.5 3h5L16 13h5',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8 M3 3v5h5 M12 7v5l3 2',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z M9 4v14 M15 6v14',
  flask: 'M9 3h6 M10 3v6L4.6 18.4A2 2 0 0 0 6.3 21.5h11.4a2 2 0 0 0 1.7-3.1L14 9V3 M7.5 15h9',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M12 12h.01',
  layers: 'M12 3 2 8l10 5 10-5-10-5z M2 13l10 5 10-5 M2 17.5l10 5 10-5',
  code: 'M8 6l-6 6 6 6 M16 6l6 6-6 6 M13.5 4l-3 16',
  rocket: 'M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.8-.9.8-2.3-.1-3.1a2.2 2.2 0 0 0-2.9.1z M12 15l-3-3a22 22 0 0 1 2-4A12.9 12.9 0 0 1 22 2c0 2.7-.8 7.5-6 11a22.4 22.4 0 0 1-4 2z M9 12H4s.6-3 2-4c1.6-1.1 5 0 5 0 M12 15v5s3-.6 4-2c1.1-1.6 0-5 0-5',
  trending: 'M3 17l6-6 4 4 8-8 M15 7h6v6',
  trendingDown: 'M3 7l6 6 4-4 8 8 M15 17h6v-6',
  trophy: 'M8 21h8 M12 17v4 M7 4h10v5a5 5 0 0 1-10 0V4z M17 5h3v1a3 3 0 0 1-3 3 M7 5H4v1a3 3 0 0 0 3 3',
  book: 'M4 19.5V5a2 2 0 0 1 2-2h14v15H6.5A2.5 2.5 0 0 0 4 20.5 2.5 2.5 0 0 0 6.5 23H20 M8 7h8 M8 11h6',
  compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M15.5 8.5l-2 5-5 2 2-5 5-2z',
  plus: 'M12 5v14 M5 12h14',
  x: 'M6 6l12 12 M18 6L6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  chevronRight: 'M9 6l6 6-6 6',
  chevronDown: 'M6 9l6 6 6-6',
  chevronUp: 'M6 15l6-6 6 6',
  lock: 'M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z M8 11V8a4 4 0 0 1 8 0v3',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M2 21c0-3.9 3.1-7 7-7s7 3.1 7 7 M16 3.2a4 4 0 0 1 0 7.6 M22 21c0-3.3-2-6-5-6.8',
  userPlus: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M2 21c0-3.9 3.1-7 7-7s7 3.1 7 7 M19 8v6 M16 11h6',
  file: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6z M14 3v6h6 M8 13h8 M8 17h5',
  megaphone: 'M3 10v4a1 1 0 0 0 1 1h3l7 5V4L7 9H4a1 1 0 0 0-1 1z M18 8.5a5 5 0 0 1 0 7',
  box: 'M21 8l-9-5-9 5 9 5 9-5z M3 8v8l9 5 9-5V8 M12 13v8',
  split: 'M16 3h5v5 M8 3H3v5 M21 3l-7 7 M3 3l7 7 M12 14v7',
  activity: 'M3 12h4l3-8 4 16 3-8h4',
  card: 'M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M3 10h18 M7 15h3',
  server: 'M5 3h14a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M5 14h14a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2z M7 6.5h.01 M7 17.5h.01',
  wallet: 'M19 7V5a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-4a2 2 0 0 0 0 4h4v2a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V6',
  alert: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z M12 9v4 M12 17h.01',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 16v-4 M12 8h.01',
  checkCircle: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M8.5 12.5l2.5 2.5 4.5-5',
  xCircle: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M15 9l-6 6 M9 9l6 6',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  arrowRight: 'M5 12h14 M13 6l6 6-6 6',
  arrowLeft: 'M19 12H5 M11 6l-6 6 6 6',
  arrowUp: 'M12 19V5 M6 11l6-6 6 6',
  arrowDown: 'M12 5v14 M6 13l6 6 6-6',
  arrowTop: 'M12 20V8 M6 14l6-6 6 6 M5 4h14',
  refresh: 'M21 12a9 9 0 1 1-2.6-6.4L21 8 M21 3v5h-5',
  message: 'M21 12a8.5 8.5 0 0 1-12.5 7.5L3 21l1.5-5.5A8.5 8.5 0 1 1 21 12z',
  sparkles: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z',
  shield: 'M12 3l8 3v6c0 5-3.4 8.3-8 9.5C7.4 20.3 4 17 4 12V6l8-3z',
  shieldCheck: 'M12 3l8 3v6c0 5-3.4 8.3-8 9.5C7.4 20.3 4 17 4 12V6l8-3z M8.5 12l2.5 2.5 4.5-5',
  heart: 'M12 20.5s-8-4.6-8-10.6A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8 2.9c0 6-8 10.6-8 10.6z',
  building: 'M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16 M16 9h3a1 1 0 0 1 1 1v11 M2 21h20 M8 7h4 M8 11h4 M8 15h4',
  briefcase: 'M5 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M3 13h18',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M3 12h18 M12 3a14 14 0 0 1 0 18 M12 3a14 14 0 0 0 0 18',
  calendar: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M3 10h18 M8 3v4 M16 3v4',
  play: 'M7 4.5v15l12-7.5-12-7.5z',
  dollar: 'M12 2v20 M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  grid: 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M20 20l-4-4',
  restart: 'M3 12a9 9 0 1 0 2.6-6.4L3 8 M3 3v5h5',
  sliders: 'M4 6h9 M17 6h3 M4 12h3 M11 12h9 M4 18h11 M19 18h1 M15 4v4 M9 10v4 M17 16v4',
  zap: 'M13 2 4 14h7l-1 8 9-12h-7l1-8z',
  star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9L12 3z',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  flag: 'M5 21V4 M5 4h11l-2 4 2 4H5',
  bug: 'M8 9h8v6a4 4 0 0 1-8 0V9z M9 9V7a3 3 0 0 1 6 0v2 M3 13h5 M16 13h5 M4 8l4 2 M20 8l-4 2 M4 19l4-2 M20 19l-4-2',
  wrench: 'M14.7 6.3a4 4 0 0 0 5 5L22 13.6 13.6 22l-2.3-2.3a4 4 0 0 0-5-5L2 10.4 10.4 2l2.3 2.3a4 4 0 0 0 2 2z',
  percent: 'M19 5 5 19 M7 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  logOut: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3 M10 17l5-5-5-5 M15 12H4',
  thumbsUp: 'M7 10v11 M15 5.9 14 10h5.8a2 2 0 0 1 2 2.3l-1.4 7A2 2 0 0 1 18.4 21H7V10l4-8a3 3 0 0 1 4 3.9z M3 10h4v11H3z',
  pie: 'M21.2 15.9A10 10 0 1 1 8 2.8 M22 12A10 10 0 0 0 12 2v10z',
} satisfies Record<string, string>;

export type IconName = keyof typeof PATHS;

export function Icon(props: { name: IconName; size?: number; className?: string; strokeWidth?: number }) {
  const size = props.size ?? 16;
  return (
    <svg
      className={props.className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={props.strokeWidth ?? 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[props.name]} />
    </svg>
  );
}
