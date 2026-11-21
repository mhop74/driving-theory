export function shuffle<T>(arr: readonly T[], rnd = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function sample<T>(arr: readonly T[], n: number, rnd = Math.random): T[] {
  return shuffle(arr, rnd).slice(0, n);
}

/** Deterministic PRNG for tests. */
export function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}
