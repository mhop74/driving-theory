import * as THREE from 'three';

// Blocky "voxel" art kit: tiny procedurally drawn pixel textures (16×16) shown with
// nearest-neighbour filtering, plus helpers that tile them at one texture per metre.
// All artwork is generated here; nothing is copied from any game.

function rnd(seed: number) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function shade(hex: string, f: number) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return `#${c.getHexString()}`;
}

type Draw = (px: (x: number, y: number, c: string) => void, n: (i: number) => number) => void;

const cache = new Map<string, THREE.Texture>();

function tex(key: string, draw: Draw, size = 16) {
  const hit = cache.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d')!;
  let seed = key.length * 31;
  draw((x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); }, () => rnd(seed++));
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestMipmapLinearFilter;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

/** Base colour with per-pixel brightness noise. */
export const noiseTex = (base: string, amt = 0.12) =>
  tex(`noise${base}${amt}`, (px, n) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, shade(base, 1 + (n(0) - 0.5) * 2 * amt)); });

export const brickTex = (base: string) => tex(`brick${base}`, (px, n) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const row = Math.floor(y / 4), off = row % 2 ? 4 : 0;
    const mortar = y % 4 === 3 || (x + off) % 8 === 7;
    px(x, y, mortar ? '#cbbfae' : shade(base, 0.9 + n(0) * 0.2));
  }
});

export const slabTex = () => tex('slab', (px, n) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, x % 8 === 0 || y % 8 === 0 ? '#9c998f' : shade('#bdb9b0', 0.94 + n(0) * 0.1));
});

export const roofTex = () => tex('roof', (px, n) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, y % 4 === 0 ? '#34363d' : shade('#50535d', 0.9 + n(0) * 0.2));
});

export const glassTex = () => tex('glass', (px) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const frame = x === 0 || y === 0 || x === 15 || y === 15 || x === 8;
    const shine = (x - y === 3 || x - y === 4) && !frame;
    px(x, y, frame ? '#ecebe6' : shine ? '#dceefa' : '#7fa9c6');
  }
});

export const plankTex = (base = '#7a4f2a') => tex(`plank${base}`, (px, n) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, y % 4 === 0 ? shade(base, 0.7) : shade(base, 0.9 + n(0) * 0.2));
});

export const leafTex = () => tex('leaf', (px, n) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const v = n(0); px(x, y, v < 0.15 ? '#2c5a22' : shade('#3f7f2f', 0.85 + v * 0.3)); }
});

export const logTex = () => tex('log', (px, n) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, x % 4 === 0 ? '#4a321c' : shade('#6b4a2b', 0.9 + n(0) * 0.2));
});

export const fieldTex = () => tex('field', (px, n) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, x % 4 < 2 ? shade('#6f8f35', 0.85 + n(0) * 0.3) : shade('#7a5a32', 0.9 + n(0) * 0.2));
});

/** 8×8 blocky face: skin, hair band, eyes. */
export const faceTex = (skin: string, hair: string) => tex(`face${skin}${hair}`, (px) => {
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    let c = skin;
    if (y < 2) c = hair;
    if (y === 3 && (x === 2 || x === 5)) c = '#ffffff';
    if (y === 3 && (x === 1 || x === 6)) c = '#2b2b3a';
    if (y === 5 && x >= 3 && x <= 4) c = shade(skin, 0.75);
    px(x, y, c);
  }
}, 8);

export const footballTex = () => tex('football', (px) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const dark = ((Math.floor(x / 4) + Math.floor(y / 4)) % 3 === 0) && x % 4 && y % 4;
    px(x, y, dark ? '#161616' : '#f4f4f0');
  }
});

const matCache = new Map<string, THREE.MeshLambertMaterial>();

/** Lambert material, optionally textured. Cached per key. */
export function vmat(color: string, map?: THREE.Texture, key = '') {
  const k = `${color}|${map?.uuid ?? ''}|${key}`;
  let m = matCache.get(k);
  if (!m) { m = new THREE.MeshLambertMaterial({ color: map ? '#ffffff' : color, map }); matCache.set(k, m); }
  return m;
}

/** A fresh (uncached) material for things that change at runtime, e.g. lights. */
export const liveMat = (color: string) => new THREE.MeshLambertMaterial({ color, emissive: '#000000' });

/** Box whose texture tiles once per `tile` metres on every face. */
export function blk(w: number, h: number, d: number, m: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0, shadow = true, tile = 1) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
    const k = f * 4 + i;
    uv.setXY(k, (uv.getX(k) * dims[f][0]) / tile, (uv.getY(k) * dims[f][1]) / tile);
  }
  const mesh = new THREE.Mesh(g, m);
  mesh.position.set(x, y, z);
  mesh.castShadow = shadow; mesh.receiveShadow = true;
  return mesh;
}

/** Flat ground strip lying on y = h, tiled per metre. */
export function strip(w: number, len: number, m: THREE.Material, x: number, z: number, h = 0, tile = 1) {
  const g = new THREE.PlaneGeometry(w, len, 1, Math.max(1, Math.ceil(len / 10)));
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tile, (uv.getY(i) * len) / tile);
  const mesh = new THREE.Mesh(g, m);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, h, z);
  mesh.receiveShadow = true;
  return mesh;
}
