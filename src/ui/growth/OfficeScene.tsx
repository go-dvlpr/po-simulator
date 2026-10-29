import { featureDef, scenarioOf } from '../../engine/catalog.ts';
import type { RoleId, TeamMember } from '../../engine/types.ts';
import { t } from '../../i18n/index.ts';
import { useGame } from '../context.ts';

// The office drawn from the real game state: who is on the team and what they are busy with.

const ROLE_COLOR: Record<RoleId, string> = {
  developer: '#5AA9FF',
  qa: '#4FD1B5',
  designer: '#E879C6',
  analyst: '#A89CFF',
  devops: '#7FB6FF',
  marketer: '#F5B544',
  support: '#C9A7FF',
  sales: '#FF8A7A',
};

const ROLE_ORDER: RoleId[] = ['developer', 'qa', 'designer', 'devops', 'analyst', 'marketer', 'sales', 'support'];
const SKIN = ['#F1C7A3', '#8D5B3E', '#F3D1B5', '#E0B08A', '#C68E68'];
const HAIR = ['#3B2A22', '#1E1714', '#C2452D', '#6B4A2E', '#2B2B33'];
const LEVEL: Record<TeamMember['level'], string> = { junior: 'Junior', middle: 'Middle', senior: 'Senior' };

interface Bubble {
  text: string;
  tone: 'info' | 'bad' | 'warn';
  progress?: number;
}

const TONE = {
  info: { fill: '#16223A', stroke: '#5AA9FF', text: '#EAEEF7' },
  bad: { fill: '#2A1A22', stroke: '#FF7A6B', text: '#FFB3A9' },
  warn: { fill: '#2A2416', stroke: '#F5B544', text: '#FFD98F' },
};

