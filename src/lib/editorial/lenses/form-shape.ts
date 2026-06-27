// the form-shape lens ... reads a poem's stanza shape against itself. when a
// poem is built in even stanzas (most share a line count ... quatrains, tercets,
// couplets), it notes the stanza that drifts off that shape. a poem with no
// dominant stanza length (free / mixed) returns nothing ... there's no shape to
// break. descriptive, self-gating, pure + unit-tested.

import type { Finding } from "@/types/editorial";

import { groupVerse, modal, type VerseBlock } from "../poetry";
import { finding, type LensInput } from "./core";

const LENS = "form-shape";

export function formShapeLens(input: LensInput): Finding[] {
  const poems = groupVerse(input.blocks as VerseBlock[]);
  if (poems.length === 0) return [];

  const out: Finding[] = [];
  for (const poem of poems) {
    const stanzas = poem.stanzas;
    // need a few stanzas before a shape is "established" enough to drift from.
    if (stanzas.length < 3) continue;
    const counts = stanzas.map((s) => s.lines.length);
    const shape = modal(counts, 0.5);
    if (shape == null) continue; // no dominant stanza length ... no shape to break

    // a deliberate CLOSING tag ... the final stanza, shorter than the shape, with
    // every earlier stanza on the shape ... is a form feature, not a drift: a
    // shakespearean sonnet's couplet [4,4,4,2], a ballade's envoi, a sestina's
    // tornada. nova shouldn't note the very lines that define the form.
    const earlierAllOnShape = counts.slice(0, -1).every((c) => c === shape);

    stanzas.forEach((stanza, i) => {
      const count = counts[i];
      if (count === undefined || count === shape) return;
      const isClosingTag = i === stanzas.length - 1 && count < shape && earlierAllOnShape;
      if (isClosingTag) return;
      const lines = count === 1 ? "line" : "lines";
      out.push(
        finding(LENS, `this stanza runs ${count} ${lines} ... the others hold ${shape}.`, "note", {
          blockIndex: stanza.lines[0]?.index ?? 0,
        }),
      );
    });
  }
  return out;
}
