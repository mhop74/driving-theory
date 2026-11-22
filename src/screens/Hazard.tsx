import { lazy, Suspense, useState } from 'react';
import { CLIPS, hazardsFor, usesVideo, videoFailed, type Clip } from '../data/clips';
import { supports3D } from '../lib/webgl';
import { HazardPlayer, Timeline } from '../components/HazardPlayer';
import { scoreClip, type ClipScore } from '../lib/hp';
import { EXAM } from '../lib/exam';
import { shuffle } from '../lib/random';
import { update } from '../lib/store';
import { useStore } from '../lib/useStore';
import { go } from '../lib/router';
import ueIconBlack from '../assets/brand/unreal-engine-icon-black.png';
import ueIconWhite from '../assets/brand/unreal-engine-icon-white.png';

const Hazard3DPlayer = lazy(() => import('../components/Hazard3D'));
const HazardVideo = lazy(() => import('../components/HazardVideo'));

function Player(props: { clip: Clip; onDone: (clicks: number[]) => void; review?: { clicks: number[] } }) {
  const [, setFailed] = useState(false);
  if (usesVideo(props.clip)) {
    return (
      <Suspense fallback={<div className="card center"><p className="muted">Loading video…</p></div>}>
        <HazardVideo {...props} onError={() => { videoFailed.add(props.clip.id); setFailed(true); }} />
      </Suspense>
    );
  }
  if (!supports3D()) return <HazardPlayer {...props} />;
  return (
    <Suspense fallback={<div className="card center"><p className="muted">Loading 3D scene…</p></div>}>
      <Hazard3DPlayer {...props} />
    </Suspense>
  );
}

export function HazardHome() {
  const store = useStore();
  const recent = store.hp.filter((h) => h.full).slice(-5).reverse();
  return (
    <div className="stack">
      <div className="card intro">
        <h2>Hazard perception</h2>
        <p className="small">Tap the screen when you see a hazard <strong>starting to develop</strong>. The earlier you tap once it starts, the more you score.</p>
        <h3 className="hp-h">How scoring works</h3>
        <ul className="small hp-rules">
          <li><strong>Potential hazard:</strong> something that <em>might</em> need you to act, such as a parked car, a pedestrian near the kerb, or a ball by the road.</li>
          <li><strong>Developing hazard:</strong> one that <em>does</em> need you to slow down, stop or change direction: the car signals and pulls out, the pedestrian steps off the kerb, the ball rolls into the road.</li>
          <li>Each developing hazard has a <strong>scoring window</strong>. It opens as the hazard starts to develop and is split into five parts: tap in the first part for <strong>5 points</strong>, then 4, 3, 2 and 1. After the window closes you score 0.</li>
          <li>Only your <strong>first tap inside the window</strong> counts. A tap before the window opens scores nothing, but costs nothing either.</li>
          <li><strong>Tip:</strong> tap when you spot a potential hazard, then <strong>tap again</strong> as soon as it starts to develop. Your second tap is the one most likely to land early in the window.</li>
          <li>Tapping constantly, very rapidly or in a regular rhythm scores <strong>0 for the whole clip</strong>, as in the real test.</li>
          <li>The real test has {EXAM.hpClips} clips with {EXAM.hpHazards} developing hazards (one clip has two). Each scores up to 5, so the maximum is {EXAM.hpMax} and the pass mark is {EXAM.hpPass}. You get one go at each clip.</li>
        </ul>
        <p className="small muted">The clips are 3D scenes seen from the driver's seat (or top-down 2D if your device can't show 3D). Clips with the Unreal Engine logo are pre-rendered videos made in Unreal Engine 5, with the same timings and scoring windows. Use them to practise timing and scanning, and also practise with DVSA's official hazard perception clips, which use realistic video.</p>
      </div>
      <div className="card">
        <h3>Full hazard perception mock</h3>
        <ul className="small facts">
          <li>{EXAM.hpClips} clips, {EXAM.hpHazards} hazards (one clip has two)</li>
          <li>Pass mark: {EXAM.hpPass}/{EXAM.hpMax}</li>
        </ul>
        <button className="btn primary full" onClick={() => go('hazard/mock')}>Start full mock</button>
        {recent.length > 0 && <div className="history">{recent.map((h) => {
          const s = Math.round((h.score / h.max) * EXAM.hpMax);
          return <span key={h.at} className={`pill ${s >= EXAM.hpPass ? 'ok' : 'bad'}`}>{s}/75</span>;
        })}</div>}
      </div>
      <h3 className="section">Practise a single clip</h3>
      {CLIPS.map((c) => (
        <button key={c.id} className="card topic-row" onClick={() => go(`hazard/clip/${c.id}`)}>
          <div>
            <strong>{c.title}</strong>
            <div className="muted small">{c.hazards.length} hazard{c.hazards.length > 1 ? 's' : ''}</div>
          </div>
          {c.video && <UnrealIcon />}
          <span className="chev">›</span>
        </button>
      ))}
      {CLIPS.some((c) => c.video) && <p className="muted small trademark">Unreal®, Unreal Engine®, and the Unreal Engine® logo are trademarks or registered trademarks of Epic Games, Inc. in the United States of America and elsewhere. Other brands or product names are the trademarks of their respective owners.</p>}
    </div>
  );
}

