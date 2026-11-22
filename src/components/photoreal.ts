import * as THREE from 'three';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import skyUrl from '../assets/hdri/sky.exr?url';
import type { Actor, Clip } from '../data/clips';
import * as real from './realistic';
import type { Geo, Lights, Model } from './realistic';

// Photo-real style kit (trial on the residential street clip). Compared with the realistic kit:
//  - a real photographed sky (CC0 HDRI) is the visible sky and lights the scene, so paint and glass
//    reflect real clouds;
//  - every surface has a normal map and roughness map generated from a height map, so brick
//    mortar, tarmac aggregate, paving joints and roof tiles catch the light;
//  - ambient occlusion, anti-aliasing, a gentle vignette and film grain are added in post-processing;
//  - cars have wheel arches, rounded bodies, clearcoat paint, pillars, door shut lines and UK plates;
//  - houses have bay windows, stone lintels and sills, tiled paths, garden walls and hedges;
//  - the cockpit has a curved, reflective bonnet, wipers, a shaped dashboard and instrument hood.

// Direction to the sun in the HDRI (brightest texel), so shadows agree with the sky.
const SUN_DIR = new THREE.Vector3(0.552, 0.745, 0.374).normalize();
// Average horizon colour of the HDRI (linear), used for distance haze.
const HORIZON = new THREE.Color().setRGB(0.445, 0.478, 0.581, THREE.LinearSRGBColorSpace);
const SKY_INTENSITY = 1.15;

// ---------------- procedural surfaces (colour + normal + roughness) ----------------

type Ctx = CanvasRenderingContext2D;
interface Surface { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap: THREE.Texture }
const surfCache = new Map<string, Surface>();
let anisotropy = 8;

function rng(key: string) {
  let seed = 7;
  for (const ch of key) seed = (seed * 31 + ch.charCodeAt(0)) % 2147483647;
  seed = seed || 1;
  return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
}

function canvas(size: number, fill: string) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.fillStyle = fill; g.fillRect(0, 0, size, size);
  return { c, g };
}

function toTex(c: HTMLCanvasElement, srgb: boolean) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = anisotropy;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Tangent-space normal map from a height canvas (white = high). Wraps at the edges so it tiles. */
function normalsFrom(h: HTMLCanvasElement, strength: number) {
  const s = h.width;
  const src = h.getContext('2d')!.getImageData(0, 0, s, s).data;
  const out = document.createElement('canvas');
  out.width = out.height = s;
  const og = out.getContext('2d')!;
  const img = og.createImageData(s, s), d = img.data;
  const H = (x: number, y: number) => src[(((y + s) % s) * s + ((x + s) % s)) * 4] / 255;
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const dx = H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1) - H(x - 1, y - 1) - 2 * H(x - 1, y) - H(x - 1, y + 1);
    const dy = H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1) - H(x - 1, y - 1) - 2 * H(x, y - 1) - H(x + 1, y - 1);
    const nx = -dx * strength, ny = dy * strength, l = Math.hypot(nx, ny, 1);
    const i = (y * s + x) * 4;
    d[i] = (nx / l * 0.5 + 0.5) * 255; d[i + 1] = (ny / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  og.putImageData(img, 0, 0);
  return out;
}

/** Draws colour, height and roughness (grey: 255 = fully rough) canvases together. */
function surface(key: string, size: number, strength: number, draw: (c: Ctx, h: Ctx, ro: Ctx, s: number, r: () => number) => void) {
  const hit = surfCache.get(key);
  if (hit) return hit;
  const col = canvas(size, '#808080'), ht = canvas(size, '#808080'), ro = canvas(size, '#e6e6e6');
  draw(col.g, ht.g, ro.g, size, rng(key));
  const res = { map: toTex(col.c, true), normalMap: toTex(normalsFrom(ht.c, strength), false), roughnessMap: toTex(ro.c, false) };
  surfCache.set(key, res);
  return res;
}

const grey = (v: number) => { const k = Math.max(0, Math.min(255, Math.round(v))); return `rgb(${k},${k},${k})`; };

function dots(gs: [Ctx, string | (() => string)][], s: number, r: () => number, n: number, rMin: number, rMax: number) {
  for (let i = 0; i < n; i++) {
    const x = r() * s, y = r() * s, rad = rMin + r() * (rMax - rMin);
    for (const [g, f] of gs) { g.fillStyle = typeof f === 'string' ? f : f(); g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); }
  }
}

/** 4 m × 4 m of worn tarmac: exposed aggregate on a darker binder. */
const asphaltSurf = () => surface('asphalt', 512, 1.1, (c, h, ro, s, r) => {
  c.fillStyle = '#3d3f42'; c.fillRect(0, 0, s, s);
  ro.fillStyle = grey(232); ro.fillRect(0, 0, s, s);
  // broad stains and lighter, polished patches
  for (let i = 0; i < 26; i++) {
    c.globalAlpha = 0.06; c.fillStyle = r() > 0.5 ? '#26282a' : '#77797b';
    c.beginPath(); c.ellipse(r() * s, r() * s, 30 + r() * 90, 15 + r() * 50, r() * 3, 0, 7); c.fill();
  }
  c.globalAlpha = 1;
  const stone = ['#36383b', '#46484b', '#4d4f52', '#3f4144', '#55575a', '#4a4846'];
  dots([[c, () => stone[Math.floor(r() * stone.length)]], [h, () => grey(140 + r() * 70)], [ro, () => grey(185 + r() * 40)]], s, r, 22000, 0.4, 1.1);
  dots([[c, '#2c2e30'], [h, grey(90)]], s, r, 2500, 0.4, 0.8); // pits
});

/** 2 m × 2 m of stretcher-bond brickwork with recessed mortar. */
const brickSurf = (tone: string) => surface(`brick${tone}`, 512, 3.2, (c, h, ro, s, r) => {
  c.fillStyle = '#a89f92'; c.fillRect(0, 0, s, s);
  h.fillStyle = grey(70); h.fillRect(0, 0, s, s);
  ro.fillStyle = grey(250); ro.fillRect(0, 0, s, s);
  dots([[c, () => (r() > 0.5 ? '#968d80' : '#bab1a3')]], s, r, 6000, 0.4, 1.0);
  const px = s / 2, bw = 0.225 * px, bh = 0.075 * px, m = 0.012 * px;
  const base = new THREE.Color(tone);
  for (let row = 0; row * bh < s; row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let x = -off; x < s; x += bw) {
      const burnt = r() < 0.08;
      const cc = base.clone().offsetHSL((r() - 0.5) * 0.03, (r() - 0.5) * 0.12, (r() - 0.5) * 0.14 - (burnt ? 0.12 : 0));
      c.fillStyle = `#${cc.getHexString()}`;
      c.fillRect(x + m / 2, row * bh + m / 2, bw - m, bh - m);
      h.fillStyle = grey(175 + r() * 30); h.fillRect(x + m / 2, row * bh + m / 2, bw - m, bh - m);
      h.fillStyle = grey(205 + r() * 20); h.fillRect(x + m, row * bh + m, bw - 2 * m, bh - 2 * m); // rounded arrises
      ro.fillStyle = grey(215 + r() * 30); ro.fillRect(x + m / 2, row * bh + m / 2, bw - m, bh - m);
    }
  }
  dots([[c, 'rgba(0,0,0,0.13)'], [h, grey(150)]], s, r, 7000, 0.4, 1.2);
  dots([[c, 'rgba(255,255,255,0.08)']], s, r, 4000, 0.4, 1.0);
});

