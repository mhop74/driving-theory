import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Actor, Clip } from '../data/clips';
import { camAt, lerpKeys } from './HazardPlayer';

// First-person 3D renderer for hazard perception clips.
// It reuses the clip's 2D timeline (and so its scoring windows) and maps it into metres:
//   along the road: 1 px = LONG metres; across the road: see lat().
const LONG = 0.12;
const ROAD_HALF = 4;           // 8 m wide residential road
const OWN_LANE_X = -1.0;       // centre of your car (UK: left of the centre line)
const DRIVER_OFFSET = 0.35;    // right-hand-drive seat
const EYE_HEIGHT = 1.15;

/** Lateral 2D px -> metres. Road (105–255 px) spans ±4 m; pavements and gardens beyond. */
function lat(x: number) {
  if (x >= 105 && x <= 255) return ((x - 180) * (2 * ROAD_HALF)) / 150;
  return x < 105 ? -ROAD_HALF - (105 - x) * 0.1 : ROAD_HALF + (x - 255) * 0.1;
}
const fwd = (y: number) => -y * LONG;

function rand(seed: number) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const mat = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...extra });

function box(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0, shadow = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = shadow; mesh.receiveShadow = true;
  return mesh;
}

// ---------- models ----------

interface VehicleParts { group: THREE.Group; brake: THREE.MeshStandardMaterial; indL: THREE.MeshStandardMaterial; indR: THREE.MeshStandardMaterial; reverse: THREE.MeshStandardMaterial; wheels: THREE.Mesh[] }

function makeCar(color: string, kind: 'car' | 'van' = 'car'): VehicleParts {
  const g = new THREE.Group();
  const body = mat(color, { roughness: 0.45, metalness: 0.05 });
  const glass = mat('#2b3946', { roughness: 0.15, metalness: 0.1 });
  const L = kind === 'van' ? 5 : 4.2, W = kind === 'van' ? 1.95 : 1.8;
  g.add(box(W, 0.62, L, body, 0, 0.62, 0));
  if (kind === 'van') {
    g.add(box(W, 1.15, L * 0.72, body, 0, 1.5, 0.55));
    g.add(box(W * 0.94, 0.55, 0.9, glass, 0, 1.3, -1.25));
  } else {
    g.add(box(W * 0.9, 0.55, 2.1, glass, 0, 1.2, 0.25));
    g.add(box(W * 0.86, 0.06, 1.7, body, 0, 1.5, 0.3));
  }
  const brake = mat('#5a0c0c', { emissive: '#000000' });
  const reverse = mat('#cccccc', { emissive: '#000000' });
  const indL = mat('#6b4a00', { emissive: '#000000' });
  const indR = mat('#6b4a00', { emissive: '#000000' });
  for (const s of [-1, 1]) {
    g.add(box(0.35, 0.14, 0.05, brake, s * (W / 2 - 0.25), 0.78, L / 2, false));
    g.add(box(0.32, 0.12, 0.05, mat('#f4f1e0', { emissive: '#555544' }), s * (W / 2 - 0.25), 0.75, -L / 2, false));
    g.add(box(0.1, 0.1, 0.06, s < 0 ? indL : indR, s * (W / 2 - 0.05), 0.75, -L / 2, false));
    g.add(box(0.1, 0.1, 0.06, s < 0 ? indL : indR, s * (W / 2 - 0.05), 0.78, L / 2, false));
  }
  g.add(box(0.2, 0.1, 0.05, reverse, 0, 0.7, L / 2, false));
  const tyre = mat('#151515', { roughness: 0.9 });
  const wheels: THREE.Mesh[] = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.24, 16), tyre);
    w.rotation.z = Math.PI / 2;
    w.position.set(sx * (W / 2 - 0.08), 0.33, sz * (L / 2 - 0.75));
    w.castShadow = true;
    g.add(w); wheels.push(w);
  }
  return { group: g, brake, indL, indR, reverse, wheels };
}

interface PersonParts { group: THREE.Group; legs: THREE.Object3D[]; arms: THREE.Object3D[] }

