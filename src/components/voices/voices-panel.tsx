"use client";

/**
 * multi-voice ... a work's CAST of voices, made workable. a calm disclosure panel
 * on the work page: the writer's own voice is the narrator, and each named voice
 * here (e.g. "the detective") is a delta OVERLAY on it. you pick who's speaking
 * ("speaking as ..."), and nova's beats + ripostes in this work generate in that
 * voice, drift-gated so the overlay never fully erases your own hand.
 *
 * you can describe a voice in plain language and let nova draft the overlay (the
 * xray-shaped propose), then tune it. the drift meter shows how far a voice pushes
 * from a neutral baseline ... past the mark, generation pulls it back. lowercase
 * voice, lunari tokens, the golden accent.
 */

import { useCallback, useId, useMemo, useState } from "react";

import {
  addVoiceAction,
  deleteVoiceAction,
  proposeVoiceAction,
  setActiveVoiceAction,
  updateVoiceAction,
  type VoiceFormInput,
} from "@/app/(authed)/work/[id]/voices-actions";
import type { VoiceEntry } from "@/lib/db/voices";
import type { VoiceDelta } from "@/lib/voices/delta";
import { DRIFT_CEILING, voiceDrift } from "@/lib/voices/resolve";

const ACCENT = "var(--nova-accent)";
const SUBTLE = "var(--lunari-fg-subtle)";
const MUTED = "var(--lunari-fg-muted)";

