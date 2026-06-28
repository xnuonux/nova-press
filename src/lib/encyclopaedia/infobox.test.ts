import { describe, expect, it } from "vitest";

import { infoboxToRecord, normalizeInfobox, recordToInfobox } from "./infobox";

describe("normalizeInfobox", () => {
  it("requires a title", () => {
    const out = normalizeInfobox({ title: "  ", summary: "x" });
    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/title/);
  });

  it("normalizes a full draft, dropping a self-aka + de-duping", () => {
    const out = normalizeInfobox({
      title: "  the seventh gate ",
      aka: "the gate\nThe Gate, the seventh gate",
      classification: "place",
      summary: "the last  gate before the river.",
      attributes: ["guarded by marik", "guarded by marik"],
    });
    expect(out.ok).toBe(true);
    expect(out.infobox).toEqual({
      title: "the seventh gate",
      aka: ["the gate"],
      classification: "place",
      summary: "the last gate before the river.",
      attributes: ["guarded by marik"],
    });
  });

  it("bounds the fields", () => {
    const out = normalizeInfobox({ title: "x".repeat(300), summary: "y".repeat(5000) });
    expect(out.infobox!.title.length).toBeLessThanOrEqual(120);
    expect(out.infobox!.summary.length).toBeLessThanOrEqual(1200);
  });
});

describe("record round-trip", () => {
  it("stores the title on headword and reads it back", () => {
    const view = {
      title: "marik",
      aka: ["the ferryman"],
      classification: "character",
      summary: "the mute ferryman",
      attributes: ["never speaks"],
    };
    const record = infoboxToRecord(view);
    expect(record.headword).toBe("marik");
    expect(recordToInfobox(record)).toEqual(view);
  });

  it("reads a partial / null record tolerantly", () => {
    expect(recordToInfobox({ headword: "ka" })).toEqual({
      title: "ka",
      aka: [],
      classification: "",
      summary: "",
      attributes: [],
    });
    expect(recordToInfobox(null).title).toBe("");
  });
});
