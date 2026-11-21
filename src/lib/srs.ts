import type { QStat } from './store';

const DAY = 86_400_000;
/** Days until next review for each Leitner box. */
export const INTERVALS = [0, 1, 3, 7, 16, 35];

export function newStat(): QStat {
  return { attempts: 0, correct: 0, box: 0, due: 0, last: 0, recent: [] };
}

export function recordAnswer(prev: QStat | undefined, correct: boolean, now = Date.now()): QStat {
  const s = prev ? { ...prev, recent: [...prev.recent] } : newStat();
  s.attempts++;
  if (correct) s.correct++;
  s.recent.push(correct ? 1 : 0);
  if (s.recent.length > 5) s.recent.shift();
  s.box = correct ? Math.min(s.box + 1, INTERVALS.length - 1) : 0;
  // Wrong answers come back within the same session (10 minutes).
  s.due = now + (correct ? INTERVALS[s.box] * DAY : 10 * 60_000);
  s.last = now;
  return s;
}

/** Recent accuracy for one question (last 3 attempts), or null if unseen. */
export function recentAccuracy(s: QStat | undefined): number | null {
  if (!s || s.recent.length === 0) return null;
  const r = s.recent.slice(-3);
  return r.reduce((a, b) => a + b, 0) / r.length;
}

export function isDue(s: QStat | undefined, now = Date.now()) {
  return !!s && s.due <= now;
}
