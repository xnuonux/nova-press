// nova press · the mythos · the form system, pinned.
//
// the registry is the only place form knowledge lives, so its integrity is
// load-bearing: a typo in an allowedChildTypes would silently break the
// binder. these tests pin that every profile is internally consistent, that
// tree navigation answers correctly, and that the advisory constraint lenses
// read pre-computed metrics deterministically (a mirror, never a verdict, and
// never a false pass on a constraint whose engine has not landed yet).

import { describe, it, expect } from "vitest";
import { FORM_REGISTRY, FORM_KEYS, isFormKey } from "./registry";
import {
  getForm,
  canNest,
  isLeafType,
  leafTypesOf,
  allowedChildTypes,
  evaluateForm,
} from "./constraints";
import type { NodeSeed } from "./types";
import { shapeOf } from "../../types/works";

const FAMILIES = new Set(["poem", "prose", "reference", "collection", "script"]);
const LEAF_CONTENTS = new Set(["prose", "verse", "record", "record_prose"]);

describe("the form registry is internally consistent (its integrity is the binder's integrity)", () => {
  it("every profile's key matches its map key, with a real label, family, tree, leaf, and exports", () => {
    for (const key of FORM_KEYS) {
      const p = FORM_REGISTRY[key];
      expect(p.key).toBe(key); // the key is not a copy-paste lie
      expect(p.label.length).toBeGreaterThan(0);
      expect(FAMILIES.has(p.family)).toBe(true);
      expect(p.tree.levels.length).toBeGreaterThan(0);
      expect(p.tree.maxDepth).toBeGreaterThanOrEqual(1);
      expect(LEAF_CONTENTS.has(p.leaf.content)).toBe(true);
      expect(p.exports.length).toBeGreaterThan(0);
    }
  });

  it("the tree is well-formed: rootType + every allowedChildType is a declared level, and there is a leaf", () => {
    for (const key of FORM_KEYS) {
      const p = FORM_REGISTRY[key];
      const declared = new Set(p.tree.levels.map((l) => l.nodeType));
      expect(declared.has(p.tree.rootType)).toBe(true); // the root is real
      for (const level of p.tree.levels) {
        for (const child of level.allowedChildTypes) {
          expect(declared.has(child)).toBe(true); // no dangling child type (the typo catcher)
        }
      }
      expect(leafTypesOf(p).length).toBeGreaterThan(0); // every form can hold content somewhere
    }
  });

  it("a record / record_prose leaf carries a record schema (so the typed editor knows the fields)", () => {
    for (const key of FORM_KEYS) {
      const p = FORM_REGISTRY[key];
      if (p.leaf.content === "record" || p.leaf.content === "record_prose") {
        expect(p.leaf.recordSchema).toBeDefined();
        expect(p.leaf.recordSchema!.fields.length).toBeGreaterThan(0);
      }
    }
  });

  it("a skeleton seeds only node types the form actually declares", () => {
    const walk = (declared: Set<string>, seeds: NodeSeed[]): void => {
      for (const s of seeds) {
        expect(declared.has(s.nodeType)).toBe(true);
        if (s.children) walk(declared, s.children);
      }
    };
    for (const key of FORM_KEYS) {
      const p = FORM_REGISTRY[key];
      if (p.skeleton) walk(new Set(p.tree.levels.map((l) => l.nodeType)), p.skeleton);
    }
  });

  it("isFormKey + getForm round-trip; an unknown key is rejected", () => {
    expect(isFormKey("novel")).toBe(true);
    expect(isFormKey("villanelle")).toBe(false); // not yet in the registry (would be one object literal)
    expect(getForm("novel")?.key).toBe("novel");
    expect(getForm("villanelle")).toBeUndefined();
  });
});

describe("tree navigation answers what may nest under what", () => {
  it("a novel nests manuscript -> part -> chapter -> scene, and a scene is a leaf", () => {
    const novel = FORM_REGISTRY.novel;
    expect(canNest(novel, "manuscript", "part")).toBe(true);
    expect(canNest(novel, "part", "chapter")).toBe(true);
    expect(canNest(novel, "chapter", "scene")).toBe(true);
    expect(canNest(novel, "manuscript", "scene")).toBe(false); // a scene cannot float at the top
    expect(isLeafType(novel, "scene")).toBe(true);
    expect(isLeafType(novel, "chapter")).toBe(false);
    expect(allowedChildTypes(novel, "scene")).toEqual([]); // a leaf has no children
  });

  it("a haiku is a single leaf (maxDepth 1, the root is the leaf)", () => {
    const haiku = FORM_REGISTRY.haiku;
    expect(haiku.tree.maxDepth).toBe(1);
    expect(isLeafType(haiku, "poem")).toBe(true);
  });
});

