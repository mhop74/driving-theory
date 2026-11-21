import { useEffect, useRef, useState } from 'react';
import type { Actor, Clip, Key, Kind } from '../data/clips';

const W = 360, H = 560, CAR_Y = 440, OWN_X = 150;

export function lerpKeys(keys: Key[] | [number, number][], t: number): number[] {
  const k = keys as number[][];
  if (t <= k[0][0]) return k[0].slice(1);
  for (let i = 1; i < k.length; i++) {
    if (t <= k[i][0]) {
      const [t0, ...a] = k[i - 1], [t1, ...b] = k[i];
      const f = (t - t0) / (t1 - t0 || 1);
      return a.map((v, j) => v + (b[j] - v) * f);
    }
  }
  return k[k.length - 1].slice(1);
}

export const camAt = (clip: Clip, t: number) => lerpKeys(clip.cam, t)[0];

const SIZE: Record<Kind, [number, number]> = {
  car: [26, 46], van: [30, 58], bus: [32, 110], lorry: [32, 100], bike: [8, 24], tractor: [28, 44],
  horse: [12, 34], dog: [7, 15], ped: [0, 0], child: [0, 0], ball: [0, 0], door: [0, 0],
};

function hash(n: number) { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); }
const HOUSE = ['#b5651d', '#c9a27e', '#9c6b4e', '#d8c3a5', '#a0522d', '#8d8d8d'];

