import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { hazardsFor, type Actor, type Clip } from '../data/clips';
import { camAt, lerpKeys } from './HazardPlayer';
import {
  blk, brickTex, faceTex, fieldTex, footballTex, glassTex, leafTex, liveMat, logTex, noiseTex, plankTex, roofTex, slabTex, strip, vmat,
} from './voxel';
import * as real from './realistic';
import * as photo from './photoreal';

/** All clips use the realistic style; the blocky voxel kit remains as a fallback for any road user the realistic kit lacks. */
const REALISTIC = { has: (_id: string) => true };
/** Trial of the photo-real kit (real sky, surface detail, ambient occlusion) on these clips. */
const PHOTO = new Set(['ball']);

// First-person, blocky 3D renderer for hazard perception clips.
// It replays each clip's 2D timeline (keys in px) in metres:
//   along the road: 1 px = LONG metres (slower in town, faster on country roads)
//   across the road: lat() maps the 150 px road to a 9 m carriageway.
const ROAD_HALF = 4.5;
const DRIVER_OFFSET = 0.35; // right-hand-drive seat
const EYE_HEIGHT = 1.2;
const OWN_LANE = -2.0;      // normal lane position (UK: drive on the left)
const OWN_PASSING = -1.0;   // moved out when passing parked vehicles

let LONG = 0.09;
export const longFor = (clip: Clip) => (clip.layout.rural ? 0.16 : 0.09);

function lat(x: number) {
  if (x >= 105 && x <= 255) return ((x - 180) * ROAD_HALF) / 75;
  return x < 105 ? -ROAD_HALF - (105 - x) * 0.1 : ROAD_HALF + (x - 255) * 0.1;
}
const fwd = (y: number) => -y * LONG;
const rand = (s: number) => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// ---------------- models ----------------

type LightMat = THREE.MeshLambertMaterial | THREE.MeshStandardMaterial;
interface Lights { brake: LightMat; indL: LightMat; indR: LightMat; reverse: LightMat; beacon?: LightMat }
interface Model { group: THREE.Group; lights?: Lights; wheels: THREE.Object3D[]; legs: THREE.Object3D[]; arms: THREE.Object3D[]; halfWidth: number; inner?: THREE.Object3D }

function newLights(): Lights {
  return { brake: liveMat('#6a1010'), indL: liveMat('#7a5200'), indR: liveMat('#7a5200'), reverse: liveMat('#bdbdbd') };
}

function addLights(g: THREE.Group, L: Lights, W: number, len: number, y: number) {
  const head = vmat('#fff8d8');
  for (const s of [-1, 1]) {
    g.add(blk(0.4, 0.2, 0.08, L.brake, s * (W / 2 - 0.3), y, len / 2, false));
    g.add(blk(0.4, 0.2, 0.08, head, s * (W / 2 - 0.3), y, -len / 2, false));
    const ind = s < 0 ? L.indL : L.indR;
    g.add(blk(0.16, 0.16, 0.1, ind, s * (W / 2 - 0.06), y, -len / 2, false));
    g.add(blk(0.16, 0.16, 0.1, ind, s * (W / 2 - 0.06), y + 0.22, len / 2, false));
  }
  g.add(blk(0.22, 0.14, 0.08, L.reverse, 0, y - 0.12, len / 2, false));
}

function wheel(r: number, w: number) {
  const tyre = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 8), vmat('#1b1b1b'));
  tyre.rotation.z = Math.PI / 2; tyre.castShadow = true;
  tyre.add(blk(r * 0.7, w + 0.02, r * 0.7, vmat('#9a9a9a'), 0, 0, 0, false));
  const spin = new THREE.Group(); spin.add(tyre);
  return spin;
}

