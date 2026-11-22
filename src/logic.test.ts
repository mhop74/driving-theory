import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { ALL_QUESTIONS, QUESTIONS, SCENARIOS, TOPICS } from './data';
import { CLIPS, hazardsFor } from './data/clips';
import { WINDOWS_3D } from './data/windows3d';
import { SIGN_CARDS } from './components/Sign';
import { buildMock, EXAM, weakQuestions } from './lib/exam';
import { scoreClip, scoreHazard, cheatReason } from './lib/hp';
import { readiness, THRESHOLDS } from './lib/readiness';
import { recordAnswer, INTERVALS } from './lib/srs';
import { emptyStore, streak } from './lib/store';
import { seeded } from './lib/random';

describe('question bank', () => {
  it('has unique ids and four distinct options per question', () => {
    const ids = new Set(ALL_QUESTIONS.map((q) => q.id));
    expect(ids.size).toBe(ALL_QUESTIONS.length);
    for (const q of ALL_QUESTIONS) {
      expect(q.wrong).toHaveLength(3);
      expect(new Set([q.answer, ...q.wrong]).size).toBe(4);
      expect(q.explain.length).toBeGreaterThan(10);
      expect(q.ref.length).toBeGreaterThan(2);
    }
  });
  it('covers all 14 DVSA topics with enough questions for a mock', () => {
    expect(TOPICS).toHaveLength(14);
    expect(TOPICS.reduce((a, t) => a + t.mockWeight, 0)).toBe(EXAM.mcQuestions - EXAM.scenarioQuestions);
    for (const t of TOPICS) expect(QUESTIONS.filter((q) => q.topic === t.id).length).toBeGreaterThanOrEqual(Math.max(10, t.mockWeight));
  });
  it('only references signs that can be drawn', () => {
    const known = new Set(SIGN_CARDS.map((s) => s.id));
    for (const q of QUESTIONS) if (q.sign) expect(known.has(q.sign), q.id).toBe(true);
  });
  it('has an official image for every sign card', () => {
    for (const c of SIGN_CARDS) expect(existsSync(`public/signs/${c.id}.png`), c.id).toBe(true);
  });
  it('has 3 questions per scenario', () => {
    for (const s of SCENARIOS) expect(s.questions).toHaveLength(3);
  });
});

describe('mock test builder', () => {
  it('builds 50 unique questions ending with a 3-question scenario', () => {
    const qs = buildMock(QUESTIONS, SCENARIOS, seeded(42));
    expect(qs).toHaveLength(50);
    expect(new Set(qs.map((q) => q.id)).size).toBe(50);
    expect(qs.slice(-3).every((q) => q.scenario)).toBe(true);
    expect(qs.slice(0, 47).some((q) => q.scenario)).toBe(false);
    for (const t of TOPICS) expect(qs.filter((q) => q.topic === t.id && !q.scenario).length).toBe(t.mockWeight);
  });
});

describe('spaced repetition', () => {
  it('moves up a box on correct and resets on wrong', () => {
    const now = 1_000_000;
    let s = recordAnswer(undefined, true, now);
    expect(s.box).toBe(1);
    expect(s.due).toBe(now + INTERVALS[1] * 86_400_000);
    s = recordAnswer(s, true, now);
    expect(s.box).toBe(2);
    s = recordAnswer(s, false, now);
    expect(s.box).toBe(0);
    expect(s.due).toBe(now + 600_000);
    expect(s.recent).toEqual([1, 1, 0]);
  });
  it('weak questions puts wrongly-answered ones first', () => {
    const store = emptyStore();
    const target = QUESTIONS[5];
    store.q[target.id] = recordAnswer(undefined, false);
    for (const q of QUESTIONS.slice(10, 40)) store.q[q.id] = recordAnswer(recordAnswer(undefined, true), true);
    expect(weakQuestions(QUESTIONS, store, 5, seeded(1))[0].id).toBe(target.id);
  });
});

