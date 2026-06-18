import { beforeEach, describe, expect, it } from "vitest";

import { __resetRateLimit, rateLimit } from "./rate-limit";

describe("rateLimit", () => {
  beforeEach(() => __resetRateLimit());

  it("allows up to the limit, then blocks within the window", () => {
    const t0 = 1_000_000;
    expect(rateLimit("ip", 3, 60_000, t0).allowed).toBe(true);
    expect(rateLimit("ip", 3, 60_000, t0 + 1).allowed).toBe(true);
    expect(rateLimit("ip", 3, 60_000, t0 + 2).allowed).toBe(true);
    const blocked = rateLimit("ip", 3, 60_000, t0 + 3);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("resets after the window elapses", () => {
    const t0 = 2_000_000;
    rateLimit("ip", 1, 1_000, t0);
    expect(rateLimit("ip", 1, 1_000, t0 + 500).allowed).toBe(false);
    expect(rateLimit("ip", 1, 1_000, t0 + 1_000).allowed).toBe(true);
  });

  it("tracks keys independently", () => {
    const t0 = 3_000_000;
    rateLimit("a", 1, 60_000, t0);
    expect(rateLimit("a", 1, 60_000, t0 + 1).allowed).toBe(false);
    expect(rateLimit("b", 1, 60_000, t0 + 1).allowed).toBe(true);
  });
});
