/**
 * the x-ray ... nova reads a draft as an ARGUMENT and returns its load-bearing
 * structure, descriptive only. it names what each block IS (opening, thesis,
 * evidence, turn, payoff ...) and threads the promises a piece makes to where
 * they pay off. it is a MIRROR, never a verdict: no "weak", no score, no
 * ranking, no advice. the writer sees the shape and draws their own conclusions.
 *
 * kept pure (the prompt + the defensive parse) so the fiddly part ... pulling
 * strict json out of whatever the model actually returned ... is unit-tested.
 * the model call lives in xray-analyze (server-only).
 */

export const XRAY_ROLES = [
  "opening",
  "thesis",
  "context",
  "evidence",
  "turn",
  "development",
  "aside",
  "payoff",
  "closing",
] as const;

export type XrayRole = (typeof XRAY_ROLES)[number];

export interface XrayBlockRole {
  n: number;
  role: XrayRole;
}

export interface XrayThread {
  from: number;
  to: number;
  label: string;
}

export interface XrayStructure {
  roles: XrayBlockRole[];
  threads: XrayThread[];
}

export const EMPTY_XRAY: XrayStructure = { roles: [], threads: [] };

const MAX_THREADS = 6;
const MAX_LABEL = 40;
const BLOCK_CHARS = 600;

function isRole(value: unknown): value is XrayRole {
  return typeof value === "string" && (XRAY_ROLES as readonly string[]).includes(value);
}

function inRange(value: unknown, count: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < count;
}

// the analyst prompt. nova reads numbered blocks and returns the argument's
// shape as strict json. DESCRIPTIVE ONLY is load-bearing: the moment this judges
// ("weak", "filler") it stops being a mirror and starts insulting the writer.
export const XRAY_SYSTEM = [
  "you are nova's structure analyst. you read a draft as an ARGUMENT and return its load-bearing shape ... what each block IS, and which promises the piece makes pay off where.",
  "you DESCRIBE, you never judge. no quality words (no 'weak', 'strong', 'filler', 'unclear'), no ranking, no advice, no praise. you are a mirror that shows the writer the architecture they are standing in, never a verdict on it.",
  "the blocks are given numbered, like '[0] the actual text'. output STRICT JSON ONLY ... no prose, no markdown, no code fences ... exactly this shape:",
  '{"roles": [{"n": 0, "role": "opening"}], "threads": [{"from": 0, "to": 7, "label": "question ... answer"}]}',
  "role is EXACTLY one of: opening, thesis, context, evidence, turn, development, aside, payoff, closing.",
  [
    "- opening: the lede or hook that draws the reader in.",
    "- thesis: the central claim or argument the piece rests on.",
    "- context: background, framing, setup.",
    "- evidence: an example, data, anecdote, or illustration that supports a point.",
    "- turn: a pivot, counterpoint, complication, or 'but'.",
    "- development: extending or deepening a point already made.",
    "- aside: a digression or tangent.",
    "- payoff: where an earlier setup, question, or promise lands.",
    "- closing: the ending or resolution.",
  ].join("\n"),
  "give every substantive block exactly one role (its dominant one). skip blocks that are blank or have no structural role.",
  "threads connect a promise to its payoff: a question to its answer, a setup to its landing, a claim to the evidence that carries it. label each with a SHORT descriptive arc, 2-4 words, lowercase, like 'question ... answer', 'setup ... payoff', 'claim ... evidence'. at most 6 threads, only the genuinely structural ones.",
  "lowercase everything. no em-dashes (use ...).",
].join("\n\n");

// number each block for the model and flatten its whitespace. long blocks are
// truncated ... structure lives in the opening sentences, not the 9th.
export function buildXrayPrompt(blocks: string[]): string {
  return blocks
    .map(
      (text, i) =>
        `[${i}] ${String(text ?? "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, BLOCK_CHARS)}`,
    )
    .join("\n");
}

// pull the structure json out of the model's reply, however it wrapped it, and
// harden it against the model: drop roles for out-of-range or duplicate blocks
// and unknown role names, drop self/out-of-range threads, cap thread count. a
// parse failure degrades to EMPTY_XRAY ... the x-ray must never throw.
export function parseXray(text: string, blockCount: number): XrayStructure {
  try {
    const cleaned = text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) return EMPTY_XRAY;
    const obj = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;

    const seen = new Set<number>();
    const roles: XrayBlockRole[] = (Array.isArray(obj.roles) ? obj.roles : [])
      .map((r) => (r ?? {}) as Record<string, unknown>)
      .filter((r) => inRange(r.n, blockCount) && isRole(r.role))
      .filter((r) => {
        const n = r.n as number;
        if (seen.has(n)) return false;
        seen.add(n);
        return true;
      })
      .map((r) => ({ n: r.n as number, role: r.role as XrayRole }));

    const threads: XrayThread[] = (Array.isArray(obj.threads) ? obj.threads : [])
      .map((t) => (t ?? {}) as Record<string, unknown>)
      .filter((t) => inRange(t.from, blockCount) && inRange(t.to, blockCount) && t.from !== t.to)
      .map((t) => ({
        from: t.from as number,
        to: t.to as number,
        label: typeof t.label === "string" ? t.label.trim().slice(0, MAX_LABEL) : "",
      }))
      .slice(0, MAX_THREADS);

    return { roles, threads };
  } catch {
    return EMPTY_XRAY;
  }
}
