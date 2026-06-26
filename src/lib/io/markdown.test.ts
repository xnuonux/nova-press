// nova press · the mythos · the markdown <-> slate spine, pinned.
//
// this is the proof that Slate JSON is the single source of truth: markdown
// deserializes into the right block vocabulary, serializes back, and the
// load-bearing content (headings, marks, links) survives the round-trip.

import { describe, it, expect } from "vitest";

import { plateText } from "@/components/editor/plate-text";

import { markdownToSlate, slateToMarkdown } from "./markdown";

const typesOf = (value: ReturnType<typeof markdownToSlate>): string[] =>
  value.map((n) => (n as { type?: string }).type ?? "");

describe("markdownToSlate deserializes markdown into a plate value", () => {
  it("maps headings and paragraphs to the right block types", () => {
    const value = markdownToSlate("# Title\n\na paragraph here\n");
    expect(Array.isArray(value)).toBe(true);
    expect(typesOf(value)).toContain("h1");
    expect(typesOf(value)).toContain("p");
    expect(plateText(value)).toContain("Title");
    expect(plateText(value)).toContain("a paragraph here");
  });

  it("an empty input degrades to a recoverable empty doc, never throwing", () => {
    const value = markdownToSlate("");
    expect(value.length).toBeGreaterThan(0);
    expect(plateText(value).trim()).toBe("");
  });
});

describe("slateToMarkdown serializes a plate value back to markdown", () => {
  it("emits the heading + body text", () => {
    const md = slateToMarkdown(markdownToSlate("# Hello\n\nworld\n"));
    expect(md).toContain("# Hello");
    expect(md).toContain("world");
  });
});

describe("the round-trip preserves the load-bearing content", () => {
  it("headings, bold, and links all survive markdown -> slate -> markdown", () => {
    const md = "## A heading\n\nsome **strong** words and a [link](https://example.com).\n";
    const out = slateToMarkdown(markdownToSlate(md));
    expect(out).toContain("## A heading");
    expect(out).toContain("**strong**");
    expect(out).toContain("https://example.com");
  });

  it("the plain text is identical across a round-trip (Slate JSON is the truth)", () => {
    const md = "# One\n\ntwo three four\n\n> a quote line\n";
    const before = plateText(markdownToSlate(md));
    const after = plateText(markdownToSlate(slateToMarkdown(markdownToSlate(md))));
    expect(after).toBe(before);
  });
});
