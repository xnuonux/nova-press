/**
 * the x-ray ... nova reads a draft as an ARGUMENT and returns its load-bearing
 * structure, descriptive only. it names what each block IS (opening, thesis,
 * evidence, turn, payoff ...) and threads the promises a piece makes to where
 * they pay off. it is a MIRROR, never a verdict: no "weak", no score, no
 * ranking, no advice. the writer sees the shape and draws their own conclusions.
 *
 * the soul is defended in the parse, not just the prompt: thread labels are
 * DERIVED from the two endpoint roles (validated enum values), never taken from
 * the model's free text ... so the model can't smuggle "weak setup ... nowhere"
 * into a label. and every non-blank block gets a role (a neutral "passage" when
 * nothing sharper fits), so a block is never silently omitted ... an absent node
 * would itself read as a verdict.
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
  "passage",
] as const;

export type XrayRole = (typeof XRAY_ROLES)[number];

export interface XrayBlockRole {
  n: number;
  role: XrayRole;
}

export interface XrayThread {
  from: number;
  to: number;
  // a derived, neutral arc built from the two endpoint roles (never model text).
  label: string;
}

export interface XrayStructure {
  roles: XrayBlockRole[];
  threads: XrayThread[];
}

export const EMPTY_XRAY: XrayStructure = { roles: [], threads: [] };

const MAX_THREADS = 6;
const BLOCK_CHARS = 800;

function isRole(value: unknown): value is XrayRole {
  return typeof value === "string" && (XRAY_ROLES as readonly string[]).includes(value);
}

function inRange(value: unknown, count: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < count;
}

// the analyst prompt. nova reads numbered blocks and returns the argument's
// shape as strict json. DESCRIPTIVE ONLY is load-bearing: the moment this judges
// ("weak", "filler") it stops being a mirror and starts insulting the writer.
// threads carry no label ... the arc is derived from the endpoint roles, so the
// model has no free-text field to editorialize in.
export const XRAY_SYSTEM = [
  "you are nova's structure analyst. you read a draft as an ARGUMENT and return its load-bearing shape ... what each block IS, and which promises the piece makes pay off where.",
  "you DESCRIBE, you never judge. no quality words (no 'weak', 'strong', 'filler', 'unclear'), no ranking, no advice, no praise. you are a mirror that shows the writer the architecture they are standing in, never a verdict on it.",
  "the blocks are given numbered, like '[0] the actual text'. output STRICT JSON ONLY ... no prose, no markdown, no code fences ... exactly this shape:",
  '{"roles": [{"n": 0, "role": "opening"}], "threads": [{"from": 0, "to": 7}]}',
  "role is EXACTLY one of: opening, thesis, context, evidence, turn, development, aside, payoff, closing, passage.",
  [
    "- opening: the lede or hook that draws the reader in.",
    "- thesis: the central claim or argument the piece rests on.",
    "- context: background, framing, setup.",
    "- evidence: an example, data, anecdote, or illustration that supports a point.",
    "- turn: a pivot, counterpoint, complication, or 'but'.",
    "- development: extending or deepening a point already made.",
    "- aside: a deliberate digression or tangent.",
    "- payoff: where an earlier setup, question, or promise lands.",
    "- closing: the ending or resolution.",
    "- passage: a stretch of the piece that carries it forward when none of the sharper roles fit. use this freely; it is neutral, not a demotion.",
  ].join("\n"),
  "give EVERY numbered block exactly one role (its dominant one). never skip a numbered block ... if nothing sharper fits, it is a 'passage'. blank blocks are not numbered, so you will not see them.",
  "threads connect a promise to its payoff: a question to its answer, a setup to its landing, a claim to the evidence that carries it. return only {from, to} block numbers, no label. at most 6 threads, only the genuinely structural ones.",
  "lowercase everything. no em-dashes (use ...).",
].join("\n\n");

// number each block for the model and flatten its whitespace. blank blocks are
// dropped (they'd waste tokens and the writer never wants a node on an empty
// line) but the ORIGINAL index is kept, so the roles still map back to the live
// dom by position. long blocks are truncated ... structure lives up front.
export function buildXrayPrompt(blocks: string[]): string {
  return blocks
    .map((text, i) => ({
      i,
      t: String(text ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, BLOCK_CHARS),
    }))
    .filter((b) => b.t.length > 0)
    .map((b) => `[${b.i}] ${b.t}`)
    .join("\n");
}

// pull the structure json out of the model's reply, however it wrapped it, and
// harden it against the model: drop roles for out-of-range or duplicate blocks
// and unknown role names; keep only threads whose endpoints both got a role, and
// DERIVE each thread's label from those roles (never the model's text). a parse
// failure degrades to EMPTY_XRAY ... the x-ray must never throw.
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

    const roleByN = new Map(roles.map((r) => [r.n, r.role]));
    const threadSeen = new Set<string>();
    const threads: XrayThread[] = (Array.isArray(obj.threads) ? obj.threads : [])
      .map((t) => (t ?? {}) as Record<string, unknown>)
      .filter(
        (t) =>
          inRange(t.from, blockCount) &&
          inRange(t.to, blockCount) &&
          t.from !== t.to &&
          roleByN.has(t.from as number) &&
          roleByN.has(t.to as number),
      )
      .filter((t) => {
        const key = `${t.from as number}-${t.to as number}`;
        if (threadSeen.has(key)) return false;
        threadSeen.add(key);
        return true;
      })
      .map((t) => {
        const from = t.from as number;
        const to = t.to as number;
        const a = roleByN.get(from) ?? "passage";
        const b = roleByN.get(to) ?? "passage";
        return { from, to, label: `${a} ... ${b}` };
      })
      .slice(0, MAX_THREADS);

    return { roles, threads };
  } catch {
    return EMPTY_XRAY;
  }
}