function drawScene(ctx: CanvasRenderingContext2D, clip: Clip, t: number, headings: number[]) {
  const cam = camAt(clip, t);
  const sy = (wy: number) => CAR_Y - (wy - cam);
  const L = clip.layout;
  const rural = !!L.rural;

  ctx.fillStyle = rural ? '#6b9e4a' : '#8fb174';
  ctx.fillRect(0, 0, W, H);

  // Roadside: houses or fields/hedges
  const top = cam + CAR_Y + 40, bottom = cam - (H - CAR_Y) - 120;
  for (let b = Math.floor(bottom / 120); b <= Math.ceil(top / 120); b++) {
    if (rural) {
      ctx.fillStyle = b % 2 ? '#7fae58' : '#74a34f';
      ctx.fillRect(0, sy(b * 120 + 120), 92, 120);
      ctx.fillRect(268, sy(b * 120 + 120), 92, 120);
    } else {
      for (const [x0, seed] of [[8, 1], [287, 2]] as const) {
        ctx.fillStyle = HOUSE[Math.floor(hash(b * 3 + seed) * HOUSE.length)];
        ctx.fillRect(x0, sy(b * 120 + 105), 65, 90);
        ctx.fillStyle = 'rgba(0,0,0,.18)';
        ctx.fillRect(x0, sy(b * 120 + 105), 65, 10);
      }
    }
  }
  if (rural) {
    ctx.fillStyle = '#2f5d1f';
    ctx.fillRect(92, 0, 8, H); ctx.fillRect(260, 0, 8, H);
    ctx.fillStyle = '#5c8a3c';
    ctx.fillRect(100, 0, 5, H); ctx.fillRect(255, 0, 5, H);
  } else {
    ctx.fillStyle = '#c4c4c0';
    ctx.fillRect(80, 0, 25, H); ctx.fillRect(255, 0, 25, H);
    ctx.fillStyle = '#9a9a96';
    ctx.fillRect(103, 0, 2, H); ctx.fillRect(255, 0, 2, H);
  }
  ctx.fillStyle = '#55595d';
  ctx.fillRect(105, 0, 150, H);

  for (const g of L.gate ?? []) {
    ctx.fillStyle = '#8b6b43';
    ctx.fillRect(g.side === 'L' ? 0 : 255, sy(g.y + 22), 105, 44);
  }
  for (const d of L.drive ?? []) {
    ctx.fillStyle = '#a7a7a3';
    ctx.fillRect(d.side === 'L' ? 20 : 255, sy(d.y + 18), 85, 36);
  }
  for (const s of L.side ?? []) {
    ctx.fillStyle = '#55595d';
    ctx.fillRect(s.side === 'L' ? 0 : 255, sy(s.y + 32), 105, 64);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
    ctx.beginPath();
    const gx = s.side === 'L' ? 102 : 258;
    ctx.moveTo(gx, sy(s.y + 30)); ctx.lineTo(gx, sy(s.y - 30)); ctx.stroke();
    ctx.setLineDash([]);
  }

  // Centre line
  ctx.fillStyle = '#f2f2f2';
  for (let y = Math.floor(bottom / 40) * 40; y < top; y += 40) {
    if ((L.zebra ?? []).some((z) => Math.abs(y - z) < 40)) continue;
    if ((L.side ?? []).some((s) => Math.abs(y - s.y) < 32)) continue;
    ctx.fillRect(178, sy(y + 20), 4, 20);
  }
  for (const z of L.zebra ?? []) {
    ctx.fillStyle = '#fff';
    for (let x = 108; x < 252; x += 16) ctx.fillRect(x, sy(z + 12), 9, 24);
    ctx.setLineDash([6, 4]); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(105, sy(z - 22)); ctx.lineTo(255, sy(z - 22)); ctx.moveTo(105, sy(z + 22)); ctx.lineTo(255, sy(z + 22)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = Math.floor(t * 2) % 2 ? '#ffb300' : '#7a5a00';
    ctx.beginPath(); ctx.arc(95, sy(z + 18), 5, 0, 7); ctx.arc(265, sy(z + 18), 5, 0, 7); ctx.fill();
  }
  for (const b of L.busStop ?? []) {
    ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 2;
    ctx.strokeRect(b.side === 'L' ? 106 : 220, sy(b.y + 75), 34, 150);
  }

  // Actors
  clip.actors.forEach((a, i) => {
    if (a.show && (t < a.show[0] || t > a.show[1])) return;
    const [x, y] = lerpKeys(a.keys, t);
    const [x2, y2] = lerpKeys(a.keys, t + 0.15);
    let h = headings[i];
    if (Math.hypot(x2 - x, y2 - y) > 0.3) {
      h = (Math.atan2(x2 - x, y2 - y) * 180) / Math.PI;
      if (a.revUntil !== undefined && t < a.revUntil) h += 180;
      headings[i] = h;
    }
    drawActor(ctx, a, x, sy(y), h, t);
  });

  // Own car
  const v = (camAt(clip, t + 0.1) - camAt(clip, t)) * 10;
  const vPrev = (camAt(clip, t) - camAt(clip, t - 0.3)) / 0.3;
  drawVehicle(ctx, OWN_X, CAR_Y, 0, 26, 46, '#1d5fb4', { brake: v < vPrev - 2 || v < 1 });
}

function drawVehicle(ctx: CanvasRenderingContext2D, x: number, y: number, deg: number, w: number, l: number, color: string,
  o: { brake?: boolean; ind?: 'L' | 'R' | null; blink?: boolean; rev?: boolean; beacon?: boolean; t?: number } = {}) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate((deg * Math.PI) / 180);
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(-w / 2 + 2, -l / 2 + 3, w, l);
  ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(-w / 2, -l / 2, w, l, 5); ctx.fill();
  ctx.fillStyle = 'rgba(20,30,45,.75)';
  ctx.fillRect(-w / 2 + 3, -l / 2 + Math.min(10, l * 0.18), w - 6, Math.min(9, l * 0.14));
  ctx.fillRect(-w / 2 + 3, l / 2 - Math.min(9, l * 0.14) - 3, w - 6, Math.min(6, l * 0.1));
  ctx.fillStyle = o.brake ? '#ff2a2a' : '#7a1010';
  ctx.fillRect(-w / 2 + 1, l / 2 - 3, 6, 3); ctx.fillRect(w / 2 - 7, l / 2 - 3, 6, 3);
  if (o.rev) { ctx.fillStyle = '#fff'; ctx.fillRect(-3, l / 2 - 3, 6, 3); }
  if (o.ind && o.blink) {
    ctx.fillStyle = '#ffa000';
    const sx = o.ind === 'L' ? -w / 2 - 1 : w / 2 - 4;
    ctx.fillRect(sx, -l / 2, 5, 5); ctx.fillRect(sx, l / 2 - 5, 5, 5);
  }
  if (o.beacon) {
    ctx.fillStyle = Math.floor((o.t ?? 0) * 3) % 2 ? '#ffb300' : '#6b4b00';
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, 7); ctx.fill();
  }
  ctx.restore();
}

function person(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, r * 1.5, r, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#f1c27d'; ctx.beginPath(); ctx.arc(x, y, r * 0.75, 0, 7); ctx.fill();
}

