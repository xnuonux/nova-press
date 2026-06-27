// the continuity MODEL layer ... the harder reads a string pass can't do: a
// CONTRADICTION of an established bible fact ("the prose has marik speak, but the
// bible says he never has"), a TIMELINE slip. it mirrors the xray promotion: a
// pure prompt + a defensive parse here, the model call in continuity-analyze
// (server-only). it degrades to [] with no model / no key.
//
// like the x-ray it stays a MIRROR ... it states what it sees ("the prose says X,
// the bible says Y"), it never grades the writing. unlike the x-ray, a
// contradiction is a specific claim, so the message is the model's (a
// contradiction can't be derived from an enum); the parse bounds it + pins the
// kind to the two it's allowed to raise, and maps the model's piece index back to
// a real piece id so a flag can't point nowhere.

import type { ContinuityFinding } from "@/lib/continuity/types";

const MODEL_KINDS = ["contradiction", "timeline"] as const;
type ModelKind = (typeof MODEL_KINDS)[number];

const MAX_FLAGS = 12;
const MAX_MESSAGE = 280;
const BLOCK_CHARS = 1200;

function isModelKind(value: unknown): value is ModelKind {
  return typeof value === "string" && (MODEL_KINDS as readonly string[]).includes(value);
}

function inRange(value: unknown, count: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < count;
}

export const CONTINUITY_SYSTEM = [
  "you are nova's continuity reader. you read a work's prose AGAINST its world bible (the established truths) and surface where they disagree.",
  "you raise exactly two kinds of concern: a CONTRADICTION (the prose states or implies something that conflicts with an established bible fact) and a TIMELINE slip (events that can't sit in the order the prose puts them).",
  "you DESCRIBE the disagreement, you never judge the writing. say what the prose has and what the bible says, plainly ... 'the prose has X, the bible says Y'. no quality words, no advice, no praise. a mirror, never a verdict. the writer decides which is wrong (the prose, or the bible).",
  "the prose is given numbered by piece, like '[0] the actual text'. the bible is given as entity lines + their facts. output STRICT JSON ONLY ... no prose, no markdown, no code fences ... exactly this shape:",
  '{"flags": [{"kind": "contradiction", "piece": 0, "message": "the prose has marik speak, but the bible says he has never spoken a word."}]}',
  "kind is EXACTLY 'contradiction' or 'timeline'. piece is the number of the piece the concern is in. message is one lowercase sentence, no em-dashes (use ...).",
  "only raise a concern you can point to a specific established fact for. if the prose and the bible agree, or the bible says nothing about it, raise NOTHING ... an empty flags array is the right answer for a consistent work. never invent a fact the bible doesn't state.",
  "at most 12 flags. lowercase everything.",
].join("\n\n");

// number each piece for the model + flatten/trim its prose; the bible is handed
// in already composed (entities + facts). long pieces are truncated ... a
// contradiction shows up against the established facts, not in the tail.
export function buildContinuityPrompt(pieces: readonly { text: string }[], bible: string): string {
  const proseBlock = pieces
    .map((p, i) => ({
      i,
      t: String(p.text ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, BLOCK_CHARS),
    }))
    .map((b) => `[${b.i}] ${b.t}`)
    .join("\n");
  const bibleBlock = bible.trim() ? bible.trim() : "(the bible is empty)";
  return `the world bible (the established truths):\n${bibleBlock}\n\nthe prose, numbered by piece:\n${proseBlock}`;
}

/**
 * pull the continuity flags out of the model's reply, however it wrapped them,
 * and harden against the model: keep only the two allowed kinds, a piece index
 * that maps to a real piece (-> pieceId), and a non-blank bounded message. a
 * parse failure degrades to [] ... the model layer must never throw.
 */
export function parseContinuity(text: string, pieceIds: readonly string[]): ContinuityFinding[] {
  try {
    const cleaned = text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) return [];
    const obj = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    const flags = Array.isArray(obj.flags) ? obj.flags : [];

    const out: ContinuityFinding[] = [];
    for (const raw of flags) {
      const f = (raw ?? {}) as Record<string, unknown>;
      if (!isModelKind(f.kind)) continue;
      if (!inRange(f.piece, pieceIds.length)) continue;
      // the message is the model's free text (a contradiction can't be derived
      // from an enum like the x-ray's labels), so it is the ONE model-to-user
      // string on this path ... enforce the HARD no-em-dash invariant here, the
      // same per-chunk swap the ghost/author/repurpose streams do, BEFORE the
      // length bound so the expansion can't push past it.
      const message =
        typeof f.message === "string"
          ? f.message
              .replace(/\s+/g, " ")
              .replace(/\s*[—–]\s*/g, " ... ")
              .trim()
          : "";
      if (!message) continue;
      out.push({
        kind: f.kind,
        message: message.slice(0, MAX_MESSAGE),
        entityId: null,
        pieceId: pieceIds[f.piece] ?? null,
        scope: { source: "model" },
      });
      if (out.length >= MAX_FLAGS) break;
    }
    return out;
  } catch {
    return [];
  }
}
