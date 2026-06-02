import { describe, expect, it } from "vitest";

import { sanitizeNextPath } from "./sanitize-next";

describe("sanitizeNextPath", () => {
  // valid same-origin paths
  it("accepts a plain absolute path", () => {
    expect(sanitizeNextPath("/library")).toBe("/library");
  });

  it("preserves query string and hash", () => {
    expect(sanitizeNextPath("/editor/abc?foo=bar#section")).toBe("/editor/abc?foo=bar#section");
  });

  it("returns undefined for null / undefined / empty input", () => {
    expect(sanitizeNextPath(null)).toBeUndefined();
    expect(sanitizeNextPath(undefined)).toBeUndefined();
    expect(sanitizeNextPath("")).toBeUndefined();
  });

  // bypass cases the substrate audit named
  it("rejects protocol-relative //evil.com", () => {
    expect(sanitizeNextPath("//evil.com")).toBeUndefined();
  });

  it("rejects /\\evil.com backslash bypass", () => {
    expect(sanitizeNextPath("/\\evil.com")).toBeUndefined();
  });

  it("rejects \\evil.com (backslash-only prefix)", () => {
    expect(sanitizeNextPath("\\evil.com")).toBeUndefined();
  });

  it("rejects tab-control-byte bypass /\\t/evil.com", () => {
    expect(sanitizeNextPath("/\t/evil.com")).toBeUndefined();
  });

  it("rejects newline-control-byte bypass /\\n/evil.com", () => {
    expect(sanitizeNextPath("/\n/evil.com")).toBeUndefined();
  });

  it("rejects carriage-return-control-byte bypass /\\r/evil.com", () => {
    expect(sanitizeNextPath("/\r/evil.com")).toBeUndefined();
  });

  it("rejects null-byte injection /library\\x00", () => {
    expect(sanitizeNextPath("/library\x00")).toBeUndefined();
  });

  // non-http schemes
  it("rejects absolute https URL", () => {
    expect(sanitizeNextPath("https://evil.com/path")).toBeUndefined();
  });

  it("rejects absolute http URL", () => {
    expect(sanitizeNextPath("http://evil.com")).toBeUndefined();
  });

  it("rejects javascript: scheme", () => {
    expect(sanitizeNextPath("javascript:alert(1)")).toBeUndefined();
  });

  it("rejects data: scheme", () => {
    expect(sanitizeNextPath("data:text/html,<script>alert(1)</script>")).toBeUndefined();
  });

  // shape
  it("rejects paths without leading slash", () => {
    expect(sanitizeNextPath("library")).toBeUndefined();
    expect(sanitizeNextPath("./library")).toBeUndefined();
  });

  it("rejects path that whatwg normalizes to // (/.//evil.com)", () => {
    // some inputs only become protocol-relative after url normalization;
    // catch them via the post-parse pathname check.
    expect(sanitizeNextPath("/.//evil.com")).toBeUndefined();
  });
});
