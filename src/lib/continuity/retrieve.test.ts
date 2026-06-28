import { describe, expect, it } from "vitest";

import type { KnownName } from "./types";
import { mentionedEntityIds } from "./retrieve";

const known: KnownName[] = [
  { entityId: "e-marik", name: "old marik", aliases: ["the ferryman"] },
  { entityId: "e-gate", name: "the seventh gate", aliases: [] },
  { entityId: "e-sable", name: "sable", aliases: ["the grey witch"] },
];

describe("mentionedEntityIds", () => {
  it("retrieves an entity by an exact full-name mention", () => {
    const out = mentionedEntityIds("Sable crossed the water.", known);
    expect([...out]).toEqual(["e-sable"]);
  });

  it("retrieves an entity by a single name-token inside a multi-word name", () => {
    // "Marik" should find "old marik".
    const out = mentionedEntityIds("Then Marik stood at the edge.", known);
    expect(out.has("e-marik")).toBe(true);
  });

  it("retrieves an entity by an alias", () => {
    const out = mentionedEntityIds("She feared the Ferryman most of all.", known);
    expect(out.has("e-marik")).toBe(true);
  });

  it("retrieves an entity through a fumbled spelling (trigram near-miss)", () => {
    const out = mentionedEntityIds("Old Marrik said nothing.", known);
    expect(out.has("e-marik")).toBe(true);
  });

  it("narrows to only the mentioned entities, not the whole codex", () => {
    const out = mentionedEntityIds("Sable opened the Gate.", known);
    // sable + the seventh gate (via the 'gate' token), but never marik.
    expect(out.has("e-sable")).toBe(true);
    expect(out.has("e-gate")).toBe(true);
    expect(out.has("e-marik")).toBe(false);
  });

  it("returns empty when the text names nothing known", () => {
    const out = mentionedEntityIds("The wind moved over empty fields.", known);
    expect(out.size).toBe(0);
  });

  it("returns empty for an empty bible", () => {
    expect(mentionedEntityIds("Sable opened the Gate.", []).size).toBe(0);
  });

  it("ignores a lowercase (non-proper-noun) occurrence, like the detect pass", () => {
    // only capitalized candidates are mentions, so a lowercase 'sable' is not one.
    const out = mentionedEntityIds("the sable cloth lay folded.", known);
    expect(out.has("e-sable")).toBe(false);
  });

  it("retrieves BOTH entities that share a bare name-token (no first-write-wins drop)", () => {
    const coNamed = [
      { entityId: "e-marik-1", name: "marik stormcrow", aliases: [] },
      { entityId: "e-marik-2", name: "marik vale", aliases: [] },
    ];
    const out = mentionedEntityIds("Then Marik spoke.", coNamed);
    expect(out.has("e-marik-1")).toBe(true);
    expect(out.has("e-marik-2")).toBe(true);
  });

  it("retrieves an entity whose name is a calendar / stopword (the bible is the authority on names)", () => {
    const named = [{ entityId: "e-may", name: "May", aliases: [] }];
    // the detect pass would drop 'May' as a stopword; retrieval must not, since
    // the bible says it IS a name.
    const out = mentionedEntityIds("That winter, May vanished from the harbor.", named);
    expect(out.has("e-may")).toBe(true);
  });
});
