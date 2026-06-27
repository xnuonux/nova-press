import { describe, expect, it } from "vitest";

import { composeBible, type BibleEntityView } from "./bible-compose";

const entity = (over: Partial<BibleEntityView> = {}): BibleEntityView => ({
  name: "marik",
  kind: "character",
  summary: "the mute ferryman of the seventh gate",
  aliases: [],
  facts: [],
  ...over,
});

describe("composeBible", () => {
  it("returns empty for no entities", () => {
    expect(composeBible([])).toBe("");
  });

  it("writes a header line: name (kind) ... summary", () => {
    expect(composeBible([entity()])).toBe(
      "marik (character) ... the mute ferryman of the seventh gate",
    );
  });

  it("folds aliases into the header and drops a self-alias", () => {
    // "Marik" equals the name (case-insensitive) so it's dropped; the bracket is
    // exactly the two real aliases, which proves the self-alias never made it in.
    const out = composeBible([entity({ aliases: ["old marik", "the ferryman", "Marik"] })]);
    expect(out).toContain("[also: old marik, the ferryman]");
    expect(out.endsWith("the ferryman]")).toBe(true);
  });

  it("lists facts as dashed lines under the header", () => {
    const out = composeBible([
      entity({ facts: ["he has never spoken a word.", "he ferries the dead, not the living."] }),
    ]);
    expect(out).toContain("\n- he has never spoken a word.");
    expect(out).toContain("\n- he ferries the dead, not the living.");
  });

  it("falls back to (entity) when the kind is blank, and keeps a bare name", () => {
    expect(
      composeBible([{ name: "the gate", kind: "", summary: null, aliases: [], facts: [] }]),
    ).toBe("the gate (entity)");
  });

  it("skips an entity with no name", () => {
    expect(composeBible([entity({ name: "  " }), entity({ name: "lethe", summary: null })])).toBe(
      "lethe (character)",
    );
  });

  it("caps the facts per entity (depth bound)", () => {
    const facts = Array.from({ length: 12 }, (_, i) => `fact ${i}`);
    const out = composeBible([entity({ summary: null, facts })]);
    const dashed = out.split("\n").filter((l) => l.startsWith("- "));
    expect(dashed).toHaveLength(6);
  });

  it("collapses whitespace in every field", () => {
    const out = composeBible([
      entity({ name: "  marik\n", summary: "the   mute\nferryman", facts: ["  spoke   never  "] }),
    ]);
    expect(out).toContain("marik (character) ... the mute ferryman");
    expect(out).toContain("- spoke never");
  });

  it("hard-caps each field so one fat entry can't blow the slot", () => {
    const long = "x".repeat(2000);
    const out = composeBible([
      { name: long, kind: "lore", summary: long, aliases: [long], facts: [long, long] },
    ]);
    // every field is bounded (<= MAX_FIELD 240), so the whole block stays small
    // even though the inputs were thousands of chars each.
    expect(out.length).toBeLessThan(1600);
    // and it still produced a usable block.
    expect(out).toContain("(lore)");
  });

  it("separates multiple entities by a newline", () => {
    const out = composeBible([
      entity({ name: "marik", summary: null, kind: "character" }),
      entity({ name: "lethe", summary: null, kind: "place" }),
    ]);
    expect(out).toBe("marik (character)\nlethe (place)");
  });
});
