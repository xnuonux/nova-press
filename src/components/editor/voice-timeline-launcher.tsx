"use client";

/**
 * the breathing timeline ... your voice over time.
 *
 * every time you train nova on your voice, nova freezes the distilled
 * fingerprint into an immutable snapshot. this panel draws those snapshots as a
 * scrubbable timeline: drag the playhead (or arrow-key it) across the dots and
 * watch a metric move ... your sentence length lengthening, your formality
 * drifting, your punctuation thinning out. land on a dot and the fingerprint
 * card shows the register + signature you carried at that moment.
 *
 * the snapshots arrive as a server-read prop (no client fetch, no new route), so
 * the panel opens instantly. it's a pure overlay over read-only history: nova
 * never rewrites a past dot, and the empty / single-point states are first-class
 * (no fake chart when there's nothing yet to show).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { VoiceSnapshot } from "@/lib/db/voice-snapshots";
import {
  buildTimelineSeries,
  METRICS,
  metricValue,
  sortAscending,
  type MetricKey,
} from "@/lib/voice/timeline-series";

export function VoiceTimelineLauncher({ snapshots }: { snapshots: VoiceSnapshot[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="np-warm inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em]"
        style={{ color: "var(--lunari-fg-subtle)" }}
      >
        your voice over time
        <span aria-hidden>↗</span>
      </button>
      {open ? <VoiceTimelinePanel snapshots={snapshots} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function VoiceTimelinePanel({
  snapshots,
  onClose,
}: {
  snapshots: VoiceSnapshot[];
  onClose: () => void;
}) {
  // the chart reads oldest -> newest left -> right; the server hands them
  // newest-first, so sort once here for the whole panel.
  const sorted = useMemo(() => sortAscending(snapshots), [snapshots]);
  const [metric, setMetric] = useState<MetricKey>("sentence_length");
  // the selected dot defaults to the newest (rightmost) ... "where you are now".
  const [selected, setSelected] = useState(() => Math.max(0, sorted.length - 1));

  // esc closes.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4 sm:p-8"
      style={{ background: "rgba(5, 5, 9, 0.62)", backdropFilter: "blur(6px)" }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="np-repurpose-sheet relative my-auto w-full max-w-2xl rounded-2xl"
        style={{
          background: "var(--lunari-bg-surface)",
          border: "1px solid var(--lunari-border)",
          boxShadow: "0 40px 120px -40px rgba(0,0,0,0.7), 0 0 0 1px rgba(201,168,76,0.04)",
        }}
      >
        {/* header */}
        <div
          className="flex items-start justify-between gap-4 border-b px-7 py-5"
          style={{ borderColor: "var(--lunari-border)" }}
        >
          <div>
            <h2
              className="font-serif text-2xl tracking-tight"
              style={{ color: "var(--lunari-fg-primary)" }}
            >
              your voice over time
            </h2>
            <p className="mt-1 font-serif text-sm" style={{ color: "var(--lunari-fg-muted)" }}>
              {sorted.length <= 1
                ? "one reading so far ... a record starts here."
                : `${sorted.length} readings ... drag across them to watch your voice move.`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="close"
            className="-mr-1 -mt-1 rounded-md px-2 py-1 font-mono text-lg leading-none transition-opacity hover:opacity-70"
            style={{ color: "var(--lunari-fg-subtle)" }}
          >
            ×
          </button>
        </div>

        {sorted.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* metric toggle */}
            <div className="flex gap-1 px-5 pt-4">
              {METRICS.map((m) => {
                const isActive = m.key === metric;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setMetric(m.key)}
                    className="rounded-lg px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.16em] transition-all duration-200"
                    style={
                      isActive
                        ? { background: "var(--nova-accent-soft)", color: "var(--nova-accent)" }
                        : { color: "var(--lunari-fg-subtle)" }
                    }
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>

            <div className="px-7 pb-4 pt-3">
              <TimelineChart
                snapshots={sorted}
                metric={metric}
                selected={Math.min(selected, sorted.length - 1)}
                onSelect={setSelected}
              />
            </div>

            <div className="border-t px-7 py-5" style={{ borderColor: "var(--lunari-border)" }}>
              <FingerprintCard
                snapshot={sorted[Math.min(selected, sorted.length - 1)]}
                metric={metric}
                isLatest={Math.min(selected, sorted.length - 1) === sorted.length - 1}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// viewBox geometry. the SVG scales to the panel width; coords are virtual.
const VW = 680;
const VH = 200;
const PAD_L = 30;
const PAD_R = 26;
const PAD_T = 22;
const PAD_B = 40;
const PLOT_W = VW - PAD_L - PAD_R;
const PLOT_H = VH - PAD_T - PAD_B;

function TimelineChart({
  snapshots,
  metric,
  selected,
  onSelect,
}: {
  snapshots: VoiceSnapshot[];
  metric: MetricKey;
  selected: number;
  onSelect: (index: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const series = useMemo(() => buildTimelineSeries(snapshots, metric), [snapshots, metric]);

  const scaled = series.points.map((p) => ({
    ...p,
    cx: PAD_L + p.x * PLOT_W,
    cy: PAD_T + (1 - p.y) * PLOT_H, // higher value sits higher on screen
  }));

  // map a clientX onto the nearest dot's index ... the scrub.
  const selectNearest = useCallback(
    (clientX: number) => {
      const svg = svgRef.current;
      if (!svg || scaled.length === 0) return;
      const rect = svg.getBoundingClientRect();
      if (rect.width === 0) return;
      const vx = ((clientX - rect.left) / rect.width) * VW;
      let best = 0;
      let bestDist = Infinity;
      for (const p of scaled) {
        const d = Math.abs(p.cx - vx);
        if (d < bestDist) {
          bestDist = d;
          best = p.index;
        }
      }
      onSelect(best);
    },
    [scaled, onSelect],
  );

  const dragging = useRef(false);
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    selectNearest(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragging.current) selectNearest(e.clientX);
  };
  const endDrag = (e: React.PointerEvent<SVGSVGElement>) => {
    dragging.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // arrow keys step the playhead between dots.
  const onKeyDown = (e: React.KeyboardEvent<SVGSVGElement>) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      onSelect(Math.max(0, selected - 1));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      onSelect(Math.min(scaled.length - 1, selected + 1));
    }
  };

  const sel = scaled[Math.min(selected, scaled.length - 1)];
  const baselineY = PAD_T + PLOT_H;
  // the polyline only when there's a real range to show; otherwise dots alone.
  const linePath = series.hasRange
    ? scaled.map((p, i) => `${i === 0 ? "M" : "L"} ${p.cx.toFixed(1)} ${p.cy.toFixed(1)}`).join(" ")
    : null;

  return (
    <div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VW} ${VH}`}
        className="w-full touch-none select-none"
        style={{ cursor: "pointer", overflow: "visible" }}
        role="slider"
        tabIndex={0}
        aria-label="voice timeline scrubber"
        aria-valuemin={0}
        aria-valuemax={scaled.length - 1}
        aria-valuenow={selected}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
      >
        <defs>
          <linearGradient id="np-tl-stroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--nova-accent)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--nova-accent)" stopOpacity="0.95" />
          </linearGradient>
        </defs>

        {/* baseline rail */}
        <line
          x1={PAD_L}
          y1={baselineY}
          x2={VW - PAD_R}
          y2={baselineY}
          className="np-timeline-rail"
        />

        {/* the playhead, behind the dots */}
        {sel ? (
          <line
            x1={sel.cx}
            y1={PAD_T - 6}
            x2={sel.cx}
            y2={baselineY + 6}
            className="np-timeline-playhead"
          />
        ) : null}

        {/* the metric line */}
        {linePath ? <path d={linePath} className="np-timeline-line" /> : null}

        {/* the dots ... size by samples, opacity by extraction confidence so a
            low-signal reading literally looks fainter (the chart tells the truth
            about how much nova knew). */}
        {scaled.map((p) => {
          const snap = snapshots[p.index];
          const conf = snap?.extractionConfidence ?? 0.7;
          const samples = snap?.samplesCount ?? 0;
          const r = 3.4 + (Math.min(samples, 6) / 6) * 2.6;
          const isSel = p.index === selected;
          return (
            <g key={snap?.id ?? p.index}>
              <circle
                cx={p.cx}
                cy={p.cy}
                r={isSel ? r + 2.2 : r}
                className="np-timeline-dot"
                style={{
                  opacity: isSel ? 1 : 0.35 + 0.6 * Math.max(0, Math.min(1, conf)),
                  fill: isSel ? "var(--nova-accent)" : "var(--lunari-fg-muted)",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(p.index);
                }}
              />
              {isSel ? <circle cx={p.cx} cy={p.cy} r={r + 6} className="np-timeline-halo" /> : null}
            </g>
          );
        })}

        {/* the "now" tick under the newest dot. */}
        {scaled.length > 0
          ? (() => {
              const last = scaled[scaled.length - 1];
              if (!last) return null;
              return (
                <text
                  x={last.cx}
                  y={baselineY + 22}
                  textAnchor="middle"
                  className="np-timeline-now"
                >
                  now
                </text>
              );
            })()
          : null}
      </svg>
    </div>
  );
}

function FingerprintCard({
  snapshot,
  metric,
  isLatest,
}: {
  snapshot: VoiceSnapshot | undefined;
  metric: MetricKey;
  isLatest: boolean;
}) {
  if (!snapshot) return null;
  const meta = METRICS.find((m) => m.key === metric);
  const raw = metricValue(snapshot, metric);
  const readout = raw === null ? "not enough signal" : (meta?.format(raw) ?? String(raw));
  const phrases = snapshot.idiosyncraticPhrases.slice(0, 4);

  return (
    <div className="np-partner-content">
      <div className="flex items-baseline justify-between gap-4">
        <span
          className="font-mono text-[10px] uppercase tracking-[0.22em]"
          style={{ color: "var(--lunari-fg-subtle)" }}
        >
          {formatDate(snapshot.capturedAt)}
          {isLatest ? " · now" : ""}
        </span>
        <span
          className="font-mono text-[11px] uppercase tabular-nums tracking-[0.16em]"
          style={{ color: "var(--nova-accent)" }}
        >
          {meta?.label}: {readout}
        </span>
      </div>

      {snapshot.register ? (
        <p
          className="mt-3 font-serif text-lg leading-snug"
          style={{ color: "var(--lunari-fg-primary)" }}
        >
          {snapshot.register}
        </p>
      ) : null}

      {snapshot.summary ? (
        <p
          className="mt-3 border-l-2 pl-3 font-serif text-[15px] italic leading-relaxed"
          style={{ borderColor: "var(--nova-accent)", color: "var(--lunari-fg-muted)" }}
        >
          {snapshot.summary}
        </p>
      ) : null}

      {phrases.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {phrases.map((phrase, i) => (
            <span
              key={i}
              className="rounded-full px-2.5 py-1 font-mono text-[10px] lowercase tracking-[0.04em]"
              style={{ background: "var(--nova-accent-soft)", color: "var(--lunari-fg-muted)" }}
            >
              {phrase}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="px-7 py-16 text-center">
      <p className="font-serif text-xl" style={{ color: "var(--lunari-fg-primary)" }}>
        nova hasn't heard you yet.
      </p>
      <p
        className="mx-auto mt-3 max-w-sm font-serif text-base leading-relaxed"
        style={{ color: "var(--lunari-fg-muted)" }}
      >
        train nova on your voice, then come back ... every time you do, a new dot lands here and
        your voice starts to move.
      </p>
    </div>
  );
}

// compact capture-date. lowercase, no fluff.
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  return d
    .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    .toLowerCase();
}
