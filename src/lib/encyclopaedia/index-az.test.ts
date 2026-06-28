import { describe, expect, it } from "vitest";

import { buildAToZ } from "./index-az";

describe("buildAToZ", () => {
  it("sorts by title and groups by first letter", () => {
    const out = buildAToZ([
      { id: "1", title: "Marik" },
      { id: "2", title: "abyss" },
      { id: "3", title: "Atrium" },
      { id: "4", title: "gate" },
    ]);
    expect(out.map((g) => g.letter)).toEqual(["A", "G", "M"]);
    // case-insensitive sort within a letter: abyss before Atrium.
    expect(out[0]!.entries.map((e) => e.title)).toEqual(["abyss", "Atrium"]);
  });

  it("collects non-letter titles under '#', sorted last", () => {
    const out = buildAToZ([
      { id: "1", title: "9th legion" },
      { id: "2", title: "alpha" },
    ]);
    expect(out.map((g) => g.letter)).toEqual(["A", "#"]);
    expect(out[1]!.entries[0]!.title).toBe("9th legion");
  });

  it("drops a blank-titled entry", () => {
    const out = buildAToZ([
      { id: "1", title: "  " },
      { id: "2", title: "real" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.entries).toHaveLength(1);
  });

  it("is empty for no articles", () => {
    expect(buildAToZ([])).toEqual([]);
  });

  it("buckets accented + ligature headwords with their base latin letter", () => {
    // mythos names lean on accents + ligatures. they must bucket under the base
    // letter the accent-aware sort places them next to, not be exiled to '#'.
    const out = buildAToZ([
      { id: "1", title: "Eärendil" },
      { id: "2", title: "Ångström" },
      { id: "3", title: "Ælfwine" },
      { id: "4", title: "Øystein" },
      { id: "5", title: "apple" },
    ]);
    const letters = out.map((g) => g.letter);
    expect(letters).toEqual(["A", "E", "O"]);
    expect(letters).not.toContain("#");
    // Ångström + Ælfwine + apple all live under A; Eärendil under E; Øystein under O.
    expect(out.find((g) => g.letter === "A")!.entries.map((e) => e.title)).toContain("Ångström");
    expect(out.find((g) => g.letter === "A")!.entries.map((e) => e.title)).toContain("Ælfwine");
    expect(out.find((g) => g.letter === "E")!.entries.map((e) => e.title)).toEqual(["Eärendil"]);
    expect(out.find((g) => g.letter === "O")!.entries.map((e) => e.title)).toEqual(["Øystein"]);
  });
});
