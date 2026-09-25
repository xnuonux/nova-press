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

import { useCallback, useEffect, useId, useRef, useState } from "react";

import type { EditorialPass, EditorialStage, Finding, FindingStatus } from "@/types/editorial";
import { evaluateTransition } from "@/lib/editorial/state-machine";
import { STAGES, nextStage, stageRank } from "@/lib/editorial/stages";
import { requestSaveFlush } from "@/lib/editor/save-handshake";
import { createReviewFreshness } from "@/lib/editor/review-freshness";

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
  const freshness = useRef(createReviewFreshness()).current;
  const operation = useRef<AbortController | null>(null);

  // one operation at a time, including before react paints a disabled button.
  const beginOperation = useCallback(() => {
    if (operation.current) return null;
    const controller = new AbortController();
    operation.current = controller;
    setRunning(true);
    setNote(null);
    return controller;
  }, []);
  const finishOperation = useCallback((controller: AbortController) => {
    if (operation.current !== controller) return;
    operation.current = null;
    setRunning(false);
  }, []);

  useEffect(() => () => {
    operation.current?.abort();
    operation.current = null;
    freshness.invalidate();
  }, [freshness, pieceId]);

  // the editor dispatches nova:piece-edited on a real edit ... the pass it
  // reviewed is now behind the words, so mark it stale (re-run before advancing).
  useEffect(() => {
    const onEdit = () => {
      freshness.edited();
      setStale((s) => (hasPass ? true : s));
    };
    document.addEventListener("nova:piece-edited", onEdit);
    return () => document.removeEventListener("nova:piece-edited", onEdit);
  }, [hasPass, freshness]);

  const runPass = useCallback(async () => {
    const controller = beginOperation();
    if (!controller) return;
    try {
      // no successful, correlated acknowledgement means no pass request.
      await requestSaveFlush(document, crypto.randomUUID(), { signal: controller.signal });
      if (controller.signal.aborted) return;
      const stamp = freshness.begin();
      const res = await fetch("/api/ai/editor/pass", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pieceId }),
        signal: controller.signal,
      });
      const data = (await res.json().catch(() => ({}))) as PassResponse;
      if (controller.signal.aborted || !freshness.isLatest(stamp)) return;
      if (res.ok && data.ok === true && data.stage === stage && Array.isArray(data.findings)) {
        setFindings(data.findings);
        setHasPass(true);
        const current = freshness.isCurrent(stamp);
        setStale(!current);
        setOpen(true);
        if (!current) setNote("you kept writing ... this pass is behind the page. run it again when ready.");
      } else {
        setNote(data.error ?? "that pass was not confirmed. your previous review is still here.");
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setNote(error instanceof Error ? error.message : "couldn't reach nova ... try again in a sec.");
      }
    } finally {
      finishOperation(controller);
    }
  }, [pieceId, stage, freshness, beginOperation, finishOperation]);

  const triage = useCallback(
    async (index: number, status: FindingStatus) => {
      const controller = beginOperation();
      if (!controller) return;
      try {
        const res = await triageFindingAction(pieceId, stage, index, status);
        if (controller.signal.aborted) return;
        if (res.ok) setFindings(res.findings);
        else setNote("couldn't update that flag ... try again.");
      } catch {
        if (!controller.signal.aborted) setNote("couldn't update that flag ... try again.");
      } finally {
        finishOperation(controller);
      }
    },
    [pieceId, stage, beginOperation, finishOperation],
  );

  const move = useCallback(
    async (target: EditorialStage) => {
      const controller = beginOperation();
      if (!controller) return;
      const stamp = freshness.begin();
      try {
        // retreat remains free. advancing needs both a current local review and
        // a confirmed save; the server remains the authority for the transition.
        if (stageRank(target) > stageRank(stage)) {
          const permission = evaluateTransition(stage, target, {
            pass: hasPass ? ({ findings } as unknown as EditorialPass) : null,
            stale,
          });
          if (!permission.allowed) {
            setNote(permission.reason);
            return;
          }
          await requestSaveFlush(document, crypto.randomUUID(), { signal: controller.signal });
          if (!freshness.isCurrent(stamp)) {
            setNote("the page changed ... run a fresh pass before advancing.");
            return;
          }
        }
        if (controller.signal.aborted) return;
        const result = await setStageAction(pieceId, target);
        if (controller.signal.aborted || !freshness.isLatest(stamp)) return;
        if (result.allowed && result.target) {
          setStage(target);
          setFindings(result.target.findings);
          setHasPass(result.target.hasPass);
          setStale(result.target.stale || !freshness.isCurrent(stamp));
          setOpen(result.target.hasPass);
        } else {
          setNote(result.reason);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setNote(error instanceof Error ? error.message : "couldn't change stages ... try again.");
        }
      } finally {
        finishOperation(controller);
      }
    },
    [pieceId, stage, hasPass, findings, stale, freshness, beginOperation, finishOperation],
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
                    disabled={!isPast || running}
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
              {running ? "working ..." : hasPass ? "re-run pass" : "run a pass"}
            </button>
            {up ? (
              <button
                type="button"
                onClick={() => void move(up)}
                disabled={!gate.allowed || running}
                aria-disabled={!gate.allowed || running}
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
                            disabled={running}
                            onClick={() => void triage(i, "open")}
                            style={{ color: SUBTLE }}
                          >
                            undo
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={running}
                              data-testid="triage-accept"
                              onClick={() => void triage(i, "accepted")}
                              style={{ color: ACCENT }}
                            >
                              accept
                            </button>
                            <button
                              type="button"
                              disabled={running}
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