interface VoicesPanelProps {
  workId: string;
  initialVoices: VoiceEntry[];
  initialActiveVoiceId: string | null;
  // the writer's own average sentence length (their base voice), so the drift
  // meter measures against the SAME base generation gates against ... null when
  // untrained (both meter + gate then fall back to the neutral default).
  baseSentenceLength: number | null;
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
function numOrNull(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const EMPTY_FORM: VoiceFormInput = {
  name: "",
  summary: "",
  register: "",
  vocabularySignature: "",
  openingPatterns: [],
  closingPatterns: [],
  idiosyncraticPhrases: [],
  avoidedPhrases: [],
  exemplars: [],
  sentenceLengthTarget: null,
  formalityTarget: null,
};

function deltaToForm(d: VoiceDelta): VoiceFormInput {
  return {
    name: d.name,
    summary: d.summary,
    register: d.register,
    vocabularySignature: d.vocabularySignature,
    openingPatterns: d.openingPatterns,
    closingPatterns: d.closingPatterns,
    idiosyncraticPhrases: d.idiosyncraticPhrases,
    avoidedPhrases: d.avoidedPhrases,
    exemplars: d.exemplars,
    sentenceLengthTarget: d.sentenceLengthTarget,
    formalityTarget: d.formalityTarget,
  };
}

// the add / edit form. carries the FULL delta (so a propose-filled opening pattern
// or vocabulary note is never dropped on a hand-edit), showing the fields a writer
// tunes. the "let nova draft it" row proposes an overlay from a description.
function VoiceForm({
  initial,
  workId,
  busy,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: VoiceEntry;
  workId: string;
  busy: boolean;
  submitLabel: string;
  onSubmit: (input: VoiceFormInput) => void;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState<VoiceFormInput>(initial ? deltaToForm(initial) : EMPTY_FORM);
  const [desc, setDesc] = useState("");
  const [proposing, setProposing] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // while nova is drafting an overlay, lock the whole form: the returning propose
  // replaces the form wholesale, so a concurrent save (which would submit the
  // pre-draft form + unmount) or a concurrent edit (which the draft would clobber)
  // must be blocked, not just the propose button.
  const locked = busy || proposing;

  const set = (patch: Partial<VoiceFormInput>) => setForm((f) => ({ ...f, ...patch }));

  const propose = async () => {
    if (proposing || busy) return;
    if (!form.name.trim()) {
      setNote("give the voice a name first.");
      return;
    }
    setProposing(true);
    setNote(null);
    const res = await proposeVoiceAction(workId, form.name, desc);
    setProposing(false);
    if (res.ok && res.delta) {
      // keep the writer's name, take nova's overlay for the rest.
      setForm({ ...deltaToForm(res.delta), name: form.name });
    } else {
      setNote(res.error ?? "nova couldn't draft that.");
    }
  };

  const submit = () => {
    if (locked) return;
    onSubmit(form);
  };

  return (
    <div className="flex flex-col gap-2 pt-1" data-testid="voice-form">
      <div className="flex gap-2">
        <input
          value={form.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="name (e.g. the detective)"
          aria-label="voice name"
          data-testid="voice-name"
          disabled={locked}
          className={`${FIELD_CLASS} flex-1`}
          style={FIELD_STYLE}
        />
        <input
          value={form.register}
          onChange={(e) => set({ register: e.target.value })}
          placeholder="register (e.g. clipped, hard-boiled)"
          aria-label="register"
          data-testid="voice-register"
          disabled={locked}
          className={`${FIELD_CLASS} flex-1`}
          style={FIELD_STYLE}
        />
      </div>

      {/* let nova draft the overlay from a plain-language description. */}
      <div
        className="flex flex-col gap-1.5 rounded-md border px-2.5 py-2"
        style={{ borderColor: "var(--lunari-border)" }}
      >
        <span className={LABEL_CLASS} style={{ color: SUBTLE }}>
          describe the voice ... let nova draft the overlay
        </span>
        <div className="flex gap-2">
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="a gruff sea-captain who talks in questions"
            aria-label="voice description"
            data-testid="voice-propose-desc"
            disabled={locked}
            className={`${FIELD_CLASS} flex-1`}
            style={FIELD_STYLE}
          />
          <button
            type="button"
            onClick={() => void propose()}
            disabled={locked}
            data-testid="voice-propose"
            className="shrink-0 rounded-full px-3 font-mono text-[10px] uppercase tracking-[0.16em] disabled:opacity-50"
            style={{ border: `1px solid ${ACCENT}`, color: ACCENT }}
          >
            {proposing ? "drafting ..." : "nova, draft it"}
          </button>
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className={LABEL_CLASS} style={{ color: SUBTLE }}>
          summary ... the voice in one line
        </span>
        <textarea
          value={form.summary}
          onChange={(e) => set({ summary: e.target.value })}
          rows={2}
          aria-label="summary"
          data-testid="voice-summary"
          disabled={locked}
          className={`${FIELD_CLASS} resize-y`}
          style={FIELD_STYLE}
        />
      </label>

      <div className="flex gap-2">
        <label className="flex flex-1 flex-col gap-1">
          <span className={LABEL_CLASS} style={{ color: SUBTLE }}>
            signature phrases ... one per line
          </span>
          <textarea
            value={toLines(form.idiosyncraticPhrases)}
            onChange={(e) => set({ idiosyncraticPhrases: fromLines(e.target.value) })}
            rows={2}
            aria-label="signature phrases"
            data-testid="voice-signature"
            disabled={locked}
            className={`${FIELD_CLASS} resize-y`}
            style={FIELD_STYLE}
          />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className={LABEL_CLASS} style={{ color: SUBTLE }}>
            avoids ... one per line
          </span>
          <textarea
            value={toLines(form.avoidedPhrases)}
            onChange={(e) => set({ avoidedPhrases: fromLines(e.target.value) })}
            rows={2}
            aria-label="avoided phrases"
            data-testid="voice-avoided"
            disabled={locked}
            className={`${FIELD_CLASS} resize-y`}
            style={FIELD_STYLE}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className={LABEL_CLASS} style={{ color: SUBTLE }}>
          in-voice lines ... one per line
        </span>
        <textarea
          value={toLines(form.exemplars)}
          onChange={(e) => set({ exemplars: fromLines(e.target.value) })}
          rows={2}
          aria-label="in-voice lines"
          data-testid="voice-exemplars"
          disabled={locked}
          className={`${FIELD_CLASS} resize-y`}
          style={FIELD_STYLE}
        />
      </label>

      <div className="flex gap-2">
        <label className="flex flex-1 flex-col gap-1">
          <span className={LABEL_CLASS} style={{ color: SUBTLE }}>
            sentence length (words)
          </span>
          <input
            value={form.sentenceLengthTarget === null ? "" : String(form.sentenceLengthTarget)}
            onChange={(e) => set({ sentenceLengthTarget: numOrNull(e.target.value) })}
            inputMode="numeric"
            placeholder="e.g. 7"
            aria-label="sentence length target"
            data-testid="voice-sentence-target"
            disabled={locked}
            className={FIELD_CLASS}
            style={FIELD_STYLE}
          />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className={LABEL_CLASS} style={{ color: SUBTLE }}>
            formality (0 raw ... 1 formal)
          </span>
          <input
            value={form.formalityTarget === null ? "" : String(form.formalityTarget)}
            onChange={(e) => set({ formalityTarget: numOrNull(e.target.value) })}
            inputMode="decimal"
            placeholder="e.g. 0.2"
            aria-label="formality target"
            data-testid="voice-formality-target"
            disabled={locked}
            className={FIELD_CLASS}
            style={FIELD_STYLE}
          />
        </label>
      </div>

      {note ? (
        <p className="font-serif text-[12px] italic" style={{ color: ACCENT }}>
          {note}
        </p>
      ) : null}

      <div className="flex items-center gap-3 pt-0.5">
        <button
          type="button"
          onClick={submit}
          disabled={locked}
          data-testid="voice-save"
          className="np-btn inline-flex h-7 items-center rounded-full px-3 font-mono text-[10px] uppercase tracking-[0.16em] disabled:opacity-50"
          style={{ background: ACCENT, color: "var(--lunari-bg-deep)" }}
        >
          {submitLabel}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={locked}
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

// a small bar of how far a voice pushes from the WRITER'S base voice. past the
// ceiling, generation clamps it back ... the bar flags that so the writer isn't
// surprised. it measures against the same base (the writer's sentence-length avg)
// that resolveGenerationVoice gates against, so the "pulled back" flag can't lie.
function DriftMeter({
  voice,
  baseSentenceLength,
}: {
  voice: VoiceEntry;
  baseSentenceLength: number | null;
}) {
  const drift = voiceDrift({ sentence_length_avg: baseSentenceLength }, voice);
  const pct = Math.round(drift * 100);
  const clamped = drift > DRIFT_CEILING;
  return (
    <span className="flex items-center gap-1.5" data-testid="voice-drift" data-drift={pct}>
      <span
        className="relative inline-block h-1 w-16 overflow-hidden rounded-full"
        style={{ background: "color-mix(in srgb, var(--lunari-fg-subtle) 24%, transparent)" }}
        aria-hidden
      >
        <span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${pct}%`,
            background: clamped ? "var(--lunari-danger, #c96a4c)" : ACCENT,
          }}
        />
      </span>
      <span className="font-mono text-[9px] uppercase tracking-[0.14em]" style={{ color: SUBTLE }}>
        {clamped ? "pulled back to your voice" : `${pct}% from your voice`}
      </span>
    </span>
  );
}

export function VoicesPanel({
  workId,
  initialVoices,
  initialActiveVoiceId,
  baseSentenceLength,
}: VoicesPanelProps) {
  const [voices, setVoices] = useState<VoiceEntry[]>(initialVoices);
  const [activeVoiceId, setActiveVoiceId] = useState<string | null>(initialActiveVoiceId);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const listId = useId();

  const activeName = useMemo(
    () => voices.find((v) => v.id === activeVoiceId)?.name ?? null,
    [voices, activeVoiceId],
  );

  const apply = (res: {
    ok: boolean;
    error?: string;
    voices: VoiceEntry[];
    activeVoiceId: string | null;
  }) => {
    setBusy(false);
    if (res.ok) {
      setVoices(res.voices);
      setActiveVoiceId(res.activeVoiceId);
      return true;
    }
    setNote(res.error ?? "something went sideways ... try again.");
    return false;
  };

  const add = useCallback(
    async (input: VoiceFormInput) => {
      setBusy(true);
      setNote(null);
      const res = await addVoiceAction(workId, input);
      if (apply(res)) setAdding(false);
    },
    [workId],
  );

  const update = useCallback(
    async (voiceId: string, input: VoiceFormInput) => {
      setBusy(true);
      setNote(null);
      const res = await updateVoiceAction(workId, voiceId, input);
      if (apply(res)) setEditingId(null);
    },
    [workId],
  );

  const remove = useCallback(
    async (voiceId: string) => {
      setBusy(true);
      setNote(null);
      apply(await deleteVoiceAction(workId, voiceId));
    },
    [workId],
  );

  const pick = useCallback(
    async (voiceId: string | null) => {
      setBusy(true);
      setNote(null);
      apply(await setActiveVoiceAction(workId, voiceId));
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
      data-testid="voices-panel"
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
          the cast of voices
          {voices.length > 0 ? ` ... ${voices.length}` : ""}
          {activeName ? ` · speaking as ${activeName}` : ""}
        </span>
        <span aria-hidden>{open ? "hide" : "show"}</span>
      </button>

      {open ? (
        <div id={listId} className="mt-3 flex flex-col gap-3">
          {/* who's speaking: the narrator (your base voice) or a named voice. */}
          <div
            className="flex flex-wrap items-center gap-2"
            data-testid="voice-active-row"
            role="group"
            aria-label="speaking as"
          >
            <span className={LABEL_CLASS} style={{ color: SUBTLE }}>
              speaking as
            </span>
            <button
              type="button"
              onClick={() => void pick(null)}
              disabled={busy}
              aria-pressed={activeVoiceId === null}
              data-testid="voice-pick"
              data-voice-id=""
              className="rounded-full px-2.5 py-0.5 font-mono text-[10px] lowercase tracking-[0.1em]"
              style={
                activeVoiceId === null
                  ? { background: ACCENT, color: "var(--lunari-bg-deep)" }
                  : { border: "1px solid var(--lunari-border)", color: SUBTLE }
              }
            >
              the narrator
            </button>
            {voices.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => void pick(v.id)}
                disabled={busy}
                aria-pressed={activeVoiceId === v.id}
                data-testid="voice-pick"
                data-voice-id={v.id}
                className="rounded-full px-2.5 py-0.5 font-mono text-[10px] lowercase tracking-[0.1em]"
                style={
                  activeVoiceId === v.id
                    ? { background: ACCENT, color: "var(--lunari-bg-deep)" }
                    : { border: "1px solid var(--lunari-border)", color: SUBTLE }
                }
              >
                {v.name}
              </button>
            ))}
          </div>

          {voices.length === 0 && !adding ? (
            <p className="font-serif text-[13px] italic" style={{ color: SUBTLE }}>
              no voices yet ... your own voice is the narrator. add a character voice below.
            </p>
          ) : null}

          <div className="flex flex-col gap-1.5">
            {voices.map((voice) =>
              editingId === voice.id ? (
                <div
                  key={voice.id}
                  className="rounded-md border px-2.5 py-2"
                  style={{ borderColor: "var(--lunari-border)" }}
                >
                  <VoiceForm
                    initial={voice}
                    workId={workId}
                    busy={busy}
                    submitLabel="save"
                    onSubmit={(input) => void update(voice.id, input)}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              ) : (
                <div
                  key={voice.id}
                  data-testid="voice-card"
                  className="rounded-md px-2.5 py-2"
                  style={{
                    background: "color-mix(in srgb, var(--lunari-fg-subtle) 8%, transparent)",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-serif text-[14px] leading-snug">
                      <span style={{ color: "var(--lunari-fg-primary)" }}>{voice.name}</span>
                      {voice.register ? (
                        <span
                          className="ml-2 font-mono text-[10px] uppercase tracking-[0.12em]"
                          style={{ color: ACCENT }}
                        >
                          {voice.register}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex shrink-0 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em]">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(voice.id);
                          setAdding(false);
                          setNote(null);
                        }}
                        disabled={busy}
                        aria-label={`edit ${voice.name}`}
                        style={{ color: SUBTLE }}
                      >
                        edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(voice.id)}
                        disabled={busy}
                        aria-label={`remove ${voice.name}`}
                        style={{ color: SUBTLE }}
                      >
                        remove
                      </button>
                    </span>
                  </div>
                  {voice.summary ? (
                    <p className="mt-0.5 font-serif text-[12px]" style={{ color: MUTED }}>
                      {voice.summary}
                    </p>
                  ) : null}
                  <div className="mt-1">
                    <DriftMeter voice={voice} baseSentenceLength={baseSentenceLength} />
                  </div>
                </div>
              ),
            )}
          </div>

          {adding ? (
            <div
              className="rounded-md border px-2.5 py-2"
              style={{ borderColor: "var(--lunari-border)" }}
            >
              <VoiceForm
                workId={workId}
                busy={busy}
                submitLabel="add voice"
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
              disabled={busy}
              data-testid="add-voice"
              className="self-start font-mono text-[11px] uppercase tracking-[0.18em]"
              style={{ color: ACCENT }}
            >
              + a voice
            </button>
          )}

          {note ? (
            <p className="font-serif text-[12px] italic" style={{ color: ACCENT }}>
              {note}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
