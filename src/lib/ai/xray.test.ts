import { describe, expect, it } from "vitest";

import { EMPTY_XRAY, XRAY_ROLES, buildXrayPrompt, parseXray } from "./xray";

describe("buildXrayPrompt", () => {
  it("numbers blocks and flattens whitespace", () => {
    const out = buildXrayPrompt(["the   lede\nhere", "second block"]);
    expect(out).toBe("[0] the lede here\n[1] second block");
  });

  it("drops blank blocks but keeps the original index", () => {
    const out = buildXrayPrompt(["", "  ok  ", "   ", "next"]);
    expect(out).toBe("[1] ok\n[3] next");
  });
});

describe("parseXray", () => {
  it("parses a clean structure and derives thread labels from roles", () => {
    const json = JSON.stringify({
      roles: [
        { n: 0, role: "opening" },
        { n: 1, role: "thesis" },
        { n: 2, role: "evidence" },
      ],
      // model sends only from/to; any label it includes is ignored.
      threads: [{ from: 0, to: 2, label: "weak setup ... goes nowhere" }],
    });
    const s = parseXray(json, 3);
    expect(s.roles).toHaveLength(3);
    expect(s.roles[0]).toEqual({ n: 0, role: "opening" });
    // the label is DERIVED from the endpoint roles, never the model's text.
    expect(s.threads).toEqual([{ from: 0, to: 2, label: "opening ... evidence" }]);
  });

  it("accepts the neutral 'passage' role", () => {
    const s = parseXray(JSON.stringify({ roles: [{ n: 0, role: "passage" }], threads: [] }), 1);
    expect(s.roles).toEqual([{ n: 0, role: "passage" }]);
  });

  it("strips code fences and stray prose around the json", () => {
    const wrapped = 'here you go:\n```json\n{"roles":[{"n":0,"role":"closing"}],"threads":[]}\n```';
    const s = parseXray(wrapped, 1);
    expect(s.roles).toEqual([{ n: 0, role: "closing" }]);
  });

  it("degrades garbage to EMPTY_XRAY", () => {
    expect(parseXray("not json at all", 3)).toEqual(EMPTY_XRAY);
    expect(parseXray("", 3)).toEqual(EMPTY_XRAY);
    expect(parseXray("{ broken", 3)).toEqual(EMPTY_XRAY);
  });

  it("drops out-of-range block indices and unknown roles", () => {
    const json = JSON.stringify({
      roles: [
        { n: 0, role: "opening" },
        { n: 9, role: "thesis" }, // out of range (count 2)
        { n: 1, role: "banger" }, // not a real role
        { n: 1, role: "evidence" }, // valid
      ],
      threads: [],
    });
    const s = parseXray(json, 2);
    expect(s.roles).toEqual([
      { n: 0, role: "opening" },
      { n: 1, role: "evidence" },
    ]);
  });

  it("keeps only the first role per block (no duplicates)", () => {
    const json = JSON.stringify({
      roles: [
        { n: 0, role: "opening" },
        { n: 0, role: "thesis" },
      ],
      threads: [],
    });
    const s = parseXray(json, 1);
    expect(s.roles).toEqual([{ n: 0, role: "opening" }]);
  });

  it("drops self-threads, out-of-range threads, and threads whose endpoints lack a role", () => {
    const json = JSON.stringify({
      roles: [
        { n: 0, role: "thesis" },
        { n: 2, role: "payoff" },
      ],
      threads: [
        { from: 0, to: 0 }, // self
        { from: 0, to: 5 }, // out of range
        { from: 0, to: 1 }, // block 1 has no role
        { from: 0, to: 2 }, // good
      ],
    });
    const s = parseXray(json, 3);
    expect(s.threads).toEqual([{ from: 0, to: 2, label: "thesis ... payoff" }]);
  });

  it("dedupes repeated threads and caps at six", () => {
    const roles = Array.from({ length: 20 }, (_, i) => ({ n: i, role: "passage" }));
    const threads = [
      { from: 0, to: 1 },
      { from: 0, to: 1 }, // dup
      ...Array.from({ length: 10 }, (_, i) => ({ from: 0, to: i + 2 })),
    ];
    const s = parseXray(JSON.stringify({ roles, threads }), 20);
    expect(s.threads).toHaveLength(6);
    expect(s.threads[0]).toEqual({ from: 0, to: 1, label: "passage ... passage" });
  });

  it("every taxonomy role is descriptive, never a judgment", () => {
    // a guard against the soul-violation: the role names must stay neutral.
    const banned = ["weak", "strong", "filler", "bad", "good", "unclear", "boring"];
    for (const role of XRAY_ROLES) {
      expect(banned).not.toContain(role);
    }
  });
});
