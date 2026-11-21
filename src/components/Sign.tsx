import type { ReactNode } from 'react';

// Simplified drawings of UK road signs (based on "Know Your Traffic Signs").
const RED = '#d4351c', BLUE = '#1d5fb4', GREEN = '#00703c', BROWN = '#6b3a1f', BLK = '#111';

const ring = (c: ReactNode, fill = '#fff') => (<><circle cx="50" cy="50" r="44" fill={fill} stroke={RED} strokeWidth="10" />{c}</>);
const disc = (c: ReactNode) => (<><circle cx="50" cy="50" r="47" fill={BLUE} />{c}</>);
const warn = (c: ReactNode) => (<><path d="M50 9 93 86H7Z" fill="#fff" stroke={RED} strokeWidth="8" strokeLinejoin="round" />{c}</>);
const rect = (fill: string, c: ReactNode) => (<><rect x="4" y="16" width="92" height="68" rx="6" fill={fill} stroke="#fff" strokeWidth="3" />{c}</>);
const arrow = (rot: number, fill = '#fff', scale = 1) => (
  <path d="M50 18 70 42H57V82H43V42H30Z" fill={fill} transform={`rotate(${rot} 50 50) translate(50 50) scale(${scale}) translate(-50 -50)`} />
);
const slash = <line x1="20" y1="80" x2="80" y2="20" stroke={RED} strokeWidth="9" />;
const txt = (t: string, size = 34, fill = BLK, y = 50) => (
  <text x="50" y={y} dominantBaseline="central" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontWeight="700" fontSize={size} fill={fill}>{t}</text>
);
const person = (x: number, s = 1) => (
  <g transform={`translate(${x} 0) scale(${s}) `} stroke={BLK} strokeWidth="4" strokeLinecap="round" fill="none">
    <circle cx="0" cy="44" r="4" fill={BLK} stroke="none" />
    <path d="M0 50V66M0 66L-6 80M0 66L6 80M-7 55 7 58" />
  </g>
);

