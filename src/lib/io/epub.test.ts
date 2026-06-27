import { describe, it, expect } from "vitest";

import { epubChaptersFromSections, workToEpub, type EpubSection } from "./epub";

describe("epubChaptersFromSections folds reading sections into per-leaf chapters", () => {
  const sections: EpubSection[] = [
    { title: "act one", depth: 0, isLeaf: false, html: "" },
    { title: "chapter 1", depth: 1, isLeaf: false, html: "" },
    { title: "scene 1", depth: 2, isLeaf: true, html: "<p>the cold stove</p>" },
    { title: "scene 2", depth: 2, isLeaf: true, html: "<p>the letter</p>" },
    { title: "act two", depth: 0, isLeaf: false, html: "" },
    { title: "epilogue", depth: 1, isLeaf: true, html: "<p>after</p>" },
  ];

  it("titles each leaf chapter by its ancestor breadcrumb path", () => {
    const chapters = epubChaptersFromSections(sections);
    expect(chapters.map((c) => c.title)).toEqual([
      "act one · chapter 1 · scene 1",
      "act one · chapter 1 · scene 2",
      "act two · epilogue",
    ]);
    expect(chapters.map((c) => c.data)).toEqual([
      "<p>the cold stove</p>",
      "<p>the letter</p>",
      "<p>after</p>",
    ]);
  });

  it("an empty leaf still ships a valid empty paragraph", () => {
    const chapters = epubChaptersFromSections([
      { title: "scene", depth: 0, isLeaf: true, html: "" },
    ]);
    expect(chapters).toEqual([{ title: "scene", data: "<p></p>" }]);
  });

  it("is empty for no sections", () => {
    expect(epubChaptersFromSections([])).toEqual([]);
  });
});

describe("workToEpub renders real .epub bytes", () => {
  it("emits an epub zip carrying the application/epub+zip mimetype", async () => {
    const buf = await workToEpub("a small novel", [
      { title: "act one · scene 1", data: "<p>the cold stove waiting</p>" },
      { title: "act one · scene 2", data: "<p>the letter sat unopened</p>" },
    ]);
    // every zip (and thus epub) starts with the local-file magic "PK\x03\x04".
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
    // an epub's first, uncompressed entry is the mimetype = application/epub+zip.
    expect(buf.toString("latin1")).toContain("application/epub+zip");
    expect(buf.length).toBeGreaterThan(500);
  }, 30_000);
});