function makePerson(height: number, shirt: string, trousers = '#2d3440', skin = '#e0b48f', hair = '#3b2a1e'): PersonParts {
  const k = height / 1.75;
  const g = new THREE.Group();
  const limb = (r: number, len: number, m: THREE.Material, x: number, y: number) => {
    const pivot = new THREE.Group(); pivot.position.set(x * k, y * k, 0);
    const c = new THREE.Mesh(new THREE.CapsuleGeometry(r * k, len * k, 4, 8), m);
    c.position.y = -(len * k) / 2 - r * k; c.castShadow = true;
    pivot.add(c); g.add(pivot);
    return pivot;
  };
  const legs = [limb(0.075, 0.7, mat(trousers), -0.1, 0.92), limb(0.075, 0.7, mat(trousers), 0.1, 0.92)];
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17 * k, 0.42 * k, 4, 10), mat(shirt));
  torso.position.y = 1.2 * k; torso.scale.z = 0.7; torso.castShadow = true; g.add(torso);
  const arms = [limb(0.055, 0.5, mat(shirt), -0.24, 1.45), limb(0.055, 0.5, mat(shirt), 0.24, 1.45)];
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.115 * k * (height < 1.3 ? 1.25 : 1), 16, 12), mat(skin));
  head.position.y = 1.63 * k; head.castShadow = true; g.add(head);
  const hairM = new THREE.Mesh(new THREE.SphereGeometry(0.12 * k * (height < 1.3 ? 1.25 : 1), 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(hair));
  hairM.position.y = 1.65 * k; g.add(hairM);
  return { group: g, legs, arms };
}

// ---------- world ----------

function buildStreet(scene: THREE.Scene, y0: number, y1: number) {
  const z0 = fwd(y0), z1 = fwd(y1);
  const len = Math.abs(z1 - z0), zc = (z0 + z1) / 2;
  const segs = Math.ceil((len + 200) / 10);
  for (const s of [-1, 1]) {
    // grass either side of the road only, so it can never show through the tarmac
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(56, len + 200, 1, segs), mat('#6f9150'));
    ground.rotation.x = -Math.PI / 2; ground.position.set(s * (ROAD_HALF + 28), -0.02, zc); ground.receiveShadow = true;
    scene.add(ground);
  }
  const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, len + 200, 1, segs), mat('#45484b', { roughness: 0.95 }));
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0, zc); road.receiveShadow = true;
  scene.add(road);
  const white = mat('#e9e9e4', { roughness: 0.6 });
  for (let z = z0 + 20; z > z1 - 100; z -= 9) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 4), white);
    dash.rotation.x = -Math.PI / 2; dash.position.set(0, 0.005, z); scene.add(dash);
  }
  const kerbM = mat('#9c9a94'), paveM = mat('#b7b4ad', { roughness: 0.95 });
  for (const s of [-1, 1]) {
    scene.add(box(0.15, 0.13, len + 200, kerbM, s * (ROAD_HALF + 0.07), 0.065, zc, false));
    const pave = box(2.35, 0.12, len + 200, paveM, s * (ROAD_HALF + 1.32), 0.06, zc, false);
    pave.castShadow = false; scene.add(pave);
  }
  // Houses, garden walls, hedges, trees, lamp posts
  const bricks = ['#9b5a3c', '#b06b48', '#8a4f36', '#c49a6c', '#d8c8a8', '#a0634a'];
  const roofM = mat('#4b4b52'), winM = mat('#2a3a4a', { roughness: 0.15, metalness: 0.5 }), frameM = mat('#f2f2ee');
  const wallM = mat('#8d6e5a'), hedgeM = mat('#3f6a33'), trunkM = mat('#5b4532'), leafM = mat('#4f7f3a');
  const lampM = mat('#5c6166', { metalness: 0.4, roughness: 0.5 });
  let i = 0;
  for (let z = z0 + 30; z > z1 - 120; z -= 11, i++) {
    for (const s of [-1, 1]) {
      const r = rand(i * 2 + (s > 0 ? 1 : 0));
      const brick = mat(bricks[Math.floor(r * bricks.length)]);
      const hx = s * (ROAD_HALF + 2.5 + 5.5 + 4);   // pavement + front garden + half depth
      const h = 5.6 + r * 0.8;
      const house = new THREE.Group();
      house.add(box(8, h, 8, brick, 0, h / 2, 0));
      // pitched roof (prism along the street)
      const shape = new THREE.Shape([new THREE.Vector2(-4.3, 0), new THREE.Vector2(4.3, 0), new THREE.Vector2(0, 2.6)]);
      const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 9.6, bevelEnabled: false }), roofM);
      roof.rotation.y = Math.PI / 2; roof.position.set(-4.8, h, 0); roof.castShadow = true;
      house.add(roof);
      const face = -s * 4.01; // street-facing wall
      for (const wz of [-2.2, 2.2]) {
        for (const wy of [1.5, h - 1.6]) {
          house.add(box(0.08, 1.15, 1.5, frameM, face, wy, wz, false));
          house.add(box(0.1, 1.0, 1.35, winM, face, wy, wz, false));
        }
      }
      house.add(box(0.1, 2.0, 1.0, mat(['#1d3b6b', '#7a1f1f', '#244d2a', '#222'][Math.floor(r * 4)]), face, 1.0, 0, false));
      house.position.set(hx, 0, z);
      scene.add(house);
      const gx = s * (ROAD_HALF + 2.55);
      if (r > 0.35) scene.add(box(0.3, 0.7, 9.5, r > 0.7 ? hedgeM : wallM, gx, 0.35, z));
      if (r > 0.8) {
        const t = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 2.6, 8), trunkM); trunk.position.y = 1.3; trunk.castShadow = true;
        const crown = new THREE.Mesh(new THREE.SphereGeometry(1.7, 12, 10), leafM); crown.position.y = 3.6; crown.castShadow = true;
        t.add(trunk, crown); t.position.set(s * (ROAD_HALF + 4.8), 0, z - 4); scene.add(t);
      }
    }
    if (i % 3 === 0) {
      const s = i % 2 ? 1 : -1;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 6.5, 8), lampM);
      post.position.set(s * (ROAD_HALF + 0.5), 3.25, z); post.castShadow = true; scene.add(post);
      scene.add(box(1.2, 0.08, 0.15, lampM, s * (ROAD_HALF - 0.05), 6.45, z, true));
    }
  }
}

