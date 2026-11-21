import type { Question } from './types';
import { SIGN_CARDS, type SignCard } from '../components/Sign';
import { seeded, shuffle } from '../lib/random';

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * One "What does this sign mean?" question per official sign that has no hand-written question.
 * Wrong answers are other signs' meanings from the same group, chosen deterministically from the
 * sign id so the options stay the same between visits.
 */
export function signQuestions(existing: Question[]): Question[] {
  const covered = new Set(existing.map((q) => q.sign).filter(Boolean));
  const counts = new Map<string, number>();
  for (const c of SIGN_CARDS) counts.set(c.meaning, (counts.get(c.meaning) ?? 0) + 1);
  const unique = (c: SignCard) => counts.get(c.meaning) === 1;
  return SIGN_CARDS.filter((c) => !covered.has(c.id) && unique(c)).map((c) => {
    const pool = SIGN_CARDS.filter((o) => o.group === c.group && o.id !== c.id && o.meaning !== c.meaning);
    const wrong = [...new Set(shuffle(pool, seeded(hash(c.id))).map((o) => o.meaning))].slice(0, 3);
    return {
      id: `sign-${c.id}`, topic: 'signs', text: 'What does this sign mean?', answer: c.meaning, wrong, sign: c.id,
      explain: `${c.meaning}.${c.note ? ' ' + c.note : ''} ${c.group === 'Orders' ? 'Circles give orders.' : c.group === 'Warnings' ? 'Triangles and similar signs warn.' : 'Rectangular signs give information or directions.'}`,
      ref: 'The Highway Code – Traffic signs',
    } satisfies Question;
  });
}
