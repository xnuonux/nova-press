import { describe, it, expect } from "vitest";

import type { EditorialPass, Finding, FindingStatus } from "@/types/editorial";

import { evaluateTransition, openFlagCount } from "./state-machine";

function flag(status: FindingStatus = "open"): Finding {
  return { lens: "mechanical", message: "x", severity: "flag", scope: {}, status };
}
function note(): Finding {
  return { lens: "mechanical", message: "y", severity: "note", scope: {}, status: "open" };
}
function passWith(findings: Finding[]): EditorialPass {
  return {
    id: "p",
    userId: "u",
    pieceId: "pc",
    stage: "drafting",
    findings,
    lensKeys: [],
    sourceEditedAt: "2026-01-01T00:00:00Z",
    passMetadata: {},
    generatedAt: "2026-01-01T00:00:00Z",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

describe("openFlagCount counts only open flags", () => {
  it("notes and triaged flags never count", () => {
    expect(openFlagCount([flag("open"), flag("accepted"), flag("dismissed"), note()])).toBe(1);
    expect(openFlagCount([note(), note()])).toBe(0);
    expect(openFlagCount([])).toBe(0);
  });
});

describe("evaluateTransition gates an advance, frees a retreat", () => {
  it("a no-op (same stage) is allowed", () => {
    const r = evaluateTransition("line", "line");
    expect(r).toMatchObject({ allowed: true, transition: "same" });
  });

  it("a retreat is always free", () => {
    expect(evaluateTransition("copy", "line")).toMatchObject({
      allowed: true,
      transition: "retreat",
    });
    expect(evaluateTransition("proof", "drafting")).toMatchObject({
      allowed: true,
      transition: "retreat",
    });
  });

  it("a skip (two steps up) is never allowed", () => {
    const r = evaluateTransition("drafting", "line");
    expect(r.allowed).toBe(false);
    expect(r.transition).toBe("skip");
    expect(r.reason).toContain("one stage at a time");
  });

  it("an advance with no pass is blocked ... run a pass first", () => {
    const r = evaluateTransition("drafting", "developmental", {});
    expect(r.allowed).toBe(false);
    expect(r.transition).toBe("advance");
    expect(r.reason).toContain("hasn't been reviewed");
  });

  it("an advance on a stale pass is blocked ... re-run it", () => {
    const r = evaluateTransition("drafting", "developmental", { pass: passWith([]), stale: true });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain("stale");
  });

  it("an advance with open flags is blocked, counted in voice", () => {
    const one = evaluateTransition("drafting", "developmental", { pass: passWith([flag()]) });
    expect(one.allowed).toBe(false);
    expect(one.reason).toContain("1 flag still want");
    const two = evaluateTransition("drafting", "developmental", {
      pass: passWith([flag(), flag(), note()]),
    });
    expect(two.reason).toContain("2 flags still want");
  });

  it("an advance with only notes + triaged flags is clear", () => {
    const r = evaluateTransition("drafting", "developmental", {
      pass: passWith([note(), flag("accepted"), flag("dismissed")]),
    });
    expect(r).toMatchObject({ allowed: true, transition: "advance" });
    expect(r.reason).toContain("clear to advance");
  });
});
