"use client";

/**
 * the codex ... the world bible made editable. a calm disclosure panel on the work
 * page: every entry is a noun in the world (a character, a place, an object, a
 * faction, an event, a piece of lore) with the names it answers to + the truths
 * established about it. add, edit, or remove an entry; the writes are
 * server-authoritative and hand back the fresh codex, so the panel re-renders
 * without a reload. the same codex the author prompt reads (retrieval-by-mention)
 * and the continuity scan checks the prose against.
 *
 * lowercase voice, lunari tokens, the golden accent. it never shouts.
 */

import { useCallback, useEffect, useId, useState } from "react";

import {
  createEntityAction,
  deleteEntityAction,
  updateEntityAction,
  type EntityFormInput,
} from "@/app/(authed)/work/[id]/codex-actions";
import { ENTITY_KINDS, isEntityKind, type EntityKind } from "@/lib/codex/validate";
import type { CodexEntity } from "@/lib/db/codex";

const ACCENT = "var(--nova-accent)";
const SUBTLE = "var(--lunari-fg-subtle)";
const MUTED = "var(--lunari-fg-muted)";

interface CodexPanelProps {
  workId: string;
  initialEntities: CodexEntity[];
  // true when this work reads a parent series' codex ... an edit lands in the
  // shared bible, so say so.
  sharedFromSeries?: boolean;
}

function toLines(arr: readonly string[]): string {
  return arr.join("\n");
}

// the field contract is one-per-line (the labels say so, the card renders one row
// per item). split on NEWLINE ONLY ... a comma split would shred a fact / alias
// that legitimately contains a comma ("born in 1850, raised in paris") on a benign
// re-save, so toLines -> fromLines stays lossless.
function fromLines(s: string): string[] {
  return s
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
}

const FIELD_CLASS =
  "w-full rounded-md border bg-transparent px-2.5 py-1.5 font-serif text-[13px] leading-snug outline-none";
const FIELD_STYLE = { borderColor: "var(--lunari-border)", color: MUTED } as const;
const LABEL_CLASS = "font-mono text-[9px] uppercase tracking-[0.18em]";