function makeVehicle(kind: Actor['kind'], color: string): Model {
  const g = new THREE.Group();
  const body = vmat('#fff', noiseTex(color, 0.05));
  const glass = vmat('#fff', glassTex());
  const L = newLights();
  const wheels: THREE.Object3D[] = [];
  const addWheels = (W: number, positions: number[], r = 0.36) => {
    for (const z of positions) for (const s of [-1, 1]) {
      const w = wheel(r, 0.28); w.position.set(s * (W / 2 - 0.1), r, z); g.add(w); wheels.push(w);
    }
  };
  let W = 1.8;
  if (kind === 'bus') {
    W = 2.5;
    g.add(blk(W, 2.7, 11, body, 0, 1.65, 0));
    for (const s of [-1, 1]) g.add(blk(0.04, 1.0, 9.6, glass, s * (W / 2 + 0.01), 2.25, 0.3, false));
    g.add(blk(W - 0.3, 1.2, 0.04, glass, 0, 2.1, -5.51, false));
    g.add(blk(1.6, 0.35, 0.05, vmat('#111'), 0, 2.85, -5.52, false));
    addLights(g, L, W, 11, 0.7); addWheels(W, [-3.6, 3.4], 0.5);
  } else if (kind === 'lorry') {
    W = 2.5;
    g.add(blk(W, 2.6, 2.3, body, 0, 1.75, -3.7));
    g.add(blk(W - 0.2, 1.0, 0.04, glass, 0, 2.3, -4.86, false));
    g.add(blk(W, 3.0, 7.0, vmat('#fff', noiseTex('#e9e7e1', 0.04)), 0, 2.0, 1.0));
    addLights(g, L, W, 9.7, 0.7); addWheels(W, [-3.6, 1.5, 3.4], 0.5);
  } else if (kind === 'tractor') {
    W = 2.2;
    g.add(blk(1.1, 1.0, 2.2, body, 0, 1.0, -0.9));
    g.add(blk(1.5, 1.6, 1.5, glass, 0, 2.1, 0.7));
    g.add(blk(1.6, 0.12, 1.6, body, 0, 2.95, 0.7));
    L.beacon = liveMat('#7a5200');
    g.add(blk(0.3, 0.3, 0.3, L.beacon, 0, 3.15, 0.7, false));
    for (const s of [-1, 1]) {
      const big = wheel(0.85, 0.5); big.position.set(s * 0.95, 0.85, 0.8); g.add(big); wheels.push(big);
      const small = wheel(0.45, 0.35); small.position.set(s * 0.8, 0.45, -1.6); g.add(small); wheels.push(small);
    }
    addLights(g, L, 1.4, 3.6, 1.0);
  } else if (kind === 'van') {
    W = 2.0;
    g.add(blk(W, 2.0, 5.2, body, 0, 1.35, 0));
    g.add(blk(W - 0.2, 0.7, 0.04, glass, 0, 1.75, -2.61, false));
    for (const s of [-1, 1]) g.add(blk(0.04, 0.6, 1.0, glass, s * (W / 2 + 0.01), 1.8, -1.9, false));
    addLights(g, L, W, 5.2, 0.75); addWheels(W, [-1.7, 1.7]);
  } else {
    g.add(blk(W, 0.75, 4.2, body, 0, 0.7, 0));
    g.add(blk(W - 0.15, 0.6, 2.1, vmat('#fff', noiseTex('#3b5266', 0.08)), 0, 1.37, 0.3)); // tinted windows
    g.add(blk(W - 0.05, 0.1, 2.2, body, 0, 1.72, 0.3));
    for (const zz of [-0.72, 1.32]) g.add(blk(W - 0.08, 0.6, 0.12, body, 0, 1.37, zz)); // pillars
    addLights(g, L, W, 4.2, 0.8); addWheels(W, [-1.35, 1.35]);
  }
  return { group: g, lights: L, wheels, legs: [], arms: [], halfWidth: W / 2 };
}

const SKINS = ['#e9c4a0', '#c99a72', '#8d5e3c', '#f1d2b6'];
const HAIRS = ['#3b2a1e', '#d9b25f', '#1a1a1a', '#8a4b26', '#bbbbbb'];

function makePerson(height: number, shirt: string, seed: number, trousers = '#33415c'): Model {
  const k = height / 1.95;
  const skin = SKINS[Math.floor(rand(seed) * SKINS.length)];
  const hair = HAIRS[Math.floor(rand(seed + 1) * HAIRS.length)];
  const g = new THREE.Group();
  const limb = (w: number, len: number, m: THREE.Material, x: number, y: number) => {
    const pivot = new THREE.Group(); pivot.position.set(x * k, y * k, 0);
    pivot.add(blk(w * k, len * k, w * k, m, 0, (-len * k) / 2, 0));
    g.add(pivot); return pivot;
  };
  const tr = vmat('#fff', noiseTex(trousers, 0.06)), sh = vmat('#fff', noiseTex(shirt, 0.06));
  const legs = [limb(0.24, 0.75, tr, -0.13, 0.75), limb(0.24, 0.75, tr, 0.13, 0.75)];
  g.add(blk(0.5 * k, 0.7 * k, 0.28 * k, sh, 0, 1.1 * k, 0));
  const arms = [limb(0.2, 0.68, sh, -0.36, 1.43), limb(0.2, 0.68, sh, 0.36, 1.43)];
  const skinM = vmat(skin), hairM = vmat(hair);
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z. People face -z (their direction of travel).
  g.add(blk(0.5 * k, 0.5 * k, 0.5 * k, [skinM, skinM, hairM, skinM, hairM, vmat('#fff', faceTex(skin, hair))], 0, 1.7 * k, 0));
  return { group: g, wheels: [], legs, arms, halfWidth: 0.3 };
}

