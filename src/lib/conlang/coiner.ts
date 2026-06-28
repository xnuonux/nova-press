// pure constrained word coiner ... the deterministic rails-respecting generator. it
// builds a word from the allowed syllable templates, filling each C/V slot from the
// inventory, so the shape is legal by construction. it is the gate's deterministic
// FALLBACK (no model up) AND the safety net when the model proposes an illegal
// word. a caller injects the rng (a () => number in [0,1)) so it stays pure +
// unit-testable: the route passes Math.random, a test passes a seeded prng.
//
// the one subtlety is maximal-munch re-segmentation: with multi-char phonemes a
// C-C boundary could spell a digraph and re-read the word, so the build is VERIFIED
// with isLegalWord and retried; a phonology with no digraphs always passes the
// first build (single-char phonemes can't merge).

import { isLegalWord, type Phonology } from "./phonology";

const MAX_TRIES = 32;

function pick<T>(arr: readonly T[], rng: () => number): T {
  // arr is non-empty by the caller's guarantee (a normalized phonology).
  const i = Math.min(arr.length - 1, Math.max(0, Math.floor(rng() * arr.length)));
  return arr[i] as T;
}

function build(phon: Phonology, rng: () => number, maxSyllables: number): string {
  const count = 1 + Math.floor(rng() * Math.max(1, maxSyllables));
  let word = "";
  for (let s = 0; s < count; s += 1) {
    const template = pick(phon.syllables, rng);
    for (const cls of template) {
      word += cls === "C" ? pick(phon.consonants, rng) : pick(phon.vowels, rng);
    }
  }
  return word;
}

/**
 * coin one word legal in this phonology: 1..maxSyllables syllables, each a random
 * allowed template with its C/V slots filled from the inventory, VERIFIED with
 * isLegalWord (and retried if a digraph collision made it illegal). returns the
 * verified word, or the last candidate as a best effort for a pathological
 * phonology (vanishingly rare; still a plausible string).
 */
export function coinLegalWord(
  phon: Phonology,
  rng: () => number,
  opts: { maxSyllables?: number } = {},
): string {
  const maxSyllables = Math.max(1, Math.min(4, opts.maxSyllables ?? 3));
  let last = "";
  for (let attempt = 0; attempt < MAX_TRIES; attempt += 1) {
    last = build(phon, rng, maxSyllables);
    if (isLegalWord(phon, last)) return last;
  }
  return last;
}

// a tiny seedable prng (mulberry32) ... NOT for the runtime coiner (it passes
// Math.random), only so a test can drive coinLegalWord deterministically.
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
