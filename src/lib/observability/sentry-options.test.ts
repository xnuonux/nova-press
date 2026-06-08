import { describe, expect, it } from "vitest";

import { sentryInitOptions } from "./sentry-options";

describe("sentryInitOptions", () => {
  it("is dormant when no dsn is set", () => {
    const opts = sentryInitOptions(undefined);
    expect(opts.enabled).toBe(false);
    expect(opts.dsn).toBeUndefined();
  });

  it("is dormant for an empty-string dsn", () => {
    expect(sentryInitOptions("").enabled).toBe(false);
  });

  it("activates when a real dsn is present", () => {
    const dsn = "https://abc@o123.ingest.sentry.io/456";
    const opts = sentryInitOptions(dsn);
    expect(opts.enabled).toBe(true);
    expect(opts.dsn).toBe(dsn);
  });

  it("ships errors only ... no perf tracing overhead by default", () => {
    expect(sentryInitOptions("https://x@sentry.io/1").tracesSampleRate).toBe(0);
  });
});