function makeCyclist(color: string, seed: number): Model {
  const g = new THREE.Group();
  const frame = vmat('#2c3e50');
  g.add(blk(0.06, 0.08, 1.0, frame, 0, 0.55, 0));
  g.add(blk(0.06, 0.5, 0.06, frame, 0, 0.75, 0.25));
  g.add(blk(0.5, 0.05, 0.05, frame, 0, 1.0, -0.45));
  const wheels: THREE.Object3D[] = [];
  for (const z of [-0.55, 0.55]) {
    const w = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.04, 4, 8), vmat('#111'));
    w.rotation.y = Math.PI / 2; w.position.set(0, 0.35, z); w.castShadow = true;
    g.add(w); wheels.push(w);
  }
  const rider = makePerson(1.75, color, seed, '#222');
  rider.group.position.set(0, 0.25, 0.2);
  rider.group.rotation.x = -0.35;
  rider.arms.forEach((a) => (a.rotation.x = -1.0));
  g.add(rider.group);
  g.add(blk(0.3, 0.16, 0.34, vmat('#f1c40f'), 0, 0.25 + 1.86, -0.45)); // helmet
  return { group: g, wheels: [], legs: rider.legs, arms: [], halfWidth: 0.35, inner: wheels[0] };
}

function makeHorse(color: string, seed: number): Model {
  const g = new THREE.Group();
  const hide = vmat('#fff', noiseTex(color, 0.08));
  g.add(blk(0.6, 0.7, 1.7, hide, 0, 1.35, 0));
  const neck = blk(0.35, 0.8, 0.4, hide, 0, 1.85, -0.85); neck.rotation.x = -0.5; g.add(neck);
  g.add(blk(0.3, 0.3, 0.6, hide, 0, 2.2, -1.25));
  g.add(blk(0.12, 0.6, 0.12, vmat('#2a1a10'), 0, 1.3, 0.9));
  const legs: THREE.Object3D[] = [];
  for (const [x, z] of [[-0.2, -0.65], [0.2, -0.65], [-0.2, 0.65], [0.2, 0.65]]) {
    const p = new THREE.Group(); p.position.set(x, 1.05, z);
    p.add(blk(0.16, 1.05, 0.16, hide, 0, -0.52, 0)); g.add(p); legs.push(p);
  }
  const rider = makePerson(1.7, '#d4ff00', seed, '#3b3b3b'); // hi-vis jacket
  rider.group.position.set(0, 1.0, 0.1);
  rider.legs.forEach((l, i) => { l.rotation.z = i ? -0.5 : 0.5; });
  g.add(rider.group);
  return { group: g, wheels: [], legs, arms: [], halfWidth: 0.4 };
}

function makeDog(): Model {
  const g = new THREE.Group();
  const fur = vmat('#fff', noiseTex('#7b4a1e', 0.1));
  g.add(blk(0.3, 0.3, 0.65, fur, 0, 0.45, 0));
  g.add(blk(0.28, 0.28, 0.3, fur, 0, 0.62, -0.4));
  g.add(blk(0.08, 0.08, 0.25, fur, 0, 0.6, 0.4));
  const legs: THREE.Object3D[] = [];
  for (const [x, z] of [[-0.1, -0.22], [0.1, -0.22], [-0.1, 0.22], [0.1, 0.22]]) {
    const p = new THREE.Group(); p.position.set(x, 0.32, z); p.add(blk(0.08, 0.32, 0.08, fur, 0, -0.16, 0)); g.add(p); legs.push(p);
  }
  return { group: g, wheels: [], legs, arms: [], halfWidth: 0.2 };
}

const BALL_R = 0.16;

function makeModel(a: Actor, i: number): Model {
  const color = a.color ?? '#7a8794';
  switch (a.kind) {
    case 'ped': return makePerson(1.75, color, i * 7 + 1);
    case 'child': return makePerson(1.2, color, i * 7 + 3, '#3a4a6a');
    case 'bike': return makeCyclist(color, i * 7 + 2);
    case 'horse': return makeHorse(color, i * 7 + 4);
    case 'dog': return makeDog();
    case 'ball': {
      const g = new THREE.Group();
      const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(BALL_R, 1), vmat('#fff', footballTex()));
      ball.castShadow = true; ball.position.y = BALL_R; g.add(ball);
      return { group: g, wheels: [], legs: [], arms: [], halfWidth: BALL_R, inner: ball };
    }
    case 'door': {
      // A car door hinged at its front edge (the group origin), swinging out into the road.
      const g = new THREE.Group();
      g.add(blk(0.08, 0.95, 1.1, vmat('#fff', noiseTex(color === '#7a8794' ? '#d35400' : color, 0.05)), 0, 0.85, 0.55));
      return { group: g, wheels: [], legs: [], arms: [], halfWidth: 0.1 };
    }
    default: return makeVehicle(a.kind, color);
  }
}

// ---------------- world ----------------

interface Zone { z0: number; z1: number }
const inZones = (zs: Zone[], z: number, pad = 0) => zs.some((q) => z > q.z1 - pad && z < q.z0 + pad);

function tree(scene: THREE.Scene, x: number, z: number, s = 1) {
  scene.add(blk(0.5, 3 * s, 0.5, vmat('#fff', logTex()), x, 1.5 * s, z));
  const leaves = vmat('#fff', leafTex());
  scene.add(blk(2.6 * s, 1.6 * s, 2.6 * s, leaves, x, 3.6 * s, z));
  scene.add(blk(1.6 * s, 1.0 * s, 1.6 * s, leaves, x, 4.8 * s, z));
}

