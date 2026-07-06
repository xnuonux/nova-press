"use client";

/**
 * publish control in the editor footer. a draft shows "publish" plus a quiet
 * "later ..." that schedules it; a scheduled piece names its hour and offers
 * the walk-back; once live it becomes a quiet row ... view the piece, copy its
 * link, or push a fresh version. closes the loop: write ... ship (now or at
 * dawn) ... share.
 */

import { useState } from "react";

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

type State = "idle" | "publishing" | "live" | "error" | "scheduled";

const linkClass =
  "font-mono text-[11px] uppercase tracking-[0.18em] transition-opacity hover:opacity-70";

function scheduledLabel(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "scheduled";
  return at.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function PublishButton({
  initialStatus,
  initialSlug,
  initialScheduledAt,
  onPublish,
  onSchedule,
}: PublishButtonProps) {
  const alreadyLive = initialStatus === "published" && !!initialSlug;
  const alreadyScheduled = initialStatus === "scheduled" && !!initialScheduledAt;
  const [state, setState] = useState<State>(
    alreadyLive ? "live" : alreadyScheduled ? "scheduled" : "idle",
  );
  const [url, setUrl] = useState<string | null>(alreadyLive ? `/p/${initialSlug}` : null);
  const [scheduledAt, setScheduledAt] = useState<string | null>(
    alreadyScheduled ? initialScheduledAt : null,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function publish() {
    setState("publishing");
    setErrorMsg(null);
    const res = await onPublish();
    if (res.ok) {
      setUrl(res.url);
      setScheduledAt(null);
      setState("live");
    } else {
      setErrorMsg(res.error);
      setState("error");
    }
  }

  async function schedule() {
    if (!when) return;
    const at = new Date(when);
    if (Number.isNaN(at.getTime())) {
      setErrorMsg("that time didn't read ... pick it again");
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    // the input is the writer's local wall clock ... send the unambiguous iso.
    const res = await onSchedule(at.toISOString());
    setBusy(false);
    if (res.ok && res.scheduledAt) {
      setScheduledAt(res.scheduledAt);
      setPickerOpen(false);
      setState("scheduled");
    } else if (!res.ok) {
      setErrorMsg(res.error);
    }
  }

  async function cancelSchedule() {
    setBusy(true);
    setErrorMsg(null);
    const res = await onSchedule(null);
    setBusy(false);
    if (res.ok) {
      setScheduledAt(null);
      setState("idle");
    } else {
      setErrorMsg(res.error);
    }
  }

  async function copy() {
    if (!url) return;
    const absolute = typeof window !== "undefined" ? window.location.origin + url : url;
    try {
      await navigator.clipboard.writeText(absolute);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard blocked (insecure context, denied permission) ... no-op, the
      // view link still works.
    }
  }

  if (state === "live" && url) {
    return (
      <div className="flex items-center gap-4">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className={linkClass}
          style={{ color: "var(--nova-accent)" }}
        >
          view
        </a>
        <button type="button" onClick={() => void copy()} className={linkClass}>
          {copied ? "copied" : "copy link"}
        </button>
        <button type="button" onClick={() => void publish()} className={linkClass}>
          republish
        </button>
      </div>
    );
  }

  if (state === "scheduled" && scheduledAt) {
    return (
      <div className="flex items-center gap-3" data-testid="publish-scheduled-row">
        {errorMsg ? (
          <span
            className="max-w-[26ch] truncate font-mono text-[10px] lowercase tracking-[0.08em]"
            style={{ color: "var(--lunari-fg-muted)" }}
            title={errorMsg}
          >
            {errorMsg}
          </span>
        ) : null}
        <span
          className="font-mono text-[10px] lowercase tracking-[0.1em]"
          style={{ color: "var(--nova-accent)" }}
          data-testid="publish-scheduled-at"
        >
          goes out {scheduledLabel(scheduledAt)}
        </span>
        <button
          type="button"
          onClick={() => void cancelSchedule()}
          disabled={busy}
          className={`${linkClass} disabled:opacity-50`}
          data-testid="publish-schedule-cancel"
        >
          cancel
        </button>
        <button type="button" onClick={() => void publish()} className={linkClass}>
          publish now
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {(state === "error" || errorMsg) && errorMsg ? (
        <span
          className="max-w-[26ch] truncate font-mono text-[10px] lowercase tracking-[0.08em]"
          style={{ color: "var(--lunari-fg-muted)" }}
          title={errorMsg}
        >
          {errorMsg}
        </span>
      ) : null}
      {pickerOpen ? (
        <span className="flex items-center gap-2" data-testid="publish-schedule-picker">
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            aria-label="publish at"
            data-testid="publish-schedule-when"
            className="h-7 rounded-md border bg-transparent px-2 font-mono text-[10px]"
            style={{ borderColor: "var(--lunari-border)", color: "var(--lunari-fg-muted)" }}
          />
          <button
            type="button"
            onClick={() => void schedule()}
            disabled={busy || !when}
            className={`${linkClass} disabled:opacity-50`}
            style={{ color: "var(--nova-accent)" }}
            data-testid="publish-schedule-set"
          >
            {busy ? "setting ..." : "set"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPickerOpen(false);
              setErrorMsg(null);
            }}
            className={linkClass}
          >
            never mind
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className={linkClass}
          data-testid="publish-schedule-open"
        >
          later ...
        </button>
      )}
      <button
        type="button"
        onClick={() => void publish()}
        disabled={state === "publishing"}
        className="np-btn inline-flex h-7 items-center rounded-full px-3.5 font-mono text-[11px] uppercase tracking-[0.18em] disabled:opacity-50"
        style={{
          background: "var(--nova-accent)",
          color: "var(--lunari-bg-deep)",
        }}
      >
        {state === "publishing" ? "publishing ..." : state === "error" ? "try again" : "publish"}
      </button>
    </div>
  );
}
