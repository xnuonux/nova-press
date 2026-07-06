"use client";

/**
 * the typesetter ... the last rung of the craft ladder, made a button. a calm
 * disclosure panel on the work page: it names where the work stands on the
 * editorial ladder (the min over its pieces), and sets the whole book into a
 * print-grade pdf ... front + back matter, running heads, folios, the quiet
 * typography pass (curled quotes, soft hyphens, guarded widows).
 *
 * the render happens server-side (POST /api/export/pdf); this island just
 * asks, waits honestly, and hands the browser the finished file. lowercase
 * voice, lunari tokens, the golden accent.
 */

import { useId, useState } from "react";

import type { EditorialStage } from "@/types/editorial";

const ACCENT = "var(--nova-accent)";
const SUBTLE = "var(--lunari-fg-subtle)";
const MUTED = "var(--lunari-fg-muted)";

/** one export receipt (shaped by the server page ... a local mirror of the
 *  db layer's ExportReceipt, kept here so this client island never imports a
 *  server-only module). */
interface ReceiptLine {
  format: string;
  status: string;
  createdAt: string;
}

interface TypesetPanelProps {
  workId: string;
  /** the work's derived editorial stage (min over its pieces) ... null when
   *  the read degraded, and the ladder line simply doesn't render. */
  stage: EditorialStage | null;
  /** the download name the server will also suggest ("<slug>.pdf"). */
  fileName: string;
  /** the work's recent export receipts, newest first (np_exports). */
  initialExports: ReceiptLine[];
}

function receiptLabel(r: ReceiptLine): string {
  const at = new Date(r.createdAt);
  const day = Number.isNaN(at.getTime())
    ? ""
    : ` · ${at.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  return `${r.format}${r.status === "failed" ? " (failed)" : ""}${day}`;
}

export function TypesetPanel({ workId, stage, fileName, initialExports }: TypesetPanelProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const bodyId = useId();

  const typeset = async (): Promise<void> => {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/export/pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workId }),
      });
      if (!res.ok) {
        let message = "couldn't set those pages ... give it another go";
        try {
          const data = (await res.json()) as { error?: unknown };
          if (typeof data.error === "string" && data.error) message = data.error;
        } catch {
          // a non-json failure keeps the default note.
        }
        setNote(message);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      try {
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } finally {
        URL.revokeObjectURL(url);
      }
      setNote("your pages are ready ... check the downloads");
    } catch {
      setNote("couldn't reach the typesetter ... check the connection and try again");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="np-rise np-rise-3 mt-10 rounded-xl border px-4 py-3"
      style={{
        borderColor: "var(--lunari-border)",
        background: "color-mix(in srgb, var(--lunari-bg-surface) 60%, transparent)",
      }}
      data-testid="typeset-panel"
    >
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setNote(null);
        }}
        aria-expanded={open}
        aria-controls={open ? bodyId : undefined}
        className="flex w-full items-center justify-between font-mono text-[11px] uppercase tracking-[0.22em]"
        style={{ color: SUBTLE }}
      >
        <span>the typesetter</span>
        <span aria-hidden>{open ? "hide" : "show"}</span>
      </button>

      {open ? (
        <div id={bodyId} className="mt-3 flex flex-col gap-3">
          <p
            className="font-serif text-[13px] leading-relaxed"
            style={{ color: MUTED }}
            data-testid="typeset-stage-note"
          >
            {stage ? (
              <>
                the ladder stands at <span style={{ color: ACCENT }}>{stage}</span> ...{" "}
              </>
            ) : null}
            typeset whenever you want to hold the pages. front matter, running heads, folios, the
            quiet typography pass.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void typeset()}
              disabled={busy}
              data-testid="typeset-render"
              className="np-btn inline-flex h-9 items-center rounded-full px-4 font-mono text-[11px] uppercase tracking-[0.18em] disabled:opacity-60"
              style={{ background: ACCENT, color: "var(--lunari-bg-deep)" }}
            >
              {busy ? "setting the pages ..." : "typeset ... a print pdf"}
            </button>
            {busy ? (
              <span
                className="font-mono text-[10px] lowercase tracking-[0.12em]"
                style={{ color: SUBTLE }}
                aria-live="polite"
              >
                pagedjs is breaking the book into pages
              </span>
            ) : null}
          </div>

          {note ? (
            <p
              className="font-serif text-[12px] italic"
              style={{ color: SUBTLE }}
              role="status"
              data-testid="typeset-note"
            >
              {note}
            </p>
          ) : null}

          {/* what left the studio lately ... the np_exports receipts. */}
          {initialExports.length > 0 ? (
            <p
              className="font-mono text-[10px] lowercase tracking-[0.1em]"
              style={{ color: SUBTLE }}
              data-testid="typeset-recent"
            >
              lately: {initialExports.map(receiptLabel).join("  ·  ")}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
