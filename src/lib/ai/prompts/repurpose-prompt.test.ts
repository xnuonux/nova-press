import { describe, expect, it } from "vitest";

import {
  buildRepurposePrompt,
  isRepurposeFormat,
  REPURPOSE_FORMATS,
  type RepurposeFormat,
} from "./repurpose-prompt";

const FORMATS: RepurposeFormat[] = ["newsletter", "thread", "linkedin"];

describe("buildRepurposePrompt", () => {
  it("assembles the voice-mirror blocks in the mandated order", () => {
    const { system } = buildRepurposePrompt({
      format: "newsletter",
      title: "golden hour",
      source: "the light here is different.",
    });
    // blocks are joined by a blank line and none contain one internally, so
    // split gives the five blocks in order. assert by block, not by substring
    // index ... marker words like "recompile" / "the writer's voice" recur
    // across blocks and make index-hunting fragile.
    const blocks = system.split("\n\n").map((b) => b.toLowerCase());
    expect(blocks).toHaveLength(5);
    expect(blocks[0]).toContain("nova"); // identity
    expect(blocks[1]).toContain("lowercase"); // voice rules
    expect(blocks[2]).toContain("not yet trained"); // compact-view slot
    expect(blocks[3]).toContain("never start with"); // forbidden preamble
    expect(blocks[4]).toContain("recompile"); // format instruction
  });

  it("injects the writer's distilled voice into the compact slot when provided", () => {
    const { system } = buildRepurposePrompt({
      format: "newsletter",
      title: "t",
      source: "s",
      voiceCompactView: "register: wry. sentences run about 9 words",
    });
    const blocks = system.split("\n\n").map((b) => b.toLowerCase());
    expect(blocks[2]).toContain("the writer's voice: register: wry");
    expect(blocks[2]).not.toContain("not yet trained");
  });

  it.each(FORMATS)("carries the non-negotiable voice rules for %s", (format) => {
    const { system } = buildRepurposePrompt({ format, title: "t", source: "s" });
    const s = system.toLowerCase();
    expect(s).toContain("lowercase");
    expect(s).toContain("em-dash");
    expect(s).toContain("...");
  });

  it.each(FORMATS)("carries the forbidden-preamble list for %s", (format) => {
    const { system } = buildRepurposePrompt({ format, title: "t", source: "s" });
    const s = system.toLowerCase();
    expect(s).toContain("absolutely");
    expect(s).toContain("here's a");
  });

  it("gives the newsletter a subject-line instruction", () => {
    const { system } = buildRepurposePrompt({ format: "newsletter", title: "t", source: "s" });
    expect(system.toLowerCase()).toContain("subject");
  });

  it("gives the thread a post-count + character cap", () => {
    const { system } = buildRepurposePrompt({ format: "thread", title: "t", source: "s" });
    const s = system.toLowerCase();
    expect(s).toContain("thread");
    expect(s).toContain("280");
  });

  it("gives linkedin a hook-first instruction", () => {
    const { system } = buildRepurposePrompt({ format: "linkedin", title: "t", source: "s" });
    const s = system.toLowerCase();
    expect(s).toContain("linkedin");
    expect(s).toContain("hook");
  });

  it("puts the title + source into the user prompt", () => {
    const { prompt } = buildRepurposePrompt({
      format: "thread",
      title: "the room at golden hour",
      source: "she said the light here is different.",
    });
    expect(prompt).toContain("title: the room at golden hour");
    expect(prompt).toContain("the light here is different");
  });

  it("omits the title line when there is no title", () => {
    const { prompt } = buildRepurposePrompt({
      format: "thread",
      title: "  ",
      source: "body only.",
    });
    expect(prompt.startsWith("title:")).toBe(false);
    expect(prompt).toContain("body only.");
  });
});

describe("isRepurposeFormat", () => {
  it("accepts the known formats", () => {
    for (const format of Object.keys(REPURPOSE_FORMATS)) {
      expect(isRepurposeFormat(format)).toBe(true);
    }
  });

  it("rejects anything else", () => {
    expect(isRepurposeFormat("tiktok")).toBe(false);
    expect(isRepurposeFormat("")).toBe(false);
    expect(isRepurposeFormat(null)).toBe(false);
    expect(isRepurposeFormat(42)).toBe(false);
  });
});
