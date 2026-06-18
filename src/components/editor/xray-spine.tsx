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
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { Value } from "platejs";
import { useEditorRef } from "platejs/react";

import type { XrayRole, XrayStructure } from "@/lib/ai/xray";

import { plateText } from "./plate-text";

const GUTTER = 72; // px the spine sits left of the text column
const MIN_LEFT = 10;

interface NodePos {
  n: number;
  role: XrayRole;
  y: number; // viewport top of the block
}

export function XraySpine() {
  const editor = useEditorRef();
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [structure, setStructure] = useState<XrayStructure | null>(null);
  const [nodes, setNodes] = useState<NodePos[]>([]);
  const [left, setLeft] = useState(MIN_LEFT);
  const [hover, setHover] = useState<number | null>(null);

  const activeRef = useRef(false);
  activeRef.current = active;
  const structRef = useRef<XrayStructure | null>(null);
  structRef.current = structure;
  const genRef = useRef(0);
  const rafRef = useRef<number | null>(null);

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

  const close = useCallback(() => {
    genRef.current += 1;
    setActive(false);
    setLoading(false);
    setStructure(null);
    setNodes([]);
    setHover(null);
    document.body.classList.remove("np-xray-on");
  }, []);

  const run = useCallback(async () => {
    setActive(true);
    setLoading(true);
    setStructure(null);
    setNodes([]);
    setHover(null);
    document.body.classList.add("np-xray-on");
    const gen = ++genRef.current;

    const blocks = (editor.children as Value).map((b) => plateText([b] as Value));
    let data: { ok?: boolean; structure?: XrayStructure } = {};
    try {
      const res = await fetch("/api/ai/xray", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ blocks }),
      });
      data = (await res.json()) as { ok?: boolean; structure?: XrayStructure };
    } catch {
      // offline / aborted / bad json ... fall through to the empty state
    }
    if (gen !== genRef.current) return;
    setLoading(false);
    setStructure(data?.ok && data.structure ? data.structure : { roles: [], threads: [] });
  }, [editor]);

  // the header toggle dispatches nova:xray-toggle; flip on (and analyze) or off.
  useEffect(() => {
    const onToggle = () => {
      if (activeRef.current) close();
      else void run();
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

  // esc closes the spine.
  useEffect(() => {
    if (!active) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, close]);

  // tag the hovered block so css can lift it ... slate doesn't re-render while
  // the spine is up (it's a read mode), so the attribute survives. cleared on
  // close + on hover change.
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
    return () => document.body.classList.remove("np-xray-on");
  }, []);

  if (!active) return null;

  const yByBlock = new Map(nodes.map((node) => [node.n, node.y]));
  const threads = (structure?.threads ?? []).filter(
    (t) => yByBlock.has(t.from) && yByBlock.has(t.to),
  );
  const empty = !loading && structure != null && nodes.length === 0;

  return createPortal(
    <div className="np-xray" role="presentation">
      <div className="np-xray-rail" style={{ left }}>
        <span className="np-xray-rail-label">structure</span>
      </div>

      {loading ? (
        <div className="np-xray-status" style={{ left }}>
          reading the shape ...
        </div>
      ) : null}

      {empty ? (
        <div className="np-xray-status" style={{ left }}>
          no clear structure yet ... keep writing
        </div>
      ) : null}

      {threads.length > 0 ? (
        <svg className="np-xray-threads" aria-hidden>
          {threads.map((t, i) => {
            const y1 = yByBlock.get(t.from) ?? 0;
            const y2 = yByBlock.get(t.to) ?? 0;
            const x = left + 4;
            const bow = Math.min(34, 14 + Math.abs(y2 - y1) / 12);
            const midY = (y1 + y2) / 2;
            const hot = hover === t.from || hover === t.to;
            return (
              <path
                key={`${t.from}-${t.to}-${i}`}
                className="np-xray-thread"
                data-hot={hot ? "true" : "false"}
                d={`M ${x} ${y1 + 7} C ${x - bow} ${midY}, ${x - bow} ${midY}, ${x} ${y2 + 7}`}
              />
            );
          })}
        </svg>
      ) : null}

      {nodes.map((node) => (
        <div
          key={node.n}
          className="np-xray-node"
          style={{ top: node.y, left }}
          data-hot={hover === node.n ? "true" : "false"}
          onMouseEnter={() => setHover(node.n)}
          onMouseLeave={() => setHover((h) => (h === node.n ? null : h))}
        >
          <span className="np-xray-dot" aria-hidden />
          <span className="np-xray-role">{node.role}</span>
        </div>
      ))}
    </div>,
    document.body,
  );
}
