import { describe, expect, it } from "vitest";

import { contentHash } from "./hash";

describe("contentHash", () => {
  it("is deterministic for the same content", () => {
    expect(contentHash("the ferryman waited")).toBe(contentHash("the ferryman waited"));
  });

  it("ignores trailing + collapsible whitespace (not a content change)", () => {
    expect(contentHash("the  ferryman   waited\n")).toBe(contentHash("the ferryman waited"));
  });

  it("moves when the content actually changes", () => {
    expect(contentHash("the ferryman waited")).not.toBe(contentHash("the ferryman left"));
    // a tiny edit (one transposed pair) still moves it.
    expect(contentHash("marik")).not.toBe(contentHash("mraik"));
  });

  it("is a short stable hex string", () => {
    expect(contentHash("anything")).toMatch(/^[0-9a-f]{24}$/);
  });
});
