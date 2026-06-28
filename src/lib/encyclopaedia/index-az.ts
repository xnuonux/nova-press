// pure A-Z index builder for the encyclopaedia: sort the articles by title, group
// them by first letter (A-Z, with "#" collecting any title that starts with a
// non-letter). no db / server imports, unit-tested headless.

export interface IndexEntry {
  id: string;
  title: string;
}

export interface IndexGroup {
  letter: string;
  entries: IndexEntry[];
}

// ligatures + stroked letters have no NFKD decomposition, so fold them to a base
// latin letter by hand (the convention an A-Z index uses). everything else accent
// folds via NFKD; anything still non-ascii (greek, cyrillic, cjk, digits) keeps
// its own char and falls to "#".
const LIGATURE_FOLD: Record<string, string> = {
  Æ: "A",
  Ø: "O",
  Œ: "O",
  Ð: "D",
  Þ: "T",
  ẞ: "S",
};

/** the bucket letter for a title: fold the first char to its base latin letter
 *  (É -> E, Å -> A, Æ -> A, ß -> S) so an accented headword buckets with the same
 *  letter the accent-aware sort places it next to, instead of being exiled to "#".
 *  \p{Mn} strips the nonspacing marks NFKD leaves behind, no literal combining
 *  chars in source. */
function bucketLetter(title: string): string {
  const first = title[0] ?? "";
  const upper = first
    .normalize("NFKD")
    .replace(/\p{Mn}/gu, "")
    .toUpperCase();
  const head = upper[0] ?? "";
  const base = LIGATURE_FOLD[head] ?? head;
  return /[A-Z]/.test(base) ? base : "#";
}

/**
 * group the articles into an A-Z index. titles are sorted case-insensitively
 * (accent-aware), then grouped by a diacritic-folded first letter; a title whose
 * first character isn't a latin letter lands in a "#" group sorted LAST. a
 * blank-titled entry is dropped.
 */
export function buildAToZ(entries: readonly IndexEntry[]): IndexGroup[] {
  const valid = entries.filter(
    (e) => e && typeof e.title === "string" && e.title.trim().length > 0,
  );
  const sorted = [...valid].sort((a, b) =>
    a.title.toLowerCase().localeCompare(b.title.toLowerCase()),
  );

  const groups = new Map<string, IndexEntry[]>();
  for (const e of sorted) {
    const title = e.title.trim();
    const letter = bucketLetter(title);
    const bucket = groups.get(letter);
    if (bucket) bucket.push({ id: e.id, title });
    else groups.set(letter, [{ id: e.id, title }]);
  }

  // letters A-Z in order, then "#" (non-letter titles) last.
  const letters = [...groups.keys()].filter((l) => l !== "#").sort();
  if (groups.has("#")) letters.push("#");
  return letters.map((letter) => ({ letter, entries: groups.get(letter)! }));
}
