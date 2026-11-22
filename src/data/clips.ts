import type { HazardWindow } from '../lib/hp';
import { supports3D } from '../lib/webgl';
import { WINDOWS_3D } from './windows3d';

// Simplified top-down hazard perception clips.
// World coordinates: x across the road (0–360, road 105–255, centre line 180;
// your car drives at x=150), y = distance along the road (increasing ahead).
// Each key is [time s, x, y]; positions are interpolated linearly.

export type Kind = 'car' | 'van' | 'bus' | 'lorry' | 'bike' | 'ped' | 'child' | 'ball' | 'dog' | 'horse' | 'tractor' | 'door';
export type Key = [number, number, number];

export interface Actor {
  kind: Kind;
  keys: Key[];
  color?: string;
  /** Indicator: [from, to, 'L' | 'R'] relative to the vehicle's own direction. */
  ind?: [number, number, 'L' | 'R'];
  brake?: [number, number];
  /** Vehicle is reversing until this time (drawn facing opposite to motion). */
  revUntil?: number;
  /** Fixed facing in degrees (0 = up the screen / same way as you, 180 = towards you). */
  face?: number;
  show?: [number, number];
  beacon?: boolean;
}

export interface Layout {
  rural?: boolean;
  side?: { y: number; side: 'L' | 'R' }[];
  zebra?: number[];
  busStop?: { y: number; side: 'L' | 'R' }[];
  gate?: { y: number; side: 'L' | 'R' }[];
  drive?: { y: number; side: 'L' | 'R' }[];
}

export interface Clip {
  id: string;
  title: string;
  duration: number;
  cam: [number, number][];
  layout: Layout;
  actors: Actor[];
  hazards: HazardWindow[];
  /** Index into `actors` of the road user that is each hazard (aligned with `hazards`). */
  focus: number[];
  explain: string;
  /** Pre-rendered Unreal Engine video of this clip (path under public/). It is played instead of the
   * 3D scene and uses the 3D scoring windows, because it was rendered with the same timings and sight lines. */
  video?: {
    src: string;
    poster: string;
    /** Scoring windows for the video when they differ from the 3D scene's (e.g. a different vehicle
     * becomes visible at a different moment). Defaults to the 3D windows. */
    windows?: HazardWindow[];
  };
}

/** Clips whose video failed to load this session (they fall back to the 3D or 2D scene). */
export const videoFailed = new Set<string>();

/** Is this clip shown as its Unreal Engine video? */
export const usesVideo = (clip: Clip) => !!clip.video && !videoFailed.has(clip.id);

/** Scoring windows for the view the clip is actually shown in (3D where supported, otherwise 2D). */
export function hazardsFor(clip: Clip): HazardWindow[] {
  if (usesVideo(clip)) return clip.video!.windows ?? WINDOWS_3D[clip.id] ?? clip.hazards;
  return (supports3D() && WINDOWS_3D[clip.id]) || clip.hazards;
}

const parked = (x: number, y: number, color = '#7a8794', face = 0): Actor => ({ kind: 'car', keys: [[0, x, y]], color, face });
const oncoming = (y0: number, speed = 90, color = '#6d6875', kind: Kind = 'car'): Actor => ({ kind, keys: [[0, 215, y0], [40, 215, y0 - speed * 40]], color });

