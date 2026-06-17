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

  it("folds recent history into the user prompt, labeling nova's own lines", () => {
    const { prompt } = buildPartnerPrompt({
      command: "respond",
      context: "now what",
      history: [
        { role: "writer", text: "the page is blank" },
        { role: "nova", text: "stare until it stares back." },
      ],
    });
    expect(prompt).toContain("the writer: the page is blank");
    expect(prompt).toContain("you (nova): stare until it stares back.");
    // the current line is the last thing nova sees, labeled as the writer's.
    expect(prompt).toContain("the writer: now what");
    expect(prompt.indexOf("now what")).toBeGreaterThan(prompt.indexOf("the page is blank"));
  });

  it("ignores empty history, leaving the raw context (one-shot behavior)", () => {
    const { prompt } = buildPartnerPrompt({
      command: "respond",
      context: "just this line",
      history: [],
    });
    expect(prompt).toBe("just this line");
  });

  it("folds the working draft into the user prompt, before the current line", () => {
    const { prompt } = buildPartnerPrompt({
      command: "respond",
      context: "is the opening too slow",
      document: "the room at golden hour. she said the light was different.",
    });
    expect(prompt).toContain("the piece the writer is working on:");
    expect(prompt).toContain("she said the light was different");
    expect(prompt).toContain("the writer: is the opening too slow");
    expect(prompt.indexOf("golden hour")).toBeLessThan(prompt.indexOf("is the opening too slow"));
  });

  it("orders draft, then history, then the current line", () => {
    const { prompt } = buildPartnerPrompt({
      command: "respond",
      context: "now what",
      document: "a short draft.",
      history: [{ role: "writer", text: "earlier line" }],
    });
    expect(prompt.indexOf("a short draft")).toBeLessThan(prompt.indexOf("earlier line"));
    expect(prompt.indexOf("earlier line")).toBeLessThan(prompt.indexOf("the writer: now what"));
  });
});
