/**
 * timeline series ... the pure x/y math behind the breathing timeline.
 *
 * turns a VoiceSnapshot[] into normalized chartable points so the SVG stays
 * dumb (it just reads x/y in 0..1). no react, no db ... fully unit-tested, the
 * same pure-core separation voice-stats and voice-distill already model. all the
 * fiddly cases (empty, single point, a flat metric, uneven time gaps) are
 * decided here, once, where they can be tested.
 */

import type { VoiceSnapshot } from "@/lib/db/voice-snapshots";

export type MetricKey = "sentence_length" | "formality" | "punctuation";

export interface MetricMeta {
  key: MetricKey;
  label: string;
  // format a raw value for the axis / readout.
  format: (value: number) => string;
}

const METRIC_BY_KEY: Record<MetricKey, MetricMeta> = {
  sentence_length: {
    key: "sentence_length",
    label: "sentence length",
    format: (v) => `${Math.round(v)} words`,
  },
  formality: {
    key: "formality",
    label: "formality",
    format: (v) => v.toFixed(2),
  },
  punctuation: {
    key: "punctuation",
    label: "punctuation",
    format: (v) => `${Math.round(v)} / 1k`,
  },
};

export const METRICS: MetricMeta[] = [
  METRIC_BY_KEY.sentence_length,
  METRIC_BY_KEY.formality,
  METRIC_BY_KEY.punctuation,
];

export function metricMeta(key: MetricKey): MetricMeta {
  return METRIC_BY_KEY[key];
}

export interface SeriesPoint {
  index: number; // index into the ascending-sorted snapshots
  x: number; // 0..1 across the rail (gap-aware on captured_at)
  y: number; // 0..1, normalized within the metric's range (0.5 when flat/single/absent)
  value: number | null;
  capturedAt: string;
}

export interface TimelineSeries {
  metric: MetricMeta;
  points: SeriesPoint[];
  min: number;
  max: number;
  // false when there are <2 numeric points or they're all equal ... there is no
  // real line to draw, only dots. the UI shows the honest single/flat state.
  hasRange: boolean;
}

// pull a metric's raw number from a snapshot (null when the column is absent).
export function metricValue(s: VoiceSnapshot, key: MetricKey): number | null {
  switch (key) {
    case "sentence_length":
      return s.sentenceLengthAvg;
    case "formality":
      return s.formalityScore;
    case "punctuation": {
      const vals = Object.values(s.punctuationStyle);
      if (vals.length === 0) return null;
      const sum = vals.reduce((a, b) => a + b, 0);
      return Math.round(sum * 100) / 100;
    }
  }
}

// snapshots sorted oldest -> newest by captured_at (the x-axis direction). pure,
// so the read layer can return newest-first and the chart still reads left-old.
export function sortAscending(snapshots: VoiceSnapshot[]): VoiceSnapshot[] {
  return [...snapshots].sort((a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt));
}

// gap-aware x in 0..1 from captured_at. single point or all-equal time -> 0.5
// (don't fake a spread); otherwise proportional to the real time gaps.
function xPositions(sorted: VoiceSnapshot[]): number[] {
  if (sorted.length <= 1) return sorted.map(() => 0.5);
  const ts = sorted.map((s) => Date.parse(s.capturedAt));
  const valid = ts.map((t) => (Number.isNaN(t) ? 0 : t));
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const span = max - min;
  if (span <= 0) return valid.map((_, i) => i / (sorted.length - 1));
  return valid.map((t) => (t - min) / span);
}

/**
 * build the normalized series for one metric. y is 0 at the metric's min and 1
 * at its max across the writer's history; a flat or single-point metric sits at
 * 0.5 (honest: no movement to show). x is gap-aware time.
 */
export function buildTimelineSeries(snapshots: VoiceSnapshot[], key: MetricKey): TimelineSeries {
  const metric = metricMeta(key);
  const sorted = sortAscending(snapshots);
  const xs = xPositions(sorted);
  const values = sorted.map((s) => metricValue(s, key));
  const numeric = values.filter((v): v is number => v !== null);
  const min = numeric.length ? Math.min(...numeric) : 0;
  const max = numeric.length ? Math.max(...numeric) : 0;
  const hasRange = numeric.length >= 2 && max > min;

  const points: SeriesPoint[] = sorted.map((s, i) => {
    const value = values[i] ?? null;
    const x = xs[i] ?? 0.5;
    const y = value === null ? 0.5 : hasRange ? (value - min) / (max - min) : 0.5;
    return { index: i, x, y, value, capturedAt: s.capturedAt };
  });

  return { metric, points, min, max, hasRange };
}
