import type { Question, TopicId } from '../data/types';
import type { Store } from './store';
import { recentAccuracy } from './srs';
import { sample, shuffle } from './random';
import { TOPICS } from '../data/topics';
import type { Scenario } from '../data/types';

/** Official DVSA car theory test format (Great Britain). */
export const EXAM = {
  mcQuestions: 50,
  mcMinutes: 57,
  mcPass: 43,
  scenarioQuestions: 3,
  hpClips: 14,
  hpHazards: 15,
  hpMax: 75,
  hpPass: 44,
} as const;

/** Build a 50-question mock: 47 standalone questions spread across topics + one 3-question scenario. */
export function buildMock(pool: Question[], scenarios: Scenario[], rnd = Math.random): Question[] {
  const byTopic = new Map<TopicId, Question[]>();
  for (const q of pool) {
    if (!byTopic.has(q.topic)) byTopic.set(q.topic, []);
    byTopic.get(q.topic)!.push(q);
  }
  const picked: Question[] = [];
  const used = new Set<string>();
  for (const t of TOPICS) {
    for (const q of sample(byTopic.get(t.id) ?? [], t.mockWeight, rnd)) { picked.push(q); used.add(q.id); }
  }
  // Top up if any topic had too few questions.
  const target = EXAM.mcQuestions - EXAM.scenarioQuestions;
  if (picked.length < target) {
    picked.push(...sample(pool.filter((q) => !used.has(q.id)), target - picked.length, rnd));
  }
  const scenario = scenarios[Math.floor(rnd() * scenarios.length)];
  return [...shuffle(picked, rnd), ...scenario.questions];
}

/** Questions ranked by weakness: wrong recently first, then unseen, then due. */
export function weakQuestions(pool: Question[], store: Store, n: number, rnd = Math.random): Question[] {
  const scored = pool.map((q) => {
    const s = store.q[q.id];
    const acc = recentAccuracy(s);
    let w: number;
    if (acc === null) w = 0.5;            // unseen
    else w = 1 - acc;                     // 1 = always wrong
    if (s && s.box <= 1 && s.attempts > 0) w += 0.3;
    return { q, w: w + rnd() * 0.15 };
  });
  return scored.sort((a, b) => b.w - a.w).slice(0, n).map((x) => x.q);
}

export function dueQuestions(pool: Question[], store: Store, now = Date.now()): Question[] {
  return pool.filter((q) => { const s = store.q[q.id]; return s && s.due <= now; })
    .sort((a, b) => store.q[a.id].due - store.q[b.id].due);
}

export function topicQuiz(pool: Question[], topic: TopicId, n: number, store: Store, rnd = Math.random): Question[] {
  const qs = pool.filter((q) => q.topic === topic);
  // Prefer unseen and weaker questions but keep some variety.
  return weakQuestions(qs, store, Math.min(n, qs.length), rnd);
}
