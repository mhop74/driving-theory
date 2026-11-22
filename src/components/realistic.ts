import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Actor, Clip } from '../data/clips';

// Realistic style kit for the 3D hazard clips: physically based materials, sky lighting with
// reflections, shaped car bodies, British terraced houses and a driver's-eye cockpit.
// Every texture is drawn procedurally here; no external assets are loaded.

export interface Geo { fwd: (y: number) => number; lat: (x: number) => number; ROAD_HALF: number; rand: (s: number) => number }
export interface Lights { brake: THREE.MeshStandardMaterial; indL: THREE.MeshStandardMaterial; indR: THREE.MeshStandardMaterial; reverse: THREE.MeshStandardMaterial; beacon?: THREE.MeshStandardMaterial }
export interface Model { group: THREE.Group; lights?: Lights; wheels: THREE.Object3D[]; legs: THREE.Object3D[]; arms: THREE.Object3D[]; halfWidth: number; inner?: THREE.Object3D }

// ---------------- textures ----------------

const texCache = new Map<string, THREE.CanvasTexture>();
let anisotropy = 4;

function canvasTex(key: string, size: number, draw: (g: CanvasRenderingContext2D, s: number, r: () => number) => void, srgb = true) {
  const hit = texCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  let seed = key.length * 977 + 13;
  const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  draw(g, size, r);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = anisotropy;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t);
  return t;
}

function speckle(g: CanvasRenderingContext2D, s: number, r: () => number, n: number, colors: string[], maxR = 1.5) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[Math.floor(r() * colors.length)];
    const rr = 0.4 + r() * maxR;
    g.fillRect(r() * s, r() * s, rr, rr);
  }
}

/** 4 m × 4 m of tarmac. */
const asphaltTex = () => canvasTex('asphalt', 512, (g, s, r) => {
  g.fillStyle = '#4b4d50'; g.fillRect(0, 0, s, s);
  speckle(g, s, r, 26000, ['#3b3d40', '#55585b', '#5f6264', '#45474a', '#6b6d6f'], 1.6);
  g.globalAlpha = 0.08;
  for (let i = 0; i < 18; i++) { g.fillStyle = r() > 0.5 ? '#2c2d2f' : '#6a6c6e'; g.beginPath(); g.ellipse(r() * s, r() * s, 20 + r() * 60, 10 + r() * 30, r() * 3, 0, 7); g.fill(); }
  g.globalAlpha = 1;
});

/** 2 m × 2 m of stretcher-bond brickwork (215 × 65 mm bricks, 10 mm mortar). */
const brickTex = (tone: string) => canvasTex(`brick${tone}`, 512, (g, s, r) => {
  g.fillStyle = '#b9b2a6'; g.fillRect(0, 0, s, s);
  const px = s / 2; // px per metre
  const bw = 0.225 * px, bh = 0.075 * px, m = 0.01 * px;
  const base = new THREE.Color(tone);
  for (let row = 0; row * bh < s; row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let x = -off; x < s; x += bw) {
      const c = base.clone().offsetHSL((r() - 0.5) * 0.03, (r() - 0.5) * 0.1, (r() - 0.5) * 0.12);
      g.fillStyle = `#${c.getHexString()}`;
      g.fillRect(x + m / 2, row * bh + m / 2, bw - m, bh - m);
    }
  }
  speckle(g, s, r, 9000, ['rgba(0,0,0,0.12)', 'rgba(255,255,255,0.08)'], 1.4);
});

/** 1.2 m × 1.2 m of 600 mm paving slabs. */
const slabTex = () => canvasTex('slab', 256, (g, s, r) => {
  g.fillStyle = '#b4b1aa'; g.fillRect(0, 0, s, s);
  for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const v = 168 + Math.floor(r() * 20);
    g.fillStyle = `rgb(${v},${v - 2},${v - 8})`; g.fillRect(x * s / 2 + 1, y * s / 2 + 1, s / 2 - 2, s / 2 - 2);
  }
  speckle(g, s, r, 5000, ['rgba(0,0,0,0.1)', 'rgba(255,255,255,0.1)'], 1.2);
  g.fillStyle = '#8f8b83'; g.fillRect(0, 0, s, 2); g.fillRect(0, 0, 2, s); g.fillRect(s / 2 - 1, 0, 2, s); g.fillRect(0, s / 2 - 1, s, 2);
});

