"use client";

/**
 * the encyclopaedia ... articles made workable + readable. a calm disclosure panel
 * on the work page (encyclopaedia forms only): an A-Z index over the articles, each
 * an infobox (title / classification / also-known-as / summary / attributes) you
 * edit here + a prose body you edit in the normal editor.
 *
 * the summary is READ with the reference seams live: a [[xref]] resolves to a link
 * to the article it names (or reads as a broken link if there's no such article),
 * and a ((citation)) renders as a numbered superscript with a footnote below. the
 * xref resolution + the citation numbering are the pure encyclopaedia spine.
 * lowercase voice, lunari tokens, the golden accent.
 */

import { useCallback, useId, useMemo, useState } from "react";

import {
  addArticleAction,
  deleteArticleAction,
  updateArticleInfoboxAction,
  type InfoboxFormInput,
} from "@/app/(authed)/work/[id]/encyclopaedia-actions";
import type { ArticleEntry } from "@/lib/db/articles";
import { buildAToZ } from "@/lib/encyclopaedia/index-az";
import { segmentArticle } from "@/lib/encyclopaedia/render";
import { resolveXref, type XrefTarget } from "@/lib/encyclopaedia/xref";

const ACCENT = "var(--nova-accent)";
const SUBTLE = "var(--lunari-fg-subtle)";
const MUTED = "var(--lunari-fg-muted)";

interface EncyclopaediaPanelProps {
  workId: string;
  initialArticles: ArticleEntry[];
}

const FIELD_CLASS =
  "w-full rounded-md border bg-transparent px-2.5 py-1.5 font-serif text-[13px] leading-snug outline-none";
const FIELD_STYLE = { borderColor: "var(--lunari-border)", color: MUTED } as const;
const LABEL_CLASS = "font-mono text-[9px] uppercase tracking-[0.18em]";

function toLines(arr: readonly string[]): string {
  return arr.join("\n");
}
function fromLines(s: string): string[] {
  return s
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
}

