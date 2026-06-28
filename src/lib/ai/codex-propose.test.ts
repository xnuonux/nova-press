import { describe, expect, it } from "vitest";

import { buildProposePrompt, parseProposal } from "./codex-propose";

describe("parseProposal", () => {
  it("pulls a kind + summary out of clean json", () => {
    const out = parseProposal('{"kind":"character","summary":"the mute ferryman of the gate"}');
    expect(out).toEqual({ kind: "character", summary: "the mute ferryman of the gate" });
  });

  it("survives code fences + surrounding prose", () => {
    const out = parseProposal('here:\n```json\n{"kind":"place","summary":"the seventh gate"}\n```');
    expect(out).toEqual({ kind: "place", summary: "the seventh gate" });
  });

  it("drops an unknown kind but keeps a valid summary", () => {
    const out = parseProposal('{"kind":"wizard","summary":"a hedge sorcerer"}');
    expect(out.kind).toBeUndefined();
    expect(out.summary).toBe("a hedge sorcerer");
  });

  it("strips em/en-dashes from the summary (the HARD voice invariant)", () => {
    const out = parseProposal(
      '{"kind":"character","summary":"sable the witch — feared at the gate"}',
    );
    expect(out.summary).not.toMatch(/[—–]/);
    expect(out.summary).toContain(" ... ");
  });

  it("bounds the summary length", () => {
    const out = parseProposal(JSON.stringify({ kind: "lore", summary: "x".repeat(1000) }));
    expect(out.summary!.length).toBeLessThanOrEqual(200);
  });

  it("degrades to {} on garbage", () => {
    expect(parseProposal("not json")).toEqual({});
    expect(parseProposal("")).toEqual({});
    expect(parseProposal("{}")).toEqual({});
  });
});

describe("buildProposePrompt", () => {
  it("carries the name and the prose", () => {
    const prompt = buildProposePrompt("Sable", "Sable crossed the water at dusk.");
    expect(prompt).toContain("Sable");
    expect(prompt).toContain("Sable crossed the water");
  });

  it("marks empty prose honestly", () => {
    expect(buildProposePrompt("Sable", "")).toContain("(no prose given)");
  });

  it("windows the prose around the name when it recurs past the head of a long work", () => {
    // the name appears only ~5000 chars in ... a head-only slice (4000) would miss
    // it, pushing the model to invent. the window must include it.
    const filler = "the river ran on and on. ".repeat(250); // ~6000 chars, no name
    const prompt = buildProposePrompt("Sable", `${filler} then Sable appeared at the ford.`);
    expect(prompt).toContain("Sable appeared at the ford");
  });
});