/** Epic's Unreal Engine icon, unaltered: black on the light theme, white on the dark theme. */
function UnrealIcon() {
  return (
    <span className="ue-icon" title="Pre-rendered video made in Unreal Engine 5">
      <img className="ue-light" src={ueIconBlack} alt="Made with Unreal Engine" width={20} height={20} />
      <img className="ue-dark" src={ueIconWhite} alt="" aria-hidden="true" width={20} height={20} />
    </span>
  );
}

type Phase = { kind: 'intro' } | { kind: 'play' } | { kind: 'result'; clicks: number[]; score: ClipScore } | { kind: 'review'; clicks: number[]; score: ClipScore };

export function HazardClip({ id }: { id: string }) {
  const clip = CLIPS.find((c) => c.id === id);
  const [phase, setPhase] = useState<Phase>({ kind: 'intro' });
  const [run, setRun] = useState(0);
  if (!clip) return <p>Clip not found.</p>;

  function done(clicks: number[]) {
    const score = scoreClip(hazardsFor(clip!), clicks);
    update((s) => { s.hp.push({ at: Date.now(), score: score.total, max: clip!.hazards.length * 5, full: false, clips: 1 }); });
    setPhase({ kind: 'result', clicks, score });
  }

  return (
    <div className="stack">
      <button className="btn ghost small back" onClick={() => go('hazard')}>‹ Hazard perception</button>
      <h2>{clip.title}</h2>
      {phase.kind === 'intro' && <Intro onStart={() => { setRun(run + 1); setPhase({ kind: 'play' }); }} />}
      {phase.kind === 'play' && <Player key={run} clip={clip} onDone={done} />}
      {(phase.kind === 'result' || phase.kind === 'review') && (
        <>
          {phase.kind === 'review' && <Player key={`r${run}`} clip={clip} review={{ clicks: phase.clicks }} onDone={() => {}} />}
          <ClipResult clip={clip} clicks={phase.clicks} score={phase.score} />
          <div className="quiz-actions">
            <button className="btn" onClick={() => { setRun(run + 1); setPhase({ ...phase, kind: 'review' }); }}>Watch with scoring window</button>
            <button className="btn primary" onClick={() => { setRun(run + 1); setPhase({ kind: 'play' }); }}>Try again</button>
          </div>
        </>
      )}
      <OfficialLinks />
    </div>
  );
}

/** Official DVSA hazard perception resources, shown under every clip. */
const OFFICIAL_LINKS = [
  { href: 'https://www.youtube.com/watch?v=SdQRkmdhwJs', title: 'Hazard perception test: official DVSA guide', note: 'Video (YouTube): when to click and how scoring works' },
  { href: 'https://www.gov.uk/theory-test/hazard-perception-test', title: 'How the hazard perception test works', note: 'GOV.UK: the official test format and scoring' },
  { href: 'https://www.gov.uk/government/news/hazard-perception-clips-get-a-modern-makeover', title: 'Example of an official CGI test clip', note: 'GOV.UK news story with a DVSA video' },
];