/** 2 m × 2 m of concrete roof tiles. */
const roofTex = () => canvasTex('roof', 256, (g, s, r) => {
  g.fillStyle = '#4a4442'; g.fillRect(0, 0, s, s);
  const rowH = s / 8;
  for (let row = 0; row < 8; row++) {
    for (let x = row % 2 ? -16 : 0; x < s; x += 32) {
      const v = 60 + Math.floor(r() * 22);
      g.fillStyle = `rgb(${v + 6},${v},${v - 4})`; g.fillRect(x + 1, row * rowH + 2, 30, rowH - 3);
    }
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, row * rowH + rowH - 3, s, 3);
  }
});

const grassTex = () => canvasTex('grass', 256, (g, s, r) => {
  g.fillStyle = '#4f7a35'; g.fillRect(0, 0, s, s);
  speckle(g, s, r, 14000, ['#3f682a', '#5b8a3c', '#6a9845', '#466f2f', '#79a552'], 1.8);
});

const hedgeTex = () => canvasTex('hedge', 256, (g, s, r) => {
  g.fillStyle = '#2f4f24'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 2600; i++) { g.fillStyle = ['#3d6a2c', '#294520', '#4f7f37', '#365e28'][Math.floor(r() * 4)]; g.beginPath(); g.ellipse(r() * s, r() * s, 2 + r() * 4, 1.5 + r() * 3, r() * 3, 0, 7); g.fill(); }
});

const footballTex = () => canvasTex('football', 512, (g, s) => {
  g.fillStyle = '#f5f5f2'; g.fillRect(0, 0, s, s);
  g.fillStyle = '#171717';
  const pent = (x: number, y: number, rr: number, sx = 1) => {
    g.beginPath();
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5; g.lineTo(x + rr * Math.cos(a) * sx, y + rr * Math.sin(a)); }
    g.closePath(); g.fill();
  };
  for (let i = 0; i < 5; i++) { pent(i * s / 5 + 25, s * 0.3, 24, 1.3); pent(i * s / 5 + 76, s * 0.7, 24, 1.3); }
  g.fillRect(0, 0, s, 18); g.fillRect(0, s - 18, s, 18);
});

// ---------------- materials & geometry helpers ----------------

const matCache = new Map<string, THREE.MeshStandardMaterial>();
function pbr(key: string, params: THREE.MeshStandardMaterialParameters) {
  let m = matCache.get(key);
  if (!m) { m = new THREE.MeshStandardMaterial(params); matCache.set(key, m); }
  return m;
}
const paint = (color: string) => pbr(`paint${color}`, { color, roughness: 0.28, metalness: 0.55 });
const plastic = (color: string, roughness = 0.6) => pbr(`plastic${color}${roughness}`, { color, roughness, metalness: 0 });
const glassMat = () => pbr('glass', { color: '#111a22', roughness: 0.04, metalness: 0.9 });
const chrome = () => pbr('chrome', { color: '#c9ccd0', roughness: 0.2, metalness: 1 });
const live = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.3, emissive: '#000000', emissiveIntensity: 2.5 });

/** Box whose texture repeats every `tile` metres on each face. */
function box(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0, cast = true, tile = 1) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, (uv.getX(k) * dims[f][0]) / tile, (uv.getY(k) * dims[f][1]) / tile); }
  const mesh = new THREE.Mesh(g, m);
  mesh.position.set(x, y, z); mesh.castShadow = cast; mesh.receiveShadow = true;
  return mesh;
}