describe("the advisory constraint lenses read metrics deterministically (mirror, never verdict)", () => {
  it("a haiku in 5-7-5 reads ok; the wrong shape reads off, never blocking", () => {
    const haiku = FORM_REGISTRY.haiku;
    const good = evaluateForm(haiku, { lineCount: 3, syllablesPerLine: [5, 7, 5] });
    expect(good.every((f) => f.status === "ok")).toBe(true);

    const wrongSyllables = evaluateForm(haiku, { lineCount: 3, syllablesPerLine: [5, 7, 6] });
    expect(wrongSyllables.find((f) => f.constraintKind === "syllable_pattern")?.status).toBe("off");

    const wrongLines = evaluateForm(haiku, { lineCount: 2, syllablesPerLine: [5, 7] });
    expect(wrongLines.find((f) => f.constraintKind === "line_count")?.status).toBe("off");
  });

  it("a constraint with no metric is deferred, never a false pass", () => {
    const haiku = FORM_REGISTRY.haiku;
    const findings = evaluateForm(haiku, {}); // nothing measured yet
    expect(findings.every((f) => f.status === "deferred")).toBe(true);
  });

  it("a sonnet's line count reads now; its meter / rhyme / volta defer until the scansion engine", () => {
    const sonnet = FORM_REGISTRY.sonnet;
    const findings = evaluateForm(sonnet, { lineCount: 14 });
    expect(findings.find((f) => f.constraintKind === "line_count")?.status).toBe("ok");
    expect(findings.find((f) => f.constraintKind === "meter")?.status).toBe("deferred");
    expect(findings.find((f) => f.constraintKind === "rhyme_scheme")?.status).toBe("deferred");
    expect(findings.find((f) => f.constraintKind === "volta")?.status).toBe("deferred");
  });

  it("a dictionary entry wants a headword: present reads ok, missing reads off, no record defers", () => {
    const dict = FORM_REGISTRY.dictionary;
    expect(
      evaluateForm(dict, { record: { headword: "mela" } }).find(
        (f) => f.constraintKind === "required_record_fields",
      )?.status,
    ).toBe("ok");
    expect(
      evaluateForm(dict, { record: {} }).find((f) => f.constraintKind === "required_record_fields")
        ?.status,
    ).toBe("off");
    expect(
      evaluateForm(dict, { record: null }).find(
        (f) => f.constraintKind === "required_record_fields",
      )?.status,
    ).toBe("deferred");
  });

  it("a word-count target is soft: within ~25% reads ok, far off reads off (a nudge, not a gate)", () => {
    const novel = FORM_REGISTRY.novel;
    const onTarget = evaluateForm(novel, { wordCount: 88000 }).find(
      (f) => f.constraintKind === "target_word_count" && f.message.includes("88"),
    );
    expect(onTarget?.status).toBe("ok");
    const tiny = evaluateForm(novel, { wordCount: 5000 }).find(
      (f) => f.constraintKind === "target_word_count",
    );
    expect(tiny?.status).toBe("off");
  });
});

describe("shapeOf discriminates the four leaf payloads", () => {
  it("reads the filled slots: container / prose / record / record_prose / work_ref", () => {
    expect(shapeOf({ pieceId: null, childWorkId: null, record: {} })).toBe("container");
    expect(shapeOf({ pieceId: "p1", childWorkId: null, record: {} })).toBe("prose");
    expect(shapeOf({ pieceId: null, childWorkId: null, record: { headword: "x" } })).toBe("record");
    expect(shapeOf({ pieceId: "p1", childWorkId: null, record: { headword: "x" } })).toBe(
      "record_prose",
    );
    expect(shapeOf({ pieceId: null, childWorkId: "w2", record: {} })).toBe("work_ref");
  });
});
