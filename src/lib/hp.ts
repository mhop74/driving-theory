// Hazard perception scoring, modelled on the DVSA method:
// each developing hazard has a scoring window divided into five equal parts.
// The first response inside the window scores 5, 4, 3, 2 or 1 depending on how
// early it is. Clicking continuously or in a pattern scores 0 for the whole clip.

export interface HazardWindow { start: number; end: number; label: string }

export function scoreHazard(h: HazardWindow, clicks: number[]): number {
  const first = clicks.filter((t) => t >= h.start && t <= h.end).sort((a, b) => a - b)[0];
  if (first === undefined) return 0;
  const band = Math.floor(((first - h.start) / (h.end - h.start)) * 5);
  return Math.max(1, 5 - Math.min(band, 4));
}

/** Returns a reason if the click pattern looks like rapid or rhythmic clicking. */
export function cheatReason(clicks: number[]): string | null {
  const c = [...clicks].sort((a, b) => a - b);
  if (c.length > 15) return 'Too many clicks in one clip';
  for (let i = 0; i + 4 < c.length; i++) {
    if (c[i + 4] - c[i] <= 2) return 'Five or more clicks within 2 seconds';
  }
  if (c.length >= 6) {
    const gaps = c.slice(1).map((t, i) => t - c[i]);
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const sd = Math.sqrt(gaps.reduce((a, g) => a + (g - mean) ** 2, 0) / gaps.length);
    if (mean > 0 && sd / mean < 0.15) return 'Clicking in a regular pattern';
  }
  return null;
}

export interface ClipScore { perHazard: number[]; total: number; cheat: string | null }

export function scoreClip(hazards: HazardWindow[], clicks: number[]): ClipScore {
  const cheat = cheatReason(clicks);
  const perHazard = hazards.map((h) => (cheat ? 0 : scoreHazard(h, clicks)));
  return { perHazard, total: perHazard.reduce((a, b) => a + b, 0), cheat };
}
