// A decorative scene above an event: the boardroom, the office or the market. Purely visual.

export type SceneKind = 'board' | 'office' | 'market';

export function EventScene(props: { kind: SceneKind; accent: string }) {
  return (
    <svg viewBox="0 0 1000 220" width="100%" aria-hidden="true" className="event-scene">
      <rect width="1000" height="220" className="event-scene-wall" />
      <rect y="176" width="1000" height="44" className="event-scene-floor" />
      <polygon points="460,0 540,0 720,220 280,220" fill="#FFF3D6" opacity="0.06" />
      {props.kind === 'board' && <Board accent={props.accent} />}
      {props.kind === 'office' && <Office accent={props.accent} />}
      {props.kind === 'market' && <Market accent={props.accent} />}
    </svg>
  );
}

function Person(props: { x: number; y: number; skin: string; hair: string; shirt: string }) {
  return (
    <g transform={`translate(${props.x} ${props.y})`}>
      <circle cx="0" cy="0" r="20" fill={props.skin} />
      <path d="M-20 -4c1-12 10-18 20-18 10 0 18 6 20 16-13-4-27-3-40 2z" fill={props.hair} />
      <rect x="-22" y="22" width="44" height="44" rx="18" fill={props.shirt} />
    </g>
  );
}

function Board(props: { accent: string }) {
  return (
    <g>
      <rect x="60" y="26" width="300" height="130" rx="12" fill="#0B0F22" stroke="#3A4680" strokeWidth="5" />
      <rect x="86" y="50" width="250" height="14" rx="7" fill="#283350" />
      <rect x="86" y="50" width="150" height="14" rx="7" fill={props.accent} />
      <path d="M86 136 L130 126 L174 130 L218 112 L262 104 L306 88 L334 78" fill="none" stroke="#4FD1B5" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <Person x={440} y={86} skin="#F1C7A3" hair="#7A7F8C" shirt="#6D5CF6" />
      <path d="M422 118 L384 104" stroke="#6D5CF6" strokeWidth="11" strokeLinecap="round" />
      <path d="M560 150 H960 L990 186 H530 Z" fill="#3D4A7A" />
      <Person x={640} y={100} skin="#D9A47E" hair="#2B2B33" shirt="#3C4A70" />
      <Person x={760} y={96} skin="#8D5B3E" hair="#1E1714" shirt="#4A3F7A" />
      <Person x={880} y={100} skin="#F3D1B5" hair="#C9C9C9" shirt="#2E5E54" />
      <rect x="612" y="160" width="56" height="16" rx="4" fill="#E8ECF4" />
    </g>
  );
}

function Office(props: { accent: string }) {
  return (
    <g>
      <rect x="40" y="24" width="220" height="110" rx="10" fill="#0B1020" stroke="#2E3966" strokeWidth="4" />
      <rect x="54" y="80" width="34" height="54" fill="#222C4D" />
      <rect x="94" y="62" width="40" height="72" fill="#283463" />
      <rect x="140" y="88" width="30" height="46" fill="#222C4D" />
      <rect x="176" y="72" width="44" height="62" fill="#283463" />
      <rect x="104" y="74" width="6" height="6" fill="#F5B544" />
      <rect x="186" y="86" width="6" height="6" fill="#F5B544" />
      {[360, 620].map((x, i) => (
        <g key={x}>
          <rect x={x + 60} y="150" width="160" height="10" rx="2" fill="#3D4A72" />
          <rect x={x + 110} y="98" width="76" height="50" rx="6" fill="#0F1526" stroke={i === 0 ? props.accent : '#3D4A72'} strokeWidth="3" />
          <rect x={x + 120} y="110" width="40" height="5" rx="2.5" fill={props.accent} />
          <rect x={x + 120} y="122" width="54" height="5" rx="2.5" fill="#3D4A72" />
          <Person x={x + 30} y={100} skin={i === 0 ? '#F1C7A3' : '#8D5B3E'} hair={i === 0 ? '#3B2A22' : '#1E1714'} shirt={i === 0 ? '#5AA9FF' : '#E879C6'} />
        </g>
      ))}
    </g>
  );
}

function Market(props: { accent: string }) {
  return (
    <g>
      <rect x="40" y="60" width="120" height="116" fill="#1C2443" />
      <rect x="170" y="30" width="90" height="146" fill="#212A4D" />
      <rect x="270" y="80" width="110" height="96" fill="#1C2443" />
      <rect x="760" y="40" width="100" height="136" fill="#212A4D" />
      <rect x="870" y="70" width="90" height="106" fill="#1C2443" />
      {[60, 90, 120, 190, 220, 290, 330, 780, 820, 890, 920].map((x, i) => (
        <rect key={x} x={x} y={i % 2 === 0 ? 90 : 120} width="10" height="10" fill="#F5B544" opacity="0.8" />
      ))}
      <rect x="420" y="28" width="300" height="120" rx="14" fill="#0B0F22" stroke={props.accent} strokeWidth="5" />
      <path d="M450 120 L520 96 L580 108 L640 70 L690 54" fill="none" stroke={props.accent} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M690 54 l-18 2 m18 -2 l-4 17" stroke={props.accent} strokeWidth="6" strokeLinecap="round" />
      <rect x="560" y="148" width="20" height="28" fill="#283350" />
    </g>
  );
}
