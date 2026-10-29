import type { ScenarioId } from '../../engine/types.ts';

// A small illustration for each product on the new-game screen. Decorative only.
export function ScenarioArt(props: { id: ScenarioId }) {
  return (
    <svg viewBox="0 0 240 120" width="100%" aria-hidden="true" className="scenario-art">
      {ART[props.id]}
    </svg>
  );
}

const ART: Record<ScenarioId, JSX.Element> = {
  b2c: (
    <>
      <rect width="240" height="120" fill="#2A1A22" />
      <circle cx="200" cy="24" r="30" fill="#FF8A7A" opacity="0.18" />
      <rect x="86" y="14" width="68" height="112" rx="12" fill="#0E1220" stroke="#FF8A7A" strokeWidth="3" />
      <rect x="96" y="28" width="48" height="58" rx="6" fill="#3A1F2A" />
      <path d="M120 70s-14-8-14-19a7 7 0 0 1 14-4 7 7 0 0 1 14 4c0 11-14 19-14 19z" fill="#FF8A7A" />
      <rect x="100" y="94" width="40" height="8" rx="4" fill="#FF8A7A" />
      <rect x="24" y="74" width="44" height="12" rx="6" fill="#5C6B90" />
      <rect x="16" y="66" width="12" height="28" rx="4" fill="#8892AB" />
      <rect x="64" y="66" width="12" height="28" rx="4" fill="#8892AB" />
      <rect x="170" y="84" width="50" height="10" rx="5" fill="#F5B544" />
    </>
  ),
  b2b: (
    <>
      <rect width="240" height="120" fill="#16223A" />
      <rect x="40" y="16" width="160" height="92" rx="10" fill="#0E1220" stroke="#7FB6FF" strokeWidth="3" />
      <rect x="40" y="16" width="160" height="20" rx="10" fill="#7FB6FF" />
      <rect x="40" y="26" width="160" height="10" fill="#7FB6FF" />
      <rect x="52" y="46" width="40" height="14" rx="4" fill="#F5B544" />
      <rect x="98" y="46" width="56" height="14" rx="4" fill="#4FD1B5" />
      <rect x="52" y="66" width="70" height="14" rx="4" fill="#E879C6" />
      <rect x="128" y="66" width="60" height="14" rx="4" fill="#7FB6FF" />
      <rect x="52" y="86" width="50" height="14" rx="4" fill="#4FD1B5" />
      <rect x="108" y="86" width="44" height="14" rx="4" fill="#F5B544" />
    </>
  ),
  edtech: (
    <>
      <rect width="240" height="120" fill="#13282A" />
      <path d="M30 22h110a12 12 0 0 1 12 12v26a12 12 0 0 1-12 12H62l-18 14V72H30a12 12 0 0 1-12-12V34a12 12 0 0 1 12-12z" fill="#5FE0C2" />
      <text x="40" y="52" fontFamily="Inter, sans-serif" fontSize="15" fontWeight="800" fill="#0E1220">
        Hi! How are you?
      </text>
      <path d="M110 66h100a12 12 0 0 1 12 12v18a12 12 0 0 1-12 12h-10v10l-16-10h-74a12 12 0 0 1-12-12V78a12 12 0 0 1 12-12z" fill="#0E1220" stroke="#5FE0C2" strokeWidth="3" />
      <circle cx="140" cy="87" r="4" fill="#5FE0C2" />
      <circle cx="156" cy="87" r="4" fill="#5FE0C2" />
      <circle cx="172" cy="87" r="4" fill="#5FE0C2" />
    </>
  ),
  fintech: (
    <>
      <rect width="240" height="120" fill="#211B36" />
      <rect x="104" y="30" width="112" height="70" rx="10" fill="#C9A7FF" />
      <rect x="104" y="46" width="112" height="14" fill="#7A5CC4" />
      <rect x="118" y="76" width="40" height="8" rx="4" fill="#2A2050" />
      <ellipse cx="62" cy="100" rx="34" ry="10" fill="#B87400" />
      <rect x="28" y="84" width="68" height="16" fill="#F5B544" />
      <ellipse cx="62" cy="84" rx="34" ry="10" fill="#FFC94A" />
      <ellipse cx="62" cy="70" rx="34" ry="10" fill="#B87400" />
      <rect x="28" y="54" width="68" height="16" fill="#F5B544" />
      <ellipse cx="62" cy="54" rx="34" ry="10" fill="#FFC94A" />
      <text x="56" y="59" fontFamily="Unbounded, Inter, sans-serif" fontSize="13" fontWeight="800" fill="#B87400">
        $
      </text>
    </>
  ),
  devtool: (
    <>
      <rect width="240" height="120" fill="#2A2416" />
      <path d="M80 112V58a40 40 0 0 1 80 0v54z" fill="#8C6A2C" />
      <path d="M80 48l-10-24 26 14M160 48l10-24-26 14" fill="#8C6A2C" />
      <circle cx="104" cy="62" r="16" fill="#FFF3D6" />
      <circle cx="136" cy="62" r="16" fill="#FFF3D6" />
      <circle cx="106" cy="64" r="7" fill="#0E1220" />
      <circle cx="134" cy="64" r="7" fill="#0E1220" />
      <path d="M114 80l6 8 6-8z" fill="#FFCB6B" />
      <path d="M100 96h40" stroke="#5C4419" strokeWidth="3" strokeLinecap="round" />
      <circle cx="198" cy="34" r="16" fill="#FF7A6B" />
      <path d="M198 26v10M198 41v.5" stroke="#FFFFFF" strokeWidth="3.4" strokeLinecap="round" />
    </>
  ),
};