function ground(w: number, len: number, m: THREE.Material, x: number, z: number, y = 0, tile = 1) {
  const g = new THREE.PlaneGeometry(w, len, 1, Math.max(1, Math.ceil(len / 8)));
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tile, (uv.getY(i) * len) / tile);
  const mesh = new THREE.Mesh(g, m);
  mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, y, z); mesh.receiveShadow = true;
  return mesh;
}

/** Profile in the (z, y) plane, extruded across the width (x), centred. Front of the vehicle is -z. */
function profile(points: [number, number][], width: number, m: THREE.Material, bevel = 0.05) {
  const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: width - 2 * bevel, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 6 });
  const mesh = new THREE.Mesh(g, m);
  mesh.rotation.y = -Math.PI / 2;
  mesh.position.x = (width - 2 * bevel) / 2;
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}

/** Merge static meshes by material to keep draw calls low on phones. */
function mergeStatic(scene: THREE.Scene, root: THREE.Group) {
  root.updateMatrixWorld(true);
  const groups = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; cast: boolean }>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || Array.isArray(m.material)) return;
    let g = m.geometry.clone().applyMatrix4(m.matrixWorld);
    if (g.index) g = g.toNonIndexed();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    const e = groups.get(m.material) ?? { geos: [], cast: false };
    e.geos.push(g); e.cast ||= m.castShadow;
    groups.set(m.material, e);
  });
  for (const [mat, { geos, cast }] of groups) {
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = cast; mesh.receiveShadow = true;
    scene.add(mesh);
  }
}

// ---------------- environment ----------------

export function setupEnvironment(renderer: THREE.WebGLRenderer, scene: THREE.Scene, sun: THREE.DirectionalLight) {
  anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.55;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const sky = new Sky();
  sky.scale.setScalar(4000);
  const u = sky.material.uniforms;
  u.turbidity.value = 4; u.rayleigh.value = 1.2; u.mieCoefficient.value = 0.004; u.mieDirectionalG.value = 0.8;
  const sunDir = new THREE.Vector3(-30, 50, 18).normalize();
  u.sunPosition.value.copy(sunDir);
  // Image-based lighting from the same sky gives reflections on paint and glass.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene(); envScene.add(sky);
  scene.environment = pmrem.fromScene(envScene, 0.02).texture;
  envScene.remove(sky);
  scene.add(sky);
  scene.environmentIntensity = 0.7;
  scene.background = null;
  scene.fog = new THREE.Fog('#c3d3e2', 70, 220);
  scene.add(new THREE.HemisphereLight('#dfe9f5', '#5d5a4a', 0.6));
  sun.color.set('#fff1dc'); sun.intensity = 3.2;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 3;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  // keep the sky dome centred on the driver
  return (camera: THREE.Camera) => { sky.position.copy(camera.position); };
}

// ---------------- world: British residential street ----------------

