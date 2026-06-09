import { describe, expect, it } from "vitest";

import { buildPartnerPrompt } from "./system-prompt";

describe("buildPartnerPrompt", () => {
  it("assembles the voice-mirror blocks in the mandated order", () => {
    const { system } = buildPartnerPrompt({
      command: "continue",
      context: "the page waited",
    });
    const iIdentity = system.indexOf("nova");
    const iRules = system.toLowerCase().indexOf("lowercase");
    const iCompact = system.toLowerCase().indexOf("voice");
    const iForbidden = system.toLowerCase().indexOf("never start with");
    const iCommand = system.toLowerCase().indexOf("one sentence");
    expect(iIdentity).toBeGreaterThanOrEqual(0);
    expect(iRules).toBeGreaterThan(iIdentity);
    expect(iForbidden).toBeGreaterThan(iRules);
    expect(iCommand).toBeGreaterThan(iForbidden);
    expect(iCompact).toBeGreaterThan(iIdentity);
  });

  it("carries the non-negotiable voice rules", () => {
    const { system } = buildPartnerPrompt({
      command: "respond",
      context: "x",
    });
    const s = system.toLowerCase();
    expect(s).toContain("lowercase");
    expect(s).toContain("em-dash");
    expect(s).toContain("...");
  });

  it("carries the forbidden-preamble list", () => {
    const { system } = buildPartnerPrompt({
      command: "respond",
      context: "x",
    });
    const s = system.toLowerCase();
    expect(s).toContain("great");
    expect(s).toContain("absolutely");
    expect(s).toContain("here's a");
    expect(s).toContain("i'd be happy to");
  });

  it("includes the one-sentence instruction for /continue", () => {
    const { system } = buildPartnerPrompt({
      command: "continue",
      context: "x",
    });
    expect(system.toLowerCase()).toContain("one sentence");
  });

  it("always injects the compact-view slot, even when empty (untrained)", () => {
    const { system } = buildPartnerPrompt({
      command: "continue",
      context: "x",
    });
    // the structural invariant: the voice slot is present regardless
    expect(system.toLowerCase()).toContain("voice");
  });

  it("injects the compact view + exemplars when provided", () => {
    const { system } = buildPartnerPrompt({
      command: "continue",
      context: "x",
      voiceCompactView: "short sentences, lots of commas, no exclamation marks",
      exemplars: ["the comma you keep that the rule says to cut."],
    });
    expect(system).toContain("short sentences, lots of commas");
    expect(system).toContain("the comma you keep");
  });

  it("puts the writer's context into the user prompt", () => {
    const { prompt } = buildPartnerPrompt({
      command: "continue",
      context: "the page waited, patiently",
    });
    expect(prompt).toContain("the page waited, patiently");
  });
});