/** 2 m × 2 m of painted pebbledash render. */
const renderSurf = (tone: string) => surface(`render${tone}`, 256, 2.4, (c, h, ro, s, r) => {
  c.fillStyle = tone; c.fillRect(0, 0, s, s);
  ro.fillStyle = grey(245); ro.fillRect(0, 0, s, s);
  dots([[c, () => (r() > 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.12)')], [h, () => grey(120 + r() * 120)]], s, r, 9000, 0.6, 1.8);
  for (let i = 0; i < 8; i++) { c.globalAlpha = 0.05; c.fillStyle = '#5a5040'; c.fillRect(r() * s, 0, 2 + r() * 6, s); }
  c.globalAlpha = 1;
});

/** 1.2 m × 1.2 m of 600 mm concrete paving slabs. */
const slabSurf = () => surface('slab', 256, 2.4, (c, h, _ro, s, r) => {
  c.fillStyle = '#7f7b74'; c.fillRect(0, 0, s, s);
  h.fillStyle = grey(60); h.fillRect(0, 0, s, s);
  for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const v = 132 + Math.floor(r() * 22);
    c.fillStyle = `rgb(${v},${v - 3},${v - 9})`; c.fillRect(x * s / 2 + 1.5, y * s / 2 + 1.5, s / 2 - 3, s / 2 - 3);
    h.fillStyle = grey(180); h.fillRect(x * s / 2 + 1.5, y * s / 2 + 1.5, s / 2 - 3, s / 2 - 3);
    if (r() < 0.4) { c.globalAlpha = 0.12; c.fillStyle = '#3d3a33'; c.beginPath(); c.ellipse(x * s / 2 + r() * s / 2, y * s / 2 + r() * s / 2, 8 + r() * 20, 6 + r() * 14, r() * 3, 0, 7); c.fill(); c.globalAlpha = 1; }
  }
  dots([[c, () => (r() > 0.5 ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)')], [h, () => grey(150 + r() * 70)]], s, r, 6000, 0.4, 1.2);
});

/** Kerb stones: 0.9 m long precast units. Repeats every 0.9 m along u. */
const kerbSurf = () => surface('kerb', 128, 2, (c, h, ro, s, r) => {
  c.fillStyle = '#99958d'; c.fillRect(0, 0, s, s);
  dots([[c, () => (r() > 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)')], [h, () => grey(110 + r() * 60)]], s, r, 1800, 0.4, 1.1);
  c.fillStyle = '#6f6b63'; c.fillRect(0, 0, 2, s); h.fillStyle = grey(20); h.fillRect(0, 0, 2, s);
  ro.fillStyle = grey(225); ro.fillRect(0, 0, s, s);
});

/** 2 m × 2 m of concrete interlocking roof tiles. Courses run along v; u runs up the slope. */
const roofSurf = () => surface('roof', 256, 3.5, (c, h, ro, s, r) => {
  const n = 8, cw = s / n;
  ro.fillStyle = grey(225); ro.fillRect(0, 0, s, s);
  for (let k = 0; k < n; k++) {
    for (let y = k % 2 ? -16 : 0; y < s; y += 32) {
      const v = 58 + Math.floor(r() * 24);
      c.fillStyle = `rgb(${v + 8},${v + 1},${v - 3})`; c.fillRect(k * cw, y + 1, cw, 30);
      const gr = h.createLinearGradient(k * cw, 0, (k + 1) * cw, 0);
      gr.addColorStop(0, grey(70)); gr.addColorStop(0.85, grey(210)); gr.addColorStop(1, grey(230));
      h.fillStyle = gr; h.fillRect(k * cw, y + 1, cw, 30);
      h.fillStyle = grey(40); h.fillRect(k * cw, y, cw, 1.5);
    }
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect((k + 1) * cw - 3, 0, 3, s);
  }
  dots([[c, () => (r() > 0.7 ? 'rgba(120,130,60,0.35)' : 'rgba(0,0,0,0.15)')]], s, r, 2500, 0.5, 1.6); // lichen
});

const grassSurf = () => surface('grass', 256, 1.6, (c, h, ro, s, r) => {
  c.fillStyle = '#4b7333'; c.fillRect(0, 0, s, s);
  ro.fillStyle = grey(250); ro.fillRect(0, 0, s, s);
  const greens = ['#3c6328', '#5a873b', '#6c9846', '#44692d', '#7aa553', '#577a33'];
  for (let i = 0; i < 9000; i++) {
    const x = r() * s, y = r() * s, len = 2 + r() * 4;
    c.strokeStyle = greens[Math.floor(r() * greens.length)]; h.strokeStyle = grey(100 + r() * 150);
    for (const g of [c, h]) { g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 2, y - len); g.stroke(); }
  }
});

const leafSurf = () => surface('leaf', 256, 3, (c, h, ro, s, r) => {
  c.fillStyle = '#2a4520'; c.fillRect(0, 0, s, s);
  h.fillStyle = grey(40); h.fillRect(0, 0, s, s);
  ro.fillStyle = grey(200); ro.fillRect(0, 0, s, s);
  const greens = ['#3d6a2c', '#294520', '#4f7f37', '#365e28', '#5b8c3e', '#467432'];
  for (let i = 0; i < 3200; i++) {
    const x = r() * s, y = r() * s, a = 2 + r() * 4, b = 1.2 + r() * 2.2, rot = r() * 3;
    c.fillStyle = greens[Math.floor(r() * greens.length)];
    c.beginPath(); c.ellipse(x, y, a, b, rot, 0, 7); c.fill();
    const gr = h.createRadialGradient(x, y, 0, x, y, a);
    gr.addColorStop(0, grey(150 + r() * 100)); gr.addColorStop(1, grey(60));
    h.fillStyle = gr; h.beginPath(); h.ellipse(x, y, a, b, rot, 0, 7); h.fill();
  }
});

/** Soft-touch dashboard plastic. */
const dashSurf = () => surface('dash', 256, 0.7, (c, h, ro, s, r) => {
  c.fillStyle = '#1d1e21'; c.fillRect(0, 0, s, s);
  ro.fillStyle = grey(200); ro.fillRect(0, 0, s, s);
  dots([[c, () => (r() > 0.5 ? '#232428' : '#18191b')], [h, () => grey(80 + r() * 100)]], s, r, 14000, 0.4, 1.0);
});

const tileSurf = () => surface('tiles', 128, 2, (c, h, ro, s) => {
  // Victorian chequered path tiles: 4 × 4 per repeat.
  const n = 4, t = s / n;
  ro.fillStyle = grey(140); ro.fillRect(0, 0, s, s);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    c.fillStyle = (i + j) % 2 ? '#8f3a2a' : '#e3dccb'; c.fillRect(i * t, j * t, t, t);
    h.fillStyle = grey(190); h.fillRect(i * t + 1, j * t + 1, t - 2, t - 2);
  }
});

// ---------------- materials & geometry helpers ----------------

const matCache = new Map<string, THREE.MeshStandardMaterial>();
function pbr(key: string, params: THREE.MeshStandardMaterialParameters) {
  let m = matCache.get(key);
  if (!m) { m = new THREE.MeshStandardMaterial(params); matCache.set(key, m); }
  return m;
}
const surf = (key: string, s: Surface, extra: THREE.MeshStandardMaterialParameters = {}) =>
  pbr(key, { map: s.map, normalMap: s.normalMap, roughnessMap: s.roughnessMap, roughness: 1, ...extra });
function paint(color: string) {
  const key = `paint${color}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshPhysicalMaterial({ color, metalness: 0.45, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.05 });
    matCache.set(key, m);
  }
  return m;
}
const plastic = (color: string, roughness = 0.6) => pbr(`plastic${color}${roughness}`, { color, roughness, metalness: 0 });
function glassMat() {
  let m = matCache.get('glass');
  if (!m) { m = new THREE.MeshPhysicalMaterial({ color: '#06090c', roughness: 0.03, metalness: 0, ior: 1.52, envMapIntensity: 2.6 }); matCache.set('glass', m); }
  return m;
}
const winGlassMat = () => {
  let m = matCache.get('winglass');
  if (!m) { m = new THREE.MeshPhysicalMaterial({ color: '#0c1116', roughness: 0.03, metalness: 0, ior: 1.52, envMapIntensity: 2.2 }); matCache.set('winglass', m); }
  return m;
};
const chrome = () => pbr('chrome', { color: '#d4d7db', roughness: 0.16, metalness: 1 });
const alloy = () => pbr('alloy', { color: '#b9bdc2', roughness: 0.3, metalness: 1 });
const live = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.2, emissive: '#000000', emissiveIntensity: 3 });

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

function scaleUV(g: THREE.BufferGeometry, k: number) {
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * k, uv.getY(i) * k);
  return g;
}

/** Profile in the (z, y) plane, extruded across the width (x), centred. Front of the vehicle is -z. */
function profile(shape: THREE.Shape | [number, number][], width: number, m: THREE.Material, bevel = 0.05, segs = 3, smooth = false) {
  const sh = Array.isArray(shape) ? new THREE.Shape(shape.map(([z, y]) => new THREE.Vector2(z, y))) : shape;
  let g: THREE.BufferGeometry = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.001, width - 2 * bevel), bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: segs, curveSegments: 12 });
  if (smooth) { g.deleteAttribute('uv'); g = mergeVertices(g, 1e-4); g.computeVertexNormals(); } // smooth-shaded rounded edges
  const mesh = new THREE.Mesh(g, m);
  mesh.rotation.y = -Math.PI / 2;
  mesh.position.x = (width - 2 * bevel) / 2;
  mesh.castShadow = true; mesh.receiveShadow = true;
  const holder = new THREE.Group();
  holder.add(mesh);
  return holder;
}

/** A prism whose plan is given as [outwards from the wall, along the street] points, standing on y0. */
function prism(plan: [number, number][], side: number, h: number, m: THREE.Material, x: number, y0: number, z: number, tile = 0) {
  const sh = new THREE.Shape(plan.map(([o, a]) => new THREE.Vector2(-side * o, -a)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  if (tile) scaleUV(g, 1 / tile);
  const mesh = new THREE.Mesh(g, m);
  mesh.position.set(x, y0, z); mesh.castShadow = true; mesh.receiveShadow = true;
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
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
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

/** Loads the sky, then lights the scene from it. Resolves once the sky is in place. */
export async function setupEnvironment(renderer: THREE.WebGLRenderer, scene: THREE.Scene, sun: THREE.DirectionalLight) {
  anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.82;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const sky = await new EXRLoader().setDataType(THREE.HalfFloatType).loadAsync(skyUrl);
  sky.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = sky;
  scene.backgroundIntensity = SKY_INTENSITY;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(sky).texture;
  pmrem.dispose();
  scene.environmentIntensity = 0.85;
  scene.fog = new THREE.Fog(HORIZON.clone().multiplyScalar(SKY_INTENSITY * 1.05), 60, 240);
  sun.color.set('#fff2de'); sun.intensity = 3.4;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 2.5;
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.025;
}

/** Where to put the sun light, relative to the point it should shade around. */
export const sunOffset = SUN_DIR.clone().multiplyScalar(70);

// ---------------- post-processing ----------------

const FinishShader = {
  uniforms: { tDiffuse: { value: null as THREE.Texture | null }, time: { value: 0 }, aspect: { value: 4 / 3 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time; uniform float aspect; varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = (vUv - 0.5) * vec2(aspect, 1.0);
      c.rgb *= mix(0.8, 1.0, smoothstep(0.95, 0.35, length(d)));
      c.rgb += (hash(vUv * 1000.0 + fract(time * 7.13)) - 0.5) * 0.022;
      gl_FragColor = c;
    }`,
};

export interface Post { render(t: number): void; setSize(w: number, h: number): void; dispose(): void }

/** Ambient occlusion, then tone mapping, then vignette and grain. AO runs at half resolution to save phones. */
export function makePost(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera): Post {
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const ao = new GTAOPass(scene, camera, 256, 256);
  const aoSize = ao.setSize.bind(ao);
  ao.setSize = (w: number, h: number) => aoSize(Math.ceil(w / 2), Math.ceil(h / 2));
  ao.blendIntensity = 0.85;
  ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 12, distanceFallOff: 1 });
  ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
  composer.addPass(ao);
  composer.addPass(new OutputPass());
  const finish = new ShaderPass(FinishShader);
  composer.addPass(finish);
  return {
    render(t) { finish.uniforms.time.value = t; composer.render(); },
    setSize(w, h) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); finish.uniforms.aspect.value = w / h; },
    dispose() { composer.dispose(); ao.dispose(); target.dispose(); },
  };
}

// ---------------- world: British residential street ----------------

const BRICKS = ['#8e4a32', '#9c5236', '#7f4430', '#a8623f', '#93583f', '#b07a52'];
const RENDERS = ['#ece6d8', '#e4dfd2', '#efe3c8', '#dfe3e0'];
const DOORS = ['#1f3a5f', '#6b1e1e', '#24472b', '#2b2b2b', '#e8e4da', '#3e5f73'];

function window3(root: THREE.Group, side: number, fx: number, z: number, wy: number, ww: number, wh: number, lintel: THREE.Material) {
  const frame = plastic('#f2f2ef', 0.35);
  const winGlass = winGlassMat();
  const out = (p: number) => fx - side * p; // p metres proud of the wall, towards the road
  root.add(box(0.1, wh - 0.04, ww - 0.04, plastic('#1c1f22', 0.9), out(-0.03), wy, z, false)); // dark reveal
  root.add(box(0.06, wh, ww, frame, out(0.0), wy, z, false));
  root.add(box(0.07, wh - 0.12, ww / 2 - 0.1, winGlass, out(0.005), wy - 0.02, z - ww / 4, false));
  root.add(box(0.07, wh - 0.12, ww / 2 - 0.1, winGlass, out(0.005), wy - 0.02, z + ww / 4, false));
  root.add(box(0.08, 0.05, ww - 0.06, frame, out(0.01), wy + wh * 0.22, z, false)); // transom (top-lights)
  root.add(box(0.2, 0.09, ww + 0.22, lintel, out(0.06), wy - wh / 2 - 0.05, z, true)); // sill
  root.add(box(0.06, 0.18, ww + 0.26, lintel, out(0.02), wy + wh / 2 + 0.1, z, false)); // lintel
}

function bay(root: THREE.Group, side: number, fx: number, z: number, wall: THREE.Material, lintel: THREE.Material) {
  const frame = plastic('#f2f2ef', 0.35);
  const winGlass = winGlassMat();
  const P = 0.75, half = 1.35, face = 0.95;
  const plan: [number, number][] = [[0, -half], [P, -face], [P, face], [0, half]];
  root.add(prism(plan, side, 0.72, wall, fx, 0, z, 2));
  root.add(prism([[0, -half + 0.02], [P - 0.04, -face + 0.02], [P - 0.04, face - 0.02], [0, half - 0.02]], side, 1.6, winGlass, fx, 0.72, z));
  root.add(prism([[0, -half - 0.06], [P + 0.08, -face - 0.06], [P + 0.08, face + 0.06], [0, half + 0.06]], side, 0.08, lintel, fx, 0.7, z)); // sill
  root.add(prism([[0, -half], [P, -face], [P, face], [0, half]], side, 0.22, frame, fx, 2.3, z)); // fascia
  root.add(prism([[0, -half - 0.1], [P + 0.12, -face - 0.08], [P + 0.12, face + 0.08], [0, half + 0.1]], side, 0.12, plastic('#3b3f44', 0.7), fx, 2.52, z)); // lead roof
  // mullions at the corners and across the front
  const post = (o: number, a: number) => root.add(box(0.07, 1.6, 0.07, frame, fx - side * o, 1.52, z + a, false));
  post(P - 0.02, -face); post(P - 0.02, face); post(P - 0.02, 0); post(0.4, -(half + face) / 2); post(0.4, (half + face) / 2);
  root.add(box(P, 0.05, 2 * face, frame, fx - side * P / 2, 1.95, z, false));
}

const LEAF_TINTS: Record<string, string> = { leaf: '#b9c9a8', hedge: '#a3b691', tree: '#aebf98' };
function shrub(root: THREE.Group, x: number, y: number, z: number, size: number, rand: (s: number) => number, seed: number, kind = 'leaf') {
  const m = surf(kind, leafSurf(), { color: LEAF_TINTS[kind], normalScale: new THREE.Vector2(1.8, 1.8) });
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(size, 3);
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g = mergeVertices(g, 1e-4);
  const p = g.attributes.position as THREE.BufferAttribute;
  const ph = [rand(seed) * 6.3, rand(seed + 1) * 6.3, rand(seed + 2) * 6.3];
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i).divideScalar(size);
    // smooth lumps (low-frequency) plus small leafy bumps
    const n = Math.sin(v.x * 3.1 + ph[0]) * Math.sin(v.y * 2.7 + ph[1]) * Math.sin(v.z * 3.3 + ph[2]);
    const f = Math.sin(v.x * 7 + ph[1]) * Math.sin(v.y * 8 + ph[2]) * Math.sin(v.z * 7.5 + ph[0]);
    const f2 = Math.sin(v.x * 17 + ph[2]) * Math.sin(v.y * 15 + ph[0]) * Math.sin(v.z * 16 + ph[1]);
    const k = size * (1 + n * 0.25 + f * 0.14 + f2 * 0.06);
    p.setXYZ(i, v.x * k, v.y * k * 0.85, v.z * k);
  }
  g.computeVertexNormals();
  // spherical UVs so the leaf texture wraps the clump
  const uvs = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); uvs[i * 2] = Math.atan2(z, x) / 6.283 + 0.5; uvs[i * 2 + 1] = y / size * 0.5 + 0.5; }
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  scaleUV(g, Math.max(1, Math.round(size * 2.5)));
  const mesh = new THREE.Mesh(g, m);
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
  root.add(mesh);
}

