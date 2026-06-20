/**
 * voice-card display helpers ... pure, db-free. turn the raw distilled numbers
 * into the plain, human phrases the studio's "your voice at a glance" card shows.
 * all pure, so they unit-test with zero mocks.
 */

// formality_score is 0..1 (a stray 0..100 is normalized so the card never lies).
function norm01(score: number): number {
  return score > 1 ? score / 100 : score;
}

export function formalityLabel(score: number | null): string | null {
  if (score === null || Number.isNaN(score)) return null;
  const s = norm01(score);
  if (s < 0.34) return "plainspoken";
  if (s < 0.67) return "balanced";
  return "formal";
}

// average words per sentence + how much it varies, as one phrase.
export function rhythmLabel(avg: number | null, variance: number | null): string | null {
  if (avg === null || Number.isNaN(avg) || avg <= 0) return null;
  const length = avg < 12 ? "short" : avg < 20 ? "medium" : "long";
  let texture = "";
  if (variance !== null && !Number.isNaN(variance) && variance >= 0) {
    // coefficient of variation: spread relative to the average.
    const cv = Math.sqrt(variance) / avg;
    texture = cv > 0.5 ? ", varied" : ", even";
  }
  return `${length}${texture} sentences`;
}

export function confidenceLabel(c: number | null): string | null {
  if (c === null || Number.isNaN(c)) return null;
  const s = norm01(c);
  if (s < 0.5) return "still forming";
  if (s < 0.8) return "taking shape";
  return "clear";
}

// "trained today" / "trained 3 days ago" ... `now` injectable for tests.
export function trainedAgo(iso: string | null, now: number = Date.now()): string | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  const days = Math.floor((now - then) / 86_400_000);
  if (days <= 0) return "trained today";
  if (days === 1) return "trained yesterday";
  if (days < 7) return `trained ${days} days ago`;
  if (days < 30) {
    const w = Math.floor(days / 7);
    return `trained ${w} week${w === 1 ? "" : "s"} ago`;
  }
  const m = Math.floor(days / 30);
  return `trained ${m} month${m === 1 ? "" : "s"} ago`;
}
