import { describe, expect, it } from "vitest";

import { buildAuthorPrompt } from "./author-prompt";
import { FORBIDDEN_PREAMBLE, VOICE_RULES } from "./system-prompt";

describe("buildAuthorPrompt", () => {
  it("shares the one source of truth for the voice rules + forbidden preamble", () => {
    const { system } = buildAuthorPrompt({ task: "expand", title: "", context: "a note" });
    expect(system).toContain(VOICE_RULES);
    expect(system).toContain(FORBIDDEN_PREAMBLE);
  });

  it("opens with the author identity and closes with the task instruction", () => {
    const { system } = buildAuthorPrompt({ task: "expand", title: "", context: "a note" });
    expect(system.startsWith("you are nova, writing as the writer")).toBe(true);
    // the expand instruction is the final block.
    expect(system.trimEnd().endsWith("output only the prose.")).toBe(true);
  });

  it("reserves the bible slot: an honest empty when none is given", () => {
    const { system } = buildAuthorPrompt({ task: "draft-beat", title: "", context: "a beat" });
    expect(system).toContain("the world so far: nothing recorded yet.");
  });

  it("fills the reserved bible slot when phase 4 hands one in", () => {
    const { system } = buildAuthorPrompt({
      task: "draft-beat",
      title: "",
      context: "a beat",
      bible: "the ferryman is mute. the river runs north.",
    });
    expect(system).toContain("the world so far (stay consistent with this");
    expect(system).toContain("the ferryman is mute. the river runs north.");
    expect(system).not.toContain("nothing recorded yet");
  });

  it("threads the writer's voice + exemplars into the prompt slots", () => {
    const { system } = buildAuthorPrompt({
      task: "expand",
      title: "",
      context: "a note",
      voiceCompactView: "terse, dry, present tense",
      exemplars: ["the dock was empty.", "no one came."],
    });
    expect(system).toContain("the writer's voice: terse, dry, present tense");
    expect(system).toContain("- the dock was empty.");
  });

  it("falls back to an honest 'not yet trained' voice line when untrained", () => {
    const { system } = buildAuthorPrompt({ task: "expand", title: "", context: "a note" });
    expect(system).toContain("the writer's voice: not yet trained");
  });

  it("labels the seed per task in the user prompt", () => {
    expect(
      buildAuthorPrompt({ task: "expand", title: "", context: "the ferryman waited" }).prompt,
    ).toContain("the note to expand: the ferryman waited");
    expect(
      buildAuthorPrompt({ task: "draft-beat", title: "", context: "they cross the river" }).prompt,
    ).toContain("the beat to draft: they cross the river");
    expect(
      buildAuthorPrompt({ task: "outline", title: "", context: "a mute ferryman" }).prompt,
    ).toContain("the premise: a mute ferryman");
  });

  it("includes the title + the piece-so-far when present", () => {
    const { prompt } = buildAuthorPrompt({
      task: "draft-beat",
      title: "the seventh gate",
      context: "they cross",
      document: "the river remembered every name.",
    });
    expect(prompt).toContain("title: the seventh gate");
    expect(prompt).toContain("the piece so far:\nthe river remembered every name.");
    expect(prompt).toContain("the beat to draft: they cross");
  });

  it("lets an outline scaffold the piece so far with no premise", () => {
    const { prompt } = buildAuthorPrompt({
      task: "outline",
      title: "",
      context: "",
      document: "a first paragraph already on the page.",
    });
    expect(prompt).toContain("scaffold the piece so far into its beats.");
  });

  it("keeps every task's instruction output-only (no preamble leakage)", () => {
    for (const task of ["expand", "draft-beat", "outline"] as const) {
      const { system } = buildAuthorPrompt({ task, title: "", context: "x" });
      expect(system).toMatch(/output only the (prose|list)/);
    }
  });

  it("instructs coin to fit the poem's measure + rhyme, one line only", () => {
    const { system } = buildAuthorPrompt({ task: "coin", title: "", context: "" });
    expect(system).toContain("coin a single line of verse");
    expect(system).toContain("exactly one line");
    expect(system).toContain("output only the line");
  });

  it("labels the coin seed, and falls back to the poem so far when bare", () => {
    expect(
      buildAuthorPrompt({ task: "coin", title: "", context: "answer the line about the moon" })
        .prompt,
    ).toContain("what the line should do: answer the line about the moon");
    expect(
      buildAuthorPrompt({ task: "coin", title: "", context: "", document: "the first line here" })
        .prompt,
    ).toContain("coin the next line that fits the poem so far.");
  });
});
