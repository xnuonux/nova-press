"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  compareDrafts, createCheckpoints, findPassages, indexDraft, outline,
  type Checkpoint, type Draft, type TextRange,
} from "@/lib/editor/manuscript-desk";
import { exportDraft, readingProof, type DraftFile } from "@/lib/editor/draft-export";
import "./manuscript-desk.css";

export interface ManuscriptDeskViewProps {
  pieceId: string;
  readDraft: () => Draft;
  navigate: (expected: Draft, range: TextRange) => boolean;
}

/** all callbacks are deliberate reads, selection changes or local downloads. */
export function ManuscriptDeskView({ pieceId, readDraft, navigate }: ManuscriptDeskViewProps) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<Draft | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [label, setLabel] = useState("");
  const [checkpoints, setCheckpoints] = useState<readonly Checkpoint[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [proof, setProof] = useState<Draft | null>(null);
  const shelf = useRef<ReturnType<typeof createCheckpoints> | null>(null);
  if (shelf.current === null) shelf.current = createCheckpoints(pieceId);
  const readRef = useRef(readDraft);
  readRef.current = readDraft;
  const urls = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const refresh = useCallback(() => {
    try {
      const draft = readRef.current();
      setCurrent((previous) => previous?.source === draft.source ? previous : draft);
      setReadError(null);
      return draft;
    } catch (error) {
      setReadError(error instanceof Error ? error.message : "the desk could not read this draft");
      return null;
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const edited = () => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(refresh, 220);
    };
    document.addEventListener("nova:piece-edited", edited);
    return () => {
      if (timer !== null) clearTimeout(timer);
      document.removeEventListener("nova:piece-edited", edited);
    };
  }, [open, refresh]);

  useEffect(() => {
    if (checkpoints.length === 0) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [checkpoints.length]);

  useEffect(() => {
    const activeUrls = urls.current;
    return () => {
      for (const [url, timer] of activeUrls) { clearTimeout(timer); URL.revokeObjectURL(url); }
      activeUrls.clear();
    };
  }, []);

  const headings = useMemo(() => current ? outline(current) : [], [current]);
  const blocks = useMemo(() => current ? indexDraft(current) : [], [current]);
  const results = useMemo(() => current ? findPassages(current, query, caseSensitive) : { matches: [], more: false }, [current, query, caseSensitive]);
  const selected = checkpoints.find((entry) => entry.id === selectedId) ?? null;
  const comparison = useMemo(() => selected && current ? compareDrafts(selected.draft, current) : null, [selected, current]);
  const proofHtml = useMemo(() => proof ? readingProof(proof) : "", [proof]);

  const jump = (range: TextRange) => {
    if (!current || readError) return;
    try {
      if (!navigate(current, range)) {
        refresh();
        setNotice("the page changed ... choose a result from the refreshed map");
      } else { setNotice("passage selected in the page"); }
    } catch {
      setNotice("that passage could not be selected ... your words were not replaced");
    }
  };

  const keep = () => {
    const draft = refresh();
    if (!draft) return;
    try {
      const entry = shelf.current!.keep(draft, label, new Date().toISOString());
      setCheckpoints(shelf.current!.list());
      setSelectedId(entry.id);
      setLabel("");
      setNotice(`kept “${entry.label}” in this session ... export it before leaving`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "the checkpoint was not kept"); }
  };

  const download = (draft: Draft, format: "json" | "txt" | "html") => {
    let url: string | null = null;
    try {
      const file: DraftFile = exportDraft(draft, format, new Date().toISOString());
      url = URL.createObjectURL(new Blob([file.content], { type: file.mime }));
      const link = document.createElement("a");
      link.href = url;
      link.download = file.filename;
      link.hidden = true;
      document.body.appendChild(link);
      try { link.click(); } finally { link.remove(); }
      const requestedUrl = url;
      const timer = setTimeout(() => {
        URL.revokeObjectURL(requestedUrl);
        urls.current.delete(requestedUrl);
      }, 60_000);
      urls.current.set(url, timer);
      setNotice(`download requested: ${file.filename} ... check your saved file`);
    } catch {
      if (url) URL.revokeObjectURL(url);
      setNotice("the download was not requested ... the page and checkpoints remain here");
    }
  };

  const exportCurrent = (format: "json" | "txt") => {
    const draft = refresh();
    if (draft) download(draft, format);
  };

  return (
    <details className="np-desk" data-testid="manuscript-desk" onToggle={(event) => {
      const isOpen = event.currentTarget.open;
      setOpen(isOpen);
      if (isOpen) refresh();
    }}>
      <summary><span>the page</span><strong>manuscript desk</strong><span aria-hidden>+</span></summary>
      <div className="np-desk__inside">
        <p className="np-desk__lede">find your place. keep a turning point. read the words away from the tools.</p>
        <p className="np-desk__note">private to this page session. no model calls, cloud backup or publication. checkpoints disappear on refresh or navigation ... export what matters.</p>
        {readError ? <p role="alert" className="np-desk__notice">{readError}. the last readable map remains below; navigation is paused.</p> : null}
        <p className="np-desk__notice" role="status" aria-live="polite" aria-atomic="true">{notice}</p>
        <div className="np-desk__grid">
          <section aria-label="manuscript navigation">
            <h2>the shape of this page</h2>
            <p className="np-desk__note">{blocks.length} blocks · {headings.length} headings. navigation never changes the text.</p>
            {blocks.some((block) => !block.readable) ? <p className="np-desk__note">some blocks are not text-readable ... they remain in the json export and are excluded from passage search.</p> : null}
            <ol className="np-desk__map" aria-label="heading outline">
              {headings.slice(0, 100).map((heading) => <li key={heading.blockIndex} style={{ paddingInlineStart: `${Math.min(heading.level - 1, 3) * 12}px` }}>
                <button type="button" disabled={!heading.point || !!readError} onClick={() => heading.point && jump({ anchor: heading.point, focus: heading.point })}>
                  <small>h{heading.level}</small> {heading.title || "untitled heading"}
                </button>
              </li>)}
            </ol>
            {headings.length === 0 ? <p className="np-desk__note">headings will appear here as you shape the page.</p> : null}
            {headings.length > 100 ? <p className="np-desk__note">showing the first 100 of {headings.length} headings. passage search still reads the full supported draft.</p> : null}
            <label className="np-desk__field">find a passage
              <input type="search" value={query} maxLength={256} onChange={(event) => setQuery(event.target.value)} placeholder="a name, an image, a line..." />
            </label>
            <label className="np-desk__check"><input type="checkbox" checked={caseSensitive} onChange={(event) => setCaseSensitive(event.target.checked)} /> match case</label>
            <p className="np-desk__note">literal matches within a block, including across inline formatting.</p>
            {query ? <>
              <p className="np-desk__note">{results.more ? "first 200 matches ... more exist" : `${results.matches.length} matches`}</p>
              <ol className="np-desk__map" aria-label="passage results">
                {results.matches.map((match) => <li key={`${match.blockIndex}:${match.start}`}><button type="button" disabled={!!readError} onClick={() => jump(match.range)}>
                  <small>block {match.blockIndex + 1}</small> {match.excerpt}
                </button></li>)}
              </ol>
            </> : null}
          </section>
          <section aria-label="session checkpoints">
            <h2>keep a turning point</h2>
            <p className="np-desk__note">{checkpoints.length} / 12 checkpoints · memory only. keeping one does not mean the server saved it.</p>
            <label className="np-desk__field">checkpoint name
              <input value={label} maxLength={80} onChange={(event) => setLabel(event.target.value)} placeholder="before the new ending" />
            </label>
            <button type="button" disabled={!label.trim()} onClick={keep}>keep checkpoint</button>
            <ol className="np-desk__map" aria-label="kept checkpoints">
              {checkpoints.map((entry) => <li key={entry.id}><button type="button" aria-pressed={entry.id === selectedId} onClick={() => { setSelectedId(entry.id); refresh(); }}>
                {entry.label}<small>{new Date(entry.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>
              </button></li>)}
            </ol>
            {selected ? <div className="np-desk__actions">
              <button type="button" onClick={() => download(selected.draft, "json")}>export this checkpoint</button>
              <button type="button" onClick={() => {
                if (!window.confirm(`remove “${selected.label}” from this session? the page will not change.`)) return;
                shelf.current!.remove(selected.id);
                setCheckpoints(shelf.current!.list());
                setSelectedId(null);
                setNotice("checkpoint removed from this session ... the page is unchanged");
              }}>remove checkpoint</button>
            </div> : null}
          </section>
        </div>
        {selected && current && comparison ? <section className="np-desk__comparison" aria-label="checkpoint comparison">
          <h2>then ... and now</h2>
          <p className="np-desk__note">{comparison.identical ? "the source is unchanged." : "one changed block window, not a minimal diff. nothing is applied to the page."}</p>
          {comparison.titleChanged ? <p className="np-desk__note">title: “{selected.draft.title}” → “{current.title}”</p> : null}
          {comparison.formattingOnly ? <p className="np-desk__note">the readable text is unchanged; formatting or non-text data changed. json exports retain those details.</p> : null}
          {comparison.bodyChanged ? <div className="np-desk__grid">
            <div><h3>{selected.label}</h3><pre>{comparison.beforeText.slice(0, 12_000) || "no readable text in this window"}</pre>{comparison.beforeText.length > 12_000 ? <p className="np-desk__note">preview limited to 12,000 characters. export the checkpoint for the full source.</p> : null}</div>
            <div><h3>current page</h3><pre>{comparison.afterText.slice(0, 12_000) || "no readable text in this window"}</pre>{comparison.afterText.length > 12_000 ? <p className="np-desk__note">preview limited to 12,000 characters. export the current draft for the full source.</p> : null}</div>
          </div> : null}
        </section> : null}
        <section className="np-desk__way-out" aria-label="private draft exports">
          <h2>take the words with you</h2>
          <p className="np-desk__note">json keeps the rich source, including unsaved edits. text and reading proofs are text-first; marks, links, media and complex layouts are not reproduced. there is no restore or import button in this desk.</p>
          <div className="np-desk__actions">
            <button type="button" onClick={() => exportCurrent("json")}>export draft json</button>
            <button type="button" onClick={() => exportCurrent("txt")}>export draft text</button>
            <button type="button" onClick={() => { const draft = refresh(); if (draft) setProof(draft); }}>{proof ? "refresh reading proof" : "read a private proof"}</button>
          </div>
          {proof ? <>
            <p className="np-desk__note">{current?.source === proof.source ? "this proof is pinned to the draft you chose." : "the page has changed since this proof ... refresh it to review the new draft."}</p>
            <iframe className="np-desk__proof" title="private text-first reading proof" sandbox="" referrerPolicy="no-referrer" srcDoc={proofHtml} />
            <div className="np-desk__actions"><button type="button" onClick={() => download(proof, "html")}>export this reading proof</button><button type="button" onClick={() => setProof(null)}>close proof</button></div>
          </> : null}
        </section>
      </div>
    </details>
  );
}
