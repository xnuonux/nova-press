import { describe, expect, it } from "vitest";

import { flagToCodexDraft } from "./flag-draft";

describe("flagToCodexDraft", () => {
  it("maps an unintroduced flag to a draft pre-filled with the mention name", () => {
    const draft = flagToCodexDraft({
      kind: "unintroduced",
      scope: { mention: "Sable", count: 3 },
    });
    expect(draft).toEqual({ name: "Sable", kind: "character", summary: "" });
  });

  it("returns null for a name_drift flag (a misspelling of an existing entity, not a new one)", () => {
    expect(
      flagToCodexDraft({ kind: "name_drift", scope: { mention: "Marrik", near: "marik" } }),
    ).toBeNull();
  });

  it("returns null for a contradiction / timeline / other flag", () => {
    expect(flagToCodexDraft({ kind: "contradiction", scope: { source: "model" } })).toBeNull();
    expect(flagToCodexDraft({ kind: "timeline" })).toBeNull();
  });

  it("returns null when the mention is missing or blank", () => {
    expect(flagToCodexDraft({ kind: "unintroduced", scope: {} })).toBeNull();
    expect(flagToCodexDraft({ kind: "unintroduced", scope: { mention: "   " } })).toBeNull();
    expect(flagToCodexDraft({ kind: "unintroduced" })).toBeNull();
  });

  it("trims + collapses whitespace in the proposed name", () => {
    const draft = flagToCodexDraft({ kind: "unintroduced", scope: { mention: "  the   gate " } });
    expect(draft!.name).toBe("the gate");
  });
});
