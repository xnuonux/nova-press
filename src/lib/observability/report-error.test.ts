import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock is hoisted above imports, so the mock fn must come from
// vi.hoisted (also hoisted) rather than a plain const.
const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException }));

import { reportError } from "./report-error";

describe("reportError", () => {
  beforeEach(() => {
    captureException.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("forwards the error to sentry", () => {
    const err = new Error("boom");
    reportError(err);
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(err, undefined);
  });

  it("passes context to sentry as extra", () => {
    const err = new Error("boom");
    reportError(err, { tag: "signin-failed", userId: "u1" });
    expect(captureException).toHaveBeenCalledWith(err, {
      extra: { tag: "signin-failed", userId: "u1" },
    });
  });

  it("also logs to the console so failures are grep-able without a dsn", () => {
    const spy = vi.spyOn(console, "error");
    const err = new Error("boom");
    reportError(err, { tag: "x" });
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
