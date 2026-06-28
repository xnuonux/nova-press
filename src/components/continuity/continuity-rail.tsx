"use client";

/**
 * the continuity rail ... the work read against its own bible, made visible.
 *
 * a calm disclosure panel on the work page. "scan" runs the continuity pass over
 * the whole work (the deterministic name-drift / unintroduced pass + the model's
 * contradiction / timeline read) and lays the open flags out below, each a
 * descriptive mirror ("looks like a slip for", "isn't in the bible yet"), never a
 * verdict. you accept or dismiss each; the triage is server-authoritative and
 * durable (a dismissed flag stays dismissed across re-scans). the scan is
 * skip-if-unchanged, so re-firing over an unedited work costs nothing.
 *
 * it mirrors the editorial pass panel: lowercase voice, lunari tokens, the golden
 * accent, a flag list with accept / dismiss / undo.
 */

import { useCallback, useId, useState } from "react";

import { triageContinuityFlagAction } from "@/app/(authed)/work/[id]/continuity-actions";
import type { ContinuityFlag } from "@/lib/db/continuity";

const ACCENT = "var(--nova-accent)";
const SUBTLE = "var(--lunari-fg-subtle)";
const MUTED = "var(--lunari-fg-muted)";

interface ContinuityRailProps {
  workId: string;
  initialFlags: ContinuityFlag[];
}

interface ScanResponse {
  ok?: boolean;
  status?: "skipped" | "complete" | "partial";
  flagsFound?: number;
  flags?: ContinuityFlag[];
  error?: string;
}

type FlagStatus = ContinuityFlag["status"];

export function ContinuityRail({ workId, initialFlags }: ContinuityRailProps) {
  const [flags, setFlags] = useState<ContinuityFlag[]>(initialFlags);
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const listId = useId();

  const runScan = useCallback(async () => {
    if (scanning) return;
    setScanning(true);
    setNote(null);
    try {
      const res = await fetch("/api/ai/continuity/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workId }),
      });
      const data = (await res.json().catch(() => ({}))) as ScanResponse;
      if (res.ok && data.ok) {
        const next = data.flags ?? [];
        setFlags(next);
        setOpen(true);
        if (data.status === "skipped") {
          setNote("no change since the last scan.");
        } else if (data.status === "partial") {
          setNote("scanned the prose ... the deeper read will retry next time.");
        } else if (next.length === 0) {
          setNote("a clean scan ... nothing reads as adrift.");
        } else {
          setNote(null);
        }
      } else {
        setNote(data.error ?? "couldn't run that scan.");
      }
    } catch {
      setNote("couldn't reach nova ... try again in a sec.");
    } finally {
      setScanning(false);
    }
  }, [workId, scanning]);

  const triage = useCallback(
    async (flagId: string, status: FlagStatus) => {
      // optimistic ... reflect the choice at once, but snapshot the prior row so a
      // server refusal rolls it back (otherwise the rail + the open-count would
      // diverge from the server until the next scan).
      let prior: ContinuityFlag | undefined;
      setFlags((list) =>
        list.map((f) => {
          if (f.id === flagId) {
            prior = f;
            return { ...f, status };
          }
          return f;
        }),
      );
      const res = await triageContinuityFlagAction(workId, flagId, status);
      if (!res.ok) {
        setNote("couldn't update that flag ... try again.");
        if (prior) {
          const restore = prior;
          setFlags((list) => list.map((f) => (f.id === restore.id ? restore : f)));
        }
        return;
      }
      // reconcile with the authoritative row. upsert, not map-in-place ... a
      // concurrent scan may have replaced the list and dropped this id, so re-add
      // it rather than silently lose the row.
      if (res.flag) {
        const updated = res.flag;
        setFlags((list) =>
          list.some((f) => f.id === updated.id)
            ? list.map((f) => (f.id === updated.id ? updated : f))
            : [...list, updated],
        );
      }
    },
    [workId],
  );

  const openCount = flags.filter((f) => f.status === "open").length;

  return (
    <section
      className="np-rise np-rise-3 mt-4 rounded-xl border px-4 py-3"
      style={{
        borderColor: "var(--lunari-border)",
        background: "color-mix(in srgb, var(--lunari-bg-surface) 60%, transparent)",
      }}
      data-testid="continuity-rail"
    >
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em]"
          style={{ color: SUBTLE }}
        >
          <span>continuity</span>
          {openCount > 0 ? (
            <span
              className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] tracking-[0.1em]"
              style={{ background: "var(--nova-accent-soft)", color: ACCENT }}
            >
              {openCount} open
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={runScan}
          disabled={scanning}
          data-testid="run-scan"
          className="np-btn inline-flex h-7 items-center rounded-full px-3 font-mono text-[10px] uppercase tracking-[0.16em] disabled:opacity-50"
          style={{ background: "var(--nova-accent-soft)", color: ACCENT }}
        >
          {scanning ? "scanning ..." : "scan"}
        </button>
      </div>

      {open ? (
        <div id={listId} className="mt-3 flex flex-col gap-1.5">
          {flags.length === 0 ? (
            <p className="font-serif text-[13px] italic" style={{ color: SUBTLE }}>
              no concerns ... scan the work against its codex to check.
            </p>
          ) : (
            <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
              {flags.map((f) => {
                const done = f.status !== "open";
                return (
                  <li
                    key={f.id}
                    data-testid="continuity-flag"
                    className="flex items-start justify-between gap-3 rounded-md px-2.5 py-1.5"
                    style={{
                      background: "color-mix(in srgb, var(--lunari-fg-subtle) 8%, transparent)",
                      opacity: done ? 0.5 : 1,
                    }}
                  >
                    <span className="flex min-w-0 items-start gap-2">
                      <span
                        className="mt-0.5 shrink-0 font-mono text-[9px] uppercase tracking-[0.1em]"
                        style={{ color: ACCENT }}
                      >
                        {f.kind.replace(/_/g, " ")}
                      </span>
                      <span
                        className="font-serif text-[13px] leading-snug"
                        style={{ color: MUTED }}
                      >
                        {f.message}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em]">
                      {done ? (
                        <button
                          type="button"
                          onClick={() => void triage(f.id, "open")}
                          style={{ color: SUBTLE }}
                        >
                          undo
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            data-testid="flag-accept"
                            onClick={() => void triage(f.id, "accepted")}
                            style={{ color: ACCENT }}
                          >
                            accept
                          </button>
                          <button
                            type="button"
                            data-testid="flag-dismiss"
                            onClick={() => void triage(f.id, "dismissed")}
                            style={{ color: SUBTLE }}
                          >
                            dismiss
                          </button>
                        </>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {note ? (
            <p
              className="font-serif text-[12px] italic leading-snug"
              style={{ color: SUBTLE }}
              data-testid="scan-note"
            >
              {note}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
