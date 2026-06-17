import { describe, expect, it } from "vitest";

import { threadBusy, threadReducer, type PartnerMessage } from "./partner-thread";

const ask = (writerId: string, novaId: string, text: string) =>
  ({ type: "ask", writerId, novaId, text }) as const;

describe("threadReducer", () => {
  it("ask appends a writer line and an open nova turn", () => {
    const next = threadReducer([], ask("w1", "n1", "hand you a line"));
    expect(next).toHaveLength(2);
    expect(next[0]).toEqual({ id: "w1", role: "writer", text: "hand you a line" });
    expect(next[1]).toEqual({ id: "n1", role: "nova", text: "", streaming: true });
  });

  it("ask preserves prior history (a real thread, not a single reply)", () => {
    let state: PartnerMessage[] = [];
    state = threadReducer(state, ask("w1", "n1", "first"));
    state = threadReducer(state, { type: "settle", id: "n1", text: "a riposte.", drift: false });
    state = threadReducer(state, ask("w2", "n2", "second"));
    expect(state.map((m) => m.id)).toEqual(["w1", "n1", "w2", "n2"]);
    expect(state[1]).toMatchObject({ text: "a riposte." });
  });

  it("stream replaces the open nova turn's text", () => {
    let state = threadReducer([], ask("w1", "n1", "go"));
    state = threadReducer(state, { type: "stream", id: "n1", text: "the room" });
    state = threadReducer(state, { type: "stream", id: "n1", text: "the room glows" });
    expect(state[1]).toMatchObject({ text: "the room glows", streaming: true });
  });

  it("stream is ignored once a turn has settled", () => {
    let state = threadReducer([], ask("w1", "n1", "go"));
    state = threadReducer(state, { type: "settle", id: "n1", text: "final.", drift: false });
    state = threadReducer(state, { type: "stream", id: "n1", text: "late clobber" });
    expect(state[1]).toMatchObject({ text: "final.", streaming: false });
  });

  it("stream on an unknown id is a no-op", () => {
    const state = threadReducer([], ask("w1", "n1", "go"));
    const next = threadReducer(state, { type: "stream", id: "nope", text: "x" });
    expect(next).toEqual(state);
  });

  it("settle finalizes the text, clears streaming, sets drift", () => {
    let state = threadReducer([], ask("w1", "n1", "go"));
    state = threadReducer(state, { type: "settle", id: "n1", text: "one line.", drift: true });
    expect(state[1]).toMatchObject({ text: "one line.", streaming: false, drift: true });
  });

  it("fail clears streaming and flags the turn", () => {
    let state = threadReducer([], ask("w1", "n1", "go"));
    state = threadReducer(state, { type: "fail", id: "n1" });
    expect(state[1]).toMatchObject({ streaming: false, failed: true });
  });
});

describe("threadBusy", () => {
  it("is true while a nova turn is open and false once it settles", () => {
    let state = threadReducer([], ask("w1", "n1", "go"));
    expect(threadBusy(state)).toBe(true);
    state = threadReducer(state, { type: "settle", id: "n1", text: "done.", drift: false });
    expect(threadBusy(state)).toBe(false);
  });

  it("is false after a failed turn too", () => {
    let state = threadReducer([], ask("w1", "n1", "go"));
    state = threadReducer(state, { type: "fail", id: "n1" });
    expect(threadBusy(state)).toBe(false);
  });
});
