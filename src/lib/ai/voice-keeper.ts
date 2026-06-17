/**
 * the voice-keeper audit ... the last gate before an AI completion reaches
 * the writer. deterministically fixes what it can (strip a leading
 * preamble clause, em/en-dash -> ..., lowercase the first char of each
 * paragraph) and reports whether a retry-worthy rule was broken (a
 * preamble was present, or more than one sentence came back when one was
 * asked for). pure, so it's fully unit-tested.
 */

import { sentenceCut } from "./ghost-format";

// conversational openers nova must never lead with. if the text starts with
// one, the whole leading clause (up to its first sentence break) is cut.
const OPENER =
  /^(great|sure|absolutely|certainly|of course|here'?s|i'?d be happy to|i can|happy to|let me)\b/i;

export interface AuditOptions {
  oneSentence?: boolean;
}

export interface AuditResult {
  text: string;
  violated: boolean;
}

export function voiceKeeperAudit(input: string, options: AuditOptions = {}): AuditResult {
  let text = input.trim();
  let violated = false;

  // 1. strip a leading preamble clause (up to the first sentence break).
  if (OPENER.test(text)) {
    const breakMatch = text.match(/^.*?(\.\.\.|[.!?:])\s+/);
    if (breakMatch) {
      text = text.slice(breakMatch[0].length).trim();
      violated = true;
    }
  }

  // 2. em/en-dash -> ... (silent auto-fix, not a violation).
  text = text.replace(/\s*[—–]\s*/g, " ... ");

  // 3. lowercase the first character of each paragraph (silent auto-fix).
  text = text
    .split(/(\n{2,})/)
    .map((part) => (part.startsWith("\n") ? part : lowercaseFirstChar(part)))
    .join("");

  // 4. one-sentence commands: cut to the first finished sentence, keeping its
  //    terminal mark and respecting "..." pauses (the shared, tested cutter).
  //    this is what actually enforces "one sentence" ... the provider stop
  //    sequence is only a cheap early-out, and the old count-only check left a
  //    multi-sentence reply truncated by the stop without its period. real text
  //    after the cut means the model overran, which is a retry-worthy drift.
  if (options.oneSentence) {
    const cut = sentenceCut(text);
    if (cut >= 0) {
      if (text.slice(cut).trim().length > 0) violated = true;
      text = text.slice(0, cut);
    }
  }

  return { text: text.trim(), violated };
}

// lowercase the leading letter unless it's a standalone "I" or an acronym
// (AI, API) ... best-effort proper-noun protection.
function lowercaseFirstChar(segment: string): string {
  const m = segment.match(/^(\s*)([A-Za-z]+)/);
  if (!m) return segment;
  const lead = m[1] ?? "";
  const word = m[2] ?? "";
  if (word === "I") return segment;
  if (word.length > 1 && word === word.toUpperCase()) return segment;
  const idx = lead.length;
  const ch = segment[idx];
  if (!ch) return segment;
  return segment.slice(0, idx) + ch.toLowerCase() + segment.slice(idx + 1);
}