function house(root: THREE.Group, side: number, z: number, ROAD_HALF: number, rand: (s: number) => number, seed: number, driveway = false) {
  const front = side * (ROAD_HALF + 2.4 + 4.5);   // pavement + front garden
  const depth = 8, h = 5.6, w = 5.6;
  const cx = front + side * depth / 2;
  const rendered = rand(seed + 11) > 0.78;
  const tone = BRICKS[Math.floor(rand(seed) * BRICKS.length)];
  const brick = surf(`brick${tone}`, brickSurf(tone));
  const wall = rendered ? surf(`render${seed % 4}`, renderSurf(RENDERS[seed % 4])) : brick;
  const lintel = surf('stone', renderSurf('#d9d2c1'), { color: '#f4efe4' });
  root.add(box(depth, h, w, wall, cx, h / 2, z, true, 2));
  // pitched roof running along the street, tiled, with ridge tiles
  const shape = new THREE.Shape([new THREE.Vector2(-depth / 2 - 0.35, 0), new THREE.Vector2(depth / 2 + 0.35, 0), new THREE.Vector2(0, 2.8)]);
  const rg = scaleUV(new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false }), 0.5);
  const roof = new THREE.Mesh(rg, surf('roof', roofSurf()));
  roof.position.set(cx, h, z - w / 2); roof.castShadow = true; roof.receiveShadow = true;
  root.add(roof);
  root.add(box(0.28, 0.16, w, plastic('#3f3a37', 0.85), cx, h + 2.8, z));
  root.add(box(0.14, 0.14, w + 0.02, plastic('#25272a', 0.5), front - side * 0.32, h - 0.05, z, false)); // gutter
  root.add(box(0.36, 0.22, w, plastic('#f0f0ec', 0.5), front - side * 0.18, h - 0.1, z, false)); // fascia board
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, h, 8), plastic('#25272a', 0.5));
  pipe.position.set(front - side * 0.06, h / 2, z + w / 2 - 0.12); root.add(pipe);
  if (seed % 2 === 0) { // chimney stack on the party wall, with pots
    root.add(box(1.1, 1.5, 0.7, brick, cx + side * 1.2, h + 2.3, z + w / 2, true, 2));
    root.add(box(1.2, 0.1, 0.8, lintel, cx + side * 1.2, h + 3.08, z + w / 2));
    for (const pz of [-0.22, 0.22]) {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.45, 12), plastic('#a45d3d', 0.85));
      pot.position.set(cx + side * 1.2, h + 3.35, z + w / 2 + pz); pot.castShadow = true; root.add(pot);
    }
  }
  const fx = front;
  const hasBay = rand(seed + 7) > 0.35;
  if (hasBay) bay(root, side, fx, z - 1.15, wall, lintel);
  else window3(root, side, fx, z - 1.15, 1.5, 2.0, 1.3, lintel);
  window3(root, side, fx, z - 1.15, 4.1, 1.8, 1.15, lintel);
  window3(root, side, fx, z + 1.6, 4.1, 0.9, 1.0, lintel);
  // front door: frame, panelled door, fanlight and a stone step
  const dz = z + 1.6;
  root.add(box(0.08, 2.5, 1.15, plastic('#f2f2ef', 0.35), fx - side * 0.02, 1.25, dz, false));
  root.add(box(0.08, 2.0, 0.9, plastic(DOORS[Math.floor(rand(seed + 3) * DOORS.length)], 0.32), fx - side * 0.035, 1.02, dz, false));
  root.add(box(0.08, 0.3, 0.9, winGlassMat(), fx - side * 0.04, 2.27, dz, false));
  root.add(box(0.03, 0.06, 0.14, chrome(), fx - side * 0.08, 1.05, dz + 0.3, false));
  root.add(box(0.35, 0.12, 1.25, lintel, fx - side * 0.17, 0.06, dz));
  root.add(box(0.06, 0.18, 1.3, lintel, fx - side * 0.02, 2.6, dz, false));
  // front garden
  const pave = side * (ROAD_HALF + 2.4);
  if (driveway) {
    root.add(ground(4.5, w, surf('blockpave', slabSurf(), { color: '#c4ab90' }), side * (ROAD_HALF + 2.4 + 2.25), z, 0.03, 0.5));
    return;
  }
  const gardenWall = (z0: number, z1: number) => {
    const len = z1 - z0; if (len < 0.2) return;
    root.add(box(0.24, 0.6, len, brick, pave + side * 0.15, 0.3, (z0 + z1) / 2, true, 2));
    root.add(box(0.3, 0.07, len + 0.02, lintel, pave + side * 0.15, 0.635, (z0 + z1) / 2));
  };
  const hedge = rand(seed + 9) > 0.6;
  if (hedge) {
    for (const [z0, z1] of [[z - w / 2, dz - 0.55], [dz + 0.55, z + w / 2]]) {
      if (z1 - z0 < 0.2) continue;
      root.add(box(0.55, 0.7, z1 - z0, surf('hedgecore', leafSurf(), { color: '#8fa080' }), pave + side * 0.4, 0.35, (z0 + z1) / 2, false, 1.5));
      for (let q = z0 + 0.3, k = 0; q < z1; q += 0.55, k++) {
        shrub(root, pave + side * (0.4 + (rand(seed + k * 3) - 0.5) * 0.1), 0.6 + rand(seed + k * 5) * 0.15, q, 0.42 + rand(seed + k * 7) * 0.08, rand, seed * 7 + k, 'hedge');
      }
    }
  } else {
    gardenWall(z - w / 2, dz - 0.6);
    gardenWall(dz + 0.6, z + w / 2);
    for (const e of [-1, 1]) root.add(box(0.34, 0.85, 0.34, brick, pave + side * 0.15, 0.42, dz + e * 0.6, true, 2));
  }
  // party wall between front gardens, a tiled path, shrubs and sometimes a wheelie bin
  root.add(box(4.4, 0.5, 0.12, brick, pave + side * 2.3, 0.25, z + w / 2, true, 2));
  root.add(ground(4.4, 1.0, surf('tiles', tileSurf()), pave + side * 2.3, dz, 0.035, 0.6));
  if (rand(seed + 4) > 0.3) shrub(root, pave + side * (1.6 + rand(seed + 5) * 1.6), 0.35, z - 1.4, 0.45 + rand(seed + 6) * 0.3, rand, seed);
  if (rand(seed + 12) > 0.5) shrub(root, front - side * 0.5, 0.3, z - 2.4, 0.38, rand, seed + 50);
  if (rand(seed + 5) > 0.45) {
    const bin = new THREE.Group();
    const binM = plastic(['#2a2d2f', '#1d4f8a', '#3c6b2f', '#6b4a2a'][Math.floor(rand(seed + 6) * 4)], 0.45);
    bin.add(box(0.58, 0.95, 0.7, binM, 0, 0.5, 0));
    bin.add(box(0.62, 0.06, 0.76, binM, 0.02, 1.0, 0));
    for (const s of [-1, 1]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 12), plastic('#111', 0.8)); wh.rotation.z = Math.PI / 2; wh.position.set(0.25 * s, 0.1, 0.3); bin.add(wh); }
    bin.position.set(pave + side * 1.0, 0, dz + 1.3); bin.rotation.y = 0.2 * side; root.add(bin);
  }
}

