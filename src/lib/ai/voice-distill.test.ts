import { describe, expect, it } from "vitest";

import { EMPTY_DISTILL, parseDistillation } from "./voice-distill";

describe("parseDistillation", () => {
  it("parses a clean json object", () => {
    const r = parseDistillation(
      JSON.stringify({
        register: "wry and direct",
        vocabulary_signature: "plain, concrete",
        opening_patterns: ["a short declarative"],
        closing_patterns: ["a turn"],
        idiosyncratic_phrases: ["here's the thing"],
        avoided_phrases: ["utilize"],
        formality_score: 0.3,
        summary: "short fragments, lots of white space",
        exemplars: ["the room waited.", "then it glowed."],
        confidence: 0.8,
      }),
    );
    expect(r.register).toBe("wry and direct");
    expect(r.summary).toContain("short fragments");
    expect(r.exemplars).toHaveLength(2);
    expect(r.confidence).toBe(0.8);
  });

  it("digs the json out of code fences and stray prose", () => {
    const r = parseDistillation(
      'here you go:\n```json\n{"register":"calm","confidence":0.5}\n```\nhope that helps',
    );
    expect(r.register).toBe("calm");
    expect(r.confidence).toBe(0.5);
  });

  it("clamps the formality + confidence scores to 0..1", () => {
    const r = parseDistillation('{"formality_score": 5, "confidence": -2}');
    expect(r.formality_score).toBe(1);
    expect(r.confidence).toBe(0);
  });

  it("caps the lists", () => {
    const r = parseDistillation(
      JSON.stringify({
        idiosyncratic_phrases: ["a", "b", "c", "d", "e", "f", "g"],
        exemplars: ["1", "2", "3", "4"],
      }),
    );
    expect(r.idiosyncratic_phrases).toHaveLength(6);
    expect(r.exemplars).toHaveLength(3);
  });

  it("drops non-string list items", () => {
    const r = parseDistillation('{"opening_patterns": ["ok", 42, null, "good"]}');
    expect(r.opening_patterns).toEqual(["ok", "good"]);
  });

  it("degrades to empty on garbage", () => {
    expect(parseDistillation("not json at all")).toEqual(EMPTY_DISTILL);
    expect(parseDistillation("")).toEqual(EMPTY_DISTILL);
  });
});