function house(root: THREE.Group, side: number, z: number, ROAD_HALF: number, rand: (s: number) => number, seed: number) {
  const tones = ['#8e4a32', '#9c5236', '#7f4430', '#a8623f', '#93583f'];
  const front = side * (ROAD_HALF + 2.4 + 4.5);   // pavement + front garden
  const depth = 8, h = 5.6, w = 5.4;
  const cx = front + side * depth / 2;
  root.add(box(depth, h, w, pbr(`brick${seed % 5}`, { map: brickTex(tones[Math.floor(rand(seed) * tones.length)]), roughness: 0.92 }), cx, h / 2, z, true, 2));
  // pitched roof running along the street, tiled
  const shape = new THREE.Shape([new THREE.Vector2(-depth / 2 - 0.35, 0), new THREE.Vector2(depth / 2 + 0.35, 0), new THREE.Vector2(0, 2.8)]);
  const rg = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
  const uv = rg.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2, uv.getY(i) / 2);
  const roof = new THREE.Mesh(rg, pbr('roof', { map: roofTex(), roughness: 0.85 }));
  roof.position.set(cx, h, z - w / 2); roof.castShadow = true; roof.receiveShadow = true;
  root.add(roof);
  root.add(box(0.12, 0.12, w + 0.1, plastic('#2a2a2a', 0.5), front + side * 0.05, h - 0.05, z, false)); // gutter
  if (seed % 2 === 0) { // chimney stack on the party wall, with pots
    root.add(box(1.0, 1.4, 0.6, pbr(`brick${seed % 5}`, {}), cx + side * 1.2, h + 2.2, z + w / 2));
    for (const pz of [-0.2, 0.2]) root.add(box(0.2, 0.35, 0.2, plastic('#9b5a3c', 0.8), cx + side * 1.2, h + 3.05, z + w / 2 + pz));
  }
  const fx = front - side * 0.02;
  const frame = plastic('#f4f4f2', 0.35);
  const winGlass = pbr('winglass', { color: '#1b2630', roughness: 0.05, metalness: 0.85 });
  const win = (wz: number, wy: number, ww: number, wh: number) => {
    root.add(box(0.1, wh + 0.1, ww + 0.1, frame, fx, wy, z + wz, false));
    root.add(box(0.12, wh - 0.06, ww / 2 - 0.08, winGlass, fx - side * 0.01, wy, z + wz - ww / 4, false));
    root.add(box(0.12, wh - 0.06, ww / 2 - 0.08, winGlass, fx - side * 0.01, wy, z + wz + ww / 4, false));
    root.add(box(0.25, 0.08, ww + 0.2, plastic('#d8d4cc', 0.7), fx - side * 0.08, wy - wh / 2 - 0.06, z + wz, false)); // sill
  };
  win(-1.1, 1.5, 2.0, 1.25);
  win(-1.1, 4.1, 1.6, 1.1);
  win(1.5, 4.1, 1.0, 1.0);
  const doors = ['#1f3a5f', '#6b1e1e', '#24472b', '#2b2b2b', '#e8e4da'];
  root.add(box(0.1, 2.05, 0.95, plastic(doors[Math.floor(rand(seed + 3) * doors.length)], 0.4), fx, 1.03, z + 1.5, false));
  root.add(box(0.6, 0.08, 1.4, plastic('#e9e9e6', 0.5), fx - side * 0.3, 2.3, z + 1.5)); // door canopy
  // front garden: lawn, path, low wall, and sometimes a wheelie bin
  const garden = front - side * 2.25;
  root.add(box(0.3, 0.6, w - 1.2, pbr(`brick${seed % 5}`, {}), side * (ROAD_HALF + 2.55), 0.3, z - 0.6, true));
  root.add(box(0.36, 0.06, w - 1.2, plastic('#c9c3b6', 0.8), side * (ROAD_HALF + 2.55), 0.63, z - 0.6, false));
  if (rand(seed + 5) > 0.4) {
    const bin = new THREE.Group();
    bin.add(box(0.58, 1.0, 0.72, plastic(['#2a2d2f', '#1d4f8a', '#3c6b2f'][Math.floor(rand(seed + 6) * 3)], 0.5), 0, 0.5, 0));
    bin.add(box(0.62, 0.06, 0.78, plastic('#1e1e1e', 0.5), 0, 1.02, 0));
    bin.position.set(garden + side * 1.2, 0, z - 1.6); root.add(bin);
  }
}

function lamp(root: THREE.Group, x: number, z: number, side: number) {
  const metal = pbr('lampgrey', { color: '#7b8085', roughness: 0.5, metalness: 0.6 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 7, 10), metal);
  post.position.set(x, 3.5, z); post.castShadow = true; root.add(post);
  root.add(box(1.0, 0.08, 0.12, metal, x - side * 0.45, 6.95, z));
  root.add(box(0.55, 0.12, 0.25, plastic('#dfe3e6', 0.3), x - side * 0.95, 6.9, z, false));
}

