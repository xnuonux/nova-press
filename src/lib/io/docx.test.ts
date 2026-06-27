import { describe, it, expect } from "vitest";

import { slateToDocx, sectionsToDocx, docxToSlate } from "./docx";
import { plateText } from "@/components/editor/plate-text";

// a docx is a zip; every zip (and thus every .docx) starts with the local-file
// magic bytes "PK\x03\x04".
function isZip(buf: Buffer): boolean {
  return buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
}

describe("slateToDocx builds a real .docx", () => {
  it("emits zip bytes (the docx package magic)", async () => {
    const buf = await slateToDocx(
      [
        { type: "h1", children: [{ text: "Chapter" }] },
        { type: "p", children: [{ text: "hello world" }] },
      ] as never,
      "My Piece",
    );
    expect(isZip(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(1000);
  });

  it("builds a work docx from reading sections", async () => {
    const buf = await sectionsToDocx("My Novel", [
      { title: "act one", depth: 0, isLeaf: false, body: null },
      {
        title: "scene 1",
        depth: 1,
        isLeaf: true,
        body: [{ type: "p", children: [{ text: "x" }] }],
      },
    ]);
    expect(isZip(buf)).toBe(true);
  });

  it("handles two separate ordered lists without crashing (per-list instance)", async () => {
    const buf = await slateToDocx([
      { type: "ol_li", children: [{ text: "one" }] },
      { type: "ol_li", children: [{ text: "two" }] },
      { type: "p", children: [{ text: "between" }] },
      { type: "ol_li", children: [{ text: "fresh one" }] },
    ] as never);
    expect(isZip(buf)).toBe(true);
  });
});

describe("docxToSlate round-trips text back out of a generated .docx", () => {
  it("the prose survives docx -> slate", async () => {
    const original = "the morning the letter came she was still in her coat";
    const buf = await slateToDocx([{ type: "p", children: [{ text: original }] }] as never);
    const value = await docxToSlate(buf);
    expect(plateText(value)).toContain("the morning the letter came");
  });
});
