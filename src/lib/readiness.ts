import type { Question, TopicId } from '../data/types';
import type { Store } from './store';
import { recentAccuracy } from './srs';
import { EXAM } from './exam';

export interface TopicProgress {
  topic: TopicId;
  total: number;
  seen: number;
  /** Recent accuracy across seen questions, 0–1 (null if none seen). */
  accuracy: number | null;
  /** Combined mastery 0–1 = accuracy × coverage. */
  mastery: number;
}

export function topicProgress(pool: Question[], store: Store, topic: TopicId): TopicProgress {
  const qs = pool.filter((q) => q.topic === topic);
  let seen = 0, sum = 0;
  for (const q of qs) {
    const a = recentAccuracy(store.q[q.id]);
    if (a !== null) { seen++; sum += a; }
  }
  const accuracy = seen ? sum / seen : null;
  return { topic, total: qs.length, seen, accuracy, mastery: (accuracy ?? 0) * (qs.length ? seen / qs.length : 0) };
}

export const THRESHOLDS = {
  mockScore: 45,       // buffer above the 43 pass mark
  mocksNeeded: 3,
  topicAccuracy: 0.85,
  coverage: 0.9,
  hpScore: 55,         // buffer above the 44 pass mark
  hpNeeded: 3,
};

export interface Criterion { key: string; label: string; met: boolean; detail: string; progress: number }

export interface Readiness {
  score: number;            // 0–100
  verdict: 'ready' | 'close' | 'not-yet';
  criteria: Criterion[];
  topics: TopicProgress[];
  weakest: TopicProgress[];
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const clamp = (x: number) => Math.max(0, Math.min(1, x));

export function readiness(pool: Question[], topicIds: TopicId[], store: Store): Readiness {
  const topics = topicIds.map((t) => topicProgress(pool, store, t));

  const lastMocks = store.mocks.slice(-THRESHOLDS.mocksNeeded);
  const mockAvg = avg(lastMocks.map((m) => (m.score / m.total) * EXAM.mcQuestions));
  const mocksMet = lastMocks.length === THRESHOLDS.mocksNeeded && lastMocks.every((m) => (m.score / m.total) * EXAM.mcQuestions >= THRESHOLDS.mockScore);
  // Progress towards mock goal: average vs target, scaled by how many mocks taken.
  const mockProg = clamp((mockAvg / THRESHOLDS.mockScore) * (lastMocks.length / THRESHOLDS.mocksNeeded));

  const topicAccs = topics.map((t) => t.accuracy ?? 0);
  const weakTopics = topics.filter((t) => (t.accuracy ?? 0) < THRESHOLDS.topicAccuracy);
  const topicsMet = weakTopics.length === 0;
  const topicProg = clamp(avg(topicAccs.map((a) => Math.min(1, a / THRESHOLDS.topicAccuracy))));

  const total = topics.reduce((a, t) => a + t.total, 0);
  const seen = topics.reduce((a, t) => a + t.seen, 0);
  const coverage = total ? seen / total : 0;
  const coverageMet = coverage >= THRESHOLDS.coverage;
  const coverageProg = clamp(coverage / THRESHOLDS.coverage);

  const fullHp = store.hp.filter((h) => h.full).slice(-THRESHOLDS.hpNeeded);
  const hpAvg = avg(fullHp.map((h) => (h.score / h.max) * EXAM.hpMax));
  const hpMet = fullHp.length === THRESHOLDS.hpNeeded && fullHp.every((h) => (h.score / h.max) * EXAM.hpMax >= THRESHOLDS.hpScore);
  const hpProg = clamp((hpAvg / THRESHOLDS.hpScore) * (fullHp.length / THRESHOLDS.hpNeeded));

  const criteria: Criterion[] = [
    { key: 'mocks', label: `Last ${THRESHOLDS.mocksNeeded} mock tests all ${THRESHOLDS.mockScore}/50 or more`, met: mocksMet, progress: mockProg,
      detail: lastMocks.length ? `Last ${lastMocks.length}: ${lastMocks.map((m) => m.score).join(', ')} (pass mark ${EXAM.mcPass})` : 'No mock tests taken yet' },
    { key: 'topics', label: `Every topic at ${Math.round(THRESHOLDS.topicAccuracy * 100)}%+ accuracy`, met: topicsMet, progress: topicProg,
      detail: topicsMet ? 'All topics strong' : `${weakTopics.length} topic${weakTopics.length === 1 ? '' : 's'} below target` },
    { key: 'coverage', label: `Seen ${Math.round(THRESHOLDS.coverage * 100)}%+ of the question bank`, met: coverageMet, progress: coverageProg,
      detail: `${seen} of ${total} questions seen (${Math.round(coverage * 100)}%)` },
    { key: 'hp', label: `Last ${THRESHOLDS.hpNeeded} hazard perception mocks all ${THRESHOLDS.hpScore}/75 or more`, met: hpMet, progress: hpProg,
      detail: fullHp.length ? `Last ${fullHp.length}: ${fullHp.map((h) => Math.round((h.score / h.max) * EXAM.hpMax)).join(', ')} (pass mark ${EXAM.hpPass})` : 'No full hazard perception mocks yet' },
  ];

  const score = Math.round(100 * (0.35 * mockProg + 0.25 * topicProg + 0.15 * coverageProg + 0.25 * hpProg));
  const verdict = criteria.every((c) => c.met) ? 'ready' : score >= 70 ? 'close' : 'not-yet';
  const weakest = [...topics].sort((a, b) => a.mastery - b.mastery).slice(0, 3);
  return { score, verdict, criteria, topics, weakest };
}