describe('hazard perception scoring', () => {
  const h = { start: 10, end: 15, label: 'x' };
  it('scores 5 to 1 by fifth of the window', () => {
    expect(scoreHazard(h, [10.1])).toBe(5);
    expect(scoreHazard(h, [11.2])).toBe(4);
    expect(scoreHazard(h, [12.5])).toBe(3);
    expect(scoreHazard(h, [13.5])).toBe(2);
    expect(scoreHazard(h, [14.9])).toBe(1);
    expect(scoreHazard(h, [15])).toBe(1);
  });
  it('scores 0 outside the window and uses the first click inside it', () => {
    expect(scoreHazard(h, [9.9, 16])).toBe(0);
    expect(scoreHazard(h, [5, 13.6, 10.5])).toBe(5);
  });
  it('zeros a clip for rapid or rhythmic clicking', () => {
    expect(cheatReason([10, 10.3, 10.6, 10.9, 11.2])).toBeTruthy();
    expect(cheatReason([1, 3, 5, 7, 9, 11, 13])).toBeTruthy();
    expect(cheatReason([4.2, 10.5, 12.1])).toBeNull();
    expect(scoreClip([h], [10, 10.3, 10.6, 10.9, 11.2]).total).toBe(0);
  });
  it('has 14 single-hazard clips plus one double, giving a 14-clip/15-hazard mock', () => {
    const singles = CLIPS.filter((c) => c.hazards.length === 1);
    expect(singles.length).toBeGreaterThanOrEqual(EXAM.hpClips - 1);
    expect(CLIPS.filter((c) => c.hazards.length === 2)).toHaveLength(1);
    for (const c of CLIPS) {
      expect(c.focus).toHaveLength(c.hazards.length);
      for (const hz of [...c.hazards, ...(WINDOWS_3D[c.id] ?? [])]) { expect(hz.end).toBeLessThanOrEqual(c.duration); expect(hz.end - hz.start).toBeGreaterThan(2); }
      for (const a of c.actors) for (let i = 1; i < a.keys.length; i++) expect(a.keys[i][0], `${c.id}`).toBeGreaterThan(a.keys[i - 1][0]);
      for (let i = 1; i < c.cam.length; i++) expect(c.cam[i][1]).toBeGreaterThanOrEqual(c.cam[i - 1][1]);
    }
  });

  it('plays Unreal Engine videos with the 3D scoring windows, and their files exist', () => {
    const withVideo = CLIPS.filter((c) => c.video);
    expect(withVideo.map((c) => c.id)).toEqual(expect.arrayContaining(['ball', 'behind-bus', 'zebra', 'dog', 'tractor', 'emerge-left', 'double']));
    for (const c of withVideo) {
      expect(existsSync(`public/${c.video!.src}`), c.video!.src).toBe(true);
      expect(existsSync(`public/${c.video!.poster}`), c.video!.poster).toBe(true);
      expect(WINDOWS_3D[c.id], c.id).toBeDefined();
      expect(hazardsFor(c)).toEqual(c.video!.windows ?? WINDOWS_3D[c.id]);
      for (const w of c.video!.windows ?? []) { expect(w.end).toBeLessThanOrEqual(c.duration); expect(w.end - w.start).toBeCloseTo(4); }
    }
  });
});

describe('readiness', () => {
  const ids = TOPICS.map((t) => t.id);
  it('is not ready with no activity', () => {
    const r = readiness(QUESTIONS, ids, emptyStore());
    expect(r.verdict).toBe('not-yet');
    expect(r.score).toBe(0);
  });
  it('is ready when every criterion is met', () => {
    const s = emptyStore();
    for (const q of QUESTIONS) s.q[q.id] = recordAnswer(undefined, true);
    for (let i = 0; i < 3; i++) s.mocks.push({ at: i, score: 47, total: 50, passed: true, seconds: 1000, byTopic: {}, wrongIds: [] });
    for (let i = 0; i < 3; i++) s.hp.push({ at: i, score: 60, max: 75, full: true, clips: 14 });
    const r = readiness(QUESTIONS, ids, s);
    expect(r.criteria.every((c) => c.met)).toBe(true);
    expect(r.verdict).toBe('ready');
    expect(r.score).toBe(100);
  });
  it('requires the buffer above the pass mark, not just a pass', () => {
    const s = emptyStore();
    for (const q of QUESTIONS) s.q[q.id] = recordAnswer(undefined, true);
    for (let i = 0; i < 3; i++) s.mocks.push({ at: i, score: 44, total: 50, passed: true, seconds: 1000, byTopic: {}, wrongIds: [] });
    for (let i = 0; i < 3; i++) s.hp.push({ at: i, score: 60, max: 75, full: true, clips: 14 });
    const r = readiness(QUESTIONS, ids, s);
    expect(r.criteria.find((c) => c.key === 'mocks')!.met).toBe(false);
    expect(r.verdict).toBe('close');
    expect(THRESHOLDS.mockScore).toBeGreaterThan(EXAM.mcPass);
  });
});

describe('streak', () => {
  it('counts consecutive days including yesterday', () => {
    const now = new Date(2026, 10, 21);
    expect(streak(['2026-11-19', '2026-11-20'], now)).toBe(2);
    expect(streak(['2026-11-19', '2026-11-20', '2026-11-21'], now)).toBe(3);
    expect(streak(['2026-11-18'], now)).toBe(0);
  });
});
