import { useState } from 'react';
import { QUESTIONS, SCENARIOS, TOPICS, topicById } from '../data';
import type { Question, TopicId } from '../data/types';
import { buildMock, dueQuestions, topicQuiz, weakQuestions, EXAM } from '../lib/exam';
import { load } from '../lib/store';
import { sample } from '../lib/random';
import { useStore } from '../lib/useStore';
import { go } from '../lib/router';
import { Quiz } from '../components/Quiz';

export function TestHome() {
  const store = useStore();
  const [topic, setTopic] = useState<TopicId>('alertness');
  const mocks = store.mocks.slice(-5).reverse();
  return (
    <div className="stack">
      <div className="card intro">
        <h2>Testing mode</h2>
        <p className="small">No feedback until the end, as in the real test.</p>
      </div>
      <div className="card">
        <h3>Full mock theory test</h3>
        <ul className="small facts">
          <li>{EXAM.mcQuestions} questions in {EXAM.mcMinutes} minutes, including a 3-question case study</li>
          <li>Pass mark: {EXAM.mcPass}/{EXAM.mcQuestions}</li>
          <li>Flag questions and review before finishing</li>
        </ul>
        <button className="btn primary full" onClick={() => go('mock')}>Start mock test</button>
        {mocks.length > 0 && (
          <div className="history">
            {mocks.map((m) => (
              <span key={m.at} className={`pill ${m.passed ? 'ok' : 'bad'}`}>{m.score}/50</span>
            ))}
          </div>
        )}
      </div>
      <div className="card">
        <h3>Weak-spots test</h3>
        <p className="small muted">20 questions you have got wrong or not yet seen.</p>
        <button className="btn full" onClick={() => go('test/weak')}>Start weak-spots test</button>
      </div>
      <div className="card">
        <h3>Topic test</h3>
        <select value={topic} onChange={(e) => setTopic(e.target.value as TopicId)} aria-label="Topic">
          {TOPICS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button className="btn full" onClick={() => go(`test/topic/${topic}`)}>Start 10-question topic test</button>
      </div>
    </div>
  );
}

/** Builds a question list once, then runs the quiz. */
export function QuizRoute({ kind, arg, mode }: { kind: string; arg?: string; mode: 'practice' | 'test' | 'mock' }) {
  const [setup] = useState<{ title: string; qs: Question[] }>(() => {
    const store = load();
    switch (kind) {
      case 'mock': return { title: 'Mock theory test', qs: buildMock(QUESTIONS, SCENARIOS) };
      case 'topic': return { title: topicById[arg as TopicId]?.name ?? 'Topic', qs: topicQuiz(QUESTIONS, arg as TopicId, mode === 'practice' ? 15 : 10, store) };
      case 'weak': return { title: 'Weak spots', qs: weakQuestions(QUESTIONS, store, 20) };
      case 'due': return { title: 'Due for review', qs: dueQuestions(QUESTIONS, store).slice(0, 25) };
      default: return { title: 'Quick practice', qs: sample(QUESTIONS, 10) };
    }
  });
  const back = mode === 'practice' ? (kind === 'topic' ? `learn/${arg}` : 'learn') : 'test';
  return <Quiz title={setup.title} questions={setup.qs} mode={mode} onExit={() => go(kind === 'due' ? '' : back)} />;
}
