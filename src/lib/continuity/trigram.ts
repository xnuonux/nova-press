// pg_trgm-shaped string similarity, in pure js (no extension, no db call). it
// mirrors postgres' pg_trgm: pad a word with two leading spaces + one trailing,
// split into trigrams, and score the JACCARD overlap of the two trigram sets.
// matching pg_trgm's shape means the deterministic name-drift pass agrees with
// the gin trigram index the bible carries (v0_9_0_np_bible) ... the same notion
// of "close" the 4.x continuity scan uses on both sides. pure + unit-tested.

/** the trigram set of a word, pg_trgm style: lowercased, padded "  word ", every
 *  length-3 window, deduped. a blank word has no trigrams. */
export function trigrams(s: string): Set<string> {
  const w = `  ${String(s ?? "")
    .toLowerCase()
    .trim()} `;
  const out = new Set<string>();
  if (w.trim().length === 0) return out;
  for (let i = 0; i + 3 <= w.length; i += 1) out.add(w.slice(i, i + 3));
  return out;
}

/** trigram similarity in [0,1] ... |common| / |union| (jaccard), the pg_trgm
 *  similarity(). 0 when either side is blank. an exact match is 1. */
export function similarity(a: string, b: string): number {
  const ta = trigrams(a);
  const tb = trigrams(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}