function house(scene: THREE.Scene, side: number, z: number, seed: number) {
  const bricks = ['#9b4a32', '#b0603e', '#8a4f36', '#c49a6c', '#a86b4f'];
  const brick = vmat('#fff', brickTex(bricks[Math.floor(rand(seed) * bricks.length)]));
  const frontX = side * (ROAD_HALF + 2.4 + 5);
  const cx = frontX + side * 4;
  const h = 6;
  scene.add(blk(8, h, 8, brick, cx, h / 2, z));
  const roof = vmat('#fff', roofTex());
  for (let i = 0; i < 4; i++) scene.add(blk(8.6 - i * 2, 0.75, 8.6, roof, cx, h + 0.37 + i * 0.75, z)); // stepped roof
  scene.add(blk(0.9, 1.8, 0.9, vmat('#fff', brickTex('#7a3a2a')), cx + side * 1.5, h + 2.4, z + 2.6));
  const glass = vmat('#fff', glassTex());
  const fx = frontX - side * 0.02;
  for (const wz of [-2.3, 2.3]) for (const wy of [1.7, 4.4]) scene.add(blk(0.1, 1.2, 1.6, glass, fx, wy, z + wz, false));
  const doors = ['#1d3b6b', '#7a1f1f', '#244d2a', '#3a3a3a'];
  scene.add(blk(0.12, 2.1, 1.0, vmat('#fff', plankTex(doors[Math.floor(rand(seed + 2) * doors.length)])), fx, 1.05, z, false));
}

