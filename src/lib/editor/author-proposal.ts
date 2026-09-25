import type { Draft } from "./manuscript-desk";

export type ProposalTask = "expand" | "draft-beat" | "outline" | "coin";
export type ProposalState = "streaming" | "ready" | "stale" | "blocked" | "consumed" | "dismissed";
export const MAX_AUTHOR_STREAM_CHARS = 32_768;
export function isProposalTask(value: unknown): value is ProposalTask {
  return value === "expand" || value === "draft-beat" || value === "outline" || value === "coin";
}

/** local proposal custody ... exact source, explicit acceptance, single consumption. */
export function createAuthorProposal(base: Draft, task: ProposalTask, blockIndex: number) {
  if (!isProposalTask(task) || !Number.isSafeInteger(blockIndex) || blockIndex < 0 || blockIndex >= base.body.length) {
    throw new Error("the proposal needs a valid task and source block");
  }
  let state: ProposalState = "streaming";
  let lines: readonly string[] = Object.freeze([]);
  const observe = (live: Draft): ProposalState => {
    if ((state === "streaming" || state === "ready") && live.source !== base.source) state = "stale";
    return state;
  };
  return {
    state: () => state,
    observe,
    finish(offered: readonly string[], live: Draft): ProposalState {
      if (state !== "streaming" && state !== "stale") return state;
      observe(live);
      if (!Array.isArray(offered) || offered.length === 0 || offered.length > 32 ||
        (task !== "outline" && offered.length !== 1) ||
        !offered.every((line) => typeof line === "string" && line.trim().length > 0) ||
        offered.reduce((count, line) => count + line.length, 0) > MAX_AUTHOR_STREAM_CHARS) {
        state = "blocked";
        return state;
      }
      lines = Object.freeze([...offered]);
      if (state === "streaming") state = "ready";
      return state;
    },
    take(live: Draft) {
      observe(live);
      if (state !== "ready") return { ok: false as const, reason: state };
      // consume before the caller invokes a transform. even a thrown transform
      // must not cause an automatic retry or a second insertion.
      state = "consumed";
      return { ok: true as const, at: blockIndex + 1, nodes: lines.map((text) => ({
        type: task === "coin" ? "verse_line" : "p", children: [{ text }],
      })) };
    },
    block() { if (state !== "consumed" && state !== "dismissed") state = "blocked"; },
    dismiss() { if (state !== "consumed") state = "dismissed"; },
  };
}
