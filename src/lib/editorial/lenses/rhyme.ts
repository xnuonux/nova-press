// the rhyme lens ... reads a poem's END-RHYME against the scheme it sets up,
// never an imposed one. it only speaks when the poem is clearly built in
// couplets (most adjacent pairs chime); then it flags the pair that doesn't, in
// the poem's own terms. the rhyme key is heuristic (no pronunciation data), so a
// near-rhyme or an eye-rhyme can slip ... which is why a flag here is an
// invitation to look, never a verdict. self-gating + pure + unit-tested.

import type { Finding } from "@/types/editorial";

import { groupVerse, lastWord, rhymeKey, poemLines, rhymes, type VerseBlock } from "../poetry";
import { finding, type LensInput } from "./core";

const LENS = "rhyme";
// only call a poem "in couplets" when at least this share of its pairs chime ...
// below it, the poem isn't rhyming on a couplet scheme and we stay quiet.
const COUPLET_SHARE = 0.6;
// AND at least this many pairs must chime on a SUBSTANTIVE key, so a couple of
// coincidental suffix collisions (-y, -ly, -ing) can't fabricate a scheme out of
// free verse. a real couplet poem clears this easily; ambiguous short poems stay
// quiet (the rhyme key is too coarse to call a scheme from one or two matches).
const MIN_CHIMING_PAIRS = 3;

// a pair "chimes" only on a rhyme key of at least two characters ... the broad
// single-letter buckets (a bare "-y" / "-e") are too weak to count as a couplet.
function chimes(a: string, b: string): boolean {
  return rhymes(a, b) && rhymeKey(a).length >= 2;
}

export function rhymeLens(input: LensInput): Finding[] {
  const poems = groupVerse(input.blocks as VerseBlock[]);
  if (poems.length === 0) return [];

  const out: Finding[] = [];
  for (const poem of poems) {
    const lines = poemLines(poem);
    // need an even count of at least four to read couplets (two pairs minimum).
    if (lines.length < 4 || lines.length % 2 !== 0) continue;

    const pairs: [(typeof lines)[number], (typeof lines)[number]][] = [];
    for (let i = 0; i + 1 < lines.length; i += 2) {
      const a = lines[i];
      const b = lines[i + 1];
      if (a && b) pairs.push([a, b]);
    }

    const chiming = pairs.filter(([a, b]) => chimes(a.text, b.text)).length;
    if (chiming < MIN_CHIMING_PAIRS) continue; // too few real chimes to call a scheme
    if (chiming < Math.ceil(pairs.length * COUPLET_SHARE)) continue; // not a couplet poem

    for (const [a, b] of pairs) {
      // flag a pair that doesn't even loosely rhyme (the gate already proved the
      // poem is built on couplets) ... a short-key chime is left alone.
      if (!rhymes(a.text, b.text)) {
        out.push(
          finding(
            LENS,
            `these two lines sit as a couplet but don't chime ... "${lastWord(a.text)}" against "${lastWord(b.text)}".`,
            "flag",
            { blockIndex: b.index },
          ),
        );
      }
    }
  }
  return out;
}
