// nova press · the mythos · the poetry layer (pure).
//
// poetry rides np_pieces.body as a flat run of `verse_line` blocks (mirroring
// the flat ul_li/ol_li list model), grouped into stanzas + poems on read. this
// module is the deterministic spine the verse lenses (scansion / rhyme / form)
// and the reading view share: a syllable heuristic, an end-rhyme key, and the
// block-run -> poems/stanzas/lines grouping. pure (no react/server/db), so it's
// unit-tested headless like voice-stats.
//
// the syllable + rhyme heuristics are approximate by design (no pronunciation
// dictionary): they exist to MIRROR a drift ("this line runs longer than the
// poem's measure"), never to grade. a lens built on them stays descriptive.

export const VERSE_LINE = "verse_line";

/** a block as the lenses see it (a subset of the lens BlockText). */
export interface VerseBlock {
  type: string;
  text: string;
  index: number;
}

export interface VerseLine {
  index: number;
  text: string;
  syllables: number;
}
export interface Stanza {
  lines: VerseLine[];
}
export interface Poem {
  stanzas: Stanza[];
}

// the classic vowel-group syllable heuristic (~85% on common english): count
// runs of vowels, drop a silent trailing e / -es / -ed, with a floor of 1. good
// enough to MIRROR a line that runs long or short against a poem's own measure.
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const trimmed = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  // each MAXIMAL vowel run is one syllable (so a 3-vowel cluster like "eau" in
  // "beautiful" counts once, not twice).
  const groups = trimmed.match(/[aeiouy]+/g);
  return groups ? groups.length : 1;
}

/** the syllable count of a whole line (sum over its words). */
export function lineSyllables(line: string): number {
  const words = line.toLowerCase().match(/[a-z']+/g);
  if (!words) return 0;
  return words.reduce((sum, w) => sum + countSyllables(w), 0);
}

/** the last word of a line (lowercased, apostrophes kept), or "". */
export function lastWord(line: string): string {
  const words = line.toLowerCase().match(/[a-z']+/g);
  return words ? (words[words.length - 1] ?? "") : "";
}

// the end-rhyme key: the last word's FINAL vowel group plus its trailing
// consonants ("night"->"ight", "moon"->"oon"), after dropping a silent trailing
// e so eye-pairs don't collide ("love"->"ov", "the"->"th"). an approximation of
// the rhyming tail. true homophone rhymes (love/move) and the reverse (eye
// rhymes) slip through; that's the cost of no pronunciation data, and it's why
// the rhyme lens stays a gentle note rather than a verdict.
export function rhymeKey(line: string): string {
  const w = lastWord(line);
  if (!w) return "";
  const stripped = w.replace(/([^aeiou])e$/, "$1");
  const m = stripped.match(/[aeiouy]+[^aeiouy]*$/);
  return m ? m[0] : stripped;
}

/** do two lines end-rhyme (same rhyme key)? an empty key never rhymes. */
export function rhymes(a: string, b: string): boolean {
  const ka = rhymeKey(a);
  const kb = rhymeKey(b);
  return ka !== "" && ka === kb;
}

function isEmptyText(text: string): boolean {
  return text.trim() === "";
}

/**
 * group a flat block run into poems -> stanzas -> lines. a poem is a maximal
 * region of verse: consecutive non-empty `verse_line` blocks, with a stanza
 * break at either an empty verse line OR a single empty paragraph that sits
 * between two verse runs (the way a writer separates stanzas). a non-empty
 * non-verse block ends the poem. empty lines never become lines themselves.
 * total over garbage (a non-array degrades to no poems).
 */
export function groupVerse(blocks: readonly VerseBlock[]): Poem[] {
  if (!Array.isArray(blocks)) return [];
  const poems: Poem[] = [];
  let i = 0;
  const n = blocks.length;

  while (i < n) {
    const b = blocks[i];
    if (!b || b.type !== VERSE_LINE || isEmptyText(b.text)) {
      i += 1;
      continue;
    }
    // open a poem at the first real verse line.
    const stanzas: Stanza[] = [];
    let lines: VerseLine[] = [];
    const flush = () => {
      if (lines.length > 0) {
        stanzas.push({ lines });
        lines = [];
      }
    };

    for (; i < n; i += 1) {
      const block = blocks[i];
      if (block && block.type === VERSE_LINE) {
        if (isEmptyText(block.text)) {
          flush(); // an empty verse line is a stanza break
        } else {
          lines.push({
            index: block.index,
            text: block.text,
            syllables: lineSyllables(block.text),
          });
        }
        continue;
      }
      // a single empty paragraph BETWEEN two verse runs is a stanza break ...
      // consume it and keep the poem open. anything else ends the poem.
      const next = blocks[i + 1];
      if (block && isEmptyText(block.text) && next && next.type === VERSE_LINE) {
        flush();
        continue;
      }
      break;
    }
    flush();
    if (stanzas.length > 0) poems.push({ stanzas });
  }
  return poems;
}

/** every line of a poem, in order (stanzas flattened). */
export function poemLines(poem: Poem): VerseLine[] {
  return poem.stanzas.flatMap((s) => s.lines);
}

// the dominant value in a set, but ONLY when it actually dominates (covers at
// least minShare of the values). ties break to the larger value (deterministic).
// returns null when nothing dominates ... the caller then stays quiet rather
// than inventing a pattern out of noise. shared by the scansion measure + the
// form-shape stanza-length check.
export function modal(values: readonly number[], minShare = 0.5): number | null {
  if (values.length === 0) return null;
  const tally = new Map<number, number>();
  for (const v of values) tally.set(v, (tally.get(v) ?? 0) + 1);
  let mode = 0;
  let modeCount = 0;
  for (const [value, count] of tally) {
    if (count > modeCount || (count === modeCount && value > mode)) {
      mode = value;
      modeCount = count;
    }
  }
  return modeCount / values.length >= minShare ? mode : null;
}

// the poem's established measure: the modal syllable count, but ONLY when it's
// actually established (>= 3 lines and the mode covers at least half of them).
// free verse (no dominant count) returns null, so the scansion lens stays quiet
// rather than inventing a meter to break.
export function establishedMeter(lines: readonly VerseLine[]): number | null {
  const counts = lines.map((l) => l.syllables).filter((c) => c > 0);
  if (counts.length < 3) return null;
  return modal(counts, 0.5);
}