// render an article's text with the reference seams live: [[xref]] -> a link to the
// named article (resolved against the work's targets), ((cite)) -> a superscript +
// a footnote. the numbering is global across the text (the pure segmentArticle).
function ArticleText({ text, targets }: { text: string; targets: XrefTarget[] }) {
  const { segments, footnotes } = useMemo(() => segmentArticle(text), [text]);
  if (!text.trim()) return null;
  return (
    <div className="flex flex-col gap-1">
      <p className="font-serif text-[13px] leading-relaxed" style={{ color: MUTED }}>
        {segments.map((seg, i) => {
          if (seg.kind === "text") return <span key={i}>{seg.value}</span>;
          if (seg.kind === "cite") {
            return (
              <sup
                key={i}
                data-testid="article-cite"
                className="px-0.5 font-mono text-[10px]"
                style={{ color: ACCENT }}
                title={seg.text}
              >
                [{seg.number}]
              </sup>
            );
          }
          const targetId = resolveXref(seg.target, targets);
          return targetId ? (
            <a
              key={i}
              href={`#article-${targetId}`}
              data-testid="article-xref"
              data-target={targetId}
              className="underline decoration-dotted underline-offset-2"
              style={{ color: ACCENT }}
            >
              {seg.label}
            </a>
          ) : (
            <span
              key={i}
              data-testid="article-xref-broken"
              className="line-through"
              style={{ color: SUBTLE }}
              title="no article by that name yet"
            >
              {seg.label}
            </span>
          );
        })}
      </p>
      {footnotes.length > 0 ? (
        <ol className="flex flex-col gap-0.5">
          {footnotes.map((f) => (
            <li
              key={f.number}
              data-testid="article-footnote"
              className="font-serif text-[11px]"
              style={{ color: SUBTLE }}
            >
              [{f.number}] {f.text}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function InfoboxForm({
  initial,
  busy,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  initial?: ArticleEntry;
  busy: boolean;
  onSubmit: (input: InfoboxFormInput) => void;
  onCancel?: () => void;
  submitLabel: string;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [classification, setClassification] = useState(initial?.classification ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [aka, setAka] = useState(toLines(initial?.aka ?? []));
  const [attributes, setAttributes] = useState(toLines(initial?.attributes ?? []));

  const submit = () => {
    if (busy) return;
    onSubmit({
      title,
      classification,
      summary,
      aka: fromLines(aka),
      attributes: fromLines(attributes),
    });
  };

  return (
    <div className="flex flex-col gap-2 pt-1" data-testid="infobox-form">
      <div className="flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="title"
          aria-label="title"
          data-testid="art-title"
          className={`${FIELD_CLASS} flex-1`}
          style={FIELD_STYLE}
        />
        <input
          value={classification}
          onChange={(e) => setClassification(e.target.value)}
          placeholder="classification"
          aria-label="classification"
          data-testid="art-classification"
          className={`${FIELD_CLASS} flex-1`}
          style={FIELD_STYLE}
        />
      </div>
      <label className="flex flex-col gap-1">
        <span className={LABEL_CLASS} style={{ color: SUBTLE }}>
          summary ... write [[a link]] or a ((citation)) inline
        </span>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={3}
          aria-label="summary"
          data-testid="art-summary"
          className={`${FIELD_CLASS} resize-y`}
          style={FIELD_STYLE}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className={LABEL_CLASS} style={{ color: SUBTLE }}>
          also known as ... one per line
        </span>
        <textarea
          value={aka}
          onChange={(e) => setAka(e.target.value)}
          rows={2}
          aria-label="also known as"
          data-testid="art-aka"
          className={`${FIELD_CLASS} resize-y`}
          style={FIELD_STYLE}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className={LABEL_CLASS} style={{ color: SUBTLE }}>
          attributes ... one per line
        </span>
        <textarea
          value={attributes}
          onChange={(e) => setAttributes(e.target.value)}
          rows={2}
          aria-label="attributes"
          data-testid="art-attributes"
          className={`${FIELD_CLASS} resize-y`}
          style={FIELD_STYLE}
        />
      </label>
      <div className="flex items-center gap-3 pt-0.5">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          data-testid="art-save"
          className="np-btn inline-flex h-7 items-center rounded-full px-3 font-mono text-[10px] uppercase tracking-[0.16em] disabled:opacity-50"
          style={{ background: ACCENT, color: "var(--lunari-bg-deep)" }}
        >
          {busy ? "saving ..." : submitLabel}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="font-mono text-[10px] uppercase tracking-[0.16em]"
            style={{ color: SUBTLE }}
          >
            cancel
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function EncyclopaediaPanel({ workId, initialArticles }: EncyclopaediaPanelProps) {
  const [articles, setArticles] = useState<ArticleEntry[]>(initialArticles);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const listId = useId();

  const targets = useMemo<XrefTarget[]>(
    () => articles.map((a) => ({ id: a.nodeId, title: a.title })),
    [articles],
  );
  const index = useMemo(() => buildAToZ(targets), [targets]);

  const add = useCallback(
    async (input: InfoboxFormInput) => {
      setBusy(true);
      setNote(null);
      const res = await addArticleAction(workId, input);
      setBusy(false);
      if (res.ok) {
        setArticles(res.articles);
        setAdding(false);
      } else {
        setNote(res.error ?? "couldn't save that article.");
      }
    },
    [workId],
  );

  const update = useCallback(
    async (nodeId: string, input: InfoboxFormInput) => {
      setBusy(true);
      setNote(null);
      const res = await updateArticleInfoboxAction(workId, nodeId, input);
      setBusy(false);
      if (res.ok) {
        setArticles(res.articles);
        setEditingId(null);
      } else {
        setNote(res.error ?? "couldn't save that article.");
      }
    },
    [workId],
  );

  const remove = useCallback(
    async (nodeId: string) => {
      setBusy(true);
      setNote(null);
      const res = await deleteArticleAction(workId, nodeId);
      setBusy(false);
      if (res.ok) setArticles(res.articles);
      else setNote(res.error ?? "couldn't remove that article.");
    },
    [workId],
  );

  return (
    <section
      className="np-rise np-rise-3 mt-10 rounded-xl border px-4 py-3"
      style={{
        borderColor: "var(--lunari-border)",
        background: "color-mix(in srgb, var(--lunari-bg-surface) 60%, transparent)",
      }}
      data-testid="encyclopaedia-panel"
    >
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setNote(null);
        }}
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        className="flex w-full items-center justify-between font-mono text-[11px] uppercase tracking-[0.22em]"
        style={{ color: SUBTLE }}
      >
        <span>
          the encyclopaedia
          {articles.length > 0
            ? ` ... ${articles.length} article${articles.length === 1 ? "" : "s"}`
            : ""}
        </span>
        <span aria-hidden>{open ? "hide" : "show"}</span>
      </button>

      {open ? (
        <div id={listId} className="mt-3 flex flex-col gap-3">
          {/* the A-Z index ... each entry jumps to its article below. */}
          {index.length > 0 ? (
            <nav
              data-testid="az-index"
              className="flex flex-wrap gap-x-4 gap-y-1 rounded-md border px-2.5 py-2"
              style={{ borderColor: "var(--lunari-border)" }}
            >
              {index.map((group) => (
                <span key={group.letter} className="flex items-baseline gap-2">
                  <span
                    className="font-mono text-[10px] uppercase tracking-[0.16em]"
                    style={{ color: ACCENT }}
                  >
                    {group.letter}
                  </span>
                  {group.entries.map((e) => (
                    <a
                      key={e.id}
                      href={`#article-${e.id}`}
                      data-testid="az-entry"
                      className="font-serif text-[12px]"
                      style={{ color: SUBTLE }}
                    >
                      {e.title}
                    </a>
                  ))}
                </span>
              ))}
            </nav>
          ) : null}

          {articles.length === 0 && !adding ? (
            <p className="font-serif text-[13px] italic" style={{ color: SUBTLE }}>
              no articles yet ... write the first entry below.
            </p>
          ) : null}

          <div className="flex flex-col gap-1.5">
            {articles.map((article) =>
              editingId === article.nodeId ? (
                <div
                  key={article.nodeId}
                  id={`article-${article.nodeId}`}
                  className="rounded-md border px-2.5 py-2"
                  style={{ borderColor: "var(--lunari-border)" }}
                >
                  <InfoboxForm
                    initial={article}
                    busy={busy}
                    submitLabel="save"
                    onSubmit={(input) => void update(article.nodeId, input)}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              ) : (
                <div
                  key={article.nodeId}
                  id={`article-${article.nodeId}`}
                  data-testid="article-card"
                  className="scroll-mt-20 rounded-md px-2.5 py-2"
                  style={{
                    background: "color-mix(in srgb, var(--lunari-fg-subtle) 8%, transparent)",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-serif text-[14px] leading-snug">
                      <span style={{ color: "var(--lunari-fg-primary)" }}>{article.title}</span>
                      {article.classification ? (
                        <span
                          className="ml-2 font-mono text-[10px] uppercase tracking-[0.12em]"
                          style={{ color: ACCENT }}
                        >
                          {article.classification}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex shrink-0 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em]">
                      {article.pieceId ? (
                        <a
                          href={`/editor/${article.pieceId}`}
                          aria-label={`open the prose for ${article.title}`}
                          style={{ color: SUBTLE }}
                        >
                          prose
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(article.nodeId);
                          setAdding(false);
                          setNote(null);
                        }}
                        disabled={busy}
                        aria-label={`edit ${article.title}`}
                        style={{ color: SUBTLE }}
                      >
                        edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(article.nodeId)}
                        disabled={busy}
                        aria-label={`remove ${article.title}`}
                        style={{ color: SUBTLE }}
                      >
                        remove
                      </button>
                    </span>
                  </div>
                  {article.aka.length > 0 ? (
                    <p className="font-serif text-[12px] italic" style={{ color: SUBTLE }}>
                      also: {article.aka.join(", ")}
                    </p>
                  ) : null}
                  <div className="mt-1">
                    <ArticleText text={article.summary} targets={targets} />
                  </div>
                  {article.attributes.length > 0 ? (
                    <ul className="mt-1 flex flex-col gap-0.5">
                      {article.attributes.map((attr, i) => (
                        <li
                          key={i}
                          className="font-serif text-[12px] leading-snug"
                          style={{ color: SUBTLE }}
                        >
                          - {attr}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ),
            )}
          </div>

          {adding ? (
            <div
              className="rounded-md border px-2.5 py-2"
              style={{ borderColor: "var(--lunari-border)" }}
            >
              <InfoboxForm
                busy={busy}
                submitLabel="add the article"
                onSubmit={(input) => void add(input)}
                onCancel={() => setAdding(false)}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setAdding(true);
                setEditingId(null);
                setNote(null);
              }}
              data-testid="add-article"
              className="self-start font-mono text-[10px] uppercase tracking-[0.16em]"
              style={{ color: ACCENT }}
            >
              + write an article
            </button>
          )}

          {note ? (
            <p
              className="font-serif text-[12px] italic"
              style={{ color: SUBTLE }}
              data-testid="encyclopaedia-note"
            >
              {note}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
