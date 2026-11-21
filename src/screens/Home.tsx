import { QUESTIONS, TOPICS, topicById } from '../data';
import { readiness } from '../lib/readiness';
import { dueQuestions } from '../lib/exam';
import { streak } from '../lib/store';
import { useStore } from '../lib/useStore';
import { go } from '../lib/router';

const VERDICT = {
  ready: { label: 'Ready to book', cls: 'ready', text: 'You are consistently scoring above the pass marks. Keep practising until your test date.' },
  close: { label: 'Getting close', cls: 'close', text: 'You are nearly there. Work on the items below that are not yet ticked.' },
  'not-yet': { label: 'Not yet ready', cls: 'notyet', text: 'Keep learning and practising. Your readiness builds as you cover more questions and take mock tests.' },
};

export function Home() {
  const store = useStore();
  const r = readiness(QUESTIONS, TOPICS.map((t) => t.id), store);
  const v = VERDICT[r.verdict];
  const due = dueQuestions(QUESTIONS, store).length;
  const days = streak(store.days);
  const lastMock = store.mocks[store.mocks.length - 1];
  const lastHp = [...store.hp].reverse().find((h) => h.full);

  return (
    <div className="stack">
      <div className={`card readiness ${v.cls}`}>
        <div className="ring" style={{ ['--p' as string]: r.score }}><span>{r.score}<small>%</small></span></div>
        <div>
          <p className="eyebrow">Test readiness</p>
          <h2>{v.label}</h2>
          <p className="small">{v.text}</p>
        </div>
      </div>

      <div className="card">
        <h3>To be ready to book</h3>
        <ul className="criteria">
          {r.criteria.map((c) => (
            <li key={c.key} className={c.met ? 'met' : ''}>
              <span className="tick">{c.met ? '✓' : ''}</span>
              <div>
                <div>{c.label}</div>
                <div className="muted small">{c.detail}</div>
                <div className="bar"><div style={{ width: `${c.progress * 100}%` }} /></div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="stats">
        <div className="stat"><b>{days}</b><span>day streak</span></div>
        <div className="stat"><b>{lastMock ? `${lastMock.score}/50` : '–'}</b><span>last mock</span></div>
        <div className="stat"><b>{lastHp ? `${Math.round((lastHp.score / lastHp.max) * 75)}/75` : '–'}</b><span>last hazard mock</span></div>
      </div>

      <div className="card">
        <h3>Suggested next</h3>
        <div className="actions">
          {due > 0 && <button className="btn primary full" onClick={() => go('practice/due')}>Review {due} due question{due === 1 ? '' : 's'}</button>}
          {r.weakest.map((t) => (
            <button key={t.topic} className="btn full" onClick={() => go(`learn/${t.topic}`)}>
              Work on {topicById[t.topic].name} <span className="muted">· {Math.round(t.mastery * 100)}% mastered</span>
            </button>
          ))}
          <button className="btn full" onClick={() => go('mock')}>Take a full mock test</button>
          <button className="btn full" onClick={() => go('hazard')}>Hazard perception practice</button>
        </div>
      </div>
    </div>
  );
}