function drawActor(ctx: CanvasRenderingContext2D, a: Actor, x: number, y: number, deg: number, t: number) {
  const c = a.color ?? '#888';
  const blink = Math.floor(t * 2.5) % 2 === 0;
  const ind = a.ind && t >= a.ind[0] && t <= a.ind[1] ? a.ind[2] : null;
  const brake = !!a.brake && t >= a.brake[0] && t <= a.brake[1];
  switch (a.kind) {
    case 'ped': return person(ctx, x, y, 6, c);
    case 'child': return person(ctx, x, y, 4.5, c);
    case 'ball':
      ctx.fillStyle = '#e53935'; ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - 1.5, y - 1.5, 1.8, 0, 7); ctx.fill();
      return;
    case 'door':
      ctx.save(); ctx.translate(x - 6, y); ctx.rotate(0.5);
      ctx.fillStyle = '#d35400'; ctx.fillRect(0, -2, 16, 4); ctx.restore();
      return;
    case 'dog':
      ctx.save(); ctx.translate(x, y); ctx.rotate((deg * Math.PI) / 180);
      ctx.fillStyle = '#7b4a1e'; ctx.beginPath(); ctx.ellipse(0, 0, 4, 8, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -8, 3.2, 0, 7); ctx.fill(); ctx.restore();
      return;
    case 'horse':
      ctx.save(); ctx.translate(x, y); ctx.rotate((deg * Math.PI) / 180);
      ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(0, 0, 6, 17, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#d4ff00'; ctx.beginPath(); ctx.arc(0, -2, 5, 0, 7); ctx.fill();
      ctx.restore();
      return;
    case 'bike':
      ctx.save(); ctx.translate(x, y); ctx.rotate((deg * Math.PI) / 180);
      ctx.fillStyle = '#222'; ctx.fillRect(-1.5, -12, 3, 24);
      ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(0, 1, 6, 4, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#fdd835'; ctx.beginPath(); ctx.arc(0, -1, 3.5, 0, 7); ctx.fill();
      ctx.restore();
      return;
    default: {
      const [w, l] = SIZE[a.kind];
      drawVehicle(ctx, x, y, deg, w, l, c, { brake, ind, blink, rev: a.revUntil !== undefined && t < a.revUntil && t > (a.keys[1]?.[0] ?? 0) - 1, beacon: a.beacon, t });
    }
  }
}

function initialHeadings(clip: Clip) {
  return clip.actors.map((a) => a.face ?? (a.keys[0][1] > 180 ? 180 : 0));
}

interface PlayerProps {
  clip: Clip;
  onDone: (clicks: number[]) => void;
  /** Show hazard windows (review mode). */
  review?: { clicks: number[] };
}

export function HazardPlayer({ clip, onDone, review }: PlayerProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const clicks = useRef<number[]>([]);
  const start = useRef(0);
  const [flags, setFlags] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const cv = canvas.current!;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    cv.width = W * dpr; cv.height = H * dpr;
    const ctx = cv.getContext('2d')!;
    ctx.scale(dpr, dpr);
    const headings = initialHeadings(clip);
    clicks.current = []; setFlags(0);
    start.current = performance.now();
    let raf = 0, done = false;
    const frame = () => {
      const t = (performance.now() - start.current) / 1000;
      drawScene(ctx, clip, Math.min(t, clip.duration), headings);
      if (review) {
        const active = clip.hazards.find((h) => t >= h.start && t <= h.end);
        if (active) {
          ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, W, 30);
          ctx.fillStyle = '#ffd54f'; ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center';
          ctx.fillText(`Scoring window: ${active.label}`, W / 2, 20);
        }
      }
      setElapsed(t);
      if (t >= clip.duration) { if (!done) { done = true; onDone(clicks.current); } return; }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip]);

  function press(e: React.PointerEvent) {
    e.preventDefault();
    if (review) return;
    clicks.current.push((performance.now() - start.current) / 1000);
    setFlags(clicks.current.length);
  }

  return (
    <div className="hp-player">
      <canvas ref={canvas} className="hp-canvas" onPointerDown={press} style={{ aspectRatio: `${W} / ${H}` }} />
      <div className="hp-flags" aria-live="polite">
        {Array.from({ length: Math.min(flags, 15) }, (_, i) => <span key={i}>⚑</span>)}
        {review && review.clicks.map((c, i) => <span key={i} style={{ opacity: elapsed >= c ? 1 : 0.15 }}>⚑</span>)}
      </div>
      <div className="hp-time"><div style={{ width: `${Math.min(100, (elapsed / clip.duration) * 100)}%` }} /></div>
    </div>
  );
}

export function Timeline({ clip, clicks, scores }: { clip: Clip; clicks: number[]; scores: number[] }) {
  const pct = (t: number) => `${(t / clip.duration) * 100}%`;
  return (
    <div className="timeline">
      <div className="tl-track">
        {clip.hazards.map((h, i) => (
          <div key={i} className="tl-window" style={{ left: pct(h.start), width: pct(h.end - h.start) }}>
            {[5, 4, 3, 2, 1].map((n) => <span key={n}>{n}</span>)}
          </div>
        ))}
        {clicks.map((c, i) => <div key={i} className="tl-click" style={{ left: pct(Math.min(c, clip.duration)) }} title={`${c.toFixed(1)}s`} />)}
      </div>
      <div className="tl-legend muted small"><span>0s</span><span>{clip.duration}s</span></div>
      <ul className="small">
        {clip.hazards.map((h, i) => <li key={i}><strong>{scores[i]}/5</strong> · {h.label}</li>)}
      </ul>
    </div>
  );
}
