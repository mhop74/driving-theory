import { useEffect, useMemo, useRef, useState } from 'react';
import type { Question, TopicId } from '../data/types';
import { SCENARIOS, topicById } from '../data';
import { shuffle } from '../lib/random';
import { update } from '../lib/store';
import { recordAnswer } from '../lib/srs';
import { EXAM } from '../lib/exam';
import { Sign } from './Sign';

export type QuizMode = 'practice' | 'test' | 'mock';

interface Props {
  title: string;
  questions: Question[];
  mode: QuizMode;
  onExit: () => void;
}

const scenarioById = new Map(SCENARIOS.map((s) => [s.id, s]));

function useShuffledOptions(questions: Question[]) {
  return useMemo(() => new Map(questions.map((q) => [q.id, shuffle([q.answer, ...q.wrong])])), [questions]);
}

function recordAll(pairs: [Question, boolean][]) {
  update((s) => { for (const [q, ok] of pairs) s.q[q.id] = recordAnswer(s.q[q.id], ok); });
}

export function Quiz({ title, questions, mode, onExit }: Props) {
  const options = useShuffledOptions(questions);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flags, setFlags] = useState<Set<string>>(new Set());
  const [revealed, setRevealed] = useState(false);
  const [finished, setFinished] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const started = useRef(Date.now());
  const [now, setNow] = useState(Date.now());
  const timed = mode === 'mock';
  const limitMs = EXAM.mcMinutes * 60_000;

  useEffect(() => {
    if (!timed || finished) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [timed, finished]);

  const remaining = limitMs - (now - started.current);
  useEffect(() => { if (timed && !finished && remaining <= 0) finish(); });

  useEffect(() => {
    if (finished) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [finished]);

  if (questions.length === 0) {
    return <div className="card"><p>There are no questions to show here yet.</p><button className="btn" onClick={onExit}>Back</button></div>;
  }

  const q = questions[idx];
  const chosen = answers[q.id];
  const scenario = q.scenario ? scenarioById.get(q.scenario) : undefined;

  function choose(opt: string) {
    if (mode === 'practice') {
      if (revealed) return;
      setAnswers({ ...answers, [q.id]: opt });
      setRevealed(true);
      recordAll([[q, opt === q.answer]]);
    } else {
      setAnswers({ ...answers, [q.id]: opt });
    }
  }

  function next() {
    setRevealed(false);
    if (idx < questions.length - 1) setIdx(idx + 1);
    else if (mode === 'practice') setFinished(true);
  }

  function finish() {
    if (finished) return;
    if (mode !== 'practice') {
      recordAll(questions.filter((x) => answers[x.id] !== undefined).map((x) => [x, answers[x.id] === x.answer] as [Question, boolean])
        .concat(questions.filter((x) => answers[x.id] === undefined).map((x) => [x, false] as [Question, boolean])));
      if (mode === 'mock') {
        const byTopic: Partial<Record<TopicId, [number, number]>> = {};
        for (const x of questions) {
          const r = byTopic[x.topic] ?? [0, 0];
          r[1]++; if (answers[x.id] === x.answer) r[0]++;
          byTopic[x.topic] = r;
        }
        const score = questions.filter((x) => answers[x.id] === x.answer).length;
        update((s) => {
          s.mocks.push({
            at: Date.now(), score, total: questions.length, passed: score >= EXAM.mcPass,
            seconds: Math.round((Date.now() - started.current) / 1000), byTopic,
            wrongIds: questions.filter((x) => answers[x.id] !== x.answer).map((x) => x.id),
          });
        });
      }
    }
    setFinished(true);
  }

  function tryFinish() {
    const unanswered = questions.filter((x) => !answers[x.id]).length;
    const flagged = flags.size;
    const msg = [unanswered && `${unanswered} unanswered`, flagged && `${flagged} flagged`].filter(Boolean).join(' and ');
    if (!msg || confirm(`You have ${msg} question(s). Finish the test anyway?`)) finish();
  }

  if (finished) return <Results title={title} questions={questions} answers={answers} mode={mode} onExit={onExit} />;

  const answeredCount = Object.keys(answers).length;
  const mins = Math.max(0, Math.floor(remaining / 60000));
  const secs = Math.max(0, Math.floor((remaining % 60000) / 1000));

  return (
    <div className="quiz">
      <div className="quiz-bar">
        <button className="btn ghost small" onClick={() => { if (mode === 'practice' || confirm('Leave this test? Your answers will be lost.')) onExit(); }}>✕</button>
        <div className="quiz-title">
          <strong>{title}</strong>
          <span className="muted">Question {idx + 1} of {questions.length}</span>
        </div>
        {timed ? <span className={`timer ${remaining < 5 * 60000 ? 'low' : ''}`}>{mins}:{String(secs).padStart(2, '0')}</span>
          : mode === 'test' ? <span className="muted small">{answeredCount}/{questions.length}</span> : <span />}
      </div>
      <div className="progress-line"><div style={{ width: `${((idx + 1) / questions.length) * 100}%` }} /></div>

      {scenario && (
        <details className="scenario card" open>
          <summary>Case study: {scenario.title}</summary>
          <p>{scenario.text}</p>
          <p className="muted small">In the real test this is a short video clip with 3 questions.</p>
        </details>
      )}

      <div className="card question">
        <div className="tag">{topicById[q.topic].name}</div>
        <h2>{q.text}</h2>
        {q.sign && <div className="sign-wrap"><Sign id={q.sign} size={120} /></div>}
        <div className="options" role="radiogroup">
          {options.get(q.id)!.map((opt) => {
            let cls = 'option';
            if (chosen === opt) cls += ' chosen';
            if (mode === 'practice' && revealed) {
              if (opt === q.answer) cls += ' correct';
              else if (opt === chosen) cls += ' wrong';
            }
            return (
              <button key={opt} className={cls} role="radio" aria-checked={chosen === opt} onClick={() => choose(opt)} disabled={mode === 'practice' && revealed}>
                {opt}
              </button>
            );
          })}
        </div>
        {mode === 'practice' && revealed && (
          <div className={`feedback ${chosen === q.answer ? 'ok' : 'bad'}`}>
            <strong>{chosen === q.answer ? 'Correct' : 'Not quite'}</strong>
            <p>{q.explain}</p>
            <p className="ref">{q.ref}</p>
          </div>
        )}
      </div>

      {mode === 'practice' ? (
        <div className="quiz-actions">
          <button className="btn" onClick={() => setFinished(true)}>End</button>
          <button className="btn primary" disabled={!revealed} onClick={next}>{idx < questions.length - 1 ? 'Next' : 'Finish'}</button>
        </div>
      ) : (
        <>
          <div className="quiz-actions">
            <button className="btn" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>Previous</button>
            <button className={`btn ${flags.has(q.id) ? 'flagged' : ''}`} onClick={() => {
              const f = new Set(flags); f.has(q.id) ? f.delete(q.id) : f.add(q.id); setFlags(f);
            }}>{flags.has(q.id) ? '⚑ Flagged' : '⚐ Flag'}</button>
            {idx < questions.length - 1
              ? <button className="btn primary" onClick={() => setIdx(idx + 1)}>Next</button>
              : <button className="btn primary" onClick={tryFinish}>Finish</button>}
          </div>
          <button className="btn ghost full" onClick={() => setShowNav(!showNav)}>{showNav ? 'Hide' : 'Review'} all questions</button>
          {showNav && (
            <div className="card">
              <div className="nav-grid">
                {questions.map((x, i) => (
                  <button key={x.id} onClick={() => { setIdx(i); setShowNav(false); }}
                    className={`nav-cell ${answers[x.id] ? 'done' : ''} ${flags.has(x.id) ? 'flag' : ''} ${i === idx ? 'current' : ''}`}>{i + 1}</button>
                ))}
              </div>
              <p className="muted small">Blue = answered, orange outline = flagged.</p>
              <button className="btn primary full" onClick={tryFinish}>Finish test</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Results({ title, questions, answers, mode, onExit }: { title: string; questions: Question[]; answers: Record<string, string>; mode: QuizMode; onExit: () => void }) {
  const answered = questions.filter((q) => answers[q.id] !== undefined);
  const list = mode === 'practice' ? answered : questions;
  const score = list.filter((q) => answers[q.id] === q.answer).length;
  const total = list.length;
  const wrong = list.filter((q) => answers[q.id] !== q.answer);
  const scaled = mode === 'mock' ? score : null;
  const passed = scaled !== null ? scaled >= EXAM.mcPass : total > 0 && score / total >= EXAM.mcPass / EXAM.mcQuestions;

  const topics = new Map<TopicId, [number, number]>();
  for (const q of list) {
    const r = topics.get(q.topic) ?? [0, 0];
    r[1]++; if (answers[q.id] === q.answer) r[0]++;
    topics.set(q.topic, r);
  }

  return (
    <div className="results">
      <div className={`card result-hero ${passed ? 'pass' : 'fail'}`}>
        <p className="muted">{title}</p>
        <div className="big-score">{score}<span>/{total}</span></div>
        {mode === 'mock'
          ? <p className="verdict">{passed ? 'PASS' : 'FAIL'} <span className="muted">· pass mark {EXAM.mcPass}/50</span></p>
          : <p className="verdict">{total ? Math.round((score / total) * 100) : 0}% <span className="muted">· target 86% (43/50)</span></p>}
      </div>

      {topics.size > 1 && (
        <div className="card">
          <h3>By topic</h3>
          {[...topics.entries()].sort((a, b) => a[1][0] / a[1][1] - b[1][0] / b[1][1]).map(([t, [c, n]]) => (
            <div key={t} className="row-bar">
              <span>{topicById[t].name}</span>
              <span className={c / n >= 0.85 ? 'ok-text' : 'bad-text'}>{c}/{n}</span>
            </div>
          ))}
        </div>
      )}

      {wrong.length > 0 && (
        <div className="card">
          <h3>Review {wrong.length} incorrect answer{wrong.length === 1 ? '' : 's'}</h3>
          {wrong.map((q) => (
            <div key={q.id} className="review-item">
              <p><strong>{q.text}</strong></p>
              {q.sign && <Sign id={q.sign} size={64} />}
              <p className="bad-text">Your answer: {answers[q.id] ?? '(not answered)'}</p>
              <p className="ok-text">Correct: {q.answer}</p>
              <p className="muted small">{q.explain} <em>({q.ref})</em></p>
            </div>
          ))}
        </div>
      )}
      <button className="btn primary full" onClick={onExit}>Done</button>
    </div>
  );
}