// ---------- actors ----------

interface ActorView {
  actor: Actor;
  obj: THREE.Object3D;
  vehicle?: VehicleParts;
  person?: PersonParts;
  heading: number;
  stride: number;
}

function makeActor(a: Actor): ActorView {
  const v = makeActorModel(a);
  v.heading = ((a.face ?? (a.keys[0][1] > 180 ? 180 : 0)) * Math.PI) / 180;
  return v;
}

function makeActorModel(a: Actor): ActorView {
  const color = a.color ?? '#7a8794';
  switch (a.kind) {
    case 'ped': { const p = makePerson(1.72, color); return { actor: a, obj: p.group, person: p, heading: 0, stride: 0 }; }
    case 'child': { const p = makePerson(1.15, color, '#3a4a6a', '#e8c09a', '#6b4423'); return { actor: a, obj: p.group, person: p, heading: 0, stride: 0 }; }
    case 'ball': {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.12, 18, 14), mat('#d62828', { roughness: 0.4 }));
      const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.015, 6, 24), mat('#ffffff'));
      ball.add(stripe); ball.castShadow = true;
      return { actor: a, obj: ball, heading: 0, stride: 0 };
    }
    default: {
      const v = makeCar(color, a.kind === 'van' ? 'van' : 'car');
      return { actor: a, obj: v.group, vehicle: v, heading: 0, stride: 0 };
    }
  }
}

function isVehicle(a: Actor) { return !['ped', 'child', 'ball', 'dog', 'horse', 'door'].includes(a.kind); }

function placeActor(v: ActorView, t: number, dt: number) {
  const a = v.actor;
  const [x, y] = lerpKeys(a.keys, t);
  const [x2, y2] = lerpKeys(a.keys, t + 0.15);
  let X = lat(x);
  if (isVehicle(a) && x >= 105 && x <= 255) {
    const lim = ROAD_HALF - 0.95 - 0.12; // keep vehicles off the kerb
    X = Math.max(-lim, Math.min(lim, X));
  }
  const dx = lat(x2) - lat(x), dz = (y2 - y) * LONG;
  const speed = Math.hypot(dx, dz) / 0.15;
  if (speed > 0.05) {
    v.heading = Math.atan2(dx, dz);
    if (a.revUntil !== undefined && t < a.revUntil) v.heading += Math.PI;
  }
  v.obj.position.set(X, a.kind === 'ball' ? 0.12 : 0, fwd(y));
  v.obj.rotation.y = -v.heading;
  if (v.person) {
    if (speed > 0.1) v.stride += dt * Math.min(9, 3 + speed * 3);
    const sw = speed > 0.1 ? Math.sin(v.stride) * Math.min(0.6, 0.25 + speed * 0.12) : 0;
    v.person.legs[0].rotation.x = sw; v.person.legs[1].rotation.x = -sw;
    v.person.arms[0].rotation.x = -sw * 0.8; v.person.arms[1].rotation.x = sw * 0.8;
  } else if (a.kind === 'ball') {
    v.stride += speed * dt;
    v.obj.rotation.set(0, -v.heading, 0);
    v.obj.rotateX(-v.stride / 0.12);
  }
  if (v.vehicle) {
    const blink = Math.floor(t * 2.5) % 2 === 0;
    const ind = a.ind && t >= a.ind[0] && t <= a.ind[1] ? a.ind[2] : null;
    v.vehicle.indL.emissive.set(ind === 'L' && blink ? '#ffa000' : '#000000');
    v.vehicle.indR.emissive.set(ind === 'R' && blink ? '#ffa000' : '#000000');
    const braking = !!a.brake && t >= a.brake[0] && t <= a.brake[1];
    v.vehicle.brake.emissive.set(braking ? '#ff1a1a' : '#000000');
    const rev = a.revUntil !== undefined && t < a.revUntil && t > (a.keys[1]?.[0] ?? 0) - 1;
    v.vehicle.reverse.emissive.set(rev ? '#ffffff' : '#000000');
    for (const w of v.vehicle.wheels) w.rotation.x += (speed * dt) / 0.33;
  }
}

