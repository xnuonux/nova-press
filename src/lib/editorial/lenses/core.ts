// nova press · the mythos · the lens layer core.
//
// the unifying abstraction of the editorial brain: a Lens reads a piece (its
// blocks, the writer's voice baseline, an optional model-produced x-ray) and
// returns Finding[] ... descriptive-first, lowercase, scoped, triable. form
// constraints, the x-ray, voice-drift, the mechanical sweep are all the same
// shape. deterministic lenses are the spine (exact + free + unit-testable like
// voice-stats); model lenses degrade to [] and inject their parse here.
//
// pure (no server / db / ai-call): the input is resolved by the caller (the
// route / the db layer in 2.3), so the lenses stay unit-tested.

import type { Value } from "platejs";

import type { VoiceStats } from "@/lib/ai/voice-stats";
import type { Finding, FindingScope, FindingSeverity } from "@/types/editorial";
import type { XrayStructure } from "@/lib/ai/xray";

/** one top-level block of a piece, flattened for the deterministic lenses. */
export interface BlockText {
  index: number;
  /** the plate block type ('p', 'h1', 'blockquote', 'ul_li', ...). */
  type: string;
  /** the block's plain text (inline marks + links flattened away). */
  text: string;
  /** the raw plate node, for inline inspection (links live in its children). */
  node: unknown;
}

/** everything a lens may read. each lens uses the subset it needs and returns
 *  [] when a needed input is absent (a missing voice baseline, no x-ray). */
export interface LensInput {
  blocks: BlockText[];
  /** the writer's resolved voice stats (voice_profiles), for the voice lenses. */
  voiceBaseline?: VoiceStats | null;
  /** the model's structure read, produced upstream (server) + injected here. */
  xray?: XrayStructure | null;
}

/** the one shape. a lens is a pure function from the resolved input to findings. */
export type Lens = (input: LensInput) => Finding[];

/** build a finding in the canonical shape (status defaults to open). messages
 *  must already be lowercase + in nova's voice ... the lens is the voice-keeper. */
export function finding(
  lens: string,
  message: string,
  severity: FindingSeverity,
  scope: FindingScope = {},
): Finding {
  return { lens, message, severity, scope, status: "open" };
}

// pull a single plate node's plain text (inline marks + nested children
// flattened). total over garbage so a malformed node never throws a lens.
// deliberately a local copy of plate-text.ts's (unexported) nodeText: the pure
// lens spine must not import out of src/components/editor, so the few lines are
// duplicated rather than inverting the lib -> components layer boundary.
function nodeText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const text = (node as { text?: unknown }).text;
  if (typeof text === "string") return text;
  const children = (node as { children?: unknown }).children;
  if (Array.isArray(children)) return children.map(nodeText).join("");
  return "";
}

// a node's text with inline-`code` runs dropped. the mechanical lens reads
// quotes + spacing over prose only, so a straight quote a writer typed inside
// code (where curling it would break the code) is never read as a slip.
export function nonCodeText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as { text?: unknown; code?: unknown; children?: unknown };
  if (typeof n.text === "string") return n.code === true ? "" : n.text;
  if (Array.isArray(n.children)) return n.children.map(nonCodeText).join("");
  return "";
}

/** flatten a plate Value into the per-block shape the deterministic lenses read.
 *  a non-array degrades to no blocks (a lens then finds nothing, never throws). */
export function deriveBlocks(value: Value): BlockText[] {
  if (!Array.isArray(value)) return [];
  return value.map((node, index) => {
    const type =
      typeof (node as { type?: unknown })?.type === "string"
        ? ((node as { type?: string }).type as string)
        : "p";
    return { index, type, text: nodeText(node), node };
  });
}

/** the whole piece's plain text, blocks joined by blank lines (so the voice
 *  stats see paragraph breaks the same way extraction does). */
export function blocksToText(blocks: readonly BlockText[]): string {
  return blocks.map((b) => b.text).join("\n\n");
}
