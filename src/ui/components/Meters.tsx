// Game-style meters for the resource bar. They only draw numbers the game already has.

// Runway as a battery: one cell per month, ten cells at most.
export function Battery(props: { months: number }) {
  const filled = Number.isFinite(props.months) ? Math.max(0, Math.min(10, Math.round(props.months))) : 10;
  const tone = props.months < 3 ? 'danger' : props.months < 6 ? 'warning' : 'success';
  return (
    <span className={`battery ${tone}`} aria-hidden="true">
      <span className="battery-body">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={`battery-cell ${i < filled ? 'on' : ''}`} />
        ))}
      </span>
      <span className="battery-tip" />
    </span>
  );
}

const HEART = 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z';

// Trust out of 100 as five hearts: full, half or empty.
export function Hearts(props: { value: number }) {
  return (
    <span className="hearts" aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => {
        const left = props.value - i * 20;
        const state = left >= 20 ? 'heart-full' : left >= 10 ? 'heart-half' : 'heart-off';
        return (
          <svg key={i} className={`heart ${state}`} width="14" height="14" viewBox="0 0 24 24">
            <path d={HEART} />
          </svg>
        );
      })}
    </span>
  );
}

// A share of a budget as small cells, like hours left in the turn.
export function Ticks(props: { value: number; max: number; count?: number }) {
  const count = props.count ?? 12;
  const filled = props.max > 0 ? Math.round((Math.max(0, props.value) / props.max) * count) : 0;
  return (
    <span className="ticks" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={`tick ${i < filled ? 'on' : ''}`} />
      ))}
    </span>
  );
}

// Team morale as a face: smiling, neutral or sad.
export function MoodFace(props: { value: number; size?: number }) {
  const size = props.size ?? 18;
  const mouth = props.value >= 60 ? 'M8 14c2 2.5 6 2.5 8 0' : props.value >= 40 ? 'M8.5 15h7' : 'M8 16c2-2.5 6-2.5 8 0';
  return (
    <svg className="mood" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <circle cx="8.8" cy="10" r="1.4" className="mood-eye" />
      <circle cx="15.2" cy="10" r="1.4" className="mood-eye" />
      <path d={mouth} className="mood-mouth" />
    </svg>
  );
}
