import { describe, expect, it } from "vitest";

import { buildContinuityPrompt, parseContinuity } from "./continuity-model";

const ids = ["pa", "pb"];

describe("parseContinuity", () => {
  it("pulls flags out and maps the piece index to a piece id", () => {
    const out = parseContinuity(
      '{"flags":[{"kind":"contradiction","piece":1,"message":"the prose has marik speak, but the bible says he never has."}]}',
      ids,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: "contradiction", pieceId: "pb", entityId: null });
    expect(out[0]!.scope).toEqual({ source: "model" });
  });

  it("survives code fences + surrounding prose", () => {
    const out = parseContinuity(
      'here you go:\n```json\n{"flags":[{"kind":"timeline","piece":0,"message":"the funeral is before the death."}]}\n```',
      ids,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: "timeline", pieceId: "pa" });
  });

  it("drops an unknown kind, an out-of-range piece, and a blank message", () => {
    const out = parseContinuity(
      JSON.stringify({
        flags: [
          { kind: "vibes", piece: 0, message: "bad" }, // unknown kind
          { kind: "contradiction", piece: 9, message: "out of range" }, // bad index
          { kind: "timeline", piece: 0, message: "   " }, // blank
          { kind: "contradiction", piece: 0, message: "a real one." }, // keep
        ],
      }),
      ids,
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.message).toBe("a real one.");
  });

  it("degrades to [] on garbage", () => {
    expect(parseContinuity("not json at all", ids)).toEqual([]);
    expect(parseContinuity("", ids)).toEqual([]);
    expect(parseContinuity("{}", ids)).toEqual([]);
  });

  it("strips em/en-dashes from the model message (the HARD voice invariant)", () => {
    const out = parseContinuity(
      JSON.stringify({
        flags: [
          {
            kind: "contradiction",
            piece: 0,
            message: "the prose has marik speak — the bible says he never has.",
          },
        ],
      }),
      ids,
    );
    expect(out[0]!.message).not.toMatch(/[—–]/);
    expect(out[0]!.message).toContain(" ... ");
  });

  it("bounds the message length", () => {
    const long = "x".repeat(1000);
    const out = parseContinuity(
      JSON.stringify({ flags: [{ kind: "contradiction", piece: 0, message: long }] }),
      ids,
    );
    expect(out[0]!.message.length).toBeLessThanOrEqual(280);
  });
});

describe("buildContinuityPrompt", () => {
  it("numbers the prose by piece and carries the bible facts", () => {
    const prompt = buildContinuityPrompt(
      [{ text: "marik spoke at last." }, { text: "the gate opened." }],
      "marik (character) ... the mute ferryman\n- he has never spoken a word.",
    );
    expect(prompt).toContain("[0] marik spoke at last.");
    expect(prompt).toContain("[1] the gate opened.");
    expect(prompt).toContain("he has never spoken a word.");
  });

  it("marks an empty bible honestly", () => {
    expect(buildContinuityPrompt([{ text: "hi" }], "")).toContain("(the bible is empty)");
  });
});
