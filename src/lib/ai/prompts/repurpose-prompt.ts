/**
 * repurpose prompts ... one finished piece, recompiled into other shapes
 * without losing the writer's voice. same soul, new format.
 *
 * follows the same voice-mirror block order the partner does: identity ->
 * voice rules -> compact voice view (empty slot until the corpus slice) ->
 * forbidden preamble -> format instruction. the voice rules + preamble list
 * are imported from system-prompt so there is one source of truth.
 */

import { FORBIDDEN_PREAMBLE, VOICE_RULES } from "./system-prompt";

export type RepurposeFormat = "newsletter" | "thread" | "linkedin";

export interface RepurposeFormatSpec {
  key: RepurposeFormat;
  label: string;
  blurb: string;
  temperature: number;
  maxTokens: number;
  instruction: string;
}

export const REPURPOSE_FORMATS: Record<RepurposeFormat, RepurposeFormatSpec> = {
  newsletter: {
    key: "newsletter",
    label: "newsletter",
    blurb: "an email to your subscribers",
    temperature: 0.6,
    maxTokens: 700,
    instruction:
      "recompile this piece as an email newsletter to the writer's subscribers. first line is a subject line, prefixed exactly with 'subject: '. then a short intro that earns the open, the heart of the piece in tight scannable paragraphs, and a human sign-off. no 'hope this finds you well', no corporate newsletter cringe. keep every line in the writer's voice. output only the newsletter.",
  },
  thread: {
    key: "thread",
    label: "x thread",
    blurb: "a thread for x / twitter",
    temperature: 0.65,
    maxTokens: 600,
    instruction:
      "recompile this piece as a thread for x (twitter). 5 to 8 posts. the first post is a hook that stops the scroll and makes a promise the thread keeps. number each post like '1/'. each post stands alone, stays under 280 characters, no hashtag spam (one at most, usually none). the last post lands the point and invites a reply. keep the writer's voice. output only the thread, posts separated by a blank line.",
  },
  linkedin: {
    key: "linkedin",
    label: "linkedin",
    blurb: "a post for linkedin",
    temperature: 0.6,
    maxTokens: 500,
    instruction:
      "recompile this piece as a linkedin post. a one-line hook first, then short punchy paragraphs with breathing room, one real insight the reader can actually use, and a soft invitation to discuss at the end. confident and human, never thought-leader cringe, no buzzwords, no 'i'm humbled to announce'. keep the writer's voice. output only the post.",
  },
};

const IDENTITY_REPURPOSE =
  "you are nova, the writer's repurpose engine. you recompile one finished piece into other formats without losing the writer's voice ... same soul, new shape. you never blandify it, never corporate-ify it, never add a claim the writer didn't make.";

export function isRepurposeFormat(value: unknown): value is RepurposeFormat {
  return (
    typeof value === "string" && Object.prototype.hasOwnProperty.call(REPURPOSE_FORMATS, value)
  );
}

export interface RepurposeParts {
  format: RepurposeFormat;
  title: string;
  source: string;
  // the writer's distilled voice ... when present, the recompile mirrors their
  // actual signature, not just the source piece's in-context tone.
  voiceCompactView?: string;
}

export function buildRepurposePrompt(parts: RepurposeParts): {
  system: string;
  prompt: string;
} {
  const spec = REPURPOSE_FORMATS[parts.format];
  const compact = parts.voiceCompactView?.trim()
    ? `the writer's voice: ${parts.voiceCompactView.trim()}`
    : "the writer's voice: not yet trained ... mirror the tone and rhythm of the source piece below.";

  const system = [
    IDENTITY_REPURPOSE,
    VOICE_RULES,
    compact,
    FORBIDDEN_PREAMBLE,
    spec.instruction,
  ].join("\n\n");

  const titleLine = parts.title.trim() ? `title: ${parts.title.trim()}\n\n` : "";
  const prompt = `${titleLine}${parts.source.trim()}`;

  return { system, prompt };
}