function lamp(root: THREE.Group, x: number, z: number, side: number) {
  const metal = pbr('lampgrey', { color: '#6f757b', roughness: 0.45, metalness: 0.7 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.11, 7, 12), metal);
  post.position.set(x, 3.5, z); post.castShadow = true; root.add(post);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.1, 8), metal);
  arm.rotation.z = Math.PI / 2 - side * 0.12; arm.position.set(x - side * 0.5, 7.02, z); root.add(arm);
  root.add(box(0.6, 0.09, 0.26, metal, x - side * 1.05, 7.08, z));
  root.add(box(0.5, 0.02, 0.2, pbr('lens', { color: '#e8edf0', roughness: 0.2 }), x - side * 1.05, 7.03, z, false));
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.5, 12), metal);
  base.position.set(x, 0.25, z); root.add(base);
}

function tree(root: THREE.Group, x: number, z: number, rand: (s: number) => number, seed: number) {
  const bark = plastic('#4f4134', 0.95);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 3.4, 10), bark);
  trunk.position.set(x, 1.7, z); trunk.castShadow = true; root.add(trunk);
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 1.6, 6), bark);
    const a = rand(seed + i * 9) * 6.28;
    b.position.set(x + Math.cos(a) * 0.35, 3.6, z + Math.sin(a) * 0.35);
    b.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6); b.castShadow = true; root.add(b);
  }
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.28 * 2.3 + rand(seed + i) * 0.7, rr = i === 0 ? 0 : 0.5 + rand(seed + i * 3) * 1.0;
    shrub(root, x + Math.cos(a) * rr, 4.0 + rand(seed + i * 5) * 2.0 - rr * 0.25, z + Math.sin(a) * rr, 0.7 + rand(seed + i * 7) * 0.5, rand, seed * 31 + i, 'tree');
  }
}