function tree(root: THREE.Group, x: number, z: number, rand: (s: number) => number, seed: number) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 3.2, 8), plastic('#5a4632', 0.9));
  trunk.position.set(x, 1.6, z); trunk.castShadow = true; root.add(trunk);
  const leaf = pbr('leaf', { map: hedgeTex(), roughness: 0.9 });
  for (let i = 0; i < 5; i++) {
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1 + rand(seed + i) * 0.7, 1), leaf);
    c.position.set(x + (rand(seed + i * 3) - 0.5) * 1.8, 3.8 + rand(seed + i * 5) * 1.4, z + (rand(seed + i * 7) - 0.5) * 1.8);
    c.castShadow = true; root.add(c);
  }
}

export function buildWorld(scene: THREE.Scene, _clip: Clip, y0: number, y1: number, geo: Geo) {
  const { fwd, ROAD_HALF, rand } = geo;
  const z0 = fwd(y0), z1 = fwd(y1), len = z0 - z1, zc = (z0 + z1) / 2;
  const root = new THREE.Group();
  root.add(ground(ROAD_HALF * 2, len, pbr('asphalt', { map: asphaltTex(), roughness: 0.92 }), 0, zc, 0, 4));
  const lineM = pbr('roadline', { color: '#ecebe4', roughness: 0.6 });
  for (let z = z0; z > z1; z -= 9) root.add(ground(0.12, 4, lineM, 0, z - 2, 0.006));
  for (const side of [-1, 1]) {
    root.add(box(0.25, 0.13, len, pbr('kerb', { map: slabTex(), color: '#c9c6bf', roughness: 0.85 }), side * (ROAD_HALF + 0.12), 0.065, zc, false, 1.2));
    root.add(box(2.15, 0.11, len, pbr('slab', { map: slabTex(), roughness: 0.88 }), side * (ROAD_HALF + 1.32), 0.055, zc, false, 1.2));
    root.add(ground(60, len, pbr('grass', { map: grassTex(), roughness: 0.95 }), side * (ROAD_HALF + 2.4 + 30), zc, 0.02, 2));
    // drains every 25 m
    for (let z = z0 - 7; z > z1; z -= 25) root.add(ground(0.35, 0.6, plastic('#262626', 0.6), side * (ROAD_HALF - 0.25), z, 0.008));
    let i = 0;
    for (let z = z0 - 3; z > z1; z -= 5.6, i++) house(root, side, z, ROAD_HALF, rand, i * 2 + (side > 0 ? 1 : 0));
    for (let z = z0 - 12, j = 0; z > z1; z -= 32, j++) lamp(root, side * (ROAD_HALF + 0.55), z + (side > 0 ? 16 : 0), side);
    for (let z = z0 - 20, j = 0; z > z1; z -= 27, j++) if (rand(j * 11 + side) > 0.45) tree(root, side * (ROAD_HALF + 4.2), z, rand, j * 13 + (side > 0 ? 5 : 0));
  }
  mergeStatic(scene, root);
}

// ---------------- road users ----------------

function newLights(): Lights {
  return { brake: live('#5e0b0b'), indL: live('#6b4500'), indR: live('#6b4500'), reverse: live('#bbbbbb') };
}