function buildWorld(scene: THREE.Scene, clip: Clip, y0: number, y1: number) {
  const L = clip.layout, rural = !!L.rural;
  const z0 = fwd(y0), z1 = fwd(y1), len = z0 - z1, zc = (z0 + z1) / 2;
  const SIDE_HALF = 3.6;
  const sideOf = (s: 'L' | 'R') => (s === 'L' ? -1 : 1);
  const zones: Record<number, Zone[]> = { [-1]: [], [1]: [] };
  for (const s of L.side ?? []) zones[sideOf(s.side)].push({ z0: fwd(s.y) + SIDE_HALF, z1: fwd(s.y) - SIDE_HALF });
  for (const s of L.gate ?? []) zones[sideOf(s.side)].push({ z0: fwd(s.y) + 2.8, z1: fwd(s.y) - 2.8 });
  const drives: Record<number, Zone[]> = { [-1]: [], [1]: [] };
  for (const s of L.drive ?? []) drives[sideOf(s.side)].push({ z0: fwd(s.y) + 1.6, z1: fwd(s.y) - 1.6 });

  const asphalt = vmat('#fff', noiseTex('#4a4c50', 0.07));
  scene.add(strip(ROAD_HALF * 2, len, asphalt, 0, zc, 0));
  const white = vmat('#f0f0ea');
  const skipDash = (z: number) => inZones(zones[-1], z, 2) || inZones(zones[1], z, 2) || (L.zebra ?? []).some((zy) => Math.abs(z - fwd(zy)) < 12);
  for (let z = z0; z > z1; z -= 9) if (!skipDash(z)) scene.add(strip(0.15, 4, white, 0, z - 2, 0.01));

  for (const side of [-1, 1]) {
    // runs of verge/pavement between junction gaps
    const gaps = [...zones[side]].sort((a, b) => b.z0 - a.z0);
    const runs: Zone[] = [];
    let cur = z0;
    for (const g of gaps) { if (g.z0 < cur) runs.push({ z0: cur, z1: g.z0 }); cur = Math.min(cur, g.z1); }
    runs.push({ z0: cur, z1 });
    if (rural) {
      scene.add(strip(1.2, len, vmat('#fff', noiseTex('#5f9a3a', 0.12)), side * (ROAD_HALF + 0.6), zc, 0.005));
      scene.add(strip(60, len, vmat('#fff', fieldTex()), side * (ROAD_HALF + 31.5), zc, 0));
      const hedge = vmat('#fff', leafTex());
      for (const r of runs) {
        const rl = r.z0 - r.z1; if (rl < 0.5) continue;
        scene.add(blk(1, 1.7, rl, hedge, side * (ROAD_HALF + 1.7), 0.85, (r.z0 + r.z1) / 2));
      }
      for (let z = z0 - 15, i = 0; z > z1; z -= 23, i++) if (rand(i * 3 + side) > 0.55 && !inZones(zones[side], z, 4)) tree(scene, side * (ROAD_HALF + 1.7), z, 1.3);
    } else {
      const kerb = vmat('#fff', noiseTex('#a3a097', 0.06)), slab = vmat('#fff', slabTex());
      scene.add(strip(70, len, vmat('#fff', noiseTex('#5f9a3a', 0.12)), side * (ROAD_HALF + 2.4 + 35), zc, 0));
      for (const r of runs) {
        const rl = r.z0 - r.z1; if (rl < 0.5) continue;
        const rz = (r.z0 + r.z1) / 2;
        scene.add(blk(0.2, 0.14, rl, kerb, side * (ROAD_HALF + 0.1), 0.07, rz, false));
        const pave = blk(2.2, 0.12, rl, slab, side * (ROAD_HALF + 1.3), 0.06, rz, false); pave.castShadow = false; scene.add(pave);
        for (let z = r.z0 - 0.5; z > r.z1 + 0.5; z -= 2) {
          if (inZones(drives[side], z, 0.6)) continue;
          const sd = Math.floor(-z / 10), rr = rand(sd * 5 + side);
          if (rr < 0.3) continue;
          scene.add(blk(0.4, rr > 0.65 ? 1.0 : 0.6, 2, vmat('#fff', rr > 0.65 ? leafTex() : brickTex('#8d5a46')), side * (ROAD_HALF + 2.6), rr > 0.65 ? 0.5 : 0.3, z - 1));
        }
      }
      let i = 0;
      for (let z = z0 - 6; z > z1; z -= 10, i++) {
        if (inZones(zones[side], z, 5)) continue;
        house(scene, side, z, i * 2 + (side > 0 ? 1 : 0));
        if (rand(i * 9 + side) > 0.8) tree(scene, side * (ROAD_HALF + 5), z - 5);
      }
      for (let z = z0 - 10, j = 0; z > z1; z -= 30, j++) {
        const s = j % 2 ? 1 : -1;
        if (s !== side || inZones(zones[s], z, 3)) continue;
        const lamp = vmat('#5c6166');
        scene.add(blk(0.18, 6.5, 0.18, lamp, s * (ROAD_HALF + 0.5), 3.25, z));
        scene.add(blk(1.3, 0.15, 0.25, lamp, s * (ROAD_HALF - 0.1), 6.45, z));
        scene.add(blk(0.4, 0.1, 0.25, vmat('#fff7cc'), s * (ROAD_HALF - 0.6), 6.35, z, false));
      }
      for (const d of drives[side]) scene.add(strip(5, 3.2, vmat('#fff', noiseTex('#9a958b', 0.08)), side * (ROAD_HALF + 2.4 + 2.5), (d.z0 + d.z1) / 2, 0.02));
    }
    for (const s of (L.side ?? []).filter((q) => sideOf(q.side) === side)) {
      const z = fwd(s.y);
      scene.add(strip(40, SIDE_HALF * 2, asphalt, side * (ROAD_HALF + 20), z, 0.002));
      if (!rural) for (const e of [-1, 1]) {
        scene.add(blk(40, 0.14, 0.2, vmat('#fff', noiseTex('#a3a097', 0.06)), side * (ROAD_HALF + 20), 0.07, z + e * (SIDE_HALF + 0.1), false));
        scene.add(blk(40, 0.12, 2.2, vmat('#fff', slabTex()), side * (ROAD_HALF + 20), 0.06, z + e * (SIDE_HALF + 1.3), false));
      }
      // give way: double broken white line across the mouth of the side road
      for (const off of [0.3, 0.75]) for (let q = -SIDE_HALF + 0.3; q < SIDE_HALF; q += 1.0) scene.add(strip(0.2, 0.6, white, side * (ROAD_HALF + off), z + q + 0.3, 0.012));
    }
    for (const g of (L.gate ?? []).filter((q) => sideOf(q.side) === side)) {
      const z = fwd(g.y);
      scene.add(strip(30, 4.5, vmat('#fff', noiseTex('#8a6a42', 0.1)), side * (ROAD_HALF + 15), z, 0.01));
      for (const e of [-1, 1]) scene.add(blk(0.25, 1.4, 0.25, vmat('#fff', logTex()), side * (ROAD_HALF + 1.7), 0.7, z + e * 2.6));
    }
  }
  for (const zy of L.zebra ?? []) {
    const z = fwd(zy);
    for (let x = -ROAD_HALF + 0.3; x < ROAD_HALF; x += 1.0) scene.add(strip(0.5, 4, white, x + 0.25, z, 0.012));
    for (const s of [-1, 1]) {
      const pole = new THREE.Group();
      for (let k = 0; k < 6; k++) pole.add(blk(0.15, 0.5, 0.15, vmat(k % 2 ? '#111111' : '#f4f4f4'), 0, 0.25 + k * 0.5, 0));
      const lamp = blk(0.4, 0.4, 0.4, liveMat('#7a5200'), 0, 3.2, 0, false);
      lamp.userData.beacon = true;
      pole.add(lamp);
      pole.position.set(s * (ROAD_HALF + 0.5), 0, z + 2);
      scene.add(pole);
      for (const dir of [1, -1]) for (let k = 0; k < 8; k++) {
        const m = strip(0.12, 1.3, white, s * (ROAD_HALF - 0.4) + (k % 2 ? 0.25 : -0.25) * s, z + dir * (2.5 + k * 1.2), 0.012);
        m.rotation.z = k % 2 ? 0.4 : -0.4; scene.add(m);
      }
    }
  }
  for (const b of L.busStop ?? []) {
    const s = sideOf(b.side), z = fwd(b.y);
    const yellow = vmat('#f2c80f');
    scene.add(strip(0.15, 15, yellow, s * (ROAD_HALF - 2.6), z, 0.012));
    for (const e of [-1, 1]) scene.add(strip(2.6, 0.15, yellow, s * (ROAD_HALF - 1.3), z + e * 7.5, 0.012));
    const sg = vmat('#fff', glassTex());
    scene.add(blk(1.4, 2.3, 0.08, sg, s * (ROAD_HALF + 1.6), 1.2, z - 2, false));
    scene.add(blk(0.08, 2.3, 3, sg, s * (ROAD_HALF + 2.3), 1.2, z - 0.5, false));
    scene.add(blk(1.5, 0.12, 3.2, vmat('#3d4a57'), s * (ROAD_HALF + 1.6), 2.4, z - 0.5));
    scene.add(blk(0.12, 2.8, 0.12, vmat('#555555'), s * (ROAD_HALF + 0.4), 1.4, z + 1));
    scene.add(blk(0.08, 0.6, 0.6, vmat('#f4f4f4'), s * (ROAD_HALF + 0.4), 2.9, z + 1));
    scene.add(blk(0.1, 0.3, 0.3, vmat('#c0281b'), s * (ROAD_HALF + 0.4), 2.9, z + 1, false));
  }
  const cloud = vmat('#ffffff');
  for (let i = 0; i < 26; i++) {
    scene.add(blk(8 + rand(i) * 14, 1.5, 6 + rand(i + 9) * 10, cloud, (rand(i * 7) - 0.5) * 160, 55 + rand(i * 5) * 10, z0 - rand(i * 3) * (len + 150), false));
  }
}