export const CLIPS: Clip[] = [
  {
    id: 'ball', title: 'Residential street', duration: 22,
    cam: [[0, 0], [8, 560], [10, 670], [12.5, 725], [16.5, 725], [17.5, 735], [22, 1100]],
    layout: {},
    actors: [
      parked(118, 640), parked(118, 700, '#a33'), parked(118, 760, '#556'), parked(118, 826, '#2a6'), parked(118, 890),
      oncoming(1500), oncoming(2600, 90, '#999'),
      { kind: 'ball', keys: [[0, 92, 793], [9.2, 92, 793], [9.8, 125, 794], [10.8, 200, 796], [12, 262, 797]] },
      { kind: 'child', keys: [[0, 84, 793], [10.2, 84, 793], [10.9, 114, 793], [11.6, 128, 793], [13.6, 128, 793], [15.6, 200, 793], [16.6, 265, 795]], color: '#e67e22' },
    ],
    hazards: [{ start: 9.2, end: 13.2, label: 'Ball rolls into the road, followed by a child' }],
    focus: [7],
    explain: 'A ball appeared between parked cars. Where there is a ball, a child often follows. Respond as soon as the ball appears.',
    video: { src: 'videos/ball.mp4', poster: 'videos/ball.jpg' },
  },
  {
    id: 'emerge-left', title: 'Side road on the left', duration: 22,
    cam: [[0, 0], [9, 630], [11, 735], [13, 785], [15.5, 800], [22, 1250]],
    layout: { side: [{ y: 900, side: 'L' }] },
    actors: [
      parked(118, 830, '#fff'),
      { kind: 'car', keys: [[0, 62, 900], [10, 62, 900], [10.8, 100, 902], [11.8, 140, 920], [12.5, 150, 955], [15, 150, 1110], [22, 150, 1650]], color: '#c0392b', ind: [7, 12.5, 'L'] },
      oncoming(1700), oncoming(2700, 90, '#ccc'),
    ],
    hazards: [{ start: 10, end: 14, label: 'Car pulls out of the side road' }],
    focus: [1],
    explain: 'The van parked near the junction hid the side road. The car waiting there started to move out. Respond when it starts to edge forward.',
    video: { src: 'videos/emerge-left.mp4', poster: 'videos/emerge-left.jpg' },
  },
  {
    id: 'zebra', title: 'Zebra crossing', duration: 23,
    cam: [[0, 0], [8, 560], [10, 680], [12, 775], [16, 780], [17, 790], [23, 1250]],
    layout: { zebra: [850] },
    actors: [
      { kind: 'ped', keys: [[0, 95, 600], [8.6, 95, 845], [9.3, 95, 850], [9.7, 110, 850], [13.2, 262, 850]], color: '#8e44ad' },
      { kind: 'ped', keys: [[0, 268, 1200], [30, 268, 700]], color: '#16a085' },
      oncoming(1700, 90, '#d35400'),
      parked(118, 1000),
    ],
    hazards: [{ start: 9.2, end: 13.2, label: 'Pedestrian steps onto the zebra crossing' }],
    focus: [0],
    explain: 'The pedestrian walking towards the crossing was a potential hazard. It developed when they stepped onto it.',
    video: { src: 'videos/zebra.mp4', poster: 'videos/zebra.jpg' },
  },
  {
    id: 'cyclist', title: 'Cyclist and parked van', duration: 24,
    cam: [[0, 0], [8, 560], [11, 700], [14, 830], [18, 1010], [24, 1290]],
    layout: {},
    actors: [
      { kind: 'van', keys: [[0, 118, 1000]], color: '#eee' },
      { kind: 'bike', keys: [[0, 122, 450], [8, 122, 810], [9, 128, 855], [10, 150, 900], [13, 150, 1035], [15, 150, 1125], [16, 128, 1170], [24, 122, 1530]], color: '#2c3e50' },
      oncoming(1300), oncoming(2300, 90, '#888'),
    ],
    hazards: [{ start: 8.6, end: 12.6, label: 'Cyclist pulls out to pass the parked van' }],
    focus: [1],
    explain: 'The cyclist had to move out into your path to get past the van. Hold back and give them room.',
  },
  {
    id: 'overtaker', title: 'Country road overtaker', duration: 22,
    cam: [[0, 0], [8.5, 600], [11, 700], [13, 730], [16, 760], [22, 1150]],
    layout: { rural: true },
    actors: [
      { kind: 'lorry', keys: [[0, 215, 1300], [25, 215, -200]], color: '#2c3e50' },
      { kind: 'car', keys: [[0, 215, 1470], [8.5, 215, 960], [9.5, 182, 870], [10.5, 178, 800], [11.5, 215, 760], [25, 215, -50]], color: '#e74c3c', brake: [10, 11.5] },
    ],
    hazards: [{ start: 8.3, end: 12.3, label: 'Oncoming car pulls out to overtake the lorry' }],
    focus: [1],
    explain: 'An oncoming driver pulled out to overtake the lorry and came towards your side. Slow down early to give them room to get back in.',
  },
  {
    id: 'bus', title: 'Bus at a bus stop', duration: 24,
    cam: [[0, 0], [8, 560], [10, 660], [12, 720], [14, 800], [24, 1350]],
    layout: { busStop: [{ y: 900, side: 'L' }] },
    actors: [
      { kind: 'bus', keys: [[0, 118, 900], [9.5, 118, 900], [11, 140, 960], [12, 150, 1010], [14, 150, 1130], [24, 150, 1800]], color: '#c0392b', ind: [7, 11.5, 'R'] },
      oncoming(1600), oncoming(2500, 90, '#f1c40f'),
    ],
    hazards: [{ start: 9, end: 13, label: 'Bus signals and pulls out from the stop' }],
    focus: [0],
    explain: 'The bus signalled right and began to pull out. Give way to buses leaving stops where it is safe.',
  },
  {
    id: 'turn-right', title: 'Car ahead turning right', duration: 22,
    cam: [[0, 0], [6, 420], [8, 560], [10, 700], [11, 760], [13, 800], [14, 815], [16, 860], [22, 1280]],
    layout: { side: [{ y: 1000, side: 'R' }] },
    actors: [
      { kind: 'car', keys: [[0, 150, 160], [6, 150, 580], [8, 150, 800], [9, 150, 900], [10, 165, 975], [12.5, 165, 985], [13.5, 200, 1000], [14.5, 270, 1000], [16, 360, 1000]], color: '#2980b9', ind: [5, 14, 'R'], brake: [8, 13] },
      oncoming(1900),
    ],
    hazards: [{ start: 7.8, end: 11.8, label: 'Car in front brakes to turn right' }],
    focus: [0],
    explain: 'The car ahead was signalling right. When its brake lights came on, it was slowing to stop and turn.',
  },
  {
    id: 'horse', title: 'Horse rider on a country lane', duration: 22,
    cam: [[0, 0], [6, 420], [9, 560], [12, 640], [22, 790]],
    layout: { rural: true },
    actors: [
      { kind: 'horse', keys: [[0, 122, 620], [30, 122, 1070]], color: '#8e5a2b' },
      oncoming(1400, 80), oncoming(2200, 80, '#aaa'),
    ],
    hazards: [{ start: 5, end: 9, label: 'Closing up on a horse rider' }],
    focus: [0],
    explain: 'You were catching up with a horse rider. Slow down early. Pass only when it is safe, at under 10 mph and at least 2 m away.',
  },
  {
    id: 'behind-bus', title: 'Pedestrian behind a bus', duration: 22,
    cam: [[0, 0], [8, 560], [10, 680], [12, 760], [15, 770], [16, 778], [22, 1200]],
    layout: { busStop: [{ y: 900, side: 'R' }] },
    actors: [
      { kind: 'bus', keys: [[0, 232, 900]], color: '#27ae60', face: 180 },
      { kind: 'ped', keys: [[0, 262, 835], [9, 262, 835], [9.3, 240, 835], [10.5, 182, 835], [11.3, 168, 835], [13.5, 168, 835], [15.2, 92, 835]], color: '#c0392b' },
      parked(118, 1080),
    ],
    hazards: [{ start: 8.9, end: 12.9, label: 'Pedestrian steps out in front of the bus' }],
    focus: [1],
    explain: 'Passengers often cross in front of stationary buses. A pedestrian appeared from behind it.',
    video: { src: 'videos/behind-bus.mp4', poster: 'videos/behind-bus.jpg' },
  },
  {
    id: 'reverse', title: 'Car reversing from a driveway', duration: 22,
    cam: [[0, 0], [8, 560], [10, 680], [12, 795], [14, 815], [15, 825], [22, 1250]],
    layout: { drive: [{ y: 950, side: 'L' }] },
    actors: [
      { kind: 'car', keys: [[0, 62, 950], [9.5, 62, 950], [11, 122, 950], [12.2, 150, 958], [13, 150, 960], [14, 150, 1000], [22, 150, 1500]], color: '#7f8c8d', revUntil: 13, face: -90 },
      oncoming(1800),
    ],
    hazards: [{ start: 9.2, end: 13.2, label: 'Car reverses out of the driveway' }],
    focus: [0],
    explain: 'Reversing lights came on, then the car backed out into the road. Look for clues such as exhaust smoke and reversing lights.',
  },
  {
    id: 'turn-across', title: 'Oncoming car turns across you', duration: 22,
    cam: [[0, 0], [8, 560], [10, 680], [11.5, 735], [13, 765], [22, 1300]],
    layout: { side: [{ y: 950, side: 'L' }] },
    actors: [
      { kind: 'car', keys: [[0, 215, 1910], [9, 215, 1100], [10, 205, 1000], [10.6, 170, 965], [11.2, 120, 950], [12, 30, 950]], color: '#8e44ad', ind: [5, 11.5, 'R'] },
      parked(118, 1100),
    ],
    hazards: [{ start: 9.3, end: 13.3, label: 'Oncoming car turns right across your path' }],
    focus: [0],
    explain: 'The oncoming car was signalling right and turned into the side road on your left, cutting across your lane.',
  },
  {
    id: 'dog', title: 'Dog on the pavement', duration: 22,
    cam: [[0, 0], [8, 560], [10, 680], [12, 760], [14, 780], [22, 1200]],
    layout: {},
    actors: [
      { kind: 'ped', keys: [[0, 270, 1000], [30, 270, 700]], color: '#34495e' },
      { kind: 'dog', keys: [[0, 266, 985], [9.6, 266, 890], [10.4, 205, 850], [11.2, 150, 846], [12, 100, 846], [13.5, 60, 846]] },
      oncoming(1500), parked(118, 640),
    ],
    hazards: [{ start: 9.5, end: 13.5, label: 'Dog runs into the road' }],
    focus: [1],
    explain: 'The dog was off its lead near the kerb and ran across the road.',
    video: { src: 'videos/dog.mp4', poster: 'videos/dog.jpg' },
  },
  {
    id: 'door', title: 'Parked car door opens', duration: 23,
    cam: [[0, 0], [8, 560], [10, 680], [12, 790], [14, 820], [17, 830], [23, 1300]],
    layout: {},
    actors: [
      parked(118, 760, '#16a085'), parked(118, 900, '#d35400'),
      { kind: 'door', keys: [[0, 137, 912]], show: [9.6, 16] },
      { kind: 'ped', keys: [[0, 128, 905], [10.6, 128, 905], [11.4, 140, 900], [13.5, 140, 880], [15.5, 92, 880]], color: '#2c3e50', show: [10.6, 30] },
      oncoming(1300), oncoming(2100, 90, '#bbb'),
    ],
    hazards: [{ start: 9.3, end: 13.3, label: 'Driver opens their door into the road' }],
    focus: [2],
    explain: 'Someone was sitting in the parked car. The door then opened into your path. Leave a door\'s width when passing parked cars where you can.',
  },
  {
    id: 'tractor', title: 'Vehicle from a field', duration: 26,
    cam: [[0, 0], [8, 560], [10, 680], [13, 820], [16, 900], [26, 1150]],
    layout: { rural: true, gate: [{ y: 1000, side: 'R' }] },
    actors: [
      { kind: 'tractor', keys: [[0, 300, 1000], [10, 300, 1000], [11.5, 240, 1005], [13, 165, 1030], [14, 150, 1060], [26, 150, 1360]], color: '#27ae60', beacon: true, face: -90 },
      oncoming(1700, 80),
    ],
    hazards: [{ start: 9.5, end: 13.5, label: 'Vehicle pulls out of the field' }],
    focus: [0],
    explain: 'The flashing amber beacon at the field entrance warned that a vehicle was about to pull out. It pulled out in front of you.',
    // In the video a pickup plays the tractor. It can be seen in the gateway before it moves, so the
    // video keeps the 2D window rather than the 3D one (the 3D tractor is hidden by the hedge until 10.2 s).
    video: { src: 'videos/tractor.mp4', poster: 'videos/tractor.jpg', windows: [{ start: 9.5, end: 13.5, label: 'Vehicle pulls out of the field' }] },
  },
  {
    id: 'double', title: 'High street (two hazards)', duration: 28,
    cam: [[0, 0], [5, 350], [7, 450], [9, 520], [11, 540], [12, 550], [13, 580], [15, 720], [17, 830], [19, 880], [21, 895], [22, 900], [28, 1350]],
    layout: { side: [{ y: 1050, side: 'R' }] },
    actors: [
      { kind: 'ped', keys: [[0, 265, 600], [5.5, 265, 600], [6, 240, 600], [11, 130, 600], [13, 90, 600]], color: '#7f8c8d' },
      { kind: 'car', keys: [[0, 300, 1050], [16.5, 300, 1050], [17.3, 240, 1055], [18.2, 170, 1075], [19, 150, 1110], [28, 150, 1700]], color: '#f39c12', ind: [14, 18.5, 'R'], face: -90 },
      parked(118, 760), parked(118, 820, '#a33'), oncoming(2600),
    ],
    hazards: [
      { start: 5.6, end: 9.6, label: 'Older pedestrian starts crossing the road' },
      { start: 16.2, end: 20.2, label: 'Car pulls out of the side road on the right' },
    ],
    focus: [0, 1],
    explain: 'This clip had two hazards: an older pedestrian crossing slowly, then a car emerging from the right.',
    video: { src: 'videos/double.mp4', poster: 'videos/double.jpg' },
  },
];
