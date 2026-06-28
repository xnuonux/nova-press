"use client";

/**
 * the language ... the conlang work made workable. a calm disclosure panel on the
 * work page (conlang forms only): the PHONOLOGY editor (the sound inventory + the
 * legal syllable shapes, the rails a word must obey) over the LEXICON (the words,
 * each a record of headword / part of speech / gloss / ipa).
 *
 * the headword field shows live whether it FITS the phonology (the pure
 * isLegalWord, client-side), and "coin" generates a word that obeys the rails for
 * the gloss you gave (the model proposes within the rails, the deterministic gate
 * validates + falls back ... a coined word is always legal). lowercase voice,
 * lunari tokens, the golden accent.
 */

import { useCallback, useId, useState } from "react";

import {
  addLexemeAction,
  coinWordAction,
  deleteLexemeAction,
  setPhonologyAction,
  updateLexemeAction,
  type LexemeFormInput,
} from "@/app/(authed)/work/[id]/conlang-actions";
import { PARTS_OF_SPEECH, type PartOfSpeech } from "@/lib/conlang/lexeme";
import { isLegalWord, normalizePhonology, type Phonology } from "@/lib/conlang/phonology";
import type { LexemeEntry } from "@/lib/db/lexicon";

const ACCENT = "var(--nova-accent)";
const SUBTLE = "var(--lunari-fg-subtle)";
const MUTED = "var(--lunari-fg-muted)";

interface ConlangPanelProps {
  workId: string;
  // the raw work.settings.phonology (normalized here) + the lexicon.
  initialPhonology: unknown;
  initialLexemes: LexemeEntry[];
}

const FIELD_CLASS =
  "w-full rounded-md border bg-transparent px-2.5 py-1.5 font-serif text-[13px] leading-snug outline-none";
const FIELD_STYLE = { borderColor: "var(--lunari-border)", color: MUTED } as const;
const LABEL_CLASS = "font-mono text-[9px] uppercase tracking-[0.18em]";