// ---------------- actor placement ----------------

const VEHICLES = new Set(['car', 'van', 'bus', 'lorry', 'tractor']);

interface View { a: Actor; m: Model; heading: number; phase: number; lastT: number }

function pose(v: View, t: number) {
  const a = v.a, g = v.m.group;
  g.visible = !a.show || (t >= a.show[0] && t <= a.show[1]);
  const [x, y] = lerpKeys(a.keys, t);
  const [x2, y2] = lerpKeys(a.keys, t + 0.15);
  let X = lat(x);
  if (VEHICLES.has(a.kind) && x >= 105 && x <= 255) {
    const lim = ROAD_HALF - v.m.halfWidth - 0.15;
    X = clamp(X, -lim, lim);
  }
  const dx = lat(x2) - lat(x), dz = (y2 - y) * LONG;
  const speed = Math.hypot(dx, dz) / 0.15;
  if (speed > 0.05) {
    v.heading = Math.atan2(dx, dz);
    if (a.revUntil !== undefined && t < a.revUntil) v.heading += Math.PI;
  }
  g.position.set(X, 0, fwd(y));
  g.rotation.y = -v.heading;
  const dt = clamp(t - v.lastT, 0, 0.1); v.lastT = t;
  v.phase += dt * speed;
  if (a.kind === 'ball') {
    const b = v.m.inner!;
    b.rotation.x = -v.phase / BALL_R;
    b.position.y = BALL_R + (speed > 0.3 ? Math.abs(Math.sin(v.phase * 1.6)) * 0.12 : 0);
  } else if (a.kind === 'door') {
    // hinge sits at the parked car's right-hand side; the door opens outwards into the road
    const open = clamp((t - (a.show?.[0] ?? 0)) / 0.6, 0, 1);
    g.position.x = -ROAD_HALF + 0.15 + 1.8;
    g.position.z = fwd(y) + 0.5;
    g.rotation.y = open * 1.0;
  } else {
    const swing = speed > 0.1 ? Math.sin(v.phase * (a.kind === 'horse' ? 2 : 3.2)) * Math.min(0.7, 0.3 + speed * 0.1) : 0;
    v.m.legs.forEach((l, i) => (l.rotation.x = i % 2 ? -swing : swing));
    v.m.arms.forEach((l, i) => (l.rotation.x = i % 2 ? swing * 0.8 : -swing * 0.8));
    for (const w of v.m.wheels) w.rotation.x = -v.phase / 0.4;
  }
  const lights = v.m.lights;
  if (lights) {
    const blink = Math.floor(t * 2.5) % 2 === 0;
    const ind = a.ind && t >= a.ind[0] && t <= a.ind[1] ? a.ind[2] : null;
    lights.indL.emissive.set(ind === 'L' && blink ? '#ffa000' : '#000000');
    lights.indR.emissive.set(ind === 'R' && blink ? '#ffa000' : '#000000');
    lights.brake.emissive.set(a.brake && t >= a.brake[0] && t <= a.brake[1] ? '#ff1a1a' : '#000000');
    const rev = a.revUntil !== undefined && t < a.revUntil && t > (a.keys[1]?.[0] ?? 0) - 1;
    lights.reverse.emissive.set(rev ? '#ffffff' : '#000000');
    if (lights.beacon) lights.beacon.emissive.set(Math.floor(t * 3) % 2 ? '#ffb300' : '#000000');
  }
}

/** Move out towards the centre line to pass vehicles parked at the left kerb, or as the clip's `passOut` keys
 * say (deterministic in t). */
