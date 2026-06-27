"use client";

/**
 * the editorial panel ... the craft ladder made visible.
 *
 * a slim stepper across the top of the editor shows the seven stages, the
 * current one lit. "run a pass" reads the saved draft through the stage's
 * deterministic lenses and lays the findings out below ... each a descriptive
 * note or a flag, a mirror never a verdict. you accept or set aside each flag;
 * the advance gate opens only once every flag is triaged (the same gate the
 * server enforces ... this is just the hint). a staleness dot lights when you've
 * written past the last pass, so you know to run it again.
 *
 * it is a calm island: a custom event from the editor marks the pass stale on
 * edit, the actions are server-authoritative, and the copy stays lowercase + in
 * voice. it never touches the editor value.
 */

import { useCallback, useEffect, useId, useState } from "react";

import type { EditorialPass, EditorialStage, Finding, FindingStatus } from "@/types/editorial";
import { evaluateTransition } from "@/lib/editorial/state-machine";
import { STAGES, nextStage, stageRank } from "@/lib/editorial/stages";

import { setStageAction, triageFindingAction } from "@/app/(authed)/editor/[id]/editorial-actions";

interface EditorialPanelProps {
  pieceId: string;
  initialStage: EditorialStage;
  initialFindings: Finding[];
  initialHasPass: boolean;
  initialStale: boolean;
}

interface PassResponse {
  ok?: boolean;
  stage?: string;
  findings?: Finding[];
  error?: string;
}

const ACCENT = "var(--nova-accent)";
const SUBTLE = "var(--lunari-fg-subtle)";
const MUTED = "var(--lunari-fg-muted)";

// ask the editor to land any pending autosave, then wait for the ack (or a short
// ceiling) so a pass reads the just-saved body. resolves at once when nothing is
// pending ... the shell acks immediately in that case.
function flushAutosave(timeoutMs = 4000): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      document.removeEventListener("nova:save-flushed", finish);
      resolve();
    };
    document.addEventListener("nova:save-flushed", finish);
    document.dispatchEvent(new CustomEvent("nova:flush-save"));
    window.setTimeout(finish, timeoutMs);
  });
}

