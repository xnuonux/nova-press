/**
 * voice drift ... the single deterministic source of every number the
 * interrogable voiceprint ever states.
 *
 * pure (imports ONLY the VoiceSnapshot type, zero db/ai/server/react), the exact
 * posture of timeline-series.ts, fully unit-tested with no mocks. this is the
 * anti-hallucination spine of chunk 2: the model NEVER computes a figure. it
 * receives the finished-english facts formatDriftForPrompt() renders here and
 * narrates them. the same computeVoiceDrift() feeds the timeline's compare-mode
 * chips on the client, so what the chart shows and what nova says can never
 * disagree ... they come from this one function.
 *
 * null-not-zero discipline: a metric absent on either side yields a null delta
 * (narrated "not enough signal"), never a fabricated 0 and never an inverted
 * direction. EVERY number is pre-rounded to its display form here, defensively,
 * so a raw-precision value (from any future numeric source) can never reach the
 * prompt for the model to "tidy" into a new figure.
 */

import type { VoiceSnapshot } from "@/lib/db/voice-snapshots";

type Dir3 = "up" | "down" | "stable";

export interface MetricDelta {
  previous: number | null;
  current: number | null;
  delta: number | null;
  direction: Dir3;
}

export interface SentenceLengthDrift {
  previous: number | null;
  current: number | null;
  delta: number | null;
  direction: "longer" | "shorter" | "stable";
}

export interface FormalityDrift {
  previous: number | null;
  current: number | null;
  delta: number | null;
  direction: "more formal" | "less formal" | "stable";
  magnitude: number | null;
}

export interface PhraseDrift {
  idiosyncratic: { gained: string[]; dropped: string[] };
  avoided: { gained: string[]; dropped: string[] };
}

export interface RegisterShift {
  previous: string | null;
  current: string | null;
  changed: boolean;
}

export interface SnapshotMeta {
  capturedAt: string;
  samplesCount: number;
  confidence: number | null;
}

export interface VoiceDriftReport {
  older: SnapshotMeta;
  newer: SnapshotMeta;
  spanDays: number | null;
  sentenceLength: SentenceLengthDrift;
  formality: FormalityDrift;
  punctuation: Record<string, MetricDelta>;
  phrases: PhraseDrift;
  register: RegisterShift;
  // false when every sub-delta is null/empty/stable ... the stretch held steady,
  // and the prompt says so instead of manufacturing a trend.
  hasSignal: boolean;
}

const DAY_MS = 86_400_000;
const PHRASE_MAX = 4;
const PHRASE_CHARS = 60;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * the ONE primitive every numeric field routes through, so "moved vs steady" is
 * decided in a single tested place with an epsilon derived from each column's
 * own granularity. null on either side -> { delta: null, direction: "stable" }:
 * never assume zero, never invert.
 */
export function delta(
  previous: number | null,
  current: number | null,
  epsilon: number,
): { delta: number | null; direction: Dir3 } {
  if (previous === null || current === null) return { delta: null, direction: "stable" };
  const d = round2(current - previous);
  if (Math.abs(d) < epsilon) return { delta: d, direction: "stable" };
  return { delta: d, direction: d > 0 ? "up" : "down" };
}

// sentence_length_avg is an integer column, so < 0.5 word is noise.
export function computeSentenceLengthSlope(
  older: VoiceSnapshot,
  newer: VoiceSnapshot,
): SentenceLengthDrift {
  const previous = older.sentenceLengthAvg === null ? null : Math.round(older.sentenceLengthAvg);
  const current = newer.sentenceLengthAvg === null ? null : Math.round(newer.sentenceLengthAvg);
  const d = delta(previous, current, 0.5);
  const direction = d.direction === "up" ? "longer" : d.direction === "down" ? "shorter" : "stable";
  return { previous, current, delta: d.delta, direction };
}

// formality_score is a 0..1 score. a DIRECTIONAL shift with magnitude = |delta|,
// never a ratio. pre-rounded to 2dp defensively so a raw value never leaks.
export function computeFormalityShift(older: VoiceSnapshot, newer: VoiceSnapshot): FormalityDrift {
  const previous = older.formalityScore === null ? null : round2(older.formalityScore);
  const current = newer.formalityScore === null ? null : round2(newer.formalityScore);
  const d = delta(previous, current, 0.03);
  const direction =
    d.direction === "up" ? "more formal" : d.direction === "down" ? "less formal" : "stable";
  const magnitude = d.delta === null ? null : round2(Math.abs(d.delta));
  return { previous, current, delta: d.delta, direction, magnitude };
}

