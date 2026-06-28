// pure retrieval-by-mention: which bible entities does a stretch of prose actually
// name? it scans the text's capitalized words and matches them against the bible's
// names + aliases (exact, name-token, or a pg_trgm-shaped near-miss), so the author
// prompt's bible slot can carry ONLY the entities a beat touches, not the whole
// codex. a fumbled spelling ("marrik") still retrieves the entity it reaches for.
// no db / server imports, so it's unit-tested headless.
//
// unlike the detect pass this does its OWN tokenize rather than reuse
// extractMentions: detection drops calendar / stopword candidates for precision,
// but the bible is the authority on what counts as a name here ... a character
// literally named "May" must still be retrievable. the only text-side filter is
// "must be capitalized" (a lowercase word is never a proper-noun mention), so a
// stopword that is NOT one of the bible's names simply matches nothing.

import type { KnownName } from "./types";
import { similarity } from "./trigram";

// a mention this close to a known name still retrieves it. the same threshold the
// detect pass uses to call a slip a slip ... a fumbled spelling should still
// ground the right entity in the prompt.
const DRIFT_THRESHOLD = 0.6;
const MIN_LEN = 3;
// stripped when reducing a multi-word name to its anchor tokens ("the ferryman"
// -> "ferryman"), matching detect's indexKnown.
const LEADING_ARTICLES = new Set(["the", "a", "an"]);

interface RetrievalIndex {
  // a full name / alias (lowercased) -> the entity ids that answer to it.
  byFull: Map<string, Set<string>>;
  // a single significant name token -> the entity ids, so "marik" finds "old
  // marik". a Set, not first-write-wins, so two co-named entities both retrieve on
  // a bare shared token instead of the older one being silently dropped.
  byToken: Map<string, Set<string>>;
}

function add(map: Map<string, Set<string>>, key: string, id: string): void {
  const set = map.get(key);
  if (set) set.add(id);
  else map.set(key, new Set([id]));
}

function buildIndex(known: readonly KnownName[]): RetrievalIndex {
  const byFull = new Map<string, Set<string>>();
  const byToken = new Map<string, Set<string>>();
  for (const k of known) {
    for (const raw of [k.name, ...(k.aliases ?? [])]) {
      const name = String(raw ?? "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
      if (!name) continue;
      add(byFull, name, k.entityId);
      for (const w of name.split(" ")) {
        if (LEADING_ARTICLES.has(w) || w.length < MIN_LEN) continue;
        add(byToken, w, k.entityId);
      }
    }
  }
  return { byFull, byToken };
}

/**
 * the set of entity ids the text mentions: an exact name / alias hit, a name-token
 * hit ("marik" inside "old marik"), or a trigram near-miss on a token (a slip like
 * "marrik" still grounds the entity it's reaching for). a bare token shared by two
 * entities retrieves BOTH. order-free; the caller composes the matched entities.
 * empty when the text names nothing known, which is the honest signal that a beat
 * touches none of the established world.
 */
export function mentionedEntityIds(text: string, known: readonly KnownName[]): Set<string> {
  const { byFull, byToken } = buildIndex(known);
  const out = new Set<string>();
  if (byFull.size === 0 && byToken.size === 0) return out;

  const s = String(text ?? "");
  const re = /[A-Za-z][A-Za-z'’-]*/g;
  const seenWord = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const word = m[0];
    if (!/^[A-Z]/.test(word)) continue; // a proper-noun mention is capitalized
    const lower = word
      .toLowerCase()
      .replace(/['’]s$/, "")
      .replace(/['’-]+$/, "");
    if (lower.length < MIN_LEN || seenWord.has(lower)) continue;
    seenWord.add(lower);

    const full = byFull.get(lower);
    if (full) {
      for (const id of full) out.add(id);
      continue;
    }
    const tok = byToken.get(lower);
    if (tok) {
      for (const id of tok) out.add(id);
      continue;
    }

    // a near-miss on a token ... a fumbled spelling still retrieves the entity.
    let best = "";
    let bestSim = 0;
    for (const key of byToken.keys()) {
      const sim = similarity(lower, key);
      if (sim > bestSim) {
        bestSim = sim;
        best = key;
      }
    }
    if (best && bestSim >= DRIFT_THRESHOLD) {
      const ids = byToken.get(best);
      if (ids) for (const id of ids) out.add(id);
    }
  }
  return out;
}