export function OfficialLinks() {
  return (
    <div className="card official-links">
      <h3>Practise with official DVSA videos</h3>
      <p className="muted small">These clips are for practice. The real test uses DVSA's own CGI video clips, which look different.</p>
      <ul>
        {OFFICIAL_LINKS.map((l) => (
          <li key={l.href}>
            <a href={l.href} target="_blank" rel="noopener noreferrer">{l.title} ↗</a>
            <span className="muted small">{l.note}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Intro({ onStart, label = 'Start clip' }: { onStart: () => void; label?: string }) {
  return (
    <div className="card center">
      <p className="small">You are the driver. Tap anywhere on the scene as soon as a hazard <strong>starts to develop</strong>. Tap once for a potential hazard and again when it develops. A flag appears for each tap. Don't tap constantly or in a rhythm.</p>
      <button className="btn primary" onClick={onStart}>{label}</button>
    </div>
  );
}

/** Plain-English explanation of how each hazard was scored. */
function feedback(h: { start: number; end: number }, clicks: number[], points: number, cheat: string | null) {
  const f = (t: number) => `${t.toFixed(1)} s`;
  if (cheat) return 'Not scored: the whole clip scores 0 when taps are constant or in a rhythm.';
  const inside = clicks.filter((c) => c >= h.start && c <= h.end).sort((a, b) => a - b)[0];
  const before = clicks.filter((c) => c < h.start);
  if (inside !== undefined) {
    const after = inside - h.start;
    return points === 5
      ? `Excellent: you tapped ${after.toFixed(1)} s after it started to develop (${f(inside)}).`
      : `You tapped ${after.toFixed(1)} s after it started to develop (${f(inside)}). Tap earlier, as soon as it starts, for more points.`;
  }
  if (before.length) return `You tapped at ${f(before[before.length - 1])}, before it started to develop at ${f(h.start)}, so that tap didn't count. Tap again as soon as it starts to develop.`;
  return `No tap during the scoring window (${f(h.start)}–${f(h.end)}).`;
}

function ClipResult({ clip, clicks, score }: { clip: Clip; clicks: number[]; score: ClipScore }) {
  const max = clip.hazards.length * 5;
  const windows = hazardsFor(clip);
  return (
    <div className="card">
      <div className="clip-score"><b>{score.total}</b>/{max}</div>
      {score.cheat && <p className="error">Scored 0: {score.cheat.toLowerCase()}.</p>}
      <Timeline clip={clip} hazards={windows} clicks={clicks} scores={score.perHazard} />
      <ul className="small hp-feedback">
        {windows.map((h, i) => <li key={i}>{feedback(h, clicks, score.perHazard[i], score.cheat)}</li>)}
      </ul>
      <p className="small">{clip.explain}</p>
    </div>
  );
}

export function HazardMock() {
  const [clips] = useState(() => {
    const singles = shuffle(CLIPS.filter((c) => c.hazards.length === 1)).slice(0, EXAM.hpClips - 1);
    const double = CLIPS.find((c) => c.hazards.length === 2)!;
    const order = [...singles];
    order.splice(Math.floor(Math.random() * (order.length + 1)), 0, double);
    return order;
  });
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [results, setResults] = useState<{ clicks: number[]; score: ClipScore }[]>([]);

  function done(clicks: number[]) {
    const score = scoreClip(hazardsFor(clips[i]), clicks);
    const next = [...results, { clicks, score }];
    setResults(next);
    setPlaying(false);
    if (next.length === clips.length) {
      const total = next.reduce((a, r) => a + r.score.total, 0);
      const max = clips.reduce((a, c) => a + c.hazards.length * 5, 0);
      update((s) => { s.hp.push({ at: Date.now(), score: total, max, full: true, clips: clips.length }); });
    } else setI(i + 1);
  }

  if (results.length === clips.length) {
    const total = results.reduce((a, r) => a + r.score.total, 0);
    const passed = total >= EXAM.hpPass;
    return (
      <div className="stack">
        <div className={`card result-hero ${passed ? 'pass' : 'fail'}`}>
          <p className="muted">Hazard perception mock</p>
          <div className="big-score">{total}<span>/{EXAM.hpMax}</span></div>
          <p className="verdict">{passed ? 'PASS' : 'FAIL'} <span className="muted">· pass mark {EXAM.hpPass}</span></p>
        </div>
        {clips.map((c, k) => (
          <div key={c.id} className="card">
            <h3>{k + 1}. {c.title}</h3>
            <ClipResult clip={c} clicks={results[k].clicks} score={results[k].score} />
          </div>
        ))}
        <OfficialLinks />
        <button className="btn primary full" onClick={() => go('hazard')}>Done</button>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="quiz-bar">
        <button className="btn ghost small" onClick={() => { if (confirm('Leave the hazard perception mock?')) go('hazard'); }}>✕</button>
        <div className="quiz-title"><strong>Hazard perception mock</strong><span className="muted">Clip {i + 1} of {clips.length}</span></div>
        <span />
      </div>
      {playing ? <Player key={i} clip={clips[i]} onDone={done} />
        : <Intro onStart={() => setPlaying(true)} label={i === 0 ? 'Start first clip' : `Start clip ${i + 1}`} />}
    </div>
  );
}
