import { describe, it, expect } from "vitest";

import { parseScheduleInput, isDueForPublish } from "./schedule";

const NOW = "2026-07-05T12:00:00.000Z";

describe("parseScheduleInput validates a requested publish time", () => {
  it("accepts a clean future time and returns canonical iso", () => {
    const r = parseScheduleInput("2026-07-06T09:00:00.000Z", NOW);
    expect(r).toEqual({ ok: true, whenIso: "2026-07-06T09:00:00.000Z" });
  });

  it("canonicalizes a datetime-local style value", () => {
    const r = parseScheduleInput("2026-07-06T09:00", NOW);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.whenIso.endsWith("Z")).toBe(true);
  });

  it("refuses now, the past, and the sub-minute future", () => {
    expect(parseScheduleInput(NOW, NOW).ok).toBe(false);
    expect(parseScheduleInput("2026-07-05T11:00:00.000Z", NOW).ok).toBe(false);
    expect(parseScheduleInput("2026-07-05T12:00:30.000Z", NOW).ok).toBe(false);
  });

  it("refuses more than a year out", () => {
    expect(parseScheduleInput("2027-08-01T12:00:00.000Z", NOW).ok).toBe(false);
  });

  it("refuses garbage without throwing", () => {
    expect(parseScheduleInput("", NOW).ok).toBe(false);
    expect(parseScheduleInput("not a time", NOW).ok).toBe(false);
    expect(parseScheduleInput(42, NOW).ok).toBe(false);
    expect(parseScheduleInput(null, NOW).ok).toBe(false);
  });
});

describe("isDueForPublish decides the sweep", () => {
  it("fires only on a scheduled row whose time arrived", () => {
    expect(
      isDueForPublish({ status: "scheduled", scheduledPublishAt: "2026-07-05T11:59:00Z" }, NOW),
    ).toBe(true);
    expect(isDueForPublish({ status: "scheduled", scheduledPublishAt: NOW }, NOW)).toBe(true);
  });

  it("stays quiet on the future, other statuses, and garbage", () => {
    expect(
      isDueForPublish({ status: "scheduled", scheduledPublishAt: "2026-07-05T12:01:00Z" }, NOW),
    ).toBe(false);
    expect(
      isDueForPublish({ status: "draft", scheduledPublishAt: "2026-07-05T11:00:00Z" }, NOW),
    ).toBe(false);
    expect(isDueForPublish({ status: "scheduled", scheduledPublishAt: null }, NOW)).toBe(false);
    expect(isDueForPublish({ status: "scheduled", scheduledPublishAt: "someday" }, NOW)).toBe(
      false,
    );
  });
});