interface Props {
  clip: Clip;
  onDone: (clicks: number[]) => void;
  review?: { clicks: number[] };
}

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
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch {
      setFailed(true); return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#b9d3ea');
    scene.fog = new THREE.Fog('#c9dbe9', 45, 150);
    scene.add(new THREE.HemisphereLight('#e4f0ff', '#5d6b4c', 1.1));
    const sun = new THREE.DirectionalLight('#fff4e0', 2.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 140 });
    sun.shadow.bias = -0.0005;
    scene.add(sun, sun.target);

    const camMax = Math.max(...clip.cam.map((c) => c[1]));
    buildStreet(scene, -300, camMax + 1200);
    const views = clip.actors.map(makeActor);
    views.forEach((v) => scene.add(v.obj));

    const camera = new THREE.PerspectiveCamera(52, 4 / 3, 0.1, 400);
    scene.add(camera);
    // Your own car: bonnet and dashboard fixed to the camera
    const ownBody = mat('#1d5fb4', { roughness: 0.4, metalness: 0.05 });
    const bonnet = box(1.8, 0.08, 1.9, ownBody, -DRIVER_OFFSET, -0.42, -1.85, false);
    bonnet.rotation.x = 0.06;
    const dash = box(2.2, 0.3, 0.5, mat('#1b1c1f', { roughness: 0.8 }), -DRIVER_OFFSET, -0.56, -0.75, false);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.025, 8, 32), mat('#111'));
    wheel.position.set(0, -0.42, -0.55); wheel.rotation.x = -0.35;
    const mirror = box(0.24, 0.07, 0.02, mat('#202224'), -DRIVER_OFFSET + 0.05, 0.3, -0.95, false);
    mirror.add(box(0.21, 0.05, 0.005, mat('#5d6f7d', { roughness: 0.1 }), 0, 0, 0.012, false));
    camera.add(bonnet, dash, wheel, mirror);

    const resize = () => {
      const w = el.clientWidth;
      const h = Math.round((w * 3) / 4);
      renderer.setSize(w, h);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);

    clicks.current = []; setFlags(0);
    start.current = performance.now();
    let raf = 0, done = false, last = 0;
    const frame = () => {
      const t = Math.min((performance.now() - start.current) / 1000, clip.duration);
      const dt = Math.min(0.1, t - last); last = t;
      const cy = camAt(clip, t);
      const v1 = camAt(clip, t + 0.1) - cy, v0 = cy - camAt(clip, t - 0.1);
      const decel = (v0 - v1) * 10 * LONG; // m/s per 0.1s window
      camera.position.set(OWN_LANE_X + DRIVER_OFFSET, EYE_HEIGHT, fwd(cy));
      camera.rotation.set(-0.05 - Math.max(-0.02, Math.min(0.03, decel * 0.02)), 0, 0);
      sun.position.set(camera.position.x - 25, 45, camera.position.z + 15);
      sun.target.position.set(camera.position.x, 0, camera.position.z - 20);
      for (const v of views) placeActor(v, t, dt);
      renderer.render(scene, camera);
      setElapsed(t);
      (window as unknown as { __hpT?: number }).__hpT = t;
      if (review) {
        const active = clip.hazards.find((h) => t >= h.start && t <= h.end);
        setLabel(active ? active.label : null);
      }
      if (t >= clip.duration) { if (!done) { done = true; onDone(clicks.current); } return; }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      renderer.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
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
