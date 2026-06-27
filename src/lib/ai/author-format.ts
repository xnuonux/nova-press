/**
 * pure text helpers for the ai author overlay ... no react/server imports (the
 * one dependency, the voice-keeper, is itself pure regex), so the accept-insert
 * logic is unit-tested directly and the component stays lean.
 */

import type { AuthorTask } from "./provider";
import { voiceKeeperAudit } from "./voice-keeper";

// strip a leading list marker the model may add despite the prompt ("- ", "* ",
// "1. ", "1) ") so an accepted outline lands as clean paragraphs.
export function stripMarker(line: string): string {
  return line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim();
}

// the beat the writer accepts, voice-kept and split into the lines that become
// paragraphs. an outline is one beat PER LINE, audited PER LINE: the keeper only
// lowercases the first char of each paragraph, and outline lines are single-
// newline separated, so auditing the whole blob would leave lines 2..N title-
// cased (the lowercase voice invariant must hold on every line). a beat is one
// paragraph, internal newlines folded to spaces. the ONE source of truth for
// both the preview and the insert, so what you see is exactly what tab weaves in.
export function auditedLines(task: AuthorTask, raw: string): string[] {
  if (task === "outline") {
    return raw
      .split(/\n+/)
      .map(stripMarker)
      .map((line) => voiceKeeperAudit(line).text)
      .filter((line) => line.length > 0);
  }
  const one = voiceKeeperAudit(raw)
    .text.replace(/\s*\n\s*/g, " ")
    .trim();
  return one ? [one] : [];
}