const SIGNS: Record<string, () => ReactNode> = {
  'no-entry': () => (<><circle cx="50" cy="50" r="47" fill={RED} /><rect x="18" y="42" width="64" height="16" fill="#fff" /></>),
  national: () => (<><circle cx="50" cy="50" r="45" fill="#fff" stroke={BLK} strokeWidth="3" /><line x1="22" y1="78" x2="78" y2="22" stroke={BLK} strokeWidth="14" /></>),
  'speed-30': () => ring(txt('30', 40)),
  'speed-50': () => ring(txt('50', 40)),
  'min-30': () => disc(txt('30', 40, '#fff')),
  'no-right': () => ring(<>{arrow(90, BLK, 0.75)}{slash}</>),
  'no-left': () => ring(<>{arrow(-90, BLK, 0.75)}{slash}</>),
  'no-uturn': () => ring(<><path d="M38 78V46a12 12 0 0 1 24 0V60" fill="none" stroke={BLK} strokeWidth="9" /><path d="M52 58h20L62 74Z" fill={BLK} />{slash}</>),
  'no-overtaking': () => ring(<><rect x="28" y="34" width="18" height="32" rx="4" fill={RED} /><rect x="54" y="34" width="18" height="32" rx="4" fill={BLK} /></>),
  'turn-left': () => disc(arrow(-90)),
  'ahead-only': () => disc(arrow(0)),
  'keep-left': () => disc(arrow(225)),
  'mini-roundabout': () => disc(<g fill="none" stroke="#fff" strokeWidth="7"><path d="M50 26a24 24 0 0 1 21 12" /><path d="M71 62a24 24 0 0 1-21 12" /><path d="M29 62a24 24 0 0 1 0-24" /><path d="M64 30 76 40 62 44Z M58 78 44 74 54 64Z M22 46 30 34 36 46Z" fill="#fff" stroke="none" /></g>),
  stop: () => (<><path d="M31 4h38l27 27v38L69 96H31L4 69V31Z" fill={RED} stroke="#fff" strokeWidth="3" />{txt('STOP', 26, '#fff')}</>),
  'give-way': () => (<><path d="M7 14H93L50 90Z" fill="#fff" stroke={RED} strokeWidth="8" strokeLinejoin="round" />{txt('GIVE', 12, BLK, 32)}{txt('WAY', 12, BLK, 46)}</>),
  'no-waiting': () => ring(<line x1="20" y1="20" x2="80" y2="80" stroke={RED} strokeWidth="9" />, BLUE),
  'no-stopping': () => ring(<><line x1="20" y1="20" x2="80" y2="80" stroke={RED} strokeWidth="9" /><line x1="80" y1="20" x2="20" y2="80" stroke={RED} strokeWidth="9" /></>, BLUE),
  crossroads: () => warn(<path d="M45 36h10v16h16v10H55v20H45V62H29V52h16Z" fill={BLK} />),
  't-junction': () => warn(<path d="M28 44h44v10H55v28H45V54H28Z" fill={BLK} />),
  'bend-right': () => warn(<path d="M44 82V64q0-14 14-22l6-4" fill="none" stroke={BLK} strokeWidth="9" />),
  roundabout: () => warn(<g fill="none" stroke={BLK} strokeWidth="5"><circle cx="50" cy="62" r="13" /><path d="M60 45 66 52 57 54Z M37 71 32 63 41 63Z" fill={BLK} /></g>),
  narrows: () => warn(<g fill="none" stroke={BLK} strokeWidth="6"><path d="M36 82V70l8-10V40" /><path d="M64 82V70l-8-10V40" /></g>),
  'two-way': () => warn(<><g transform="translate(-11 14) scale(0.55) translate(40 40)">{arrow(0, BLK)}</g><g transform="translate(11 14) scale(0.55) translate(40 40)">{arrow(180, BLK)}</g></>),
  signals: () => warn(<><rect x="41" y="34" width="18" height="46" rx="4" fill={BLK} /><circle cx="50" cy="43" r="5" fill={RED} /><circle cx="50" cy="57" r="5" fill="#f5a300" /><circle cx="50" cy="71" r="5" fill={GREEN} /></>),
  pedestrians: () => warn(person(50)),
  children: () => warn(<>{person(42)}{person(60, 0.8)}</>),
  'hill-down': () => warn(<><path d="M24 80h52L24 56Z" fill={BLK} />{txt('10%', 15, BLK, 72)}</>),
  danger: () => warn(txt('!', 44, BLK, 62)),
  'dead-end': () => rect(BLUE, <><rect x="44" y="38" width="12" height="40" fill="#fff" /><rect x="30" y="28" width="40" height="11" fill={RED} /></>),
  'one-way': () => rect(BLUE, arrow(0, '#fff', 0.8)),
  countdown: () => (<><rect x="26" y="4" width="48" height="92" rx="4" fill={BLUE} />{[22, 46, 70].map((y) => <path key={y} d={`M32 ${y + 8}l36-12v8l-36 12Z`} fill="#fff" />)}</>),
  motorway: () => rect(BLUE, txt('M1', 30, '#fff')),
  primary: () => rect(GREEN, txt('A40', 26, '#f5d000')),
  local: () => rect('#fff', <><rect x="4" y="16" width="92" height="68" rx="6" fill="#fff" stroke={BLK} strokeWidth="3" />{txt('Town', 22)}</>),
  tourist: () => rect(BROWN, txt('Castle', 20, '#fff')),
  hospital: () => (<><rect x="10" y="10" width="80" height="80" rx="6" fill={BLUE} /><rect x="22" y="22" width="56" height="56" fill="#fff" />{txt('H', 44, BLUE)}</>),
  parking: () => (<><rect x="10" y="10" width="80" height="80" rx="6" fill={BLUE} />{txt('P', 56, '#fff')}</>),
};