interface Zone { z0: number; z1: number }
const inZones = (zs: Zone[], z: number, pad = 0) => zs.some((q) => z > q.z1 - pad && z < q.z0 + pad);

/** Tyre-polished bands, patch repairs and ironwork that break up a plain carriageway. */
function roadWear(root: THREE.Group, z0: number, z1: number, rand: (s: number) => number) {
  const len = z0 - z1, zc = (z0 + z1) / 2;
  const trackTex = (() => {
    const { c, g } = canvas(64, 'rgba(0,0,0,0)');
    g.clearRect(0, 0, 64, 64);
    const gr = g.createLinearGradient(0, 0, 64, 0);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return toTex(c, false);
  })();
  const track = pbr('track', { color: '#1d1e20', alphaMap: trackTex, transparent: true, opacity: 0.32, roughness: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  for (const x of [-3.1, -1.2, 1.2, 3.1]) root.add(ground(0.9, len, track, x, zc, 0.002, 1));
  const gutter = pbr('gutter', { color: '#24221e', alphaMap: trackTex, transparent: true, opacity: 0.45, roughness: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  for (const x of [-4.4, 4.4]) root.add(ground(0.5, len, gutter, x, zc, 0.002, 1));
  const asph = asphaltSurf();
  const patch = pbr('patch', { map: asph.map, normalMap: asph.normalMap, roughnessMap: asph.roughnessMap, roughness: 1, color: '#7c7f84', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const iron = pbr('iron', { color: '#3b3a38', roughness: 0.55, metalness: 0.7, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  for (let z = z0 - 14, i = 0; z > z1; z -= 22 + rand(i * 5) * 20, i++) {
    const r = rand(i * 7 + 1);
    if (r < 0.45) root.add(ground(1.2 + rand(i * 3) * 2.5, 1 + rand(i * 9) * 2.5, patch, (rand(i * 11) - 0.5) * 6, z, 0.003, 4));
    else if (r < 0.75) root.add(ground(0.7, 0.7, iron, (rand(i * 13) - 0.5) * 5, z, 0.004));
  }
}

export function buildWorld(scene: THREE.Scene, clip: Clip, y0: number, y1: number, geo: Geo) {
  const { fwd, ROAD_HALF, rand } = geo;
  const L = clip.layout;
  if (L.rural || L.zebra?.length || L.busStop?.length || L.gate?.length) {
    // This trial covers the residential street; other layouts keep the realistic kit's scenery.
    real.buildWorld(scene, clip, y0, y1, geo);
    return;
  }
  const z0 = fwd(y0), z1 = fwd(y1), len = z0 - z1, zc = (z0 + z1) / 2;
  const SIDE_HALF = 3.6;
  const sideOf = (q: 'L' | 'R') => (q === 'L' ? -1 : 1);
  const gaps: Record<number, Zone[]> = { [-1]: [], [1]: [] };
  for (const q of L.side ?? []) gaps[sideOf(q.side)].push({ z0: fwd(q.y) + SIDE_HALF, z1: fwd(q.y) - SIDE_HALF });
  const drives: Record<number, Zone[]> = { [-1]: [], [1]: [] };
  for (const q of L.drive ?? []) drives[sideOf(q.side)].push({ z0: fwd(q.y) + 1.8, z1: fwd(q.y) - 1.8 });

  const root = new THREE.Group();
  const asphalt = surf('asphalt', asphaltSurf());
  root.add(ground(ROAD_HALF * 2, len, asphalt, 0, zc, 0, 4));
  roadWear(root, z0, z1, rand);
  const lineM = pbr('roadline', { color: '#e6e4dc', roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const skipLine = (z: number) => inZones(gaps[-1], z, 3) || inZones(gaps[1], z, 3);
  for (let z = z0; z > z1; z -= 9) if (!skipLine(z - 2)) root.add(ground(0.1, 4, lineM, 0, z - 2, 0.005));

  for (const side of [-1, 1]) {
    const sorted = [...gaps[side]].sort((a, b) => b.z0 - a.z0);
    const runs: Zone[] = [];
    let cur = z0;
    for (const g of sorted) { if (g.z0 < cur) runs.push({ z0: cur, z1: g.z0 }); cur = Math.min(cur, g.z1); }
    runs.push({ z0: cur, z1 });
    const kerbM = surf('kerb', kerbSurf());
    const slabM = surf('slab', slabSurf());
    root.add(ground(60, len, surf('grass', grassSurf()), side * (ROAD_HALF + 2.4 + 30), zc, 0.02, 2));
    for (const r of runs) {
      const rl = r.z0 - r.z1; if (rl < 0.5) continue;
      const rz = (r.z0 + r.z1) / 2;
      const kerb = box(0.25, 0.13, rl, kerbM, side * (ROAD_HALF + 0.12), 0.065, rz, false, 0.9);
      root.add(kerb);
      root.add(box(2.15, 0.11, rl, slabM, side * (ROAD_HALF + 1.32), 0.055, rz, false, 1.2));
    }
    // gully gratings at the kerb
    for (let z = z0 - 7; z > z1; z -= 25) if (!inZones(gaps[side], z, 1)) root.add(ground(0.4, 0.65, pbr('gully', { color: '#2a2a2a', roughness: 0.5, metalness: 0.6, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), side * (ROAD_HALF - 0.25), z, 0.004));
    let i = 0;
    for (let z = z0 - 3; z > z1; z -= 5.6, i++) {
      if (inZones(gaps[side], z, 4)) continue;
      house(root, side, z, ROAD_HALF, rand, i * 2 + (side > 0 ? 1 : 0), inZones(drives[side], z, 1));
    }
    for (let z = z0 - 12 - (side > 0 ? 16 : 0); z > z1; z -= 32) if (!inZones(gaps[side], z, 3)) lamp(root, side * (ROAD_HALF + 0.55), z, side);
    for (let z = z0 - 20, j = 0; z > z1; z -= 27, j++) if (rand(j * 11 + side) > 0.45 && !inZones(gaps[side], z, 5) && !inZones(drives[side], z, 3)) tree(root, side * (ROAD_HALF + 4.4), z, rand, j * 13 + (side > 0 ? 5 : 0));
    for (const q of (L.side ?? []).filter((g) => sideOf(g.side) === side)) {
      const z = fwd(q.y);
      root.add(ground(40, SIDE_HALF * 2, asphalt, side * (ROAD_HALF + 20), z, 0.003, 4));
      for (const e of [-1, 1]) {
        root.add(box(40, 0.13, 0.25, kerbM, side * (ROAD_HALF + 20), 0.065, z + e * (SIDE_HALF + 0.12), false, 0.9));
        root.add(box(40, 0.11, 2.15, slabM, side * (ROAD_HALF + 20), 0.055, z + e * (SIDE_HALF + 1.32), false, 1.2));
      }
      for (const off of [0.35, 0.8]) for (let k = -SIDE_HALF + 0.3; k < SIDE_HALF - 0.3; k += 0.9) root.add(ground(0.2, 0.6, lineM, side * (ROAD_HALF + off), z + k + 0.3, 0.012));
    }
  }
  mergeStatic(scene, root);
}

// ---------------- road users ----------------

function newLights(): Lights {
  return { brake: live('#4a0606'), indL: live('#6b4500'), indR: live('#6b4500'), reverse: live('#bbbbbb') };
}

interface CarSpec {
  F: number; R: number; W: number; wf: number; wb: number; wr: number; clear: number; belt: number; nose: number;
  ws: number; roofF: number; roofR: number; roof: number; tail: [number, number]; boot?: boolean;
}
const CAR_SPECS: CarSpec[] = [
  // hatchback
  { F: -2.0, R: 1.95, W: 1.76, wf: -1.3, wb: 1.25, wr: 0.31, clear: 0.33, belt: 0.97, nose: 0.78, ws: -0.82, roofF: -0.08, roofR: 1.45, roof: 1.47, tail: [1.9, 1.08] },
  // saloon
  { F: -2.2, R: 2.2, W: 1.8, wf: -1.38, wb: 1.32, wr: 0.32, clear: 0.33, belt: 0.95, nose: 0.76, ws: -0.92, roofF: -0.15, roofR: 0.95, roof: 1.45, tail: [1.55, 1.0], boot: true },
  // small SUV
  { F: -2.1, R: 2.1, W: 1.84, wf: -1.36, wb: 1.32, wr: 0.36, clear: 0.42, belt: 1.12, nose: 0.98, ws: -0.92, roofF: -0.12, roofR: 1.8, roof: 1.66, tail: [2.02, 1.24] },
];

const plateTex = (rear: boolean, seed: number) => {
  const key = `plate${rear}${seed}`;
  const hit = surfCache.get(key);
  if (hit) return hit.map;
  const c = document.createElement('canvas'); c.width = 260; c.height = 56;
  const g = c.getContext('2d')!;
  g.fillStyle = rear ? '#f4c400' : '#f4f4ef'; g.fillRect(0, 0, 260, 56);
  g.fillStyle = '#1f4fa8'; g.fillRect(0, 0, 22, 56);
  const L = 'ABCDEFGHJKLMNOPRSTUVWXY', r = rng(key);
  const ch = () => L[Math.floor(r() * L.length)];
  const txt = `${ch()}${ch()}${10 + Math.floor(r() * 64)} ${ch()}${ch()}${ch()}`;
  g.fillStyle = '#111'; g.font = 'bold 40px "Arial Narrow", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(txt, 141, 30);
  const t = toTex(c, true);
  surfCache.set(key, { map: t, normalMap: t, roughnessMap: t });
  return t;
};

/**
 * Tilts the normals of an extruded panel's flat sides up above `yMid` and down below it, so a flat
 * slab shades like a curved car flank: a bright shoulder catching the sky, a darker sill.
 */
function curveSides(holder: THREE.Group, yMid: number, k: number) {
  const mesh = holder.children[0] as THREE.Mesh;
  const g = mesh.geometry, p = g.attributes.position as THREE.BufferAttribute, n = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < n.count; i++) {
    const nz = n.getZ(i);
    if (Math.abs(nz) < 0.9) continue;
    const v = new THREE.Vector3(0, (p.getY(i) - yMid) * k, Math.sign(nz)).normalize();
    n.setXYZ(i, v.x, v.y, v.z);
  }
  n.needsUpdate = true;
  return holder;
}


function makeCar(color: string, style: number, seed: number): Model {
  const S = CAR_SPECS[style % CAR_SPECS.length];
  const g = new THREE.Group();
  const body = paint(color);
  const { F, R, W, wf, wb, wr, clear, belt, nose } = S;
  const ar = wr + 0.07;
  // lower body with wheel-arch cut-outs
  const sh = new THREE.Shape();
  sh.moveTo(F + 0.12, clear);
  sh.lineTo(wf - ar, clear); sh.absarc(wf, wr, ar, Math.PI, 0, true);
  sh.lineTo(wb - ar, clear); sh.absarc(wb, wr, ar, Math.PI, 0, true);
  sh.lineTo(R - 0.12, clear);
  sh.quadraticCurveTo(R + 0.04, clear, R + 0.04, clear + 0.2);
  sh.lineTo(R + 0.02, belt - 0.12);
  sh.quadraticCurveTo(R, belt, R - 0.12, belt);
  sh.lineTo(S.ws, belt);
  sh.lineTo(F + 0.42, nose);
  sh.quadraticCurveTo(F + 0.02, nose - 0.02, F, nose - 0.2);
  sh.lineTo(F - 0.02, clear + 0.14);
  sh.quadraticCurveTo(F - 0.01, clear, F + 0.12, clear);
  g.add(curveSides(profile(sh, W, body, 0.09, 4, true), (clear + belt) / 2 + 0.08, 1.6));
  // outer surfaces of the bevelled body, for fitting lamps and plates
  const Fs = F - 0.11, Rs = R + 0.13;
  // cabin: a body-coloured shell with glass set into it, so the pillars and roof form naturally
  const gw = W - 0.3;
  const [tz, ty] = S.tail;
  const cabin: [number, number][] = S.boot
    ? [[S.ws - 0.02, belt - 0.03], [S.roofF, S.roof], [S.roofR, S.roof], [tz, ty], [tz + 0.05, belt - 0.03]]
    : [[S.ws - 0.02, belt - 0.03], [S.roofF, S.roof], [S.roofR, S.roof], [tz, ty], [tz, belt - 0.03]];
  if (S.boot) g.add(profile([[tz - 0.05, belt], [tz + 0.05, ty], [R - 0.12, belt + 0.1], [R - 0.12, belt]], W - 0.1, body, 0.05, 3, true)); // boot lid
  g.add(curveSides(profile(cabin, gw, body, 0.1, 4, true), belt - 0.25, 1.4));
  const glass = glassMat();
  // windscreen and rear screen: thin panels lying just proud of the shell's rounded surface
  const screen = (a: [number, number], b: [number, number], width: number, inset: number) => {
    const dz = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dz, dy);
    const u = [dz / len, dy / len], n = [-dy / len, dz / len];
    const p = (q: [number, number], k: number, l: number): [number, number] => [q[0] + u[0] * k + n[0] * l, q[1] + u[1] * k + n[1] * l];
    g.add(profile([p(a, inset, 0.103), p(b, -inset, 0.103), p(b, -inset, 0.115), p(a, inset, 0.115)], width, glass, 0));
  };
  screen([S.ws, belt + 0.02], [S.roofF, S.roof], gw - 0.14, 0.13);
  screen([S.roofR, S.roof], [tz, ty], gw - 0.22, 0.13);
  // side windows either side of the B-pillar, inset from the shell's flat flank
  const bz = (S.roofF + S.roofR) / 2 - 0.1;
  const top = S.roof - 0.06, sill = belt + 0.04;
  const aAt = (y: number) => S.ws + ((S.roofF - S.ws) * (y - belt)) / (S.roof - belt);
  const rearTop = S.boot ? S.roofR - 0.08 : S.roofR - 0.35, rearSill = S.boot ? tz - 0.2 : tz - 0.55;
  for (const pts of [
    [[aAt(sill) + 0.09, sill], [aAt(top) + 0.07, top], [bz - 0.06, top], [bz - 0.06, sill]],
    [[bz + 0.06, sill], [bz + 0.06, top], [rearTop, top], [rearSill, sill]],
  ] as [number, number][][]) {
    for (const sd of [-1, 1]) {
      const pane = curveSides(profile(pts, 0.012, glass, 0), belt - 0.25, 1.4);
      pane.position.x = sd * (gw / 2 + 0.004);
      g.add(pane);
    }
  }
  // wheel arch liners, tyres and alloys
  const liner = plastic('#0d0d0d', 0.9);
  const wheels: THREE.Object3D[] = [];
  for (const z of [wf, wb]) {
    const arch = new THREE.Mesh(new THREE.CylinderGeometry(ar - 0.01, ar - 0.01, W - 0.16, 18, 1, true, 0, Math.PI), liner);
    arch.geometry.rotateZ(Math.PI / 2); arch.material.side = THREE.DoubleSide;
    arch.position.set(0, wr, z); g.add(arch);
    for (const s of [-1, 1]) {
      const spin = new THREE.Group();
      const tyre = new THREE.Mesh(new THREE.CylinderGeometry(wr, wr, 0.21, 28), plastic('#151515', 0.85));
      tyre.rotation.z = Math.PI / 2; tyre.castShadow = true;
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(wr * 0.68, wr * 0.68, 0.215, 20), plastic('#2a2b2d', 0.6));
      rim.rotation.z = Math.PI / 2;
      for (let k = 0; k < 5; k++) { const spoke = box(0.22, 0.045, wr * 1.28, alloy(), 0, 0, 0, false); spoke.rotation.x = (k * Math.PI) / 5; spin.add(spoke); }
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.225, 12), alloy()); hub.rotation.z = Math.PI / 2;
      spin.add(tyre, rim, hub);
      spin.position.set(s * (W / 2 - 0.13), wr, z);
      g.add(spin); wheels.push(spin);
    }
  }
  // shut lines, handles and mirrors on both sides
  const seam = plastic('#0c0c0c', 0.8);
  for (const s of [-1, 1]) {
    const x = s * (W / 2 + 0.002);
    for (const zz of [S.ws + 0.06, bz, ...(S.boot || style === 2 ? [Math.min(wb - ar - 0.05, tz - 0.6)] : [])]) g.add(box(0.006, belt - clear - 0.12, 0.012, seam, x, (belt + clear) / 2 + 0.02, zz, false));
    g.add(box(0.012, 0.035, 0.16, chrome(), x + s * 0.004, belt - 0.13, S.ws + 0.6, false));
    const mirror = new THREE.Group();
    mirror.add(box(0.1, 0.12, 0.2, body, 0, 0, 0));
    mirror.add(box(0.1, 0.1, 0.01, glassMat(), 0, 0, 0.1, false));
    mirror.position.set(s * (W / 2 + 0.05), belt + 0.08, S.ws + 0.22); g.add(mirror);
  }
  // lamps, grille, bumpers and UK number plates (white front, yellow rear)
  const L = newLights();
  const lens = pbr('headlamp', { color: '#f6f3e8', roughness: 0.05, metalness: 0.6, emissive: '#3a382f' });
  for (const s of [-1, 1]) {
    const hl = box(0.42, 0.12, 0.1, lens, s * (W / 2 - 0.3), nose - 0.08, F + 0.02, false); hl.rotation.y = s * 0.12; hl.rotation.x = 0.5; g.add(hl);
    g.add(box(0.38, 0.15, 0.08, L.brake, s * (W / 2 - 0.24), belt - 0.13, Rs - 0.03, false));
    const ind = s < 0 ? L.indL : L.indR;
    g.add(box(0.1, 0.07, 0.08, ind, s * (W / 2 - 0.08), nose - 0.17, F - 0.04, false));
    g.add(box(0.12, 0.06, 0.05, ind, s * (W / 2 - 0.1), belt - 0.25, Rs - 0.01, false));
    g.add(box(0.03, 0.03, 0.08, ind, s * (W / 2 + 0.01), belt - 0.05, S.ws + 0.15, false)); // side repeater
  }
  g.add(box(0.16, 0.06, 0.05, L.reverse, 0.35, clear + 0.17, Rs - 0.01, false));
  g.add(box(W - 0.5, 0.17, 0.08, plastic('#151618', 0.5), 0, nose - 0.32, Fs + 0.03, false)); // grille
  g.add(box(W - 0.2, 0.12, 0.1, plastic('#1d1e20', 0.7), 0, clear + 0.05, Fs + 0.06, false)); // front lower lip
  g.add(box(W - 0.2, 0.12, 0.1, plastic('#1d1e20', 0.7), 0, clear + 0.06, Rs - 0.06, false)); // rear diffuser
  for (const [rear, z] of [[false, Fs - 0.015], [true, Rs + 0.015]] as const) {
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.112), new THREE.MeshStandardMaterial({ map: plateTex(rear, seed), roughness: 0.35 }));
    plate.position.set(0, rear ? belt - 0.36 : clear + 0.25, z); if (!rear) plate.rotation.y = Math.PI;
    g.add(plate);
  }
  return { group: g, lights: L, wheels, legs: [], arms: [], halfWidth: W / 2 };
}

const SKIN = ['#e8c2a0', '#c6946c', '#8a5a3a', '#f0d0b4'];
const HAIR = ['#2e2119', '#c79f55', '#151515', '#7a3f1f'];

function makePerson(height: number, top: string, seed: number, rand: (s: number) => number, bottoms = '#2e3a52'): Model {
  const k = height / 1.75;
  const g = new THREE.Group();
  const skinC = SKIN[Math.floor(rand(seed) * SKIN.length)];
  const skin = pbr(`skin${skinC}`, { color: skinC, roughness: 0.6 });
  const fabric = (c: string) => pbr(`fabric${c}`, { color: c, roughness: 0.92 });
  const child = height < 1.4, girth = child ? 1.25 : 1; // children are stockier for their height
  const cloth = fabric(top), legsM = fabric(bottoms), shoe = plastic('#1d1d1d', 0.5);
  const limb = (r0: number, r1: number, len: number, m: THREE.Material, x: number, y: number) => {
    const pivot = new THREE.Group(); pivot.position.set(x * k, y * k, 0);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r0 * k, r1 * k, len * k, 12), m);
    c.position.y = -(len * k) / 2; c.castShadow = true; pivot.add(c);
    g.add(pivot); return pivot;
  };
  const legs = [limb(0.075 * girth, 0.055 * girth, 0.86, legsM, -0.1, 0.92), limb(0.075 * girth, 0.055 * girth, 0.86, legsM, 0.1, 0.92)];
  for (const l of legs) { const f = box(0.1 * k, 0.08 * k, 0.25 * k, shoe, 0, -0.88 * k, -0.05 * k); l.add(f); }
  // torso: a lathe shaped from hips to shoulders
  const pts = [[0.0, 0.88], [0.15, 0.9], [0.17, 1.0], [0.155, 1.15], [0.18, 1.35], [0.17, 1.45], [0.1, 1.5], [0.0, 1.51]].map(([r, y]) => new THREE.Vector2(r * k, y * k));
  const torso = new THREE.Mesh(new THREE.LatheGeometry(pts, 16), cloth);
  torso.scale.set(1.05 * girth, 1, 0.68 * girth); torso.castShadow = true; g.add(torso);
  const arms = [limb(0.055 * girth, 0.045 * girth, 0.58, cloth, -0.22 * girth, 1.45), limb(0.055 * girth, 0.045 * girth, 0.58, cloth, 0.22 * girth, 1.45)];
  for (const a of arms) { const hand = new THREE.Mesh(new THREE.SphereGeometry(0.048 * k, 10, 8), skin); hand.position.y = -0.62 * k; hand.scale.set(0.8, 1.2, 0.6); a.add(hand); }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * k, 0.055 * k, 0.1 * k, 10), skin); neck.position.y = 1.54 * k; g.add(neck);
  const headR = 0.105 * k * (height < 1.4 ? 1.2 : 1);
  const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 20, 16), skin);
  head.position.y = 1.56 * k + headR + 0.01; head.scale.set(0.9, 1.1, 1); head.castShadow = true; g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(headR * 1.07, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.58), pbr(`hair${seed}`, { color: HAIR[Math.floor(rand(seed + 1) * HAIR.length)], roughness: 0.75 }));
  hair.position.copy(head.position); hair.position.y += 0.012; hair.position.z += 0.012; hair.rotation.x = 0.3; g.add(hair);
  return { group: g, wheels: [], legs, arms, halfWidth: 0.3 };
}

