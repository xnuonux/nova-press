import { describe, expect, it } from "vitest";

import { ENTITY_KINDS, isEntityKind, normalizeEntity } from "./validate";

describe("isEntityKind", () => {
  it("accepts the six bible kinds and nothing else", () => {
    for (const k of ENTITY_KINDS) expect(isEntityKind(k)).toBe(true);
    expect(isEntityKind("vibes")).toBe(false);
    expect(isEntityKind("")).toBe(false);
    expect(isEntityKind(null)).toBe(false);
    expect(isEntityKind(7)).toBe(false);
  });
});

describe("normalizeEntity", () => {
  it("requires a name", () => {
    const out = normalizeEntity({ name: "   ", kind: "character" });
    expect(out.ok).toBe(false);
    expect(out.entity).toBeUndefined();
    expect(out.error).toMatch(/name/);
  });

  it("requires a real kind", () => {
    const out = normalizeEntity({ name: "marik", kind: "wizard" });
    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/kind/);
  });

  it("trims + collapses whitespace in the name and summary", () => {
    const out = normalizeEntity({
      name: "  old   marik  ",
      kind: "character",
      summary: "the   mute\nferryman  ",
    });
    expect(out.ok).toBe(true);
    expect(out.entity!.name).toBe("old marik");
    expect(out.entity!.summary).toBe("the mute ferryman");
  });

  it("empties a blank summary to null", () => {
    const out = normalizeEntity({ name: "marik", kind: "character", summary: "   " });
    expect(out.entity!.summary).toBeNull();
  });

  it("splits a newline/comma alias blob, de-dupes case-insensitively, drops the self-alias", () => {
    const out = normalizeEntity({
      name: "Marik",
      kind: "character",
      aliases: "the ferryman\nThe Ferryman, marik,  old marik ",
    });
    expect(out.entity!.aliases).toEqual(["the ferryman", "old marik"]);
  });

  it("accepts an array of aliases too", () => {
    const out = normalizeEntity({
      name: "marik",
      kind: "character",
      aliases: ["the ferryman", "the ferryman", ""],
    });
    expect(out.entity!.aliases).toEqual(["the ferryman"]);
  });

  it("splits facts on newlines, dropping blanks", () => {
    const out = normalizeEntity({
      name: "marik",
      kind: "character",
      facts: "he has never spoken a word.\n\nhe ferries only the dead.\n  ",
    });
    expect(out.entity!.facts).toEqual(["he has never spoken a word.", "he ferries only the dead."]);
  });

  it("bounds a fat field so one paste can't blow the row", () => {
    const out = normalizeEntity({
      name: "x".repeat(500),
      kind: "lore",
      summary: "y".repeat(5000),
      facts: ["z".repeat(5000)],
    });
    expect(out.entity!.name.length).toBeLessThanOrEqual(120);
    expect(out.entity!.summary!.length).toBeLessThanOrEqual(600);
    expect(out.entity!.facts[0]!.length).toBeLessThanOrEqual(400);
  });

  it("bounds the breadth of the lists", () => {
    const many = Array.from({ length: 100 }, (_, i) => `alias${i}`);
    const out = normalizeEntity({ name: "marik", kind: "character", aliases: many });
    expect(out.entity!.aliases.length).toBeLessThanOrEqual(24);
  });
});
