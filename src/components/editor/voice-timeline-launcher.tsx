"use client";

/**
 * the breathing timeline ... your voice over time, now interrogable.
 *
 * scrub a single playhead across your training snapshots (chunk 1), or flip to
 * compare-mode: pin two dots and nova draws the drift between them ... a dual
 * fingerprint, the deltas as chips, and an ask box where you can talk to how
 * you've grown. every number on the chart and in nova's answer comes from the
 * ONE pure computeVoiceDrift(), so they can never disagree, and nova only ever
 * narrates pre-computed facts (it never does the math).
 *
 * the snapshots arrive as a server-read prop (no client fetch on open). the ask
 * streams from /api/voice/ask, which loads only the caller's own snapshots and
 * declines honestly (no model call) when there's nothing real to compare.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { nameForkAction } from "@/app/(authed)/library/name-fork-action";
import { setWriteAsForkAction } from "@/app/(authed)/library/write-as-fork-action";
import { voiceKeeperAudit } from "@/lib/ai/voice-keeper";
import type { VoiceSnapshot } from "@/lib/db/voice-snapshots";
import { computeVoiceDrift, type VoiceDriftReport } from "@/lib/voice/drift";
import { deriveForkRoster, normalizeForkLabel, resolveForkView } from "@/lib/voice/forks";
import {
  buildTimelineSeries,
  METRICS,
  metricValue,
  sortAscending,
  type MetricKey,
} from "@/lib/voice/timeline-series";

export function VoiceTimelineLauncher({
  snapshots,
  activeWritingFork = null,
}: {
  snapshots: VoiceSnapshot[];
  activeWritingFork?: string | null;
}) {
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
      {open ? (
        <VoiceTimelinePanel
          snapshots={snapshots}
          activeWritingFork={activeWritingFork}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

type Mode = "scrub" | "compare";

function VoiceTimelinePanel({
  snapshots,
  activeWritingFork,
  onClose,
}: {
  snapshots: VoiceSnapshot[];
  activeWritingFork: string | null;
  onClose: () => void;
}) {
  // forks are a pure read-time lens: the roster is DERIVED from the loaded rows
  // (never stored), the active strand is client state, and resolveForkView keeps
  // the default (null) view a strict referential pass-through ... so "your voice"
  // feeds the chart the byte-identical array chunk 2 always had.
  const [activeFork, setActiveFork] = useState<string | null>(null);
  const roster = useMemo(() => deriveForkRoster(snapshots), [snapshots]);
  const scoped = useMemo(() => resolveForkView(snapshots, activeFork), [snapshots, activeFork]);
  // the chart reads oldest -> newest left -> right; the server hands them
  // newest-first, so sort once here for the whole panel (over the active strand).
  const sorted = useMemo(() => sortAscending(scoped), [scoped]);
  const [metric, setMetric] = useState<MetricKey>("sentence_length");
  const [mode, setMode] = useState<Mode>("scrub");
  const [naming, setNaming] = useState(false);
  const [labelDraft, setLabelDraft] = useState("");
  const [pending, startTransition] = useTransition();
  // which strand nova WRITES in (the voice-switch), distinct from activeFork (the
  // VIEW lens). server-seeded, optimistic on change. null = your live voice.
  const [writingFork, setWritingFork] = useState<string | null>(activeWritingFork);
  const writeAs = useCallback(
    (label: string | null) => {
      setWritingFork(label);
      startTransition(async () => {
        const res = await setWriteAsForkAction(label);
        if (!res.ok) setWritingFork(activeWritingFork); // revert on failure
      });
    },
    [activeWritingFork],
  );
  // scrub playhead defaults to the newest dot ... "where you are now".
  const [selected, setSelected] = useState(() => Math.max(0, sorted.length - 1));
  // compare pins default to the most recent stretch (the question you most likely
  // have). a = older index, b = newer index by position; the view sorts them.
  const [pins, setPins] = useState<{ a: number; b: number }>(() => ({
    a: Math.max(0, sorted.length - 2),
    b: Math.max(0, sorted.length - 1),
  }));
  const [activePin, setActivePin] = useState<"a" | "b">("b");

  const canCompare = sorted.length >= 2;

  // switching strands changes which dots exist ... reset the scrub + pins into the
  // new strand's range so the chart never points at a dot the lens removed.
  useEffect(() => {
    setSelected(Math.max(0, sorted.length - 1));
    setPins({ a: Math.max(0, sorted.length - 2), b: Math.max(0, sorted.length - 1) });
    setNaming(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFork]);

  // if the active strand emptied out (every dot un-named), fall back to your voice
  // so the panel never shows a strand that no longer exists.
  useEffect(() => {
    if (activeFork !== null && !roster.includes(activeFork)) setActiveFork(null);
  }, [roster, activeFork]);

  // esc closes.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const setPin = useCallback(
    (pin: "a" | "b", idx: number) => {
      const clamped = Math.max(0, Math.min(sorted.length - 1, idx));
      setPins((prev) => {
        const other = pin === "a" ? prev.b : prev.a;
        if (clamped === other) return prev; // never stack the two pins
        return pin === "a" ? { a: clamped, b: prev.b } : { a: prev.a, b: clamped };
      });
    },
    [sorted.length],
  );

  const olderIdx = Math.min(pins.a, pins.b);
  const newerIdx = Math.max(pins.a, pins.b);
  const older = sorted[olderIdx];
  const newer = sorted[newerIdx];

  // name (or release) a strand: in scrub mode the one selected reading, in compare
  // mode the whole pinned span. the server action sets fork_label on those rows
  // and revalidates; on success we switch the lens to the new strand (null when
  // released). an empty label un-names. this is the ONLY write the panel makes,
  // and it never touches voice_profiles.
  const submitFork = useCallback(() => {
    const span =
      mode === "compare" && canCompare
        ? sorted.slice(olderIdx, newerIdx + 1)
        : [sorted[Math.min(selected, sorted.length - 1)]];
    const ids = span.filter((s): s is VoiceSnapshot => !!s).map((s) => s.id);
    if (ids.length === 0) return;
    const draft = labelDraft;
    startTransition(async () => {
      const res = await nameForkAction(ids, draft);
      if (res.ok) {
        setActiveFork(normalizeForkLabel(draft));
        setNaming(false);
        setLabelDraft("");
      }
    });
  }, [mode, canCompare, sorted, olderIdx, newerIdx, selected, labelDraft]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4 sm:p-8"
      style={{ background: "var(--lunari-overlay)", backdropFilter: "blur(6px)" }}
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
                : mode === "compare"
                  ? "pin two readings and ask nova how you've grown."
                  : `${sorted.length} readings ... drag across them to watch your voice move.`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* fork switcher ... hidden entirely until a second self exists, so a
                writer who never forks sees the chunk-2 header verbatim. */}
            {roster.length > 0 ? (
              <div className="flex items-center gap-1">
                {[null, ...roster].map((label) => {
                  const isActive = activeFork === label;
                  return (
                    <button
                      key={label ?? "__your_voice__"}
                      type="button"
                      onClick={() => setActiveFork(label)}
                      className="rounded-lg px-2.5 py-1.5 font-mono text-[10px] lowercase tracking-[0.1em] transition-all duration-200"
                      style={
                        isActive
                          ? { background: "var(--nova-accent-soft)", color: "var(--nova-accent)" }
                          : { color: "var(--lunari-fg-subtle)" }
                      }
                    >
                      {label ?? "your voice"}
                    </button>
                  );
                })}
              </div>
            ) : null}
            {sorted.length >= 1 ? (
              canCompare ? (
                <button
                  type="button"
                  onClick={() => setMode((m) => (m === "compare" ? "scrub" : "compare"))}
                  className="rounded-lg px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-all duration-200"
                  style={
                    mode === "compare"
                      ? { background: "var(--nova-accent-soft)", color: "var(--nova-accent)" }
                      : {
                          color: "var(--lunari-fg-subtle)",
                          border: "1px solid var(--lunari-border)",
                        }
                  }
                >
                  {mode === "compare" ? "back to scrub" : "compare two"}
                </button>
              ) : (
                <span
                  className="font-mono text-[10px] uppercase tracking-[0.14em]"
                  style={{ color: "var(--lunari-fg-subtle)" }}
                >
                  train again to compare
                </span>
              )
            ) : null}
            <button
              type="button"
              onClick={onClose}
              aria-label="close"
              className="-mr-1 rounded-md px-2 py-1 font-mono text-lg leading-none transition-opacity hover:opacity-70"
              style={{ color: "var(--lunari-fg-subtle)" }}
            >
              ×
            </button>
          </div>
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
                mode={mode === "compare" && canCompare ? "compare" : "scrub"}
                pins={pins}
                activePin={activePin}
                onPinMove={setPin}
                onActivePinChange={setActivePin}
              />
            </div>

            <div className="border-t px-7 py-5" style={{ borderColor: "var(--lunari-border)" }}>
              {mode === "compare" && canCompare && older && newer ? (
                <CompareView older={older} newer={newer} />
              ) : (
                <FingerprintCard
                  snapshot={sorted[Math.min(selected, sorted.length - 1)]}
                  metric={metric}
                  isLatest={Math.min(selected, sorted.length - 1) === sorted.length - 1}
                />
              )}

              {/* write-as ... the voice-switch. distinct from the view lens in the
                  header: this sets which strand nova actually WRITES in (the
                  partner / ghost / repurpose). a read-source switch, never a change
                  to your live voice. */}
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span
                  className="font-mono text-[10px] uppercase tracking-[0.18em]"
                  style={{ color: "var(--lunari-fg-subtle)" }}
                >
                  nova writes as
                  <span className="ml-1.5" style={{ color: "var(--nova-accent)" }}>
                    {writingFork ?? "your voice"}
                  </span>
                </span>
                {activeFork !== writingFork ? (
                  <button
                    type="button"
                    onClick={() => writeAs(activeFork)}
                    disabled={pending}
                    className="np-warm rounded-full px-2.5 py-1 font-mono text-[10px] lowercase tracking-[0.04em] disabled:opacity-40"
                    style={{
                      border: "1px solid var(--lunari-border)",
                      color: "var(--lunari-fg-subtle)",
                    }}
                  >
                    write as {activeFork ?? "your voice"}
                  </button>
                ) : writingFork ? (
                  <button
                    type="button"
                    onClick={() => writeAs(null)}
                    disabled={pending}
                    className="np-warm font-mono text-[10px] uppercase tracking-[0.16em] disabled:opacity-40"
                    style={{ color: "var(--lunari-fg-subtle)" }}
                  >
                    back to your voice
                  </button>
                ) : null}
              </div>

              {/* name-this-moment ... a quiet, reversible move. naming a stretch
                  partitions it into its own strand; an empty label releases it
                  back to "your voice". a pure metadata tag, never the live voice. */}
              <div className="mt-4 flex items-center gap-2">
                {naming ? (
                  <>
                    <input
                      value={labelDraft}
                      onChange={(e) => setLabelDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          submitFork();
                        }
                      }}
                      maxLength={40}
                      autoFocus
                      aria-label="name this strand (40 character limit)"
                      placeholder={
                        activeFork ? "rename, or empty to release" : "name this strand ..."
                      }
                      className="min-w-0 flex-1 rounded-lg bg-transparent px-3 py-1.5 font-serif text-sm outline-none"
                      style={{
                        border: "1px solid var(--lunari-border)",
                        color: "var(--lunari-fg-primary)",
                      }}
                    />
                    <button
                      type="button"
                      onClick={submitFork}
                      disabled={pending}
                      className="np-btn rounded-lg px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] disabled:opacity-40"
                      style={{ background: "var(--nova-accent-soft)", color: "var(--nova-accent)" }}
                    >
                      {pending ? "saving ..." : "save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNaming(false);
                        setLabelDraft("");
                      }}
                      className="font-mono text-[10px] uppercase tracking-[0.16em] transition-opacity hover:opacity-70"
                      style={{ color: "var(--lunari-fg-subtle)" }}
                    >
                      cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setLabelDraft(activeFork ?? "");
                      setNaming(true);
                    }}
                    className="np-warm font-mono text-[10px] uppercase tracking-[0.16em]"
                    style={{ color: "var(--lunari-fg-subtle)" }}
                  >
                    {mode === "compare" && canCompare
                      ? "name this stretch ↗"
                      : "name this reading ↗"}
                  </button>
                )}
              </div>
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
  mode = "scrub",
  pins,
  activePin = "b",
  onPinMove,
  onActivePinChange,
}: {
  snapshots: VoiceSnapshot[];
  metric: MetricKey;
  selected: number;
  onSelect: (index: number) => void;
  // compare-mode is strictly additive: with these omitted the chart renders
  // byte-identical to chunk 1's single scrub.
  mode?: Mode;
  pins?: { a: number; b: number };
  activePin?: "a" | "b";
  onPinMove?: (pin: "a" | "b", index: number) => void;
  onActivePinChange?: (pin: "a" | "b") => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const series = useMemo(() => buildTimelineSeries(snapshots, metric), [snapshots, metric]);
  const isCompare = mode === "compare" && !!pins;

  const scaled = series.points.map((p) => ({
    ...p,
    cx: PAD_L + p.x * PLOT_W,
    cy: PAD_T + (1 - p.y) * PLOT_H, // higher value sits higher on screen
  }));

  const nearestIndex = useCallback(
    (clientX: number): number | null => {
      const svg = svgRef.current;
      if (!svg || scaled.length === 0) return null;
      const rect = svg.getBoundingClientRect();
      if (rect.width === 0) return null;
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
      return best;
    },
    [scaled],
  );

  const dragging = useRef(false);
  const activePinRef = useRef(activePin);
  activePinRef.current = activePin;

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const idx = nearestIndex(e.clientX);
    if (idx === null) return;
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (isCompare && pins && onPinMove && onActivePinChange) {
      // grab the pin closer to the click, make it active, move it.
      const pin = Math.abs(pins.a - idx) <= Math.abs(pins.b - idx) ? "a" : "b";
      activePinRef.current = pin;
      onActivePinChange(pin);
      onPinMove(pin, idx);
    } else {
      onSelect(idx);
    }
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging.current) return;
    const idx = nearestIndex(e.clientX);
    if (idx === null) return;
    if (isCompare && onPinMove) onPinMove(activePinRef.current, idx);
    else onSelect(idx);
  };
  const endDrag = (e: React.PointerEvent<SVGSVGElement>) => {
    dragging.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const onKeyDown = (e: React.KeyboardEvent<SVGSVGElement>) => {
    if (isCompare && pins && onPinMove && onActivePinChange) {
      if (e.key === "Tab") {
        e.preventDefault();
        onActivePinChange(activePin === "a" ? "b" : "a");
        return;
      }
      const cur = activePin === "a" ? pins.a : pins.b;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onPinMove(activePin, cur - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onPinMove(activePin, cur + 1);
      }
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      onSelect(Math.max(0, selected - 1));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      onSelect(Math.min(scaled.length - 1, selected + 1));
    }
  };

  const baselineY = PAD_T + PLOT_H;
  const linePath = series.hasRange
    ? scaled.map((p, i) => `${i === 0 ? "M" : "L"} ${p.cx.toFixed(1)} ${p.cy.toFixed(1)}`).join(" ")
    : null;

  // compare geometry: the two pinned points + the bright drift segment between.
  const pinA = isCompare && pins ? scaled[pins.a] : undefined;
  const pinB = isCompare && pins ? scaled[pins.b] : undefined;
  const loIdx = isCompare && pins ? Math.min(pins.a, pins.b) : -1;
  const hiIdx = isCompare && pins ? Math.max(pins.a, pins.b) : -1;
  const segPath =
    isCompare && series.hasRange
      ? scaled
          .filter((p) => p.index >= loIdx && p.index <= hiIdx)
          .map((p, i) => `${i === 0 ? "M" : "L"} ${p.cx.toFixed(1)} ${p.cy.toFixed(1)}`)
          .join(" ")
      : null;

  // the midpoint readout: the CHART metric's delta across the two pins (the same
  // value the polyline shows), so the chart and the chips agree.
  const compareReadout =
    isCompare && loIdx >= 0 && hiIdx >= 0
      ? metricDeltaLabel(snapshots[loIdx], snapshots[hiIdx], metric)
      : null;

  const scrubSel = scaled[Math.min(selected, scaled.length - 1)];

  return (
    <div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VW} ${VH}`}
        className="w-full touch-none select-none"
        style={{ cursor: "pointer", overflow: "visible" }}
        role="slider"
        tabIndex={0}
        aria-label={isCompare ? "voice compare scrubber" : "voice timeline scrubber"}
        aria-valuemin={0}
        aria-valuemax={scaled.length - 1}
        aria-valuenow={isCompare && pins ? (activePin === "a" ? pins.a : pins.b) : selected}
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

        <line
          x1={PAD_L}
          y1={baselineY}
          x2={VW - PAD_R}
          y2={baselineY}
          className="np-timeline-rail"
        />

        {/* the metric line */}
        {linePath ? (
          <path
            d={linePath}
            className="np-timeline-line"
            style={isCompare ? { opacity: 0.3 } : undefined}
          />
        ) : null}

        {/* compare: the bright drift segment between the two pins */}
        {segPath ? <path d={segPath} className="np-timeline-line" /> : null}

        {/* playheads */}
        {!isCompare && scrubSel ? (
          <line
            x1={scrubSel.cx}
            y1={PAD_T - 6}
            x2={scrubSel.cx}
            y2={baselineY + 6}
            className="np-timeline-playhead"
          />
        ) : null}
        {isCompare && pinA ? (
          <line
            x1={pinA.cx}
            y1={PAD_T - 6}
            x2={pinA.cx}
            y2={baselineY + 6}
            className={activePin === "a" ? "np-timeline-playhead" : "np-timeline-playhead-b"}
          />
        ) : null}
        {isCompare && pinB ? (
          <line
            x1={pinB.cx}
            y1={PAD_T - 6}
            x2={pinB.cx}
            y2={baselineY + 6}
            className={activePin === "b" ? "np-timeline-playhead" : "np-timeline-playhead-b"}
          />
        ) : null}

        {/* the dots */}
        {scaled.map((p) => {
          const snap = snapshots[p.index];
          const conf = snap?.extractionConfidence ?? 0.7;
          const samples = snap?.samplesCount ?? 0;
          const r = 3.4 + (Math.min(samples, 6) / 6) * 2.6;
          const isPinned =
            isCompare && pins ? p.index === pins.a || p.index === pins.b : p.index === selected;
          const inSpan = !isCompare || (p.index >= loIdx && p.index <= hiIdx);
          return (
            <g key={snap?.id ?? p.index}>
              <circle
                cx={p.cx}
                cy={p.cy}
                r={isPinned ? r + 2.2 : r}
                className="np-timeline-dot"
                style={{
                  opacity: isPinned
                    ? 1
                    : (inSpan ? 1 : 0.4) * (0.35 + 0.6 * Math.max(0, Math.min(1, conf))),
                  fill: isPinned ? "var(--nova-accent)" : "var(--lunari-fg-muted)",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isCompare && pins && onPinMove && onActivePinChange) {
                    const pin =
                      Math.abs(pins.a - p.index) <= Math.abs(pins.b - p.index) ? "a" : "b";
                    onActivePinChange(pin);
                    onPinMove(pin, p.index);
                  } else {
                    onSelect(p.index);
                  }
                }}
              />
              {isPinned ? (
                <circle cx={p.cx} cy={p.cy} r={r + 6} className="np-timeline-halo" />
              ) : null}
            </g>
          );
        })}

        {/* compare midpoint readout */}
        {compareReadout && pinA && pinB ? (
          <text
            x={(pinA.cx + pinB.cx) / 2}
            y={PAD_T - 8}
            textAnchor="middle"
            className="np-timeline-readout"
          >
            {compareReadout}
          </text>
        ) : null}

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

function metricDeltaLabel(
  a: VoiceSnapshot | undefined,
  b: VoiceSnapshot | undefined,
  metric: MetricKey,
): string | null {
  if (!a || !b) return null;
  const prev = metricValue(a, metric);
  const curr = metricValue(b, metric);
  if (prev === null || curr === null) return null;
  const d = Math.round((curr - prev) * 100) / 100;
  if (d === 0) return "no change";
  const unit = metric === "sentence_length" ? " words" : metric === "punctuation" ? " / 1k" : "";
  return `${d > 0 ? "+" : ""}${d}${unit}`;
}

function CompareView({
  older: olderSnap,
  newer: newerSnap,
}: {
  older: VoiceSnapshot;
  newer: VoiceSnapshot;
}) {
  const report = useMemo(() => computeVoiceDrift(olderSnap, newerSnap), [olderSnap, newerSnap]);
  return (
    <div className="np-partner-content space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <SnapshotPane snapshot={olderSnap} label="then" dim />
        <SnapshotPane snapshot={newerSnap} label="now" />
      </div>
      <DriftChips report={report} />
      <AskBox older={olderSnap} newer={newerSnap} />
    </div>
  );
}

function SnapshotPane({
  snapshot,
  label,
  dim = false,
}: {
  snapshot: VoiceSnapshot;
  label: string;
  dim?: boolean;
}) {
  return (
    <div
      className="rounded-lg p-3"
      style={{
        background: dim ? "transparent" : "var(--nova-accent-soft)",
        opacity: dim ? 0.72 : 1,
      }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className="font-mono text-[9px] uppercase tracking-[0.22em]"
          style={{ color: "var(--lunari-fg-subtle)" }}
        >
          {label}
        </span>
        <span
          className="font-mono text-[9px] uppercase tracking-[0.16em]"
          style={{ color: "var(--lunari-fg-subtle)" }}
        >
          {formatDate(snapshot.capturedAt)}
        </span>
      </div>
      {snapshot.register ? (
        <p
          className="mt-1.5 font-serif text-[15px] leading-snug"
          style={{ color: "var(--lunari-fg-primary)" }}
        >
          {snapshot.register}
        </p>
      ) : (
        <p
          className="mt-1.5 font-serif text-[15px] italic"
          style={{ color: "var(--lunari-fg-subtle)" }}
        >
          still settling
        </p>
      )}
    </div>
  );
}

function DriftChips({ report }: { report: VoiceDriftReport }) {
  const chips: string[] = [];
  const sl = report.sentenceLength;
  if (sl.delta !== null && sl.direction !== "stable")
    chips.push(`${sl.delta > 0 ? "+" : ""}${sl.delta} words, ${sl.direction}`);
  if (report.formality.direction !== "stable" && report.formality.magnitude !== null)
    chips.push(`${report.formality.direction} (${report.formality.magnitude})`);
  for (const phrase of report.phrases.idiosyncratic.gained.slice(0, 2))
    chips.push(`now: "${phrase}"`);
  for (const phrase of report.phrases.idiosyncratic.dropped.slice(0, 2))
    chips.push(`dropped: "${phrase}"`);
  if (report.register.changed) chips.push("register shifted");

  if (!report.hasSignal) {
    return (
      <p className="font-serif text-sm italic" style={{ color: "var(--lunari-fg-muted)" }}>
        these two readings are nearly identical ... your voice held steady across this stretch.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((chip, i) => (
        <span
          key={i}
          className="rounded-full px-2.5 py-1 font-mono text-[10px] lowercase tracking-[0.04em]"
          style={{ background: "var(--nova-accent-soft)", color: "var(--lunari-fg-muted)" }}
        >
          {chip}
        </span>
      ))}
    </div>
  );
}

type AnswerState = {
  status: "idle" | "streaming" | "done" | "error";
  text: string;
  drift: boolean;
};

const QUICK_ASKS = [
  "how has my voice changed?",
  "am i getting more formal?",
  "what did i stop saying?",
];

function AskBox({
  older: olderSnap,
  newer: newerSnap,
}: {
  older: VoiceSnapshot;
  newer: VoiceSnapshot;
}) {
  const [input, setInput] = useState("");
  const [answer, setAnswer] = useState<AnswerState>({ status: "idle", text: "", drift: false });
  const controllerRef = useRef<AbortController | null>(null);

  // re-pinning a dot changes the stretch ... abort any in-flight ask and clear
  // the answer, so the streamed text always matches the dots currently pinned.
  useEffect(() => {
    controllerRef.current?.abort();
    setAnswer({ status: "idle", text: "", drift: false });
  }, [olderSnap.id, newerSnap.id]);

  useEffect(() => {
    const controllers = controllerRef;
    return () => controllers.current?.abort();
  }, []);

  const ask = useCallback(
    (question: string) => {
      const q = question.trim();
      if (!q) return;
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setAnswer({ status: "streaming", text: "", drift: false });
      void (async () => {
        try {
          const res = await fetch("/api/voice/ask", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ question: q, snapshotIds: [olderSnap.id, newerSnap.id] }),
            signal: controller.signal,
          });
          if (!res.ok || !res.body) throw new Error("ask failed");
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let acc = "";
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            acc += decoder.decode(value, { stream: true });
            if (controller.signal.aborted) return;
            setAnswer({ status: "streaming", text: acc, drift: false });
          }
          acc += decoder.decode();
          if (controller.signal.aborted) return;
          const audited = voiceKeeperAudit(acc, { oneSentence: false });
          setAnswer({ status: "done", text: audited.text, drift: audited.violated });
        } catch {
          if (controller.signal.aborted) return;
          setAnswer({ status: "error", text: "", drift: false });
        }
      })();
    },
    [olderSnap.id, newerSnap.id],
  );

  const busy = answer.status === "streaming";

  return (
    <div className="rounded-xl p-3" style={{ background: "var(--lunari-bg-elevated)" }}>
      <div className="flex flex-wrap gap-1.5">
        {QUICK_ASKS.map((q) => (
          <button
            key={q}
            type="button"
            disabled={busy}
            onClick={() => {
              setInput(q);
              ask(q);
            }}
            className="np-warm rounded-full px-2.5 py-1 font-mono text-[10px] lowercase tracking-[0.04em] disabled:opacity-40"
            style={{ border: "1px solid var(--lunari-border)", color: "var(--lunari-fg-subtle)" }}
          >
            {q}
          </button>
        ))}
      </div>

      <div className="mt-2.5 flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(input);
            }
          }}
          rows={1}
          maxLength={600}
          placeholder="ask how you've grown ..."
          className="min-h-[38px] flex-1 resize-none rounded-lg bg-transparent px-3 py-2 font-serif text-[15px] leading-snug outline-none"
          style={{ border: "1px solid var(--lunari-border)", color: "var(--lunari-fg-primary)" }}
        />
        <button
          type="button"
          onClick={() => ask(input)}
          disabled={busy || input.trim().length === 0}
          className="np-btn inline-flex h-[38px] items-center rounded-lg px-4 font-sans text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: "var(--nova-accent)", color: "var(--lunari-bg-deep)" }}
        >
          ask
        </button>
      </div>

      {answer.status !== "idle" ? (
        <div className="mt-3">
          {answer.status === "error" ? (
            <p className="font-serif text-sm" style={{ color: "var(--lunari-fg-muted)" }}>
              nova couldn't reach the model ... try again in a sec.
            </p>
          ) : (
            <p
              className="np-partner-content whitespace-pre-wrap font-serif text-[15px] leading-relaxed"
              style={{ color: "var(--lunari-fg-primary)" }}
              aria-busy={answer.status === "streaming"}
            >
              {answer.text}
              {answer.status === "streaming" ? <span className="np-caret" aria-hidden /> : null}
            </p>
          )}
        </div>
      ) : null}
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
