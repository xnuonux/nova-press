import { describe, expect, it } from "vitest";

import { parseXrefs, resolveXref, splitOnXrefs, type XrefTarget } from "./xref";

describe("parseXrefs", () => {
  it("finds a bare [[target]]", () => {
    const out = parseXrefs("see [[the gate]] for more.");
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ target: "the gate", label: "the gate" });
  });

  it("finds [[target|label]] and uses the label as display", () => {
    const out = parseXrefs("the [[the seventh gate|gate]] groaned.");
    expect(out[0]).toMatchObject({ target: "the seventh gate", label: "gate" });
  });

  it("finds several in order", () => {
    const out = parseXrefs("[[a]] then [[b|bee]] then [[c]]");
    expect(out.map((x) => x.target)).toEqual(["a", "b", "c"]);
    expect(out.map((x) => x.label)).toEqual(["a", "bee", "c"]);
  });

  it("ignores an escaped \\[[ and an unclosed [[", () => {
    expect(parseXrefs("a literal \\[[not an xref]] here")).toHaveLength(0);
    expect(parseXrefs("an unclosed [[ bracket")).toHaveLength(0);
  });

  it("skips a blank target", () => {
    expect(parseXrefs("[[]] and [[  ]]")).toHaveLength(0);
  });
});

describe("splitOnXrefs", () => {
  it("splits text + xref segments in order", () => {
    const out = splitOnXrefs("before [[gate]] after");
    expect(out).toEqual([
      { kind: "text", value: "before " },
      { kind: "xref", target: "gate", label: "gate" },
      { kind: "text", value: " after" },
    ]);
  });

  it("unescapes a literal \\[[ in the text", () => {
    const out = splitOnXrefs("a \\[[literal]] one");
    expect(out).toEqual([{ kind: "text", value: "a [[literal]] one" }]);
  });

  it("returns nothing for empty input", () => {
    expect(splitOnXrefs("")).toEqual([]);
  });

  it("handles back-to-back xrefs", () => {
    const out = splitOnXrefs("[[a]][[b]]");
    expect(out).toEqual([
      { kind: "xref", target: "a", label: "a" },
      { kind: "xref", target: "b", label: "b" },
    ]);
  });
});

describe("resolveXref", () => {
  const articles: XrefTarget[] = [
    { id: "a1", title: "The Seventh Gate" },
    { id: "a2", title: "marik" },
  ];

  it("resolves by title, case + whitespace insensitive", () => {
    expect(resolveXref("the seventh gate", articles)).toBe("a1");
    expect(resolveXref("  MARIK ", articles)).toBe("a2");
  });

  it("returns null for a dangling target", () => {
    expect(resolveXref("the eighth gate", articles)).toBeNull();
    expect(resolveXref("", articles)).toBeNull();
  });

  it("first match wins on a duplicate title", () => {
    const dup: XrefTarget[] = [
      { id: "x1", title: "gate" },
      { id: "x2", title: "gate" },
    ];
    expect(resolveXref("gate", dup)).toBe("x1");
  });
});
