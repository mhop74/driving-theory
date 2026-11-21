import type { TopicId } from '../data/types';

export interface QStat {
  attempts: number;
  correct: number;
  /** Leitner box 0–5 for spaced repetition. */
  box: number;
  /** Next review time (ms epoch). */
  due: number;
  last: number;
  /** Most recent results, newest last (1 = correct). Max 5. */
  recent: number[];
}

export interface MockResult {
  at: number;
  score: number;
  total: number;
  passed: boolean;
  seconds: number;
  byTopic: Partial<Record<TopicId, [number, number]>>;
  wrongIds: string[];
}

export interface HPResult { at: number; score: number; max: number; full: boolean; clips: number }

export interface Store {
  v: 1;
  q: Record<string, QStat>;
  mocks: MockResult[];
  hp: HPResult[];
  signs: Record<string, { box: number; due: number }>;
  days: string[];
}

const KEY = 'theory-trainer:data';

export const emptyStore = (): Store => ({ v: 1, q: {}, mocks: [], hp: [], signs: {}, days: [] });

let cache: Store | null = null;
const listeners = new Set<() => void>();

export function load(): Store {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...emptyStore(), ...JSON.parse(raw) } : emptyStore();
  } catch {
    cache = emptyStore();
  }
  return cache!;
}

export function save(next: Store) {
  cache = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage full or unavailable */ }
  listeners.forEach((l) => l());
}

export function update(fn: (s: Store) => void) {
  const s = structuredClone(load());
  fn(s);
  markDay(s);
  save(s);
}

export function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }

export function today(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function markDay(s: Store) {
  const t = today();
  if (s.days[s.days.length - 1] !== t) s.days.push(t);
  if (s.days.length > 400) s.days = s.days.slice(-400);
}

export function streak(days: string[], now = new Date()): number {
  const set = new Set(days);
  const d = new Date(now);
  if (!set.has(today(d))) d.setDate(d.getDate() - 1); // streak survives until end of today
  let n = 0;
  while (set.has(today(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

export function exportData(): string { return JSON.stringify(load(), null, 1); }

export function importData(json: string) {
  const parsed = JSON.parse(json);
  if (!parsed || parsed.v !== 1 || typeof parsed.q !== 'object') throw new Error('This does not look like a Theory Trainer backup file.');
  save({ ...emptyStore(), ...parsed });
}

export function resetAll() { save(emptyStore()); }
