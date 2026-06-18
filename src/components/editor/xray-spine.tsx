"use client";

/**
 * the x-ray spine ... the draft's argument, drawn in the left margin.
 *
 * on demand (the "structure" toggle in the chrome), nova reads the whole draft
 * as an argument and renders its load-bearing shape: one quiet node per block,
 * labelled by what that block IS (opening, thesis, evidence, turn, payoff ...),
 * with thin threads connecting a promise to where it pays off. it is a MIRROR,
 * never a verdict ... it shows you the building you are standing in and never
 * once grades it. you see your best line stranded in paragraph nine and draw
 * your own conclusion.
 *
 * like ghost text, it's a PURE DOM OVERLAY measured off block rects ... it never
 * touches the editor value, and it lives always-mounted inside <Plate> (toggled
 * by a custom event from the header button) so flipping it on never re-renders
 * the editable. positions track scroll + resize on a rAF.
 *
 * it is a SNAPSHOT of a moment: the instant you edit, the shape is stale, so the
 * spine dismisses itself on any input and you re-run it. that one rule keeps the
 * index->block mapping honest (no drift on insert / delete / reorder) and means
 * the hover highlight can never fight a live slate re-render.
 *
 * the structure is exposed to assistive tech as a labelled list (the nodes are
 * content, not controls ... hover is a sighted enhancement); the toggle carries
 * aria-pressed via the nova:xray-state event.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { Value } from "platejs";
import { useEditorRef } from "platejs/react";

import type { XrayRole, XrayStructure } from "@/lib/ai/xray";

import { plateText } from "./plate-text";

const GUTTER = 72; // px the spine sits left of the text column
const MIN_LEFT = 10;
const MIN_GUTTER = 130; // below this much room left of the text, the spine hides

interface NodePos {
  n: number;
  role: XrayRole;
  y: number; // viewport top of the block
}

interface XrayResponse {
  ok?: boolean;
  structure?: XrayStructure;
  degraded?: boolean;
}

function setToggleState(active: boolean) {
  document.dispatchEvent(new CustomEvent("nova:xray-state", { detail: { active } }));
}

export function XraySpine() {
  const editor = useEditorRef();
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [degraded, setDegraded] = useState(false);
  const [structure, setStructure] = useState<XrayStructure | null>(null);
  const [nodes, setNodes] = useState<NodePos[]>([]);
  const [left, setLeft] = useState(MIN_LEFT);
  const [narrow, setNarrow] = useState(false);
  const [hover, setHover] = useState<number | null>(null);

  const openRef = useRef(false); // synchronous source of truth for the toggle
  const structRef = useRef<XrayStructure | null>(null);
  structRef.current = structure;
  const genRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // read the live block rects and lay the nodes out. cheap enough to run on
  // every scroll frame (rAF-throttled below).
  const reposition = useCallback(() => {
    const struct = structRef.current;
    const editable = document.querySelector('[data-slate-editor="true"]');
    if (!struct || !editable) {
      setNodes([]);
      return;
    }
    const editRect = editable.getBoundingClientRect();
    if (editRect.left < MIN_GUTTER) {
      setNarrow(true);
      setNodes([]);
      return;
    }
    setNarrow(false);
    setLeft(Math.max(MIN_LEFT, Math.round(editRect.left - GUTTER)));
    const kids = editable.children;
    const next: NodePos[] = [];
    for (const r of struct.roles) {
      const el = kids[r.n];
      if (!el) continue;
      next.push({ n: r.n, role: r.role, y: Math.round(el.getBoundingClientRect().top) });
    }
    setNodes(next);
  }, []);

  const scheduleReposition = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      reposition();
    });
  }, [reposition]);

  // restoreFocus: true when the writer closed it on purpose (esc / the toggle),
  // false when it auto-dismissed on an edit ... we must NOT yank focus out of
  // the editable mid-keystroke.
  const close = useCallback((restoreFocus = false) => {
    openRef.current = false;
    abortRef.current?.abort();
    abortRef.current = null;
    genRef.current += 1;
    setActive(false);
    setLoading(false);
    setDegraded(false);
    setStructure(null);
    setNodes([]);
    setHover(null);
    setNarrow(false);
    document.body.classList.remove("np-xray-on");
    setToggleState(false);
    if (restoreFocus) {
      const toggle = document.querySelector(".np-xray-toggle");
      if (toggle instanceof HTMLElement) toggle.focus();
    }
  }, []);

  const run = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setActive(true);
    setLoading(true);
    setDegraded(false);
    setStructure(null);
    setNodes([]);
    setHover(null);
    document.body.classList.add("np-xray-on");
    setToggleState(true);
    // place the gutter up front so the "reading the shape" notice lands in the
    // right spot before the analysis returns (reposition only runs once the
    // structure is in).
    const editable0 = document.querySelector('[data-slate-editor="true"]');
    if (editable0) {
      const r = editable0.getBoundingClientRect();
      if (r.left < MIN_GUTTER) {
        setNarrow(true);
      } else {
        setNarrow(false);
        setLeft(Math.max(MIN_LEFT, Math.round(r.left - GUTTER)));
      }
    }
    const gen = ++genRef.current;

    const blocks = (editor.children as Value).map((b) => plateText([b] as Value));
    let data: XrayResponse | null = null;
    try {
      const res = await fetch("/api/ai/xray", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ blocks }),
        signal: controller.signal,
      });
      data = (await res.json()) as XrayResponse;
    } catch {
      // aborted / offline / bad json ... fall through to the degraded state
    }
    if (gen !== genRef.current) return;
    abortRef.current = null;
    setLoading(false);
    if (data?.ok && data.structure) {
      setStructure(data.structure);
      setDegraded(!!data.degraded);
    } else {
      setStructure({ roles: [], threads: [] });
      setDegraded(true);
    }
  }, [editor]);

  // the header toggle dispatches nova:xray-toggle; openRef is the synchronous
  // gate so a rapid double-click can't fire two analyses.
  useEffect(() => {
    const onToggle = () => {
      if (openRef.current) {
        close(true);
      } else {
        openRef.current = true;
        void run();
      }
    };
    document.addEventListener("nova:xray-toggle", onToggle);
    return () => document.removeEventListener("nova:xray-toggle", onToggle);
  }, [run, close]);

  // (re)lay the spine whenever the analysis lands, and track scroll + resize.
  useEffect(() => {
    if (!structure) {
      setNodes([]);
      return;
    }
    reposition();
    window.addEventListener("scroll", scheduleReposition, true);
    window.addEventListener("resize", scheduleReposition);
    return () => {
      window.removeEventListener("scroll", scheduleReposition, true);
      window.removeEventListener("resize", scheduleReposition);
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [structure, reposition, scheduleReposition]);

  // the spine is a snapshot. the instant the draft changes, dismiss it ... that
  // keeps the index->block mapping from drifting on insert / delete / reorder,
  // and stops the hover highlight from fighting a live slate re-render. no focus
  // restore: the writer is typing, leave the caret where it is.
  useEffect(() => {
    if (!active) return;
    const editable = document.querySelector('[data-slate-editor="true"]');
    if (!editable) return;
    // beforeinput (capture) is the reliable "the content is about to change"
    // signal for a contenteditable ... slate manages the native input event
    // itself, so listening for "input" misses keystrokes. capture runs before
    // slate's own handler; we only dismiss, never preventDefault, so the edit
    // still lands.
    const onEdit = () => close(false);
    editable.addEventListener("beforeinput", onEdit, true);
    return () => editable.removeEventListener("beforeinput", onEdit, true);
  }, [active, close]);

  // esc closes the spine and hands focus back to the toggle.
  useEffect(() => {
    if (!active) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") close(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, close]);

  // tag the hovered block so css can lift it. the spine dismisses on edit, so
  // slate won't reconcile this away underneath us.
  useEffect(() => {
    const editable = document.querySelector('[data-slate-editor="true"]');
    if (!editable) return;
    const kids = editable.children;
    for (let i = 0; i < kids.length; i += 1) {
      const el = kids[i];
      if (!el) continue;
      if (hover != null && i === hover) el.setAttribute("data-xray-focus", "true");
      else el.removeAttribute("data-xray-focus");
    }
  }, [hover, nodes]);

  useEffect(() => {
    return () => {
      document.body.classList.remove("np-xray-on");
      abortRef.current?.abort();
    };
  }, []);

  if (!active) return null;

  const yByBlock = new Map(nodes.map((node) => [node.n, node.y]));
  const threads = (structure?.threads ?? []).filter(
    (t) => yByBlock.has(t.from) && yByBlock.has(t.to),
  );
  const empty = !loading && !narrow && structure != null && nodes.length === 0;

  let statusText: string | null = null;
  if (loading) statusText = "reading the shape ...";
  else if (narrow) statusText = "the structure spine needs a wider window";
  else if (degraded && nodes.length === 0) statusText = "couldn't read it just now ... try again";
  else if (empty) statusText = "no clear structure yet ... keep writing";

  return createPortal(
    <div className="np-xray">
      {!narrow ? <div className="np-xray-rail" style={{ left }} aria-hidden /> : null}
      {!narrow ? (
        <span className="np-xray-rail-label" style={{ left }} aria-hidden>
          structure
        </span>
      ) : null}

      {statusText ? (
        <div
          className={narrow ? "np-xray-status np-xray-status-center" : "np-xray-status"}
          style={narrow ? undefined : { left }}
          role="status"
        >
          {statusText}
        </div>
      ) : null}

      {threads.length > 0 ? (
        <svg className="np-xray-threads" aria-hidden>
          {threads.map((t, i) => {
            const y1 = yByBlock.get(t.from) ?? 0;
            const y2 = yByBlock.get(t.to) ?? 0;
            const x = left;
            const bow = Math.min(34, 14 + Math.abs(y2 - y1) / 12);
            const midY = (y1 + y2) / 2;
            const hot = hover === t.from || hover === t.to;
            return (
              <path
                key={`${t.from}-${t.to}-${i}`}
                className="np-xray-thread"
                data-hot={hot ? "true" : "false"}
                d={`M ${x} ${y1 + 7} C ${x + bow} ${midY}, ${x + bow} ${midY}, ${x} ${y2 + 7}`}
              />
            );
          })}
        </svg>
      ) : null}

      <ul className="np-xray-nodes" aria-label="the draft's argument, top to bottom">
        {nodes.map((node) => (
          <li
            key={node.n}
            className="np-xray-node"
            style={{ top: node.y, left }}
            data-hot={hover === node.n ? "true" : "false"}
            aria-label={`block ${node.n + 1}: ${node.role}`}
            onMouseEnter={() => setHover(node.n)}
            onMouseLeave={() => setHover((h) => (h === node.n ? null : h))}
          >
            <span className="np-xray-dot" aria-hidden />
            <span className="np-xray-role">{node.role}</span>
          </li>
        ))}
      </ul>
    </div>,
    document.body,
  );
}
