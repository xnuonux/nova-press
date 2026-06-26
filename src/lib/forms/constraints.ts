// nova press · the mythos · form navigation + advisory constraint checks.
//
// two jobs: (1) answer "what may nest under what" for a form's tree (the
// binder + node-creation validation read this), and (2) evaluate a form's
// advisory craft lenses against ALREADY-COMPUTED metrics. these are a
// mirror, never a verdict ... a finding is descriptive and never blocks a
// save. the deterministic engines that produce the metrics (the syllabifier,
// the meter/rhyme scansion) land in a later phase; constraints that need
// them report "deferred", never a false pass.

import type { FormProfile, FormProfileKey, FormConstraint, NodeLevelSpec } from "./types";
import { FORM_REGISTRY, isFormKey } from "./registry";

// ---- tree navigation -----------------------------------------------------

export function getForm(key: string): FormProfile | undefined {
  return isFormKey(key) ? FORM_REGISTRY[key as FormProfileKey] : undefined;
}

export function levelFor(profile: FormProfile, nodeType: string): NodeLevelSpec | undefined {
  return profile.tree.levels.find((l) => l.nodeType === nodeType);
}

export function allowedChildTypes(profile: FormProfile, nodeType: string): string[] {
  return levelFor(profile, nodeType)?.allowedChildTypes ?? [];
}

export function isLeafType(profile: FormProfile, nodeType: string): boolean {
  const level = levelFor(profile, nodeType);
  if (!level) return false;
  return level.isLeaf === true || level.allowedChildTypes.length === 0;
}

export function leafTypesOf(profile: FormProfile): string[] {
  return profile.tree.levels.filter((l) => isLeafType(profile, l.nodeType)).map((l) => l.nodeType);
}

/** can a `childType` node be created under a `parentType` node in this form? */
export function canNest(profile: FormProfile, parentType: string, childType: string): boolean {
  return allowedChildTypes(profile, parentType).includes(childType);
}

// ---- advisory constraint evaluation --------------------------------------

/** the metrics a caller computes from a leaf's body / record before checking. */
export interface FormMetrics {
  lineCount?: number;
  stanzaCount?: number;
  syllablesPerLine?: number[];
  lineLengths?: number[];
  wordCount?: number;
  record?: Record<string, unknown> | null;
}

export interface FormFinding {
  constraintKind: FormConstraint["kind"];
  /** ok = met; off = present but not met (descriptive, never blocking); deferred = needs an engine not built yet. */
  status: "ok" | "off" | "deferred";
  message: string;
}

/** a human-readable, lowercase, mirror-not-verdict line for any constraint. */
export function describeConstraint(c: FormConstraint): string {
  switch (c.kind) {
    case "line_count":
      return `${c.lines} lines per ${c.scope}`;
    case "syllable_pattern":
      return `syllables per line: ${c.pattern.join("-")}`;
    case "stanza_count":
      return `${c.stanzas} stanzas`;
    case "line_length_range":
      return `line length ${c.min ?? "?"} to ${c.max ?? "?"}`;
    case "rhyme_scheme":
      return `rhyme scheme ${c.scheme}`;
    case "meter":
      return `${c.perLine} ${c.foot} feet per line`;
    case "volta":
      return `a turn after line ${c.afterLine}`;
    case "refrain":
      return `refrain on lines ${c.lines.join(", ")}`;
    case "target_word_count":
      return `around ${c.words.toLocaleString("en-us")} words per ${c.scope}`;
    case "required_record_fields":
      return `fields wanted: ${c.fields.join(", ")}`;
  }
}

const NEEDS_SCANSION: ReadonlySet<FormConstraint["kind"]> = new Set([
  "meter",
  "rhyme_scheme",
  "volta",
  "refrain",
]);

/**
 * evaluate a form's constraints against pre-computed metrics. each finding is
 * descriptive; nothing here blocks a save (the form lens is a mirror). a
 * constraint whose metric is absent, or that needs the scansion engine, is
 * reported "deferred" rather than guessed.
 */
export function evaluateForm(profile: FormProfile, metrics: FormMetrics): FormFinding[] {
  const out: FormFinding[] = [];
  for (const c of profile.constraints) {
    if (NEEDS_SCANSION.has(c.kind)) {
      out.push({
        constraintKind: c.kind,
        status: "deferred",
        message: `${describeConstraint(c)} ... the scansion lens reads this once it lands.`,
      });
      continue;
    }
    out.push(checkOne(c, metrics));
  }
  return out;
}

function checkOne(c: FormConstraint, m: FormMetrics): FormFinding {
  const deferred = (): FormFinding => ({
    constraintKind: c.kind,
    status: "deferred",
    message: `${describeConstraint(c)} ... no metric yet.`,
  });
  switch (c.kind) {
    case "line_count": {
      if (m.lineCount == null) return deferred();
      const ok = m.lineCount === c.lines;
      return {
        constraintKind: c.kind,
        status: ok ? "ok" : "off",
        message: ok ? `${c.lines} lines` : `${m.lineCount} lines, this form wants ${c.lines}`,
      };
    }
    case "syllable_pattern": {
      if (!m.syllablesPerLine) return deferred();
      const got = m.syllablesPerLine;
      const want = c.pattern;
      const matches = got.length === want.length && want.every((n, i) => got[i] === n);
      return {
        constraintKind: c.kind,
        status: matches ? "ok" : "off",
        message: matches
          ? `${want.join("-")}`
          : `${got.join("-")}, this form wants ${want.join("-")}`,
      };
    }
    case "stanza_count": {
      if (m.stanzaCount == null) return deferred();
      const ok = m.stanzaCount === c.stanzas;
      return {
        constraintKind: c.kind,
        status: ok ? "ok" : "off",
        message: ok
          ? `${c.stanzas} stanzas`
          : `${m.stanzaCount} stanzas, this form wants ${c.stanzas}`,
      };
    }
    case "line_length_range": {
      if (!m.lineLengths) return deferred();
      const over = m.lineLengths.filter(
        (n) => (c.max != null && n > c.max) || (c.min != null && n < c.min),
      ).length;
      return {
        constraintKind: c.kind,
        status: over === 0 ? "ok" : "off",
        message:
          over === 0
            ? `lines within range`
            : `${over} lines outside ${c.min ?? "?"} to ${c.max ?? "?"}`,
      };
    }
    case "target_word_count": {
      if (m.wordCount == null) return deferred();
      // a soft target ... within 25% reads as on-target. never a hard fail, just a nudge.
      const ratio = c.words === 0 ? 1 : m.wordCount / c.words;
      const onTarget = ratio >= 0.75 && ratio <= 1.25;
      return {
        constraintKind: c.kind,
        status: onTarget ? "ok" : "off",
        message: `${m.wordCount.toLocaleString("en-us")} of ~${c.words.toLocaleString("en-us")} words`,
      };
    }
    case "required_record_fields": {
      const rec = m.record;
      if (!rec) return deferred();
      const missing = c.fields.filter((f) => {
        const v = rec[f];
        return (
          v == null ||
          (typeof v === "string" && v.trim() === "") ||
          (Array.isArray(v) && v.length === 0)
        );
      });
      return {
        constraintKind: c.kind,
        status: missing.length === 0 ? "ok" : "off",
        message:
          missing.length === 0 ? `all wanted fields present` : `missing: ${missing.join(", ")}`,
      };
    }
    default:
      return deferred();
  }
}
