import { describe, expect, it } from "vitest";

import { formatSavedLabel } from "./use-autosave";

describe("formatSavedLabel", () => {
  it("reads 'ready' before the first save", () => {
    expect(formatSavedLabel("idle", null, Date.now())).toBe("ready");
  });

  it("reads 'saving...' mid-save", () => {
    expect(formatSavedLabel("saving", null, Date.now())).toBe("saving...");
  });

  it("reads 'saved just now' within five seconds", () => {
    const savedAt = 10_000;
    expect(formatSavedLabel("saved", savedAt, savedAt + 2_000)).toBe("saved just now");
  });

  it("counts seconds, then rolls into minutes", () => {
    const savedAt = 100_000;
    expect(formatSavedLabel("saved", savedAt, savedAt + 30_000)).toBe("saved 30s ago");
    expect(formatSavedLabel("saved", savedAt, savedAt + 180_000)).toBe("saved 3m ago");
  });

  it("reads 'couldn't save' when a save fails", () => {
    expect(formatSavedLabel("error", null, Date.now())).toBe("couldn't save");
  });
});
