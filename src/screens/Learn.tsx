import { useState } from 'react';
import { QUESTIONS, TOPICS, topicById } from '../data';
import type { TopicId } from '../data/types';
import { topicProgress } from '../lib/readiness';
import { useStore } from '../lib/useStore';
import { go } from '../lib/router';
import { Sign, SIGN_CARDS, SIGN_GROUPS, type SignGroup } from '../components/Sign';
import { update } from '../lib/store';
import { shuffle } from '../lib/random';

export function LearnHome() {
  const store = useStore();
  return (
    <div className="stack">
      <div className="card intro">
        <h2>Learning mode</h2>
        <p className="small">Read the key rules for each topic, then practise. You get instant feedback with Highway Code references. Questions you get wrong come back sooner.</p>
        <div className="actions">
          <button className="btn primary full" onClick={() => go('practice/quick')}>Quick practice (10 mixed questions)</button>
          <button className="btn full" onClick={() => go('signs')}>Road sign flashcards</button>
          <button className="btn full" onClick={() => go('stopping')}>Thinking and stopping distances</button>
        </div>
      </div>
      <h3 className="section">The 14 official topics</h3>
      {TOPICS.map((t) => {
        const p = topicProgress(QUESTIONS, store, t.id);
        return (
          <button key={t.id} className="card topic-row" onClick={() => go(`learn/${t.id}`)}>
            <div>
              <strong>{t.name}</strong>
              <div className="muted small">{p.seen}/{p.total} seen · {p.accuracy === null ? 'not started' : `${Math.round(p.accuracy * 100)}% recent accuracy`}</div>
              <div className="bar"><div style={{ width: `${p.mastery * 100}%` }} /></div>
            </div>
            <span className="chev">›</span>
          </button>
        );
      })}
    </div>
  );
}

export function Lesson({ topic }: { topic: TopicId }) {
  const t = topicById[topic];
  const store = useStore();
  if (!t) return <p>Unknown topic.</p>;
  const p = topicProgress(QUESTIONS, store, topic);
  return (
    <div className="stack">
      <button className="btn ghost small back" onClick={() => go('learn')}>‹ Topics</button>
      <div className="card">
        <p className="eyebrow">Topic</p>
        <h2>{t.name}</h2>
        <p className="muted small">{p.seen}/{p.total} questions seen · {Math.round(p.mastery * 100)}% mastered</p>
      </div>
      {t.lesson.map((s) => (
        <div key={s.heading} className="card lesson">
          <h3>{s.heading}</h3>
          <ul>{s.points.map((pt) => <li key={pt}>{pt}</li>)}</ul>
        </div>
      ))}
      {topic === 'signs' && <button className="btn full" onClick={() => go('signs')}>Open road sign flashcards</button>}
      <div className="sticky-actions">
        <button className="btn primary full" onClick={() => go(`practice/topic/${topic}`)}>Practise {t.name} (instant feedback)</button>
        <button className="btn full" onClick={() => go(`test/topic/${topic}`)}>Topic test (marked at the end)</button>
      </div>
    </div>
  );
}

const DAY = 86_400_000;

export function Signs() {
  const store = useStore();
  const [filter, setFilter] = useState<SignGroup | 'All'>('All');
  const pool = (f: SignGroup | 'All') => SIGN_CARDS.filter((c) => f === 'All' || c.group === f);
  const makeDeck = (f: SignGroup | 'All') => {
    const now = Date.now();
    const cards = pool(f);
    const dueFirst = cards.filter((c) => (store.signs[c.id]?.due ?? 0) <= now);
    return shuffle(dueFirst.length ? dueFirst : cards);
  };
  const [deck, setDeck] = useState(() => makeDeck('All'));
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [browse, setBrowse] = useState(false);
  const card = deck[i];

  function choose(f: SignGroup | 'All') { setFilter(f); setDeck(makeDeck(f)); setI(0); setFlipped(false); }

  function rate(known: boolean) {
    update((s) => {
      const prev = s.signs[card.id]?.box ?? 0;
      const box = known ? Math.min(prev + 1, 5) : 0;
      s.signs[card.id] = { box, due: Date.now() + (known ? [0, 1, 3, 7, 16, 35][box] * DAY : 0) };
    });
    setFlipped(false);
    setI(i + 1);
  }

  const cards = pool(filter);
  const known = cards.filter((c) => (store.signs[c.id]?.box ?? 0) >= 2).length;

  return (
    <div className="stack">
      <button className="btn ghost small back" onClick={() => go('learn')}>‹ Learn</button>
      <div className="seg">
        <button className={!browse ? 'on' : ''} onClick={() => setBrowse(false)}>Flashcards</button>
        <button className={browse ? 'on' : ''} onClick={() => setBrowse(true)}>Browse all</button>
      </div>
      <div className="chips" role="group" aria-label="Sign type">
        {(['All', ...SIGN_GROUPS] as const).map((g) => (
          <button key={g} className={`chip ${filter === g ? 'on' : ''}`} onClick={() => choose(g)}>
            {g} <span>{pool(g).length}</span>
          </button>
        ))}
      </div>
      <p className="muted small center">{known}/{cards.length} learned · Circles give orders, triangles warn, rectangles inform.</p>
      {browse ? (
        SIGN_GROUPS.filter((g) => filter === 'All' || g === filter).map((g) => (
          <div key={g} className="card">
            <h3>{g}</h3>
            <div className="sign-grid">
              {SIGN_CARDS.filter((c) => c.group === g).map((c) => (
                <div key={c.id} className="sign-cell"><Sign id={c.id} size={72} /><span>{c.meaning}</span></div>
              ))}
            </div>
          </div>
        ))
      ) : card ? (
        <div className="card flash" onClick={() => setFlipped(true)}>
          <Sign id={card.id} size={160} />
          {flipped ? (
            <>
              <h3>{card.meaning}</h3>
              {card.note && <p className="muted small">{card.note}</p>}
              <div className="quiz-actions" onClick={(e) => e.stopPropagation()}>
                <button className="btn" onClick={() => rate(false)}>Didn’t know</button>
                <button className="btn primary" onClick={() => rate(true)}>Knew it</button>
              </div>
            </>
          ) : <p className="muted">Tap to reveal the meaning</p>}
          <p className="muted small">{i + 1} / {deck.length}</p>
        </div>
      ) : (
        <div className="card center">
          <h3>Deck complete</h3>
          <button className="btn primary" onClick={() => { setDeck(shuffle(cards)); setI(0); }}>Go again</button>
        </div>
      )}
      <p className="muted small center">Sign images: The Highway Code – Traffic signs (DfT). Crown copyright, Open Government Licence v3.0.</p>
    </div>
  );
}
