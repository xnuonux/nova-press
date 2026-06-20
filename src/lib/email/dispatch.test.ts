import { describe, expect, it } from "vitest";

import { computeBodyHash } from "./dispatch";

describe("computeBodyHash", () => {
  it("is stable for the same content", () => {
    expect(computeBodyHash("hi", "the body")).toBe(computeBodyHash("hi", "the body"));
  });

  it("ignores trailing whitespace + crlf differences (same edition)", () => {
    expect(computeBodyHash("hi", "the body")).toBe(computeBodyHash("hi  ", "the body\n"));
    expect(computeBodyHash("hi", "a\nb")).toBe(computeBodyHash("hi", "a\r\nb"));
  });

  it("changes when the body changes (a new edition)", () => {
    expect(computeBodyHash("hi", "the body")).not.toBe(computeBodyHash("hi", "the bodyy"));
  });

  it("changes when the subject changes", () => {
    expect(computeBodyHash("hi", "x")).not.toBe(computeBodyHash("ho", "x"));
  });

  it("distinguishes a subject/body shift (no naive concatenation collision)", () => {
    // "ab" + "c" vs "a" + "bc" must not collide.
    expect(computeBodyHash("ab", "c")).not.toBe(computeBodyHash("a", "bc"));
  });

  it("returns a stable-width hex string", () => {
    expect(computeBodyHash("hi", "x")).toMatch(/^[0-9a-f]+$/);
  });

  it("does not throw on non-string input", () => {
    // @ts-expect-error runtime guard
    expect(typeof computeBodyHash(null, undefined)).toBe("string");
  });
});
