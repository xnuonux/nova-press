import { describe, expect, it } from "vitest";

import { normalizeVoiceDelta } from "@/lib/voices/delta";

import { buildVoiceProposePrompt, parseVoiceProposal } from "./propose-voice";

describe("buildVoiceProposePrompt", () => {
  it("carries the name + the description, flattened", () => {
    const p = buildVoiceProposePrompt("  the detective ", "gruff\nand\ntired");
    expect(p).toContain("the voice's name: the detective");
    expect(p).toContain("gruff and tired");
  });

  it("degrades gently with no name / no description", () => {
    const p = buildVoiceProposePrompt("", "");
    expect(p).toContain("(unnamed)");
    expect(p).toContain("(no description given)");
  });
});

describe("parseVoiceProposal", () => {
  it("pulls a fenced json overlay into a draft", () => {
    const draft = parseVoiceProposal(
      '```json\n{"register":"clipped, hard-boiled","summary":"world-weary, talks in questions","idiosyncraticPhrases":["see, kid"],"sentenceLengthTarget":7,"formalityTarget":0.2}\n```',
    );
    expect(draft.register).toBe("clipped, hard-boiled");
    expect(draft.summary).toBe("world-weary, talks in questions");
    expect(draft.idiosyncraticPhrases).toEqual(["see, kid"]);
    expect(draft.sentenceLengthTarget).toBe(7);
    expect(draft.formalityTarget).toBe(0.2);
  });

  it("strips em-dashes from the model strings (the hard invariant)", () => {
    const draft = parseVoiceProposal('{"summary":"terse — clipped — cold","register":"noir—ish"}');
    expect(draft.summary).not.toMatch(/[—–]/);
    expect(draft.register).not.toMatch(/[—–]/);
    expect(draft.summary).toContain("...");
  });

  it("degrades to {} on non-json", () => {
    expect(parseVoiceProposal("i can't do that")).toEqual({});
    expect(parseVoiceProposal("")).toEqual({});
  });

  it("the parsed draft survives normalizeVoiceDelta with the writer's name", () => {
    const draft = parseVoiceProposal('{"register":"gruff","sentenceLengthTarget":9999}');
    const r = normalizeVoiceDelta({ ...draft, name: "the captain" });
    expect(r.ok).toBe(true);
    expect(r.delta!.name).toBe("the captain");
    expect(r.delta!.register).toBe("gruff");
    expect(r.delta!.sentenceLengthTarget).toBe(80); // clamped by normalize
  });
});