export function makeModel(a: Actor, i: number, rand: (s: number) => number): Model | null {
  const color = a.color ?? '#7a8794';
  switch (a.kind) {
    case 'car': {
      // Mix body styles, keeping long saloons off tight parking gaps (parked cars are 5.4 m apart).
      const style = Math.floor(rand(i * 17 + 3) * 3);
      return makeCar(color, a.keys.length === 1 && style === 1 ? 0 : style, i);
    }
    case 'ped': return makePerson(1.74, color, i * 7 + 1, rand);
    case 'child': return makePerson(1.2, color, i * 7 + 3, rand, '#3d4f73');
    default: return real.makeModel(a, i, rand);
  }
}

// ---------------- cockpit ----------------

/** Driver's-eye interior: curved bonnet, wipers, dashboard with instrument hood, wheel, pillar and mirror. */
export function cockpit(camera: THREE.Camera, driverOffset: number) {
  const cx = -driverOffset;
  const ds = dashSurf();
  const trim = pbr('dashtrim', { map: ds.map, normalMap: ds.normalMap, roughnessMap: ds.roughnessMap, roughness: 1, envMapIntensity: 0.35 });
  // The cabin roof is not drawn, but it casts a shadow so the sun does not light the dashboard.
  const roofShade = box(1.5, 0.05, 2.2, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }), cx, 0.38, 0.45, true);
  roofShade.receiveShadow = false;
  // bonnet: a crowned panel that falls away at the sides and front, in clearcoat paint
  const bg = new THREE.PlaneGeometry(1, 1, 36, 24);
  const p = bg.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) * 2, t = p.getY(i) + 0.5; // u: -1..1 across, t: 0 at the windscreen, 1 at the nose
    const x = cx + u * 0.86 * (1 - 0.08 * t * t);
    const y = -0.5 - 0.07 * t - 0.05 * t * t - 0.07 * Math.pow(Math.abs(u), 3) - (t > 0.82 ? 1.8 * (t - 0.82) * (t - 0.82) : 0);
    const z = -0.95 - t * 2.05;
    p.setXYZ(i, x, y, z);
  }
  bg.computeVertexNormals();
  const bonnet = new THREE.Mesh(bg, paint('#14335c'));
  bonnet.material.side = THREE.DoubleSide;
  // scuttle panel and wipers at the base of the windscreen
  const scuttle = box(1.9, 0.04, 0.16, plastic('#121314', 0.7), cx, -0.47, -0.95, false);
  const wiperM = plastic('#0d0d0d', 0.5);
  const wipers = [-0.55, 0.25].map((dx) => { const w = box(0.68, 0.016, 0.025, wiperM, cx + dx, -0.445, -0.98, false); w.rotation.z = 0.08; w.rotation.y = -0.05; return w; });
  // dashboard: a moulded top that curls down towards the driver
  const dash = profile([[-1.02, -0.45], [-0.62, -0.4], [-0.5, -0.43], [-0.46, -0.5], [-0.46, -0.75], [-1.02, -0.75]], 2.2, trim, 0.04);
  dash.position.x = cx;
  const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.2, 24, 1, true, Math.PI / 2, Math.PI), trim);
  hood.geometry.rotateX(Math.PI / 2); hood.material.side = THREE.DoubleSide;
  hood.position.set(0, -0.43, -0.6); hood.scale.set(1.25, 0.55, 1);
  const sw = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.185, 0.026, 12, 48), plastic('#151515', 0.55));
  sw.add(rim);
  for (const a of [Math.PI, 0, -Math.PI / 2]) { const s = box(0.17, 0.035, 0.02, plastic('#202124', 0.6), Math.cos(a) * 0.09, Math.sin(a) * 0.09, 0, false); s.rotation.z = a; sw.add(s); }
  sw.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 20).rotateX(Math.PI / 2), plastic('#1a1b1d', 0.6)));
  sw.position.set(0, -0.53, -0.44); sw.rotation.x = -0.42;
  // right-hand windscreen pillar (the left one is out of view from a right-hand-drive seat)
  const pillarShape = (bottom: THREE.Vector3, top: THREE.Vector3) => {
    const d = top.clone().sub(bottom);
    const pl = box(0.075, d.length(), 0.11, trim, 0, 0, 0, false);
    pl.position.copy(bottom.clone().add(top).multiplyScalar(0.5));
    pl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    return pl;
  };
  const pillar = pillarShape(new THREE.Vector3(0.58, -0.44, -0.97), new THREE.Vector3(0.7, 0.62, -0.42));
  // rear-view mirror on a stem from the top of the windscreen
  const mirror = new THREE.Group();
  const ms = new THREE.Shape(); const mw = 0.115, mh = 0.032, mr = 0.028;
  ms.moveTo(-mw + mr, -mh); ms.lineTo(mw - mr, -mh); ms.quadraticCurveTo(mw, -mh, mw, -mh + mr); ms.lineTo(mw, mh - mr); ms.quadraticCurveTo(mw, mh, mw - mr, mh);
  ms.lineTo(-mw + mr, mh); ms.quadraticCurveTo(-mw, mh, -mw, mh - mr); ms.lineTo(-mw, -mh + mr); ms.quadraticCurveTo(-mw, -mh, -mw + mr, -mh);
  mirror.add(new THREE.Mesh(new THREE.ExtrudeGeometry(ms, { depth: 0.03, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 3 }), plastic('#141416', 0.6)));
  const mglass = new THREE.Mesh(new THREE.ShapeGeometry(ms), pbr('mirrorglass', { color: '#8d9aa6', roughness: 0.04, metalness: 1 }));
  mglass.scale.set(0.93, 0.85, 1); mglass.position.z = 0.04; mirror.add(mglass);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.12, 8), plastic('#141416', 0.6));
  stem.position.set(0, 0.08, 0.01); mirror.add(stem);
  mirror.position.set(cx + 0.08, 0.37, -0.78); mirror.rotation.y = -0.25; mirror.rotation.x = 0.06;
  camera.add(bonnet, scuttle, ...wipers, dash, hood, sw, pillar, mirror, roofShade);
}

/** Small, deterministic engine and road vibration for the driver's view. */
export function shake(t: number, speed: number) {
  const k = Math.min(1, speed / 9);
  return {
    y: (Math.sin(t * 13.7) * 0.6 + Math.sin(t * 23.1 + 1.3) * 0.4) * 0.0035 * k,
    roll: Math.sin(t * 4.3 + 0.7) * 0.0015 * k,
    pitch: Math.sin(t * 9.1 + 2.1) * 0.0012 * k,
  };
}

export const BALL_R = real.BALL_R;
