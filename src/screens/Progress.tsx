import { useRef, useState } from 'react';
import { QUESTIONS, TOPICS, topicById } from '../data';
import { readiness } from '../lib/readiness';
import { EXAM } from '../lib/exam';
import { exportData, importData, resetAll } from '../lib/store';
import { lock } from '../lib/auth';
import { useStore } from '../lib/useStore';
import { go } from '../lib/router';

function Trend({ values, max, pass, label }: { values: number[]; max: number; pass: number; label: string }) {
  if (values.length === 0) return <p className="muted small">No {label} yet.</p>;
  const w = 300, h = 110, pad = 6;
  const x = (i: number) => pad + (values.length === 1 ? (w - 2 * pad) / 2 : (i / (values.length - 1)) * (w - 2 * pad));
  const y = (v: number) => h - pad - (v / max) * (h - 2 * pad);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="trend" role="img" aria-label={`${label} trend`}>
      <line x1={0} x2={w} y1={y(pass)} y2={y(pass)} className="pass-line" />
      <text x={w - 4} y={y(pass) - 4} textAnchor="end" className="pass-label">pass {pass}</text>
      <polyline points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} className="trend-line" />
      {values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={3.5} className={v >= pass ? 'dot ok' : 'dot bad'} />)}
    </svg>
  );
}

export function Progress() {
  const store = useStore();
  const r = readiness(QUESTIONS, TOPICS.map((t) => t.id), store);
  const answered = Object.values(store.q).reduce((a, s) => a + s.attempts, 0);
  const correct = Object.values(store.q).reduce((a, s) => a + s.correct, 0);
  return (
    <div className="stack">
      <div className="stats">
        <div className="stat"><b>{answered}</b><span>answers</span></div>
        <div className="stat"><b>{answered ? Math.round((correct / answered) * 100) : 0}%</b><span>all-time correct</span></div>
        <div className="stat"><b>{store.mocks.length}</b><span>mock tests</span></div>
      </div>
      <div className="card">
        <h3>Mock test scores</h3>
        <Trend values={store.mocks.slice(-20).map((m) => Math.round((m.score / m.total) * 50))} max={50} pass={EXAM.mcPass} label="mock tests" />
      </div>
      <div className="card">
        <h3>Hazard perception mocks</h3>
        <Trend values={store.hp.filter((h) => h.full).slice(-20).map((h) => Math.round((h.score / h.max) * 75))} max={75} pass={EXAM.hpPass} label="hazard mocks" />
      </div>
      <div className="card">
        <h3>Topic mastery</h3>
        <p className="muted small">Bar = mastery (accuracy × coverage). Target: 85%+ accuracy in every topic.</p>
        {[...r.topics].sort((a, b) => a.mastery - b.mastery).map((t) => (
          <button key={t.topic} className="topic-line" onClick={() => go(`learn/${t.topic}`)}>
            <div className="row-bar"><span>{topicById[t.topic].name}</span><span className="muted small">{t.accuracy === null ? '–' : `${Math.round(t.accuracy * 100)}%`} · {t.seen}/{t.total}</span></div>
            <div className="bar"><div className={(t.accuracy ?? 0) >= 0.85 ? 'good' : ''} style={{ width: `${t.mastery * 100}%` }} /></div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function Settings({ onLock }: { onLock: () => void }) {
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');

  function download() {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `theory-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function upload(f: File) {
    try { importData(await f.text()); setMsg('Progress restored.'); }
    catch (e) { setMsg((e as Error).message); }
  }

  return (
    <div className="stack">
      <div className="card">
        <h3>Your progress data</h3>
        <p className="small">Progress is saved in this browser on this device only. Export a backup now and then, especially before clearing browser data or changing phone.</p>
        <div className="actions">
          <button className="btn full" onClick={download}>Export backup</button>
          <button className="btn full" onClick={() => file.current?.click()}>Import backup</button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          {msg && <p className="small">{msg}</p>}
          <button className="btn danger full" onClick={() => { if (confirm('Delete all progress on this device? This cannot be undone.')) { resetAll(); setMsg('All progress deleted.'); } }}>Reset all progress</button>
        </div>
      </div>
      <div className="card">
        <h3>Security</h3>
        <button className="btn full" onClick={() => { lock(); onLock(); }}>Lock app now</button>
      </div>
      <div className="card small">
        <h3>About</h3>
        <p>Covers the DVSA car (category B) theory test in Great Britain: {EXAM.mcQuestions} multiple-choice questions in {EXAM.mcMinutes} minutes (pass {EXAM.mcPass}), and hazard perception with {EXAM.hpClips} clips (pass {EXAM.hpPass}/{EXAM.hpMax}). You must pass both parts at the same sitting.</p>
        <p>The questions are original. They are written from the Highway Code and Know Your Traffic Signs (Crown copyright, Open Government Licence) and are not DVSA's licensed question bank. Always check the current Highway Code on GOV.UK.</p>
        <p>Road sign images: The Highway Code – Traffic signs, Department for Transport. Crown copyright, used under the Open Government Licence v3.0.</p>
        <p className="muted">{QUESTIONS.length} questions · build {__BUILD_ID__}</p>
      </div>
    </div>
  );
}
