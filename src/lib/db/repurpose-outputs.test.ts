import { describe, expect, it } from "vitest";

import { isOutputStale } from "./repurpose-outputs";

const out = (iso: string) => ({ sourceEditedAt: iso });

describe("isOutputStale", () => {
  it("is stale when the source was edited after the output was generated", () => {
    expect(isOutputStale(out("2026-06-01T10:00:00Z"), "2026-06-01T10:05:00Z")).toBe(true);
  });

  it("is not stale when the source has not been touched since", () => {
    expect(isOutputStale(out("2026-06-01T10:00:00Z"), "2026-06-01T10:00:00Z")).toBe(false);
  });

  it("is not stale when the watermark is newer than the piece (clock skew / re-read)", () => {
    expect(isOutputStale(out("2026-06-01T10:05:00Z"), "2026-06-01T10:00:00Z")).toBe(false);
  });

  it("degrades to not-stale on an unparseable timestamp rather than nagging", () => {
    expect(isOutputStale(out("not-a-date"), "2026-06-01T10:00:00Z")).toBe(false);
    expect(isOutputStale(out("2026-06-01T10:00:00Z"), "garbage")).toBe(false);
  });
});