function makeCar(color: string): Model {
  const g = new THREE.Group();
  const W = 1.78;
  const body = paint(color);
  // lower body: bumpers, bonnet and boot line (side profile, front at -z)
  g.add(profile([[2.08, 0.3], [2.15, 0.62], [2.08, 0.98], [-0.72, 0.98], [-1.95, 0.84], [-2.12, 0.62], [-2.08, 0.3]], W, body, 0.06));
  // glasshouse and roof
  const cabin = profile([[1.95, 0.96], [1.6, 1.4], [0.12, 1.44], [-0.7, 0.96]], W - 0.18, glassMat(), 0.04);
  g.add(cabin);
  g.add(profile([[1.58, 1.38], [1.62, 1.46], [0.12, 1.5], [0.1, 1.42]], W - 0.16, body, 0.03));
  for (const pz of [0.55]) g.add(box(W - 0.12, 0.42, 0.1, body, 0, 1.2, pz)); // B-pillar
  // wheel arches (dark) and wheels
  const tyreM = plastic('#161616', 0.9);
  const wheels: THREE.Object3D[] = [];
  for (const z of [-1.32, 1.3]) for (const s of [-1, 1]) {
    const spin = new THREE.Group();
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.22, 24), tyreM);
    tyre.rotation.z = Math.PI / 2; tyre.castShadow = true;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.23, 10), chrome());
    rim.rotation.z = Math.PI / 2;
    for (let k = 0; k < 5; k++) { const spoke = box(0.235, 0.05, 0.36, chrome(), 0, 0, 0, false); spoke.rotation.x = (k * Math.PI) / 5; spin.add(spoke); }
    spin.add(tyre, rim);
    spin.position.set(s * (W / 2 - 0.08), 0.31, z);
    g.add(spin); wheels.push(spin);
  }
  // lights and UK number plates (white front, yellow rear)
  const L = newLights();
  for (const s of [-1, 1]) {
    g.add(box(0.36, 0.14, 0.06, L.brake, s * (W / 2 - 0.22), 0.86, 2.13, false));
    g.add(box(0.38, 0.12, 0.06, pbr('headlamp', { color: '#f6f3e8', roughness: 0.1, metalness: 0.3, emissive: '#3a382f' }), s * (W / 2 - 0.24), 0.78, -2.11, false));
    const ind = s < 0 ? L.indL : L.indR;
    g.add(box(0.1, 0.1, 0.06, ind, s * (W / 2 - 0.04), 0.78, -2.1, false));
    g.add(box(0.1, 0.1, 0.06, ind, s * (W / 2 - 0.04), 0.94, 2.12, false));
  }
  g.add(box(0.2, 0.08, 0.05, L.reverse, 0, 0.62, 2.16, false));
  g.add(box(0.52, 0.11, 0.03, plastic('#f2f2ee', 0.4), 0, 0.5, -2.14, false));
  g.add(box(0.52, 0.11, 0.03, plastic('#f2c400', 0.4), 0, 0.55, 2.17, false));
  g.add(box(W - 0.05, 0.18, 0.12, plastic('#202020', 0.6), 0, 0.38, 2.1, false));  // rear bumper insert
  g.add(box(W - 0.05, 0.16, 0.12, plastic('#202020', 0.6), 0, 0.4, -2.08, false)); // front grille band
  return { group: g, lights: L, wheels, legs: [], arms: [], halfWidth: W / 2 };
}

const SKIN = ['#e8c2a0', '#c6946c', '#8a5a3a', '#f0d0b4'];
const HAIR = ['#2e2119', '#c79f55', '#151515', '#7a3f1f'];

function makePerson(height: number, top: string, seed: number, rand: (s: number) => number, bottoms = '#2e3a52'): Model {
  const k = height / 1.75;
  const g = new THREE.Group();
  const skin = plastic(SKIN[Math.floor(rand(seed) * SKIN.length)], 0.7);
  const cloth = plastic(top, 0.85), legsM = plastic(bottoms, 0.85), shoe = plastic('#1d1d1d', 0.6);
  const limb = (r: number, len: number, m: THREE.Material, x: number, y: number, foot = false) => {
    const pivot = new THREE.Group(); pivot.position.set(x * k, y * k, 0);
    const c = new THREE.Mesh(new THREE.CapsuleGeometry(r * k, len * k, 4, 10), m);
    c.position.y = -(len * k) / 2 - r * k; c.castShadow = true; pivot.add(c);
    if (foot) { const f = box(0.11 * k, 0.07 * k, 0.24 * k, shoe, 0, -(len + 2 * r) * k + 0.03, -0.05 * k); pivot.add(f); }
    g.add(pivot); return pivot;
  };
  const legs = [limb(0.07, 0.72, legsM, -0.1, 0.92, true), limb(0.07, 0.72, legsM, 0.1, 0.92, true)];
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.16 * k, 0.4 * k, 4, 12), cloth);
  torso.position.y = 1.2 * k; torso.scale.set(1.1, 1, 0.7); torso.castShadow = true; g.add(torso);
  const arms = [limb(0.05, 0.5, cloth, -0.23, 1.45), limb(0.05, 0.5, cloth, 0.23, 1.45)];
  for (const a of arms) { const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05 * k, 8, 6), skin); hand.position.y = -0.62 * k; a.add(hand); }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * k, 0.06 * k, 0.1 * k, 8), skin); neck.position.y = 1.53 * k; g.add(neck);
  const headR = 0.11 * k * (height < 1.4 ? 1.2 : 1);
  const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 18, 14), skin); head.position.y = 1.53 * k + headR + 0.02; head.scale.set(0.92, 1.08, 1); head.castShadow = true; g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(headR * 1.05, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), plastic(HAIR[Math.floor(rand(seed + 1) * HAIR.length)], 0.8));
  hair.position.copy(head.position); hair.position.y += 0.01; hair.rotation.x = 0.25; g.add(hair);
  return { group: g, wheels: [], legs, arms, halfWidth: 0.3 };
}