function hash(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

function short(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function Station(props: { x: number; member: TeamMember; bubble?: Bubble }) {
  const { member, bubble } = props;
  const color = ROLE_COLOR[member.role];
  const skin = SKIN[hash(member.id) % SKIN.length];
  const hair = HAIR[hash(member.id + 'h') % HAIR.length];
  const tone = bubble ? TONE[bubble.tone] : null;
  return (
    <g transform={`translate(${props.x},0)`}>
      <rect x="10" y="228" width="8" height="62" rx="3" fill="#2E3966" />
      <rect x="10" y="284" width="52" height="9" rx="4" fill="#2E3966" />
      <rect x="32" y="293" width="6" height="24" fill="#2E3966" />
      <rect x="18" y="314" width="34" height="5" rx="2" fill="#2E3966" />
      <rect x="24" y="228" width="40" height="58" rx="16" fill={color} />
      <circle cx="45" cy="210" r="16" fill={skin} />
      <path d="M29 208c0-10 8-16 16-16s16 6 16 14c-6-4-12-6-20-4-4 1-8 3-12 6z" fill={hair} />
      <rect x="52" y="246" width="58" height="10" rx="5" fill={color} opacity="0.8" />
      <rect x="80" y="258" width="120" height="10" rx="2" fill="#3D4A72" />
      <rect x="88" y="268" width="6" height="50" fill="#2E3966" />
      <rect x="186" y="268" width="6" height="50" fill="#2E3966" />
      <rect x="120" y="206" width="72" height="48" rx="5" fill="#0F1526" stroke={bubble?.tone === 'bad' ? '#FF7A6B' : '#3D4A72'} strokeWidth="2" />
      <rect x="128" y="216" width="40" height="4" rx="2" fill={color} />
      <rect x="128" y="226" width="52" height="4" rx="2" fill="#3D4A72" />
      <rect x="128" y="236" width="30" height="4" rx="2" fill="#3D4A72" />
      <rect x="152" y="254" width="8" height="5" fill="#3D4A72" />
      {bubble && tone && (
        <g>
          <rect x="14" y="146" width="182" height={bubble.progress === undefined ? 40 : 46} rx="14" fill={tone.fill} stroke={tone.stroke} strokeWidth="2" />
          <text x="28" y={bubble.progress === undefined ? 171 : 166} fontFamily="Inter, sans-serif" fontSize="12.5" fontWeight="700" fill={tone.text}>
            {short(bubble.text, 22)}
          </text>
          {bubble.progress !== undefined && (
            <>
              <rect x="28" y="175" width="154" height="7" rx="3.5" fill="#283350" />
              <rect x="28" y="175" width={Math.max(6, 154 * bubble.progress)} height="7" rx="3.5" fill={tone.stroke} />
            </>
          )}
        </g>
      )}
      <rect x="18" y="328" width="168" height="24" rx="8" fill="#0E1220" stroke={color} strokeWidth="2" />
      <text x="30" y="345" fontFamily="Inter, sans-serif" fontSize="12" fontWeight="700" fill="#EAEEF7">
        {short(`${member.name} · ${LEVEL[member.level]}`, 24)}
      </text>
    </g>
  );
}

export function OfficeScene() {
  const { state } = useGame();
  const sc = scenarioOf(state);
  const last = state.history[state.history.length - 1];
  const team = state.team
    .filter((m) => m.joinWeek <= state.week)
    .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));
  const shown = team.slice(0, 4);
  const extra = team.length - shown.length;

  // What people are busy with comes from the real queue, bugs, creatives and support load.
  const current = state.featureQueue.find((id) => !state.product.features[id]?.completed);
  const bubbles = new Map<string, Bubble>();
  const devs = shown.filter((m) => m.role === 'developer');
  if (current && devs[0]) {
    const def = featureDef(sc, current);
    const done = state.product.features[current]?.done ?? 0;
    bubbles.set(devs[0].id, { text: def.name, tone: 'info', progress: Math.min(1, done / Math.max(1, def.effort)) });
  }
  const bugHolder = devs[1] ?? shown.find((m) => m.role === 'qa');
  if (state.product.bugs >= 20 && bugHolder) bubbles.set(bugHolder.id, { text: t('Багов: {0}', [Math.round(state.product.bugs)]), tone: 'bad' });
  const marketer = shown.find((m) => m.role === 'marketer');
  const tired = sc.channels.some((c) => c.fatigue && state.marketing.budgets[c.id] > 0 && state.marketing.creative[c.id] < 0.7);
  if (marketer && tired) bubbles.set(marketer.id, { text: t('Креативы выгорают'), tone: 'warn' });
  const support = shown.find((m) => m.role === 'support');
  if (support && last?.support && last.support.tickets > last.support.capacity) bubbles.set(support.id, { text: t('Очередь обращений'), tone: 'bad' });

  // The whiteboard shows the real MRR trend.
  const mrr = state.history.slice(-8).map((r) => r.mrr);
  const top = Math.max(1, ...mrr);
  const trend = mrr.map((v, i) => `${320 + (i * 190) / Math.max(1, mrr.length - 1)},${132 - (v / top) * 70}`).join(' ');
  const spacing = 190;

  return (
    <section className="card office">
      <svg viewBox="0 0 900 360" width="100%" role="img" aria-label={t('Офис: команда за работой')} className="office-svg">
        <rect x="0" y="0" width="900" height="322" className="office-wall" />
        <rect x="0" y="322" width="900" height="38" className="office-floor" />
        <rect x="0" y="316" width="900" height="6" fill="#28325A" />
        <rect x="24" y="30" width="230" height="124" rx="10" fill="#0B1020" stroke="#2E3966" strokeWidth="4" />
        <circle cx="212" cy="58" r="13" fill="#F2E7C9" />
        <circle cx="206" cy="54" r="13" fill="#0B1020" />
        <rect x="36" y="94" width="34" height="60" fill="#222C4D" />
        <rect x="74" y="76" width="40" height="78" fill="#283463" />
        <rect x="118" y="102" width="30" height="52" fill="#222C4D" />
        <rect x="152" y="86" width="44" height="68" fill="#283463" />
        <rect x="200" y="110" width="44" height="44" fill="#222C4D" />
        <rect x="82" y="86" width="6" height="6" fill="#F5B544" />
        <rect x="160" y="98" width="6" height="6" fill="#F5B544" />
        <rect x="44" y="106" width="6" height="6" fill="#F5B544" />
        <path d="M139 30v124M24 92h230" stroke="#2E3966" strokeWidth="4" />
        <rect x="300" y="36" width="230" height="116" rx="8" fill="#E8ECF4" stroke="#B8C0D6" strokeWidth="4" />
        <text x="316" y="58" fontFamily="Inter, sans-serif" fontSize="12" fontWeight="800" fill="#1B2337">MRR</text>
        {mrr.length > 1 && <polyline points={trend} fill="none" stroke="#6D5CF6" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
        <rect x="566" y="250" width="22" height="70" rx="4" fill="#28325A" />
        <path d="M577 252c-18-14-22-34-12-50 6 14 12 20 12 30 2-14 10-26 22-30 4 18-6 36-22 50z" fill="#3FB68E" />
        {shown.map((m, i) => (
          <Station key={m.id} x={6 + i * spacing} member={m} bubble={bubbles.get(m.id)} />
        ))}
        {extra > 0 && (
          <g>
            <rect x="720" y="286" width="70" height="28" rx="10" fill="#0E1220" stroke="#3A4666" strokeWidth="2" />
            <text x="755" y="305" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="13" fontWeight="800" fill="#EAEEF7">
              +{extra}
            </text>
          </g>
        )}
        <rect x="806" y="150" width="86" height="172" rx="4" fill="#232D52" />
        <rect x="812" y="156" width="74" height="166" rx="3" fill="#2E3A66" />
        <rect x="824" y="172" width="50" height="18" rx="4" fill="#F5B544" />
        <text x="849" y="185" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="10.5" fontWeight="800" fill="#2A1A00">
          CEO
        </text>
        <circle cx="874" cy="250" r="4" fill="#F5B544" />
        {state.trust < 45 && (
          <g>
            <circle cx="812" cy="232" r="15" fill="#F1C7A3" />
            <rect x="798" y="248" width="16" height="40" rx="8" fill="#6D5CF6" />
            <path d="M680 194h112a12 12 0 0 1 12 12v10a12 12 0 0 1-12 12h-58l-10 10v-10h-44a12 12 0 0 1-12-12v-10a12 12 0 0 1 12-12z" fill="#EAEEF7" stroke="#B8C0D6" strokeWidth="2" />
            <text x="690" y="216" fontFamily="Inter, sans-serif" fontSize="12.5" fontWeight="800" fill="#1B2337">
              {t('Нам надо поговорить')}
            </text>
          </g>
        )}
      </svg>
    </section>
  );
}
