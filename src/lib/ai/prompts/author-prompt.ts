/**
 * author prompts ... nova writing AS the writer, one beat at a time.
 *
 * the generative counterpart to the partner/ghost prompts. same voice-mirror
 * block order (identity -> voice rules -> compact voice -> forbidden preamble ->
 * exemplars -> the world bible -> task instruction), the rules + preamble
 * imported from system-prompt so there is one source of truth. the author never
 * overwrites the writer's intent and never runs past the beat it was asked for.
 *
 * the BIBLE slot is reserved here for phase 4 (world bible + continuity): when a
 * piece has a bible, the relevant entries land in this slot so a drafted beat
 * stays consistent with the established world. it is an empty slot for now ...
 * the structure is fixed so nothing downstream drifts when phase 4 fills it.
 */

import { FORBIDDEN_PREAMBLE, VOICE_RULES } from "./system-prompt";
import type { AuthorTask } from "../provider";

const IDENTITY_AUTHOR =
  "you are nova, writing as the writer, not for them. you write in their voice, you serve their intent, you never overwrite it. you write exactly what was asked ... one beat, no more ... then you stop and hand the page back.";

// per-task instruction. the beat tasks produce ONE paragraph of finished prose;
// the outline produces a skeleton, never drafted prose. all output-only, no
// preamble, lowercase per the voice rules.
const AUTHOR_INSTRUCTION: Record<AuthorTask, string> = {
  expand:
    "expand the writer's note below into one beat of finished prose ... a single paragraph that realizes the note in their voice. don't restate the note, write the scene/argument it points to. exactly one paragraph, then stop. output only the prose.",
  "draft-beat":
    "draft the beat described below into one paragraph of finished prose, in the writer's voice, picking up the rhythm of the piece so far. realize just this beat ... don't race ahead to the next one. exactly one paragraph, then stop. output only the prose.",
  outline:
    "scaffold the piece into an outline of beats: a short ordered list, one beat per line, each a single plain line naming what happens or what's argued there (not drafted prose). 5 to 9 beats, in the writer's voice, no numbering, no headers, no preamble. output only the list, one beat per line.",
  coin: "coin a single line of verse in the writer's voice. read the poem so far below and fit it: match the line length / measure the other lines hold, and if the poem rhymes, end on a word that chimes with the line it should answer. the note (if any) says what the line should do. exactly one line, no line break, then stop. output only the line.",
};

export interface AuthorParts {
  task: AuthorTask;
  // the piece's title, for grounding ... empty string when untitled.
  title: string;
  // the seed the task acts on: the note to expand, the beat to draft, or the
  // premise for an outline. empty when the writer just wants an outline of the
  // piece so far.
  context: string;
  // the piece so far, as plain text (bounded by the route) ... grounds a beat in
  // what's already on the page, and is the source an outline scaffolds. empty on
  // a blank canvas.
  document?: string;
  // the writer's distilled voice ... the same compact line + exemplars the
  // partner/ghost/repurpose surfaces fill, so the author echoes their real
  // signature, not a generic one.
  voiceCompactView?: string;
  exemplars?: string[];
  // RESERVED for phase 4 (world bible + continuity). when present, the relevant
  // bible entries so a drafted beat never contradicts the established world.
  // empty for now ... the slot exists so the prompt structure is stable.
  bible?: string;
}

export function buildAuthorPrompt(parts: AuthorParts): { system: string; prompt: string } {
  const compact = parts.voiceCompactView?.trim()
    ? `the writer's voice: ${parts.voiceCompactView.trim()}`
    : "the writer's voice: not yet trained ... mirror the tone and rhythm of the writing below.";

  const exemplars =
    parts.exemplars && parts.exemplars.length > 0
      ? "lines in the writer's voice (echo this texture, never copy):\n" +
        parts.exemplars.map((e) => `- ${e}`).join("\n")
      : "lines in the writer's voice: none yet.";

  // the reserved bible slot ... phase 4 fills it; until then it's an honest
  // "nothing recorded", so the block order never changes when it goes live.
  const bible = parts.bible?.trim()
    ? `the world so far (stay consistent with this, never contradict it):\n${parts.bible.trim()}`
    : "the world so far: nothing recorded yet.";

  const system = [
    IDENTITY_AUTHOR,
    VOICE_RULES,
    compact,
    FORBIDDEN_PREAMBLE,
    exemplars,
    bible,
    AUTHOR_INSTRUCTION[parts.task],
  ].join("\n\n");

  const titleLine = parts.title.trim() ? `title: ${parts.title.trim()}\n\n` : "";
  const doc = parts.document?.trim();
  const docBlock = doc ? `the piece so far:\n${doc}\n\n` : "";

  // the seed line is labelled per task so nova knows what it's acting on. an
  // outline / coin with no seed leans on the doc block (the piece / poem so far).
  const seed = parts.context.trim();
  const seedLabel =
    parts.task === "outline"
      ? "the premise"
      : parts.task === "expand"
        ? "the note to expand"
        : parts.task === "coin"
          ? "what the line should do"
          : "the beat to draft";
  const seedBlock = seed
    ? `${seedLabel}: ${seed}`
    : parts.task === "outline"
      ? "scaffold the piece so far into its beats."
      : parts.task === "coin"
        ? "coin the next line that fits the poem so far."
        : "";

  const prompt = `${titleLine}${docBlock}${seedBlock}`.trim();
  return { system, prompt };
}