export const BALL_R = 0.11; // a real size-5 football

export function makeModel(a: Actor, i: number, rand: (s: number) => number): Model | null {
  const color = a.color ?? '#7a8794';
  switch (a.kind) {
    case 'car': return makeCar(color);
    case 'ped': return makePerson(1.74, color, i * 7 + 1, rand);
    case 'child': return makePerson(1.2, color, i * 7 + 3, rand, '#3d4f73');
    case 'ball': {
      const g = new THREE.Group();
      const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R * 1.4, 28, 20), pbr('ball', { map: footballTex(), roughness: 0.45 }));
      ball.castShadow = true; ball.position.y = BALL_R * 1.4; g.add(ball);
      return { group: g, wheels: [], legs: [], arms: [], halfWidth: BALL_R, inner: ball };
    }
    default: return null; // other road users fall back to the standard models
  }
}

// ---------------- cockpit ----------------

/** Driver's-eye interior: dashboard, bonnet, A-pillars, mirror. Attach to the camera. */
export function cockpit(camera: THREE.Camera, driverOffset: number) {
  const trim = plastic('#1b1c1f', 0.75);
  const cx = -driverOffset;
  // Bonnet: only a slice shows above the dashboard, as from a real driver's seat.
  const bonnet = profile([[0, 0], [-2.0, -0.06], [-2.15, -0.22], [0, -0.22]], 1.75, paint('#1e4f8f'), 0.05);
  bonnet.position.set(cx + 0.825, -0.5, -0.9);
  const dash = box(2.2, 0.3, 0.75, trim, cx, -0.55, -0.78, false);
  const top = box(2.2, 0.02, 0.75, plastic('#26272b', 0.9), cx, -0.395, -0.78, false);
  const sw = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.022, 10, 36), plastic('#121212', 0.5));
  sw.position.set(0, -0.47, -0.42); sw.rotation.x = -0.45;
  // A-pillars at the edges of the windscreen: these really do hide things from the driver.
  const pillar = (x: number, lean: number) => {
    const p = box(0.05, 1.2, 0.07, trim, x, 0.05, -0.98, false);
    p.rotation.z = lean; p.rotation.x = -0.5; return p;
  };
  const mirror = box(0.2, 0.06, 0.03, trim, cx + 0.02, 0.4, -0.9, false);
  mirror.add(box(0.18, 0.045, 0.008, pbr('mirrorglass', { color: '#9fb2c2', roughness: 0.05, metalness: 1 }), 0, 0, 0.018, false));
  const header = box(1.9, 0.05, 0.3, plastic('#cfccc5', 0.9), cx, 0.6, -0.85, false);
  camera.add(bonnet, dash, top, sw, pillar(cx - 0.95, -0.22), pillar(cx + 0.95, 0.22), mirror, header);
}
