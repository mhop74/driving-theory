import { lazy, Suspense, useState } from 'react';
import { CLIPS, hazardsFor, type Clip } from '../data/clips';
import { supports3D } from '../lib/webgl';
import { HazardPlayer, Timeline } from '../components/HazardPlayer';
import { scoreClip, type ClipScore } from '../lib/hp';
import { EXAM } from '../lib/exam';
import { shuffle } from '../lib/random';
import { update } from '../lib/store';
import { useStore } from '../lib/useStore';
import { go } from '../lib/router';

const Hazard3DPlayer = lazy(() => import('../components/Hazard3D'));

function Player(props: { clip: Clip; onDone: (clicks: number[]) => void; review?: { clicks: number[] } }) {
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
        <p className="small">Tap the screen as soon as you see a <strong>developing hazard</strong>: something that would make you slow down, stop or change direction. The earlier you respond within the scoring window, the more you score (5 down to 1).</p>
        <p className="small">Tapping constantly or in a pattern scores 0 for the clip, as in the real test.</p>
        <p className="small muted">The clips are blocky 3D scenes seen from the driver's seat (or top-down 2D if your device can't show 3D). Use them to practise timing and scanning, and also practise with DVSA's official hazard perception clips, which use realistic video.</p>
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
          <div><strong>{c.title}</strong><div className="muted small">{c.hazards.length} hazard{c.hazards.length > 1 ? 's' : ''}</div></div>
          <span className="chev">›</span>
        </button>
      ))}
    </div>
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
    </div>
  );
}

function Intro({ onStart, label = 'Start clip' }: { onStart: () => void; label?: string }) {
  return (
    <div className="card center">
      <p className="small">You are driving the blue car at the bottom of the scene. Tap anywhere on the scene when you see a hazard developing. A flag appears each time you tap.</p>
      <button className="btn primary" onClick={onStart}>{label}</button>
    </div>
  );
}

function ClipResult({ clip, clicks, score }: { clip: Clip; clicks: number[]; score: ClipScore }) {
  const max = clip.hazards.length * 5;
  return (
    <div className="card">
      <div className="clip-score"><b>{score.total}</b>/{max}</div>
      {score.cheat && <p className="error">Scored 0: {score.cheat.toLowerCase()}.</p>}
      <Timeline clip={clip} hazards={hazardsFor(clip)} clicks={clicks} scores={score.perHazard} />
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
