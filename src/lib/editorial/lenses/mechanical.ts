// the mechanical lens ... the cheap, exact, deterministic sweep. no model, no
// voice, no judgment of craft: just the small mechanical slips a careful eye
// catches (double spaces, a straight quote the curler missed, a heading that
// skips a level, a link that points nowhere). every finding is a gentle note,
// scoped to its block. pure + unit-tested.

import { isSafeHref } from "@/components/reading/sanitize-href";
import type { Finding } from "@/types/editorial";

import { finding, nonCodeText, type LensInput } from "./core";

const LENS = "mechanical";

function headingLevel(type: string): number {
  if (type === "h1") return 1;
  if (type === "h2") return 2;
  if (type === "h3") return 3;
  return 0;
}

// walk a block's inline children for link nodes whose url is empty or unsafe
// (not http/https/mailto/tel) ... a link that points nowhere.
function hasBrokenLink(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  const n = node as { type?: unknown; url?: unknown; children?: unknown };
  if (n.type === "a") {
    const url = typeof n.url === "string" ? n.url.trim() : "";
    if (url === "" || !isSafeHref(url)) return true;
  }
  if (Array.isArray(n.children)) return n.children.some(hasBrokenLink);
  return false;
}

export function mechanicalLens(input: LensInput): Finding[] {
  const out: Finding[] = [];
  let prevHeading = 0;

  for (const block of input.blocks) {
    const { index, type, node } = block;
    // quotes + spacing are read over PROSE only ... a straight quote or aligned
    // spacing a writer typed inside `code` is deliberate (curling would break
    // it), so it is never a slip. the descriptive notes just mirror the fact.
    const prose = nonCodeText(node);

    if (/ {2,}/.test(prose)) {
      out.push(
        finding(LENS, "double spaces here ... two in a row.", "note", { blockIndex: index }),
      );
    }

    if (prose.includes('"')) {
      out.push(
        finding(
          LENS,
          "a straight quote slipped through here ... nova curls quotes as you type.",
          "note",
          { blockIndex: index },
        ),
      );
    }

    const level = headingLevel(type);
    if (level > 0) {
      if (prevHeading > 0 && level > prevHeading + 1) {
        out.push(
          finding(
            LENS,
            `this heading jumps from h${prevHeading} to h${level} ... a level was skipped.`,
            "note",
            { blockIndex: index },
          ),
        );
      }
      prevHeading = level;
    }

    if (hasBrokenLink(node)) {
      out.push(
        finding(LENS, "a link here points nowhere ... its address is empty or malformed.", "flag", {
          blockIndex: index,
        }),
      );
    }
  }

  return out;
}
