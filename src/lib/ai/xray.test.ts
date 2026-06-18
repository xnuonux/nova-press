import { describe, expect, it } from "vitest";

import { EMPTY_XRAY, XRAY_ROLES, buildXrayPrompt, parseXray } from "./xray";

describe("buildXrayPrompt", () => {
  it("numbers blocks and flattens whitespace", () => {
    const out = buildXrayPrompt(["the   lede\nhere", "second block"]);
    expect(out).toBe("[0] the lede here\n[1] second block");
  });

  it("tolerates non-string / empty blocks", () => {
    const out = buildXrayPrompt(["", "  ok  "] as string[]);
    expect(out).toBe("[0] \n[1] ok");
  });
});

describe("parseXray", () => {
  it("parses a clean structure", () => {
    const json = JSON.stringify({
      roles: [
        { n: 0, role: "opening" },
        { n: 1, role: "thesis" },
        { n: 2, role: "evidence" },
      ],
      threads: [{ from: 0, to: 2, label: "question ... answer" }],
    });
    const s = parseXray(json, 3);
    expect(s.roles).toHaveLength(3);
    expect(s.roles[0]).toEqual({ n: 0, role: "opening" });
    expect(s.threads).toEqual([{ from: 0, to: 2, label: "question ... answer" }]);
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

  it("drops self-threads and out-of-range threads", () => {
    const json = JSON.stringify({
      roles: [],
      threads: [
        { from: 0, to: 0, label: "self" },
        { from: 0, to: 5, label: "oob" },
        { from: 0, to: 2, label: "good" },
      ],
    });
    const s = parseXray(json, 3);
    expect(s.threads).toEqual([{ from: 0, to: 2, label: "good" }]);
  });

  it("caps threads at six and truncates long labels", () => {
    const threads = Array.from({ length: 10 }, (_, i) => ({
      from: 0,
      to: i + 1,
      label: "x".repeat(80),
    }));
    const s = parseXray(JSON.stringify({ roles: [], threads }), 20);
    expect(s.threads).toHaveLength(6);
    expect(s.threads[0]?.label.length).toBe(40);
  });

  it("every taxonomy role is descriptive, never a judgment", () => {
    // a guard against the soul-violation: the role names must stay neutral.
    const banned = ["weak", "strong", "filler", "bad", "good", "unclear", "boring"];
    for (const role of XRAY_ROLES) {
      expect(banned).not.toContain(role);
    }
  });
});