// the union of both punctuation fingerprints. NULL-NOT-ZERO: a key truly absent
// from a snapshot's record -> null on that side -> null delta ("unmeasured");
// but a mark present-at-0 in one and present in the other is a REAL measured
// per-1k rate, so its delta is computed. all rates pre-rounded.
export function computePunctuationDrift(
  older: VoiceSnapshot,
  newer: VoiceSnapshot,
): Record<string, MetricDelta> {
  const keys = new Set<string>([
    ...Object.keys(older.punctuationStyle),
    ...Object.keys(newer.punctuationStyle),
  ]);
  const out: Record<string, MetricDelta> = {};
  for (const key of keys) {
    const prevRaw = older.punctuationStyle[key];
    const currRaw = newer.punctuationStyle[key];
    const previous = typeof prevRaw === "number" ? round2(prevRaw) : null;
    const current = typeof currRaw === "number" ? round2(currRaw) : null;
    const d = delta(previous, current, 0.5);
    out[key] = { previous, current, delta: d.delta, direction: d.direction };
  }
  return out;
}

// normalized key -> first verbatim original. normalize (trim + lowercase) to
// kill cosmetic churn, but PRESERVE the original string for display/narration.
function normMap(list: string[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const s of list) {
    const norm = s.trim().toLowerCase();
    if (norm && !m.has(norm)) m.set(norm, s.trim());
  }
  return m;
}

function setDiff(
  olderList: string[],
  newerList: string[],
): { gained: string[]; dropped: string[] } {
  const o = normMap(olderList);
  const n = normMap(newerList);
  const gained: string[] = [];
  const dropped: string[] = [];
  for (const [k, v] of n) if (!o.has(k)) gained.push(v);
  for (const [k, v] of o) if (!n.has(k)) dropped.push(v);
  return { gained, dropped };
}

// idiosyncratic + avoided kept SEPARATE so "started avoiding X" can never read
// as "started using X". untrusted snapshot text ... rides through as data only.
export function computeSignaturePhraseDrift(
  older: VoiceSnapshot,
  newer: VoiceSnapshot,
): PhraseDrift {
  return {
    idiosyncratic: setDiff(older.idiosyncraticPhrases, newer.idiosyncraticPhrases),
    avoided: setDiff(older.avoidedPhrases, newer.avoidedPhrases),
  };
}

export function computeRegisterShift(older: VoiceSnapshot, newer: VoiceSnapshot): RegisterShift {
  const previous = older.register?.trim() ? older.register.trim() : null;
  const current = newer.register?.trim() ? newer.register.trim() : null;
  const changed =
    previous !== null && current !== null && previous.toLowerCase() !== current.toLowerCase();
  return { previous, current, changed };
}

function metaOf(s: VoiceSnapshot): SnapshotMeta {
  return {
    capturedAt: s.capturedAt,
    samplesCount: s.samplesCount,
    confidence: s.extractionConfidence === null ? null : round2(s.extractionConfidence),
  };
}

/**
 * THE report. sorts the pair internally by captured_at ascending (belt-and-
 * suspenders even though the route also sorts) so older/newer is always correct
 * and a direction word can never invert. deterministic + pre-rounded, so the
 * same two snapshots always yield a byte-identical report.
 */