function PhonologyEditor({
  workId,
  phonology,
  onSaved,
}: {
  workId: string;
  phonology: Phonology;
  onSaved: (p: Phonology) => void;
}) {
  const [consonants, setConsonants] = useState(phonology.consonants.join(" "));
  const [vowels, setVowels] = useState(phonology.vowels.join(" "));
  const [syllables, setSyllables] = useState(phonology.syllables.join(" "));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const save = useCallback(async () => {
    setBusy(true);
    setNote(null);
    const res = await setPhonologyAction(workId, { consonants, vowels, syllables });
    setBusy(false);
    if (res.ok && res.phonology) onSaved(res.phonology);
    else setNote(res.error ?? "couldn't save the phonology.");
  }, [workId, consonants, vowels, syllables, onSaved]);

  return (
    <div
      className="flex flex-col gap-2 rounded-md border px-2.5 py-2"
      style={{ borderColor: "var(--lunari-border)" }}
      data-testid="phonology-editor"
    >
      <span className={LABEL_CLASS} style={{ color: ACCENT }}>
        phonology ... the rails
      </span>
      <label className="flex flex-col gap-1">
        <span className={LABEL_CLASS} style={{ color: SUBTLE }}>
          consonants (C)
        </span>
        <input
          value={consonants}
          onChange={(e) => setConsonants(e.target.value)}
          data-testid="phon-consonants"
          aria-label="consonants"
          className={FIELD_CLASS}
          style={FIELD_STYLE}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className={LABEL_CLASS} style={{ color: SUBTLE }}>
          vowels (V)
        </span>
        <input
          value={vowels}
          onChange={(e) => setVowels(e.target.value)}
          data-testid="phon-vowels"
          aria-label="vowels"
          className={FIELD_CLASS}
          style={FIELD_STYLE}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className={LABEL_CLASS} style={{ color: SUBTLE }}>
          syllable shapes (over C / V) ... e.g. CV CVC V
        </span>
        <input
          value={syllables}
          onChange={(e) => setSyllables(e.target.value)}
          data-testid="phon-syllables"
          aria-label="syllable shapes"
          className={FIELD_CLASS}
          style={FIELD_STYLE}
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          data-testid="phon-save"
          className="np-btn inline-flex h-7 items-center rounded-full px-3 font-mono text-[10px] uppercase tracking-[0.16em] disabled:opacity-50"
          style={{ background: "var(--nova-accent-soft)", color: ACCENT }}
        >
          {busy ? "saving ..." : "save the rails"}
        </button>
        {note ? (
          <span className="font-serif text-[12px] italic" style={{ color: SUBTLE }}>
            {note}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function LexemeForm({
  workId,
  phonology,
  initial,
  busy,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  workId: string;
  phonology: Phonology;
  initial?: LexemeEntry;
  busy: boolean;
  onSubmit: (input: LexemeFormInput) => void;
  onCancel?: () => void;
  submitLabel: string;
}) {
  const [headword, setHeadword] = useState(initial?.headword ?? "");
  const [partOfSpeech, setPartOfSpeech] = useState<PartOfSpeech>(initial?.partOfSpeech ?? "noun");
  const [gloss, setGloss] = useState(initial?.gloss ?? "");
  const [ipa, setIpa] = useState(initial?.ipa ?? "");
  const [coining, setCoining] = useState(false);

  const legal = headword.trim().length > 0 ? isLegalWord(phonology, headword) : null;

  const coin = useCallback(async () => {
    setCoining(true);
    const res = await coinWordAction(workId, gloss);
    setCoining(false);
    if (res.ok && res.word) setHeadword(res.word);
  }, [workId, gloss]);

  const submit = () => {
    if (busy) return;
    onSubmit({ headword, partOfSpeech, gloss, ipa });
  };

  return (
    <div className="flex flex-col gap-2 pt-1" data-testid="lexeme-form">
      <div className="flex items-center gap-2">
        <input
          value={headword}
          onChange={(e) => setHeadword(e.target.value)}
          placeholder="headword (the word)"
          aria-label="headword"
          data-testid="lex-headword"
          className={`${FIELD_CLASS} flex-1`}
          style={FIELD_STYLE}
        />
        <button
          type="button"
          onClick={coin}
          disabled={coining}
          data-testid="lex-coin"
          title="coin a word that obeys the phonology"
          className="np-btn inline-flex h-8 shrink-0 items-center rounded-full px-3 font-mono text-[10px] uppercase tracking-[0.16em] disabled:opacity-50"
          style={{ background: "var(--nova-accent-soft)", color: ACCENT }}
        >
          {coining ? "..." : "coin"}
        </button>
      </div>
      {legal !== null ? (
        <span
          className="font-mono text-[9px] uppercase tracking-[0.16em]"
          data-testid="lex-legal"
          style={{ color: legal ? ACCENT : SUBTLE }}
        >
          {legal ? "fits the phonology" : "breaks the sound rules"}
        </span>
      ) : null}
      <div className="flex gap-2">
        <select
          value={partOfSpeech}
          onChange={(e) => setPartOfSpeech(e.target.value as PartOfSpeech)}
          aria-label="part of speech"
          data-testid="lex-pos"
          className="rounded-md border bg-transparent px-2 py-1.5 font-mono text-[11px] lowercase outline-none"
          style={FIELD_STYLE}
        >
          {PARTS_OF_SPEECH.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <input
          value={ipa}
          onChange={(e) => setIpa(e.target.value)}
          placeholder="ipa (optional)"
          aria-label="ipa"
          data-testid="lex-ipa"
          className={`${FIELD_CLASS} flex-1`}
          style={FIELD_STYLE}
        />
      </div>
      <input
        value={gloss}
        onChange={(e) => setGloss(e.target.value)}
        placeholder="gloss ... what it means"
        aria-label="gloss"
        data-testid="lex-gloss"
        className={FIELD_CLASS}
        style={FIELD_STYLE}
      />
      <div className="flex items-center gap-3 pt-0.5">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          data-testid="lex-save"
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

export function ConlangPanel({ workId, initialPhonology, initialLexemes }: ConlangPanelProps) {
  const [phonology, setPhonology] = useState<Phonology>(() => normalizePhonology(initialPhonology));
  const [lexemes, setLexemes] = useState<LexemeEntry[]>(initialLexemes);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const listId = useId();

  const add = useCallback(
    async (input: LexemeFormInput) => {
      setBusy(true);
      setNote(null);
      const res = await addLexemeAction(workId, input);
      setBusy(false);
      if (res.ok) {
        setLexemes(res.lexemes);
        setAdding(false);
      } else {
        setNote(res.error ?? "couldn't save that word.");
      }
    },
    [workId],
  );

  const update = useCallback(
    async (nodeId: string, input: LexemeFormInput) => {
      setBusy(true);
      setNote(null);
      const res = await updateLexemeAction(workId, nodeId, input);
      setBusy(false);
      if (res.ok) {
        setLexemes(res.lexemes);
        setEditingId(null);
      } else {
        setNote(res.error ?? "couldn't save that word.");
      }
    },
    [workId],
  );

  const remove = useCallback(
    async (nodeId: string) => {
      setBusy(true);
      setNote(null);
      const res = await deleteLexemeAction(workId, nodeId);
      setBusy(false);
      if (res.ok) setLexemes(res.lexemes);
      else setNote(res.error ?? "couldn't remove that word.");
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
      data-testid="conlang-panel"
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
          the language
          {lexemes.length > 0
            ? ` ... ${lexemes.length} word${lexemes.length === 1 ? "" : "s"}`
            : ""}
        </span>
        <span aria-hidden>{open ? "hide" : "show"}</span>
      </button>

      {open ? (
        <div id={listId} className="mt-3 flex flex-col gap-3">
          <PhonologyEditor
            // re-mount on the CANONICAL phonology so the fields re-seed from the
            // normalized result after a save ... otherwise clearing an inventory
            // (which falls back to the default) would leave the field blank while
            // the default is silently enforced. same lesson as the codex prefill key.
            key={`${phonology.consonants.join("")}|${phonology.vowels.join("")}|${phonology.syllables.join("")}`}
            workId={workId}
            phonology={phonology}
            onSaved={setPhonology}
          />

          <div className="flex flex-col gap-1.5">
            {lexemes.length === 0 && !adding ? (
              <p className="font-serif text-[13px] italic" style={{ color: SUBTLE }}>
                no words yet ... coin the first one below.
              </p>
            ) : null}

            {lexemes.map((lex) =>
              editingId === lex.nodeId ? (
                <div
                  key={lex.nodeId}
                  className="rounded-md border px-2.5 py-2"
                  style={{ borderColor: "var(--lunari-border)" }}
                >
                  <LexemeForm
                    workId={workId}
                    phonology={phonology}
                    initial={lex}
                    busy={busy}
                    submitLabel="save"
                    onSubmit={(input) => void update(lex.nodeId, input)}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              ) : (
                <div
                  key={lex.nodeId}
                  data-testid="lexeme-row"
                  className="flex items-start justify-between gap-3 rounded-md px-2.5 py-1.5"
                  style={{
                    background: "color-mix(in srgb, var(--lunari-fg-subtle) 8%, transparent)",
                  }}
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-serif text-[14px] leading-snug">
                      <span style={{ color: "var(--lunari-fg-primary)" }}>{lex.headword}</span>{" "}
                      <span
                        className="font-mono text-[10px] uppercase tracking-[0.12em]"
                        style={{ color: ACCENT }}
                      >
                        {lex.partOfSpeech}
                      </span>
                      {lex.ipa ? (
                        <span className="font-mono text-[11px]" style={{ color: SUBTLE }}>
                          {" "}
                          /{lex.ipa}/
                        </span>
                      ) : null}
                    </span>
                    {lex.gloss ? (
                      <span className="font-serif text-[12px]" style={{ color: SUBTLE }}>
                        {lex.gloss}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em]">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(lex.nodeId);
                        setAdding(false);
                        setNote(null);
                      }}
                      disabled={busy}
                      style={{ color: SUBTLE }}
                    >
                      edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(lex.nodeId)}
                      disabled={busy}
                      style={{ color: SUBTLE }}
                    >
                      remove
                    </button>
                  </span>
                </div>
              ),
            )}
          </div>

          {adding ? (
            <div
              className="rounded-md border px-2.5 py-2"
              style={{ borderColor: "var(--lunari-border)" }}
            >
              <LexemeForm
                workId={workId}
                phonology={phonology}
                busy={busy}
                submitLabel="add the word"
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
              data-testid="lex-add"
              className="self-start font-mono text-[10px] uppercase tracking-[0.16em]"
              style={{ color: ACCENT }}
            >
              + coin a word
            </button>
          )}

          {note ? (
            <p
              className="font-serif text-[12px] italic"
              style={{ color: SUBTLE }}
              data-testid="conlang-note"
            >
              {note}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
