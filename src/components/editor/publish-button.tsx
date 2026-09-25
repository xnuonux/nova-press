"use client";

/** A deliberate way out ... confirm the save before releasing the page. */
import { useEffect, useRef, useState } from "react";
import { requestSaveFlush } from "@/lib/editor/save-handshake";
import { createReleaseGate, type ReleaseIntent, type ReleasePhase } from "@/lib/editor/release-gate";

export type ScheduleHandler = (
  whenIso: string | null,
) => Promise<{ ok: true; scheduledAt: string | null } | { ok: false; error: string }>;

interface PublishButtonProps {
  initialStatus: string;
  initialSlug: string | null;
  initialScheduledAt: string | null;
  onPublish: () => Promise<{ ok: true; slug: string; url: string } | { ok: false; error: string }>;
  onSchedule: ScheduleHandler;
}

type State = "idle" | "live" | "scheduled";
const linkClass =
  "font-mono text-[11px] uppercase tracking-[0.18em] transition-opacity hover:opacity-70 disabled:opacity-50";

function scheduledLabel(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "scheduled";
  return at.toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export function PublishButton({
  initialStatus, initialSlug, initialScheduledAt, onPublish, onSchedule,
}: PublishButtonProps) {
  const alreadyLive = initialStatus === "published" && !!initialSlug;
  const alreadyScheduled = initialStatus === "scheduled" && !!initialScheduledAt;
  // The last confirmed state survives failed saves, failed sends and republishing.
  const [state, setState] = useState<State>(alreadyLive ? "live" : alreadyScheduled ? "scheduled" : "idle");
  const [url, setUrl] = useState<string | null>(alreadyLive ? `/p/${initialSlug}` : null);
  const [scheduledAt, setScheduledAt] = useState<string | null>(alreadyScheduled ? initialScheduledAt : null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [when, setWhen] = useState("");
  const [phase, setPhase] = useState<ReleasePhase>(null);
  const [uncertain, setUncertain] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const gateRef = useRef<ReturnType<typeof createReleaseGate> | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = phase !== null;
  const disabled = busy || uncertain;

  useEffect(() => {
    // Own a fresh gate per effect lifetime, including StrictMode's setup replay.
    const gate = createReleaseGate({
      target: document,
      flush: (signal) => requestSaveFlush(document, crypto.randomUUID(), { signal }),
      onPhase: setPhase,
    });
    gateRef.current = gate;
    return () => {
      gate.dispose();
      if (gateRef.current === gate) gateRef.current = null;
      if (copyTimer.current !== null) clearTimeout(copyTimer.current);
    };
  }, []);

  async function release(intent: ReleaseIntent, action: () => Promise<unknown>) {
    const gate = gateRef.current;
    if (!gate || gate.busy() || uncertain) return;
    setMessage(null);
    const result = await gate.run(intent, action);
    // A late server reply does not belong to a different mounted page.
    if (gateRef.current !== gate) return;
    if (result.status === "busy" || result.status === "closed") return;
    if (result.status !== "confirmed") {
      setMessage(result.error);
      if (result.status === "unconfirmed") setUncertain(true);
      return;
    }
    const { receipt } = result;
    setPickerOpen(false);
    if (receipt.kind === "publish") {
      setUrl(receipt.url);
      setScheduledAt(null);
      setState("live");
    } else if (receipt.kind === "schedule") {
      setScheduledAt(receipt.scheduledAt);
      setState("scheduled");
    } else {
      setScheduledAt(null);
      setUrl(null);
      setState("idle");
    }
    if (receipt.kind !== "cancel" && result.editedWhileSending) {
      setMessage(receipt.kind === "publish"
        ? "the release was confirmed, but you kept writing. those later edits are not confirmed in this release."
        : "the schedule was confirmed, but you kept writing. review the saved draft before it goes out.");
    }
  }

  async function schedule() {
    if (!when) return;
    const at = new Date(when);
    if (Number.isNaN(at.getTime())) {
      setMessage("that time didn't read ... pick it again.");
      return;
    }
    // The writer chooses a local wall clock; the server receives its ISO instant.
    const whenIso = at.toISOString();
    await release({ kind: "schedule", whenIso }, () => onSchedule(whenIso));
  }

  async function copy() {
    if (!url) return;
    const owner = gateRef.current;
    try {
      await navigator.clipboard.writeText(window.location.origin + url);
      if (!owner || gateRef.current !== owner) return;
      setCopied(true);
      if (copyTimer.current !== null) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      // The view link remains usable when clipboard permission is denied.
    }
  }

  return (
    <div className="flex min-w-0 flex-col items-end gap-2" data-testid="publish-control" aria-busy={busy}>
      {state === "live" && url ? (
        <div className="flex flex-wrap items-center gap-4">
          <a href={url} target="_blank" rel="noreferrer" className={linkClass} style={{ color: "var(--nova-accent)" }}>
            view
          </a>
          <button type="button" onClick={() => void copy()} className={linkClass}>
            {copied ? "copied" : "copy link"}
          </button>
          <button type="button" onClick={() => void release({ kind: "publish" }, onPublish)} disabled={disabled} className={linkClass}>
            republish
          </button>
        </div>
      ) : state === "scheduled" && scheduledAt ? (
        <div className="flex flex-wrap items-center gap-3" data-testid="publish-scheduled-row">
          <span className="font-mono text-[10px] lowercase tracking-[0.1em]" style={{ color: "var(--nova-accent)" }} data-testid="publish-scheduled-at">
            {uncertain ? "last confirmed schedule: " : "goes out "}{scheduledLabel(scheduledAt)}
          </span>
          <button type="button" onClick={() => void release({ kind: "cancel" }, () => onSchedule(null))} disabled={disabled} className={linkClass} data-testid="publish-schedule-cancel">
            cancel
          </button>
          <button type="button" onClick={() => void release({ kind: "publish" }, onPublish)} disabled={disabled} className={linkClass}>
            publish now
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          {pickerOpen ? (
            <span className="flex flex-wrap items-center gap-2" data-testid="publish-schedule-picker">
              <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} disabled={disabled}
                aria-label="publish at" data-testid="publish-schedule-when"
                className="h-7 rounded-md border bg-transparent px-2 font-mono text-[10px]"
                style={{ borderColor: "var(--lunari-border)", color: "var(--lunari-fg-muted)" }} />
              <button type="button" onClick={() => void schedule()} disabled={disabled || !when} className={linkClass}
                style={{ color: "var(--nova-accent)" }} data-testid="publish-schedule-set">
                set
              </button>
              <button type="button" onClick={() => { setPickerOpen(false); setMessage(null); }} disabled={disabled} className={linkClass}>
                never mind
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setPickerOpen(true)} disabled={disabled} className={linkClass} data-testid="publish-schedule-open">
              later ...
            </button>
          )}
          <button type="button" onClick={() => void release({ kind: "publish" }, onPublish)} disabled={disabled}
            className="np-btn inline-flex h-7 items-center rounded-full px-3.5 font-mono text-[11px] uppercase tracking-[0.18em] disabled:opacity-50"
            style={{ background: "var(--nova-accent)", color: "var(--lunari-bg-deep)" }}>
            publish
          </button>
        </div>
      )}
      <p role="status" aria-live="polite" aria-atomic="true" data-testid="publish-feedback"
        className="max-w-[48ch] break-words text-right font-mono text-[10px] leading-relaxed"
        style={{ color: "var(--lunari-fg-muted)" }}>
        {phase === "saving" ? "confirming your save ..." : phase === "sending" ? "sending ..." : message}
      </p>
      {uncertain ? (
        <button type="button" onClick={() => window.open(window.location.href, "_blank", "noopener,noreferrer")} className={linkClass}>
          check saved status in a new tab
        </button>
      ) : null}
    </div>
  );
}