export function computeVoiceDrift(a: VoiceSnapshot, b: VoiceSnapshot): VoiceDriftReport {
  const [older, newer] = Date.parse(a.capturedAt) <= Date.parse(b.capturedAt) ? [a, b] : [b, a];

  const olderMs = Date.parse(older.capturedAt);
  const newerMs = Date.parse(newer.capturedAt);
  const spanDays =
    Number.isNaN(olderMs) || Number.isNaN(newerMs)
      ? null
      : Math.round((newerMs - olderMs) / DAY_MS);

  const sentenceLength = computeSentenceLengthSlope(older, newer);
  const formality = computeFormalityShift(older, newer);
  const punctuation = computePunctuationDrift(older, newer);
  const phrases = computeSignaturePhraseDrift(older, newer);
  const register = computeRegisterShift(older, newer);

  const hasSignal =
    sentenceLength.direction !== "stable" ||
    formality.direction !== "stable" ||
    Object.values(punctuation).some((p) => p.direction !== "stable") ||
    phrases.idiosyncratic.gained.length > 0 ||
    phrases.idiosyncratic.dropped.length > 0 ||
    phrases.avoided.gained.length > 0 ||
    phrases.avoided.dropped.length > 0 ||
    register.changed;

  return {
    older: metaOf(older),
    newer: metaOf(newer),
    spanDays,
    sentenceLength,
    formality,
    punctuation,
    phrases,
    register,
    hasSignal,
  };
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// deterministic, tz-independent capture date (utc), lowercase.
export function formatSnapshotDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "an earlier reading";
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()} ${d.getUTCFullYear()}`;
}

function quoteList(items: string[]): string {
  return items
    .slice(0, PHRASE_MAX)
    .map((s) => `"${s.slice(0, PHRASE_CHARS)}"`)
    .join(", ");
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

/**
 * the finished-facts block ... the model's ENTIRE factual diet. every number is
 * already computed and pre-rounded above; the model narrates these fragments and
 * can derive nothing. a null field renders "not enough signal"; hasSignal=false
 * renders the steady line. exported so the gold-standard test can assert no digit
 * in the model's answer is absent from this block.
 */
export function formatDriftForPrompt(report: VoiceDriftReport): string {
  const lines: string[] = [];
  lines.push(
    `older reading: ${formatSnapshotDate(report.older.capturedAt)} (heard ${report.older.samplesCount} ${report.older.samplesCount === 1 ? "piece" : "pieces"}).`,
  );
  lines.push(
    `newer reading: ${formatSnapshotDate(report.newer.capturedAt)} (heard ${report.newer.samplesCount} ${report.newer.samplesCount === 1 ? "piece" : "pieces"}).`,
  );
  if (report.spanDays !== null) {
    lines.push(`${report.spanDays} ${report.spanDays === 1 ? "day" : "days"} apart.`);
  }

  if (!report.hasSignal) {
    lines.push(
      "these two readings are nearly identical ... the voice held steady, no real movement to report.",
    );
    return lines.join("\n");
  }

  const sl = report.sentenceLength;
  if (sl.previous === null || sl.current === null || sl.delta === null) {
    lines.push("sentence length: not enough signal.");
  } else {
    lines.push(
      `sentence length: ${sl.previous} -> ${sl.current} words (${signed(sl.delta)}, ${sl.direction}).`,
    );
  }

  const fm = report.formality;
  if (fm.previous === null || fm.current === null) {
    lines.push("formality: not enough signal.");
  } else if (fm.direction === "stable") {
    lines.push(`formality: ${fm.previous} -> ${fm.current} (steady).`);
  } else {
    lines.push(`formality: ${fm.previous} -> ${fm.current} (${fm.direction}, by ${fm.magnitude}).`);
  }

  const movers = Object.entries(report.punctuation)
    .filter(([, p]) => p.delta !== null && p.direction !== "stable")
    .sort((x, y) => Math.abs(y[1].delta ?? 0) - Math.abs(x[1].delta ?? 0))
    .slice(0, 3);
  for (const [key, p] of movers) {
    lines.push(`${key}: ${p.previous} -> ${p.current} per 1k words (${p.direction}).`);
  }

  if (report.phrases.idiosyncratic.gained.length > 0) {
    lines.push(`started leaning on: ${quoteList(report.phrases.idiosyncratic.gained)}.`);
  }
  if (report.phrases.idiosyncratic.dropped.length > 0) {
    lines.push(`stopped reaching for: ${quoteList(report.phrases.idiosyncratic.dropped)}.`);
  }
  if (report.phrases.avoided.gained.length > 0) {
    lines.push(`started steering clear of: ${quoteList(report.phrases.avoided.gained)}.`);
  }
  if (report.phrases.avoided.dropped.length > 0) {
    lines.push(`no longer avoiding: ${quoteList(report.phrases.avoided.dropped)}.`);
  }

  if (report.register.changed) {
    lines.push(`register: "${report.register.previous}" -> "${report.register.current}".`);
  }

  if (report.older.confidence !== null || report.newer.confidence !== null) {
    lines.push(
      `nova's confidence in each read: ${report.older.confidence ?? "unknown"} -> ${report.newer.confidence ?? "unknown"}.`,
    );
  }

  return lines.join("\n");
}