function ownLateral(views: View[], t: number, camY: number, passOut?: [number, number][]) {
  let out = passOut ? lerpKeys(passOut, t)[0] : 0;
  for (const v of views) {
    if (!VEHICLES.has(v.a.kind)) continue;
    const [x, y] = lerpKeys(v.a.keys, t);
    const [x2, y2] = lerpKeys(v.a.keys, t + 1);
    if (x !== x2 || y !== y2 || x < 105 || x > 160) continue;
    const ahead = (y - camY) * LONG;
    out = Math.max(out, clamp(1 - (Math.abs(ahead - 3) - 6) / 6, 0, 1));
  }
  return OWN_LANE + (OWN_PASSING - OWN_LANE) * out;
}

// ---------------- component ----------------

interface Props { clip: Clip; onDone: (clicks: number[]) => void; review?: { clicks: number[] } }

export interface Probe { visible: boolean; size: number }
type HpWindow = { __hpFreeze?: number; __hpT?: number; __hpProbe?: (t: number, i: number) => Probe };

export default function Hazard3DPlayer({ clip, onDone, review }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const clicks = useRef<number[]>([]);
  const start = useRef(0);
  const [flags, setFlags] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [label, setLabel] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); }
    catch { setFailed(true); return; }
    LONG = longFor(clip);
    const isPhoto = PHOTO.has(clip.id);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isPhoto ? 1.5 : 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);

    const isReal = REALISTIC.has(clip.id);
    const scene = new THREE.Scene();
    const sun = new THREE.DirectionalLight('#fff3dc', 2.0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -35, right: 35, top: 35, bottom: -35, near: 1, far: 150 });
    sun.shadow.bias = -0.0006;
    scene.add(sun, sun.target);
    let followSky: ((c: THREE.Camera) => void) | null = null;
    let envReady: Promise<void> = Promise.resolve();
    // If the sky image cannot be loaded (e.g. offline before it was cached), fall back to the generated sky.
    if (isPhoto) envReady = photo.setupEnvironment(renderer, scene, sun).catch(() => { followSky = real.setupEnvironment(renderer, scene, sun); });
    else if (isReal) followSky = real.setupEnvironment(renderer, scene, sun);
    else {
      scene.background = new THREE.Color('#8fc3f2');
      scene.fog = new THREE.Fog('#b7d8f5', 60, 170);
      scene.add(new THREE.HemisphereLight('#eaf4ff', '#6b7a52', 1.6));
    }

    const camMax = Math.max(...clip.cam.map((c) => c[1]));
    const kit = isPhoto ? photo : real;
    if (isReal) kit.buildWorld(scene, clip, -350, camMax + 1300, { fwd, lat, ROAD_HALF, rand });
    else buildWorld(scene, clip, -350, camMax + 1300);
    const beacons: THREE.Mesh[] = [];
    scene.traverse((o) => { if (o.userData.beacon) beacons.push(o as THREE.Mesh); });
    const views: View[] = clip.actors.map((a, i) => {
      const m = (isReal ? kit.makeModel(a, i, rand) : null) ?? makeModel(a, i);
      scene.add(m.group);
      return { a, m, heading: ((a.face ?? (a.keys[0][1] > 180 ? 180 : 0)) * Math.PI) / 180, phase: 0, lastT: 0 };
    });

    const camera = new THREE.PerspectiveCamera(isReal ? 60 : 55, 4 / 3, 0.1, 4500);
    scene.add(camera);
    if (isReal) kit.cockpit(camera, DRIVER_OFFSET);
    else {
    const bonnet = blk(1.8, 0.1, 2.0, vmat('#fff', noiseTex('#1d5fb4', 0.05)), -DRIVER_OFFSET, -0.48, -1.9, false);
    bonnet.rotation.x = 0.06;
    const dash = blk(2.3, 0.3, 0.5, vmat('#fff', noiseTex('#1d1e22', 0.08)), -DRIVER_OFFSET, -0.6, -0.75, false);
    const wheelRing = new THREE.Group(); // blocky steering wheel rim (top half)
    for (let k = 0; k <= 6; k++) {
      const a = Math.PI * (k / 6);
      wheelRing.add(blk(0.09, 0.06, 0.05, vmat('#111111'), Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0, false));
    }
    wheelRing.position.set(0, -0.62, -0.55); wheelRing.rotation.x = -0.35;
    const mirror = blk(0.26, 0.08, 0.03, vmat('#202224'), -DRIVER_OFFSET + 0.05, 0.31, -0.95, false);
    mirror.add(blk(0.22, 0.05, 0.01, vmat('#5d6f7d'), 0, 0, 0.016, false));
    camera.add(bonnet, dash, wheelRing, mirror);
    }

    const post = isPhoto ? photo.makePost(renderer, scene, camera) : null;
    const resize = () => {
      const w = el.clientWidth, h = Math.round((w * 3) / 4);
      renderer.setSize(w, h);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      post?.setSize(w, h);
    };
    resize();
    window.addEventListener('resize', resize);

    const update = (t: number) => {
      const cy = camAt(clip, t);
      const v1 = camAt(clip, t + 0.1) - cy, v0 = cy - camAt(clip, t - 0.1);
      const decel = (v0 - v1) * 10 * LONG;
      camera.position.set(ownLateral(views, t, cy, clip.passOut) + DRIVER_OFFSET, EYE_HEIGHT, fwd(cy));
      camera.rotation.set(-0.05 - clamp(decel * 0.02, -0.02, 0.03), 0, 0);
      if (isPhoto) {
        const s = photo.shake(t, v1 * 10 * LONG);
        camera.position.y += s.y; camera.rotation.x += s.pitch; camera.rotation.z = s.roll;
        sun.target.position.set(camera.position.x, 0, camera.position.z - 22);
        sun.position.copy(sun.target.position).add(photo.sunOffset);
      } else {
        sun.position.set(camera.position.x - 30, 50, camera.position.z + 18);
        sun.target.position.set(camera.position.x, 0, camera.position.z - 22);
      }
      for (const v of views) pose(v, t);
      followSky?.(camera);
      const on = Math.floor(t * 1.5) % 2 === 0;
      for (const b of beacons) (b.material as THREE.MeshLambertMaterial).emissive.set(on ? '#ffb300' : '#000000');
      scene.updateMatrixWorld();
    };

    // Test hook: can actor i be seen from the driver's seat at time t? Used to set fair 3D scoring windows.
    const ray = new THREE.Raycaster();
    const W = window as unknown as HpWindow;
    W.__hpProbe = (t, i) => {
      update(t);
      const v = views[i];
      if (!v.m.group.visible) return { visible: false, size: 0 };
      const box = new THREE.Box3().setFromObject(v.m.group);
      let seen = 0, minY = 9, maxY = -9;
      for (const fx of [0.2, 0.5, 0.8]) for (const fy of [0.25, 0.6, 0.9]) for (const fz of [0.2, 0.5, 0.8]) {
        const p = new THREE.Vector3(box.min.x + (box.max.x - box.min.x) * fx, box.min.y + (box.max.y - box.min.y) * fy, box.min.z + (box.max.z - box.min.z) * fz);
        const ndc = p.clone().project(camera);
        if (Math.abs(ndc.x) > 0.98 || Math.abs(ndc.y) > 0.98 || ndc.z > 1) continue;
        const dir = p.clone().sub(camera.position); const dist = dir.length();
        ray.set(camera.position, dir.normalize()); ray.far = dist + 0.01;
        const hit = ray.intersectObjects(scene.children, true).find((h) => h.object.visible);
        let o: THREE.Object3D | null = hit?.object ?? null, mine = false;
        while (o) { if (o === v.m.group) { mine = true; break; } o = o.parent; }
        if (!hit || mine || hit.distance >= dist - 0.05) { seen++; minY = Math.min(minY, ndc.y); maxY = Math.max(maxY, ndc.y); }
      }
      return { visible: seen >= 2, size: seen ? maxY - minY : 0 };
    };

    clicks.current = []; setFlags(0);
    start.current = performance.now();
    let raf = 0, done = false, disposed = false;
    const hz = hazardsFor(clip);
    const frame = () => {
      const t = W.__hpFreeze ?? Math.min((performance.now() - start.current) / 1000, clip.duration);
      update(t);
      if (post) post.render(t); else renderer.render(scene, camera);
      setElapsed(t);
      W.__hpT = t;
      if (review) { const act = hz.find((h) => t >= h.start && t <= h.end); setLabel(act ? act.label : null); }
      if (t >= clip.duration) { if (!done) { done = true; onDone(clicks.current); } return; }
      raf = requestAnimationFrame(frame);
    };
    // The clip starts once the sky has loaded, so the timeline is not eaten by the download.
    envReady.then(() => { if (disposed) return; start.current = performance.now(); raf = requestAnimationFrame(frame); });
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      post?.dispose();
      window.removeEventListener('resize', resize);
      delete W.__hpProbe;
      scene.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
      renderer.dispose();
      el.innerHTML = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip]);

  function press(e: React.PointerEvent) {
    e.preventDefault();
    if (review) return;
    clicks.current.push((performance.now() - start.current) / 1000);
    setFlags(clicks.current.length);
  }

  if (failed) return <p className="error">3D graphics are not available on this device.</p>;

  return (
    <div className="hp-player">
      <div className="hp-3d" ref={host} onPointerDown={press}>
        {label && <div className="hp-label">Scoring window: {label}</div>}
      </div>
      <div className="hp-flags" aria-live="polite">
        {Array.from({ length: Math.min(flags, 15) }, (_, i) => <span key={i}>⚑</span>)}
        {review && review.clicks.map((c, i) => <span key={i} style={{ opacity: elapsed >= c ? 1 : 0.15 }}>⚑</span>)}
      </div>
      <div className="hp-time hp-time-wide"><div style={{ width: `${Math.min(100, (elapsed / clip.duration) * 100)}%` }} /></div>
    </div>
  );
}