export function Sign({ id, size = 96 }: { id: string; size?: number }) {
  const draw = SIGNS[id];
  if (!draw) return null;
  return (
    <svg className="sign" width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Road sign">{draw()}</svg>
  );
}

export interface SignCard { id: string; meaning: string; group: 'Orders' | 'Warnings' | 'Information'; note?: string }

export const SIGN_CARDS: SignCard[] = [
  { id: 'stop', meaning: 'Stop and give way', group: 'Orders', note: 'The only octagonal sign. Stop at the line.' },
  { id: 'give-way', meaning: 'Give way to traffic on the major road', group: 'Orders', note: 'The only inverted triangle.' },
  { id: 'no-entry', meaning: 'No entry for vehicular traffic', group: 'Orders' },
  { id: 'national', meaning: 'National speed limit applies', group: 'Orders', note: 'Cars: 60 mph single, 70 mph dual carriageway/motorway.' },
  { id: 'speed-30', meaning: 'Maximum speed 30 mph', group: 'Orders' },
  { id: 'speed-50', meaning: 'Maximum speed 50 mph', group: 'Orders' },
  { id: 'no-right', meaning: 'No right turn', group: 'Orders' },
  { id: 'no-left', meaning: 'No left turn', group: 'Orders' },
  { id: 'no-uturn', meaning: 'No U-turns', group: 'Orders' },
  { id: 'no-overtaking', meaning: 'No overtaking', group: 'Orders' },
  { id: 'no-waiting', meaning: 'No waiting', group: 'Orders' },
  { id: 'no-stopping', meaning: 'No stopping (clearway)', group: 'Orders' },
  { id: 'min-30', meaning: 'Minimum speed 30 mph', group: 'Orders', note: 'Blue circles give positive instructions.' },
  { id: 'turn-left', meaning: 'Turn left', group: 'Orders' },
  { id: 'ahead-only', meaning: 'Ahead only', group: 'Orders' },
  { id: 'keep-left', meaning: 'Keep left', group: 'Orders' },
  { id: 'mini-roundabout', meaning: 'Mini-roundabout (give way to traffic from the right)', group: 'Orders' },
  { id: 'crossroads', meaning: 'Crossroads', group: 'Warnings' },
  { id: 't-junction', meaning: 'T-junction', group: 'Warnings' },
  { id: 'bend-right', meaning: 'Bend to the right', group: 'Warnings' },
  { id: 'roundabout', meaning: 'Roundabout', group: 'Warnings' },
  { id: 'narrows', meaning: 'Road narrows on both sides', group: 'Warnings' },
  { id: 'two-way', meaning: 'Two-way traffic ahead', group: 'Warnings' },
  { id: 'signals', meaning: 'Traffic signals ahead', group: 'Warnings' },
  { id: 'pedestrians', meaning: 'Pedestrians in road ahead', group: 'Warnings' },
  { id: 'children', meaning: 'Children going to or from school', group: 'Warnings' },
  { id: 'hill-down', meaning: 'Steep hill downwards', group: 'Warnings' },
  { id: 'danger', meaning: 'Other danger (plate explains)', group: 'Warnings' },
  { id: 'dead-end', meaning: 'No through road', group: 'Information' },
  { id: 'one-way', meaning: 'One-way traffic', group: 'Information' },
  { id: 'countdown', meaning: 'Countdown marker: 300 yards to exit', group: 'Information' },
  { id: 'motorway', meaning: 'Motorway sign (blue)', group: 'Information' },
  { id: 'primary', meaning: 'Primary route (green)', group: 'Information' },
  { id: 'local', meaning: 'Non-primary/local route (white)', group: 'Information' },
  { id: 'tourist', meaning: 'Tourist destination (brown)', group: 'Information' },
  { id: 'hospital', meaning: 'Hospital ahead', group: 'Information' },
  { id: 'parking', meaning: 'Parking place', group: 'Information' },
];
