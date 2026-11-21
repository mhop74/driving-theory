// Official sign artwork taken from "The Highway Code – Traffic signs"
// (Department for Transport, Crown copyright, Open Government Licence v3.0).
// The images are in public/signs/<id>.png.

export function Sign({ id, size = 96 }: { id: string; size?: number }) {
  return (
    <img className="sign" src={`./signs/${id}.png`} alt="Road sign" width={size} height={size}
      style={{ width: size, height: size, objectFit: 'contain' }} loading="lazy" decoding="async" />
  );
}

export interface SignCard { id: string; meaning: string; group: 'Orders' | 'Warnings' | 'Information'; note?: string }

export const SIGN_CARDS: SignCard[] = [
  // Signs giving orders
  { id: 'stop', meaning: 'Stop and give way', group: 'Orders', note: 'The only octagonal sign. Stop at the line.' },
  { id: 'give-way', meaning: 'Give way to traffic on major road', group: 'Orders', note: 'The only inverted triangle.' },
  { id: 'no-entry', meaning: 'No entry for vehicular traffic', group: 'Orders' },
  { id: 'national', meaning: 'National speed limit applies', group: 'Orders', note: 'Cars: 60 mph on single carriageways, 70 mph on dual carriageways and motorways.' },
  { id: 'speed-40', meaning: 'Maximum speed', group: 'Orders' },
  { id: 'no-vehicles', meaning: 'No vehicles except bicycles being pushed', group: 'Orders' },
  { id: 'no-cycling', meaning: 'No cycling', group: 'Orders' },
  { id: 'no-motor', meaning: 'No motor vehicles', group: 'Orders' },
  { id: 'no-overtaking', meaning: 'No overtaking', group: 'Orders' },
  { id: 'no-right', meaning: 'No right turn', group: 'Orders' },
  { id: 'no-left', meaning: 'No left turn', group: 'Orders' },
  { id: 'no-uturn', meaning: 'No U-turns', group: 'Orders' },
  { id: 'give-priority', meaning: 'Give priority to vehicles from opposite direction', group: 'Orders' },
  { id: 'no-waiting', meaning: 'No waiting', group: 'Orders' },
  { id: 'no-stopping', meaning: 'No stopping (Clearway)', group: 'Orders' },
  { id: 'ahead-only', meaning: 'Ahead only', group: 'Orders', note: 'Blue circles give positive instructions.' },
  { id: 'turn-left-ahead', meaning: 'Turn left ahead (right if symbol reversed)', group: 'Orders' },
  { id: 'turn-left', meaning: 'Turn left (right if symbol reversed)', group: 'Orders' },
  { id: 'keep-left', meaning: 'Keep left (right if symbol reversed)', group: 'Orders' },
  { id: 'pass-either', meaning: 'Vehicles may pass either side to reach same destination', group: 'Orders' },
  { id: 'mini-roundabout', meaning: 'Mini-roundabout (give way to vehicles from the immediate right)', group: 'Orders' },
  { id: 'cycles-only', meaning: 'Route to be used by pedal cycles only', group: 'Orders' },
  { id: 'min-30', meaning: 'Minimum speed', group: 'Orders' },
  { id: 'end-min', meaning: 'End of minimum speed', group: 'Orders' },
  // Warning signs
  { id: 'dual-ends', meaning: 'Dual carriageway ends', group: 'Warnings', note: 'Triangles warn.' },
  { id: 'narrows-right', meaning: 'Road narrows on right (left if symbol reversed)', group: 'Warnings' },
  { id: 'narrows', meaning: 'Road narrows on both sides', group: 'Warnings' },
  { id: 'crossroads', meaning: 'Crossroads', group: 'Warnings' },
  { id: 't-junction', meaning: 'T-junction with priority over vehicles from the right', group: 'Warnings', note: 'The priority route is shown by the broader line.' },
  { id: 'staggered', meaning: 'Staggered junction', group: 'Warnings' },
  { id: 'double-bend', meaning: 'Double bend first to left (symbol may be reversed)', group: 'Warnings' },
  { id: 'bend-right', meaning: 'Bend to right (or left if symbol reversed)', group: 'Warnings' },
  { id: 'roundabout', meaning: 'Roundabout', group: 'Warnings' },
  { id: 'uneven', meaning: 'Uneven road', group: 'Warnings' },
  { id: 'two-way-crosses', meaning: 'Two-way traffic crosses one-way road', group: 'Warnings' },
  { id: 'two-way', meaning: 'Two-way traffic straight ahead', group: 'Warnings' },
  { id: 'falling-rocks', meaning: 'Falling or fallen rocks', group: 'Warnings' },
  { id: 'signals', meaning: 'Traffic signals', group: 'Warnings' },
  { id: 'slippery', meaning: 'Slippery road', group: 'Warnings' },
  { id: 'hill-down', meaning: 'Steep hill downwards', group: 'Warnings' },
  { id: 'hill-up', meaning: 'Steep hill upwards', group: 'Warnings' },
  { id: 'tunnel', meaning: 'Tunnel ahead', group: 'Warnings' },
  { id: 'level-barrier', meaning: 'Level crossing with barrier or gate ahead', group: 'Warnings' },
  { id: 'level-no-barrier', meaning: 'Level crossing without barrier or gate ahead', group: 'Warnings' },
  { id: 'level-crossbar', meaning: 'Level crossing without barrier', group: 'Warnings' },
  { id: 'children', meaning: 'Children going to or from school / school crossing patrol ahead', group: 'Warnings' },
  { id: 'elderly', meaning: 'Frail (or blind or disabled if shown) pedestrians likely to cross road ahead', group: 'Warnings' },
  { id: 'pedestrians', meaning: 'Pedestrians in road ahead', group: 'Warnings' },
  { id: 'zebra', meaning: 'Zebra crossing', group: 'Warnings' },
  { id: 'cattle', meaning: 'Cattle', group: 'Warnings' },
  { id: 'wild-animals', meaning: 'Wild animals', group: 'Warnings' },
  { id: 'wild-horses', meaning: 'Wild horses or ponies', group: 'Warnings' },
  { id: 'horses', meaning: 'Accompanied horses or ponies', group: 'Warnings' },
  { id: 'cycle-route', meaning: 'Cycle route ahead', group: 'Warnings' },
  { id: 'ice', meaning: 'Risk of ice', group: 'Warnings' },
  { id: 'queues', meaning: 'Traffic queues likely ahead', group: 'Warnings' },
  { id: 'humps', meaning: 'Distance over which road humps extend', group: 'Warnings' },
  { id: 'danger', meaning: 'Other danger (a plate shows the nature of the danger)', group: 'Warnings' },
  { id: 'side-winds', meaning: 'Side winds', group: 'Warnings' },
  { id: 'hump-bridge', meaning: 'Hump bridge', group: 'Warnings' },
  { id: 'quayside', meaning: 'Quayside or river bank', group: 'Warnings' },
  { id: 'roadworks', meaning: 'Road works', group: 'Warnings' },
  // Information and direction signs
  { id: 'one-way', meaning: 'One-way traffic', group: 'Information', note: 'Compare with the circular "Ahead only" sign.' },
  { id: 'dead-end', meaning: 'No through road for vehicles', group: 'Information' },
  { id: 'priority-over', meaning: 'Traffic has priority over oncoming vehicles', group: 'Information' },
  { id: 'hospital', meaning: 'Hospital ahead with Accident and Emergency facilities', group: 'Information' },
  { id: 'parking', meaning: 'Parking place', group: 'Information' },
  { id: 'start-motorway', meaning: 'Start of motorway (motorway regulations apply)', group: 'Information' },
  { id: 'end-motorway', meaning: 'End of motorway', group: 'Information' },
  { id: 'countdown', meaning: 'Countdown marker at motorway exit (each bar = 100 yards)', group: 'Information' },
  { id: 'motorway', meaning: 'Motorway sign (blue background)', group: 'Information' },
  { id: 'primary', meaning: 'Primary route sign (green background)', group: 'Information' },
  { id: 'local', meaning: 'Non-primary or local route (white background, black border)', group: 'Information' },
  { id: 'tourist', meaning: 'Tourist attraction (brown background)', group: 'Information' },
];