function EntityForm({
  initial,
  busy,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  initial?: CodexEntity;
  busy: boolean;
  onSubmit: (input: EntityFormInput) => void;
  onCancel?: () => void;
  submitLabel: string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState<EntityKind>(initial?.kind ?? "character");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [aliases, setAliases] = useState(toLines(initial?.aliases ?? []));
  const [facts, setFacts] = useState(toLines(initial?.facts ?? []));

  const submit = () => {
    if (busy) return;
    onSubmit({
      name,
      kind,
      summary,
      aliases: fromLines(aliases),
      facts: fromLines(facts),
    });
  };

  return (
    <div className="flex flex-col gap-2 pt-1" data-testid="entity-form">
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="name"
          aria-label="name"
          data-testid="entity-name"
          className={`${FIELD_CLASS} flex-1`}
          style={FIELD_STYLE}
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as EntityKind)}
          aria-label="kind"
          data-testid="entity-kind"
          className="rounded-md border bg-transparent px-2 py-1.5 font-mono text-[11px] lowercase outline-none"
          style={FIELD_STYLE}
        >
          {ENTITY_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>
      <input
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder="a one-line summary (who or what this is)"
        aria-label="summary"
        data-testid="entity-summary"
        className={FIELD_CLASS}
        style={FIELD_STYLE}
      />
      <label className="flex flex-col gap-1">
        <span className={LABEL_CLASS} style={{ color: SUBTLE }}>
          also known as ... one per line
        </span>
        <textarea
          value={aliases}
          onChange={(e) => setAliases(e.target.value)}
          rows={2}
          aria-label="aliases"
          data-testid="entity-aliases"
          className={`${FIELD_CLASS} resize-y`}
          style={FIELD_STYLE}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className={LABEL_CLASS} style={{ color: SUBTLE }}>
          what's true of it ... one per line
        </span>
        <textarea
          value={facts}
          onChange={(e) => setFacts(e.target.value)}
          rows={3}
          aria-label="facts"
          data-testid="entity-facts"
          className={`${FIELD_CLASS} resize-y`}
          style={FIELD_STYLE}
        />
      </label>
      <div className="flex items-center gap-3 pt-0.5">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          data-testid="entity-save"
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

function EntityCard({
  entity,
  busy,
  onEdit,
  onRemove,
}: {
  entity: CodexEntity;
  busy: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const aliases = entity.aliases.filter((a) => a.toLowerCase() !== entity.name.toLowerCase());
  return (
    <div
      data-testid="codex-entity"
      className="flex items-start justify-between gap-3 rounded-md px-2.5 py-2"
      style={{ background: "color-mix(in srgb, var(--lunari-fg-subtle) 8%, transparent)" }}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="font-serif text-[14px] leading-snug" style={{ color: MUTED }}>
          <span style={{ color: "var(--lunari-fg-primary)" }}>{entity.name}</span>{" "}
          <span
            className="font-mono text-[10px] uppercase tracking-[0.12em]"
            style={{ color: ACCENT }}
          >
            {entity.kind}
          </span>
          {entity.summary ? <span style={{ color: SUBTLE }}> ... {entity.summary}</span> : null}
        </span>
        {aliases.length > 0 ? (
          <span className="font-serif text-[12px] italic" style={{ color: SUBTLE }}>
            also: {aliases.join(", ")}
          </span>
        ) : null}
        {entity.facts.length > 0 ? (
          <ul className="mt-0.5 flex flex-col gap-0.5">
            {entity.facts.map((f, i) => (
              <li key={i} className="font-serif text-[12px] leading-snug" style={{ color: SUBTLE }}>
                - {f}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <span className="flex shrink-0 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em]">
        <button
          type="button"
          onClick={onEdit}
          disabled={busy}
          data-testid="entity-edit"
          style={{ color: SUBTLE }}
        >
          edit
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          data-testid="entity-remove"
          style={{ color: SUBTLE }}
        >
          remove
        </button>
      </span>
    </div>
  );
}

export function CodexPanel({ workId, initialEntities, sharedFromSeries }: CodexPanelProps) {
  const [entities, setEntities] = useState<CodexEntity[]>(initialEntities);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<{
    name: string;
    kind: EntityKind;
    summary: string;
  } | null>(null);
  // bumped on every prefill event so the add form re-mounts + re-initializes even
  // when a second proposal arrives for the SAME name (an enriched kind / summary).
  const [prefillNonce, setPrefillNonce] = useState(0);
  const listId = useId();

  // the continuity rail's "add to codex" hands a recurring name up via this event
  // (closing the detect -> codex loop): open the panel + the add form, pre-filled
  // with the proposed name (and a model-proposed kind / summary when present). a
  // document event is the cross-island bridge, like nova:piece-edited.
  useEffect(() => {
    const onPrefill = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { name?: unknown; kind?: unknown; summary?: unknown }
        | undefined;
      const name = typeof detail?.name === "string" ? detail.name.trim() : "";
      if (!name) return;
      setPrefill({
        name,
        kind: isEntityKind(detail?.kind) ? detail.kind : "character",
        summary: typeof detail?.summary === "string" ? detail.summary : "",
      });
      setPrefillNonce((n) => n + 1);
      setOpen(true);
      setAdding(true);
      setEditingId(null);
      setNote(null);
    };
    document.addEventListener("nova:codex-prefill", onPrefill);
    return () => document.removeEventListener("nova:codex-prefill", onPrefill);
  }, []);

  const create = useCallback(
    async (input: EntityFormInput) => {
      setBusy(true);
      setNote(null);
      const res = await createEntityAction(workId, input);
      setBusy(false);
      if (res.ok) {
        setEntities(res.entities);
        setAdding(false);
        setPrefill(null);
      } else {
        setNote(res.error ?? "couldn't save that.");
      }
    },
    [workId],
  );

  const update = useCallback(
    async (entityId: string, input: EntityFormInput) => {
      setBusy(true);
      setNote(null);
      const res = await updateEntityAction(workId, entityId, input);
      setBusy(false);
      if (res.ok) {
        setEntities(res.entities);
        setEditingId(null);
      } else {
        setNote(res.error ?? "couldn't save that.");
      }
    },
    [workId],
  );

  const remove = useCallback(
    async (entityId: string) => {
      setBusy(true);
      setNote(null);
      const res = await deleteEntityAction(workId, entityId);
      setBusy(false);
      if (res.ok) setEntities(res.entities);
      else setNote(res.error ?? "couldn't remove that.");
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
      data-testid="codex-panel"
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
          the codex
          {entities.length > 0
            ? ` ... ${entities.length} entr${entities.length === 1 ? "y" : "ies"}`
            : ""}
        </span>
        <span aria-hidden>{open ? "hide" : "show"}</span>
      </button>

      {open ? (
        <div id={listId} className="mt-3 flex flex-col gap-2">
          {sharedFromSeries ? (
            <p className="font-serif text-[12px] italic" style={{ color: SUBTLE }}>
              this codex is shared across the series ... an edit lands in the shared bible.
            </p>
          ) : null}

          {entities.length === 0 && !adding ? (
            <p className="font-serif text-[13px] italic" style={{ color: SUBTLE }}>
              nothing recorded yet ... add the first name, place, or truth of this world.
            </p>
          ) : null}

          <div className="flex flex-col gap-1.5">
            {entities.map((entity) =>
              editingId === entity.id ? (
                <div
                  key={entity.id}
                  className="rounded-md border px-2.5 py-2"
                  style={{ borderColor: "var(--lunari-border)" }}
                >
                  <EntityForm
                    initial={entity}
                    busy={busy}
                    submitLabel="save"
                    onSubmit={(input) => void update(entity.id, input)}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              ) : (
                <EntityCard
                  key={entity.id}
                  entity={entity}
                  busy={busy}
                  onEdit={() => {
                    setEditingId(entity.id);
                    setAdding(false);
                    setNote(null);
                  }}
                  onRemove={() => void remove(entity.id)}
                />
              ),
            )}
          </div>

          {adding ? (
            <div
              className="rounded-md border px-2.5 py-2"
              style={{ borderColor: "var(--lunari-border)" }}
            >
              <EntityForm
                // re-mount on every prefill (keyed on the nonce, not the name) so
                // the form re-initializes from the proposed draft ... even a second
                // proposal for the same name lands its enriched kind / summary.
                key={prefill ? `prefill-${prefillNonce}` : "new"}
                initial={
                  prefill
                    ? {
                        id: "",
                        name: prefill.name,
                        kind: prefill.kind,
                        summary: prefill.summary || null,
                        aliases: [],
                        facts: [],
                      }
                    : undefined
                }
                busy={busy}
                submitLabel="add to codex"
                onSubmit={(input) => void create(input)}
                onCancel={() => {
                  setAdding(false);
                  setPrefill(null);
                }}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setAdding(true);
                setEditingId(null);
                setNote(null);
                setPrefill(null);
              }}
              data-testid="codex-add"
              className="self-start font-mono text-[10px] uppercase tracking-[0.16em]"
              style={{ color: ACCENT }}
            >
              + add an entry
            </button>
          )}

          {note ? (
            <p
              className="font-serif text-[12px] italic"
              style={{ color: SUBTLE }}
              data-testid="codex-note"
            >
              {note}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
