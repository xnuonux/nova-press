"use client";

/** a proposal beside the page ... source-pinned, never an automatic rewrite. */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useEditorRef } from "platejs/react";
import { auditedLines } from "@/lib/ai/author-format";
import { captureDraft } from "@/lib/editor/manuscript-desk";
import {
  createAuthorProposal, isProposalTask, MAX_AUTHOR_STREAM_CHARS, type ProposalTask,
} from "@/lib/editor/author-proposal";
import "./author-proposal.css";

interface AuthorEventDetail { task: ProposalTask; context: string; blockIndex: number; }
interface BeatState {
  task: ProposalTask; blockIndex: number; text: string; done: boolean;
  error: string | null; stale: boolean; feedback: string | null;
  top: number | null; bottom: number | null; left: number; width: number;
}
const LABEL: Record<ProposalTask, string> = {
  expand: "expanding", "draft-beat": "drafting", outline: "scaffolding", coin: "coining",
};

export function AuthorBeat({ pieceId, getTitle }: { pieceId: string; getTitle?: () => string }) {
  const editor = useEditorRef();
  const [beat, setBeat] = useState<BeatState | null>(null);
  const beatRef = useRef<BeatState | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const genRef = useRef(0);
  const proposalRef = useRef<ReturnType<typeof createAuthorProposal> | null>(null);
  const show = useCallback((next: BeatState | null) => {
    // event handlers see the new state immediately, before react paints it.
    beatRef.current = next;
    setBeat(next);
  }, []);
  const readSource = useCallback(() => {
    if (!getTitle) throw new Error("the source title is unavailable");
    return captureDraft(pieceId, getTitle(), editor.children);
  }, [pieceId, getTitle, editor]);
  const cancel = useCallback(() => {
    genRef.current++;
    abortRef.current?.abort();
    abortRef.current = null;
    proposalRef.current?.dismiss();
    proposalRef.current = null;
    show(null);
  }, [show]);

  const observeSource = useCallback(() => {
    const b = beatRef.current;
    const proposal = proposalRef.current;
    if (!b || !proposal) return;
    try {
      if (proposal.observe(readSource()) === "stale" && !b.stale) show({ ...b, stale: true });
    } catch {
      proposal.block();
      show({ ...b, error: "the current source could not be confirmed ... nothing can be inserted" });
    }
  }, [readSource, show]);

  const accept = useCallback(() => {
    const b = beatRef.current;
    const proposal = proposalRef.current;
    if (!b || !proposal || !b.done || b.error) return;
    let plan: ReturnType<typeof proposal.take>;
    try { plan = proposal.take(readSource()); }
    catch {
      proposal.block();
      show({ ...b, error: "the current source could not be confirmed ... nothing can be inserted" });
      return;
    }
    if (!plan.ok) {
      show({ ...b, stale: plan.reason === "stale", feedback: "this proposal cannot be applied ... ask for a fresh one" });
      return;
    }
    // the gate has already consumed the offer. no retry, even if a transform
    // reports an error after changing part of the document.
    cancel();
    try {
      editor.tf.insertNodes(plan.nodes, { at: [plan.at], select: true });
      editor.tf.focus();
    } catch {
      show({ ...b, done: true, error: "insertion was not confirmed ... inspect the page before asking again" });
    }
  }, [readSource, editor, cancel, show]);

  const run = useCallback(async (detail: AuthorEventDetail) => {
    cancel();
    const root = Array.from(document.querySelectorAll<HTMLElement>("[data-nova-editor-piece]"))
      .find((element) => element.dataset.novaEditorPiece === pieceId);
    const editable = root?.querySelector('[data-slate-editor="true"]');
    const blockEl = editable?.children[detail.blockIndex] as HTMLElement | undefined;
    if (!editable || !blockEl) return;
    const rect = blockEl.getBoundingClientRect();
    const width = Math.max(1, Math.min(rect.width, window.innerWidth - 24));
    const below = window.innerHeight - rect.bottom >= 240;
    const initial: BeatState = {
      task: detail.task, blockIndex: detail.blockIndex, text: "", done: false,
      error: null, stale: false, feedback: null,
      top: below ? rect.bottom + 6 : null,
      bottom: below ? null : Math.max(8, window.innerHeight - rect.top + 6),
      left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), width,
    };
    let proposal: ReturnType<typeof createAuthorProposal>;
    try { proposal = createAuthorProposal(readSource(), detail.task, detail.blockIndex); }
    catch {
      show({ ...initial, done: true, error: "this request could not be anchored to the source ... nothing was sent" });
      return;
    }
    proposalRef.current = proposal;
    const gen = ++genRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    show(initial);
    const update = (patch: Partial<BeatState>) => {
      if (gen === genRef.current && beatRef.current) show({ ...beatRef.current, ...patch });
    };
    let response: Response;
    try {
      response = await fetch("/api/ai/author", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ pieceId, task: detail.task, context: detail.context }),
        signal: controller.signal,
      });
    } catch {
      proposal.block();
      update({ done: true, error: "nova could not finish this request ... nothing was inserted" });
      return;
    }
    if (gen !== genRef.current) return;
    if (!response.ok || !response.body) {
      const data = await response.json().catch(() => null) as { error?: unknown } | null;
      proposal.block();
      update({ done: true, error: typeof data?.error === "string" ? data.error.slice(0, 240) : "nova couldn't write that one" });
      return;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    try {
      for (;;) {
        const chunk = await reader.read();
        if (gen !== genRef.current) return;
        if (chunk.done) break;
        text += decoder.decode(chunk.value, { stream: true });
        if (text.length > MAX_AUTHOR_STREAM_CHARS) {
          controller.abort();
          throw new Error("proposal limit");
        }
        update({ text });
      }
      text += decoder.decode();
      if (gen !== genRef.current) return;
      const lines = auditedLines(detail.task, text);
      const state = proposal.finish(lines, readSource());
      update({ text, done: true, stale: state === "stale", error: state === "blocked" ? "nova's reply was empty or exceeded the proposal limits" : null });
    } catch {
      proposal.block();
      update({ done: true, error: "the proposal was not completed safely ... nothing was inserted" });
    } finally { reader.releaseLock(); }
  }, [cancel, pieceId, readSource, show]);

  useEffect(() => {
    const onAuthor = (event: Event) => {
      const detail = (event as CustomEvent<AuthorEventDetail>).detail;
      if (!detail || !isProposalTask(detail.task) || typeof detail.context !== "string" ||
        detail.context.length > MAX_AUTHOR_STREAM_CHARS || !Number.isSafeInteger(detail.blockIndex) || detail.blockIndex < 0) return;
      void run(detail);
    };
    document.addEventListener("nova:author", onAuthor);
    return () => document.removeEventListener("nova:author", onAuthor);
  }, [run]);

  const active = beat !== null;
  useEffect(() => {
    if (!active) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.isComposing || event.defaultPrevented) return;
      const b = beatRef.current;
      const editable = event.target instanceof Element ? event.target.closest('[data-slate-editor="true"]') : null;
      const root = editable?.closest<HTMLElement>("[data-nova-editor-piece]");
      if (event.key === "Tab" && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey &&
        root?.dataset.novaEditorPiece === pieceId && b?.done && !b.error && !b.stale) {
        event.preventDefault(); event.stopPropagation(); accept();
      } else if (event.key === "Escape") {
        event.preventDefault(); event.stopPropagation(); cancel();
      }
    };
    const onScroll = (event: Event) => {
      if (event.target instanceof Element && event.target.closest(".np-author-beat")) return;
      cancel();
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("nova:piece-edited", observeSource);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", cancel);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("nova:piece-edited", observeSource);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", cancel);
    };
  }, [active, pieceId, accept, cancel, observeSource]);

  useEffect(() => {
    document.dispatchEvent(new CustomEvent(active ? "nova:author-active" : "nova:author-idle"));
  }, [active]);
  useEffect(() => () => {
    genRef.current++;
    abortRef.current?.abort();
    proposalRef.current?.dismiss();
    proposalRef.current = null;
    beatRef.current = null;
  }, [pieceId]);

  const copy = async () => {
    const b = beatRef.current;
    if (!b || !b.done || b.error) return;
    const gen = genRef.current;
    try {
      await navigator.clipboard.writeText(auditedLines(b.task, b.text).join("\n"));
      if (gen === genRef.current && beatRef.current) show({ ...beatRef.current, feedback: "proposal copied ... nothing inserted" });
    } catch {
      if (gen === genRef.current && beatRef.current) show({ ...beatRef.current, feedback: "the copy could not be confirmed" });
    }
  };
  if (!beat) return null;
  const preview = beat.error ?? auditedLines(beat.task, beat.text).join("\n");
  const canAccept = beat.done && !beat.error && !beat.stale && proposalRef.current?.state() === "ready";
  return createPortal(
    <div className="np-author-beat np-proposal" data-testid="author-beat" role="region" aria-label="nova's proposed addition"
      style={{ top: beat.top ?? undefined, bottom: beat.bottom ?? undefined, left: beat.left, width: beat.width }}>
      <div className="np-author-beat-head"><span>nova ... {LABEL[beat.task]}</span><span className="np-author-beat-keys">{canAccept ? "tab to weave in · esc" : "esc to dismiss"}</span></div>
      <p className="np-proposal__anchor">adds after block {beat.blockIndex + 1} ... existing text stays</p>
      <div className="np-author-beat-body" aria-busy={!beat.done} data-testid="author-beat-body">{preview}{!beat.done ? <span className="np-caret" aria-hidden /> : null}</div>
      {beat.stale ? <p className="np-proposal__notice" role="status">the page changed while this proposal was open ... copy it or ask for a fresh one</p> : null}
      {beat.feedback ? <p className="np-proposal__notice" role="status">{beat.feedback}</p> : null}
      <div className="np-proposal__actions">
        <button type="button" disabled={!canAccept} onClick={accept}>weave into page</button>
        <button type="button" disabled={!beat.done || !!beat.error} onClick={() => void copy()}>copy proposal</button>
        <button type="button" onClick={cancel}>dismiss</button>
      </div>
    </div>, document.body,
  );
}