export function EditorialPanel({
  pieceId,
  initialStage,
  initialFindings,
  initialHasPass,
  initialStale,
}: EditorialPanelProps) {
  const [stage, setStage] = useState<EditorialStage>(initialStage);
  const [findings, setFindings] = useState<Finding[]>(initialFindings);
  const [hasPass, setHasPass] = useState(initialHasPass);
  const [stale, setStale] = useState(initialStale);
  const [running, setRunning] = useState(false);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const listId = useId();

  // the editor dispatches nova:piece-edited on a real edit ... the pass it
  // reviewed is now behind the words, so mark it stale (re-run before advancing).
  useEffect(() => {
    const onEdit = () => setStale((s) => (hasPass ? true : s));
    document.addEventListener("nova:piece-edited", onEdit);
    return () => document.removeEventListener("nova:piece-edited", onEdit);
  }, [hasPass]);

  const runPass = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setNote(null);
    // land any pending edit first, so the pass reads the current body and the
    // "not stale" state it returns is honest rather than optimistic.
    await flushAutosave();
    try {
      const res = await fetch("/api/ai/editor/pass", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pieceId }),
      });
      const data = (await res.json().catch(() => ({}))) as PassResponse;
      if (res.ok && data.ok) {
        setFindings(data.findings ?? []);
        setHasPass(true);
        setStale(false);
        setOpen(true);
      } else {
        setNote(data.error ?? "couldn't run that pass.");
      }
    } catch {
      setNote("couldn't reach nova ... try again in a sec.");
    } finally {
      setRunning(false);
    }
  }, [pieceId, running]);

  const triage = useCallback(
    async (index: number, status: FindingStatus) => {
      const res = await triageFindingAction(pieceId, stage, index, status);
      if (res.ok) setFindings(res.findings);
      else setNote("couldn't update that flag ... try again.");
    },
    [pieceId, stage],
  );

  const move = useCallback(
    async (target: EditorialStage) => {
      setNote(null);
      const result = await setStageAction(pieceId, target);
      if (result.allowed && result.target) {
        setStage(target);
        // a retreat restores the target stage's stored review; an advance lands
        // on a fresh, not-yet-run stage (target comes back empty).
        setFindings(result.target.findings);
        setHasPass(result.target.hasPass);
        setStale(result.target.stale);
        setOpen(result.target.hasPass);
      } else {
        setNote(result.reason);
      }
    },
    [pieceId],
  );

  const up = nextStage(stage);
  const openFlags = findings.filter((f) => f.severity === "flag" && f.status === "open").length;

  // the advance hint: the same gate the server enforces, run uniformly so the
  // button reads honestly. without a pass, evaluateTransition itself supplies the
  // "run a pass first" reason ... no second copy to drift out of sync.
  const gate: { allowed: boolean; reason: string } = up
    ? evaluateTransition(stage, up, {
        pass: hasPass ? ({ findings } as unknown as EditorialPass) : null,
        stale,
      })
    : { allowed: false, reason: "this is the last stage." };

  const showList = open && findings.length > 0;

  return (
    <div
      className="np-rise pointer-events-auto fixed left-1/2 top-16 z-30 w-[min(90vw,640px)] -translate-x-1/2 lg:left-[calc(50%-160px)]"
      data-testid="editorial-panel"
    >
      <div
        className="flex flex-col gap-2 rounded-xl border px-3 py-2 backdrop-blur"
        style={{
          borderColor: "var(--lunari-border)",
          background: "color-mix(in srgb, var(--lunari-bg-surface) 86%, transparent)",
        }}
      >
        {/* the ladder */}
        <div className="flex items-center justify-between gap-3">
          <ol className="flex items-center gap-1.5 overflow-x-auto">
            {STAGES.map((s) => {
              const isCurrent = s === stage;
              const isPast = stageRank(s) < stageRank(stage);
              return (
                <li key={s} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => (isPast ? void move(s) : undefined)}
                    disabled={!isPast}
                    aria-current={isCurrent ? "step" : undefined}
                    title={isPast ? `step back to ${s}` : s}
                    className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-opacity disabled:cursor-default"
                    style={{
                      color: isCurrent ? ACCENT : isPast ? MUTED : SUBTLE,
                      opacity: isCurrent ? 1 : isPast ? 0.85 : 0.5,
                    }}
                  >
                    {isCurrent && stale ? (
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ background: ACCENT }}
                        aria-label="stale"
                      />
                    ) : null}
                    {s}
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={runPass}
              disabled={running}
              data-testid="run-pass"
              className="np-btn inline-flex h-7 items-center rounded-full px-3 font-mono text-[10px] uppercase tracking-[0.16em] disabled:opacity-50"
              style={{ background: "var(--nova-accent-soft)", color: ACCENT }}
            >
              {running ? "reading ..." : hasPass ? "re-run pass" : "run a pass"}
            </button>
            {up ? (
              <button
                type="button"
                onClick={() => void move(up)}
                aria-disabled={!gate.allowed}
                data-testid="advance"
                title={gate.allowed ? `advance to ${up}` : gate.reason}
                className={`inline-flex h-7 items-center rounded-full px-3 font-mono text-[10px] uppercase tracking-[0.16em] transition-opacity ${gate.allowed ? "" : "cursor-not-allowed opacity-40"}`}
                style={{ background: ACCENT, color: "var(--lunari-bg-deep)" }}
              >
                advance ...
              </button>
            ) : null}
          </div>
        </div>

        {/* the pass panel */}
        {hasPass ? (
          <div
            className="flex flex-col gap-1 border-t pt-2"
            style={{ borderColor: "var(--lunari-border)" }}
          >
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-controls={showList ? listId : undefined}
              className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em]"
              style={{ color: SUBTLE }}
            >
              <span>
                {findings.length === 0
                  ? "a clean pass ... nothing to note"
                  : `${findings.length} note${findings.length === 1 ? "" : "s"}${openFlags > 0 ? ` · ${openFlags} flag${openFlags === 1 ? "" : "s"} open` : ""}`}
              </span>
              <span aria-hidden>{open ? "hide" : "show"}</span>
            </button>

            {showList ? (
              <ul id={listId} className="flex max-h-56 flex-col gap-1 overflow-y-auto pt-1">
                {findings.map((f, i) => {
                  const done = f.status !== "open";
                  return (
                    <li
                      key={i}
                      data-testid="finding"
                      className="flex items-start justify-between gap-3 rounded-md px-2 py-1.5"
                      style={{
                        background: "color-mix(in srgb, var(--lunari-fg-subtle) 8%, transparent)",
                        opacity: done ? 0.5 : 1,
                      }}
                    >
                      <span className="flex items-start gap-2">
                        <span
                          className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: f.severity === "flag" ? ACCENT : SUBTLE }}
                          aria-label={f.severity}
                        />
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
                            onClick={() => void triage(i, "open")}
                            style={{ color: SUBTLE }}
                          >
                            undo
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              data-testid="triage-accept"
                              onClick={() => void triage(i, "accepted")}
                              style={{ color: ACCENT }}
                            >
                              accept
                            </button>
                            <button
                              type="button"
                              data-testid="triage-dismiss"
                              onClick={() => void triage(i, "dismissed")}
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
            ) : null}
          </div>
        ) : null}

        {note ? (
          <p
            className="font-serif text-[12px] italic leading-snug"
            style={{ color: SUBTLE }}
            data-testid="panel-note"
          >
            {note}
          </p>
        ) : null}
      </div>
    </div>
  );
}
