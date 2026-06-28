"use server";

import { coinWord } from "@/lib/ai/coin-word-analyze";
import { normalizePhonology, type Phonology } from "@/lib/conlang/phonology";
import {
  addLexeme,
  deleteLexeme,
  listLexemes,
  updateLexeme,
  type LexemeEntry,
} from "@/lib/db/lexicon";
import { getWorkById, updateWork } from "@/lib/db/works";
import { rateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// the conlang work-page writes: the phonology registry (work.settings.phonology),
// the lexicon (node_type "lexeme" record-leaves), and the constrained coiner. each
// re-checks the session AND that the caller owns the work (getWorkById is RLS-gated,
// so a stranger's work reads null), validates inside the db / pure layer, and hands
// back fresh state so the panel re-renders without a reload.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function ownWorkOrNull(workId: string) {
  if (!UUID_RE.test(workId)) return null;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const work = await getWorkById(supabase, workId);
  if (!work) return null;
  return { supabase, userId: user.id, work };
}

// the loose phonology shape the editor sends (raw text the writer typed).
export interface PhonologyInput {
  consonants: string;
  vowels: string;
  syllables: string;
}

export interface PhonologyResult {
  ok: boolean;
  error?: string;
  phonology?: Phonology;
}

export async function setPhonologyAction(
  workId: string,
  input: PhonologyInput,
): Promise<PhonologyResult> {
  const ctx = await ownWorkOrNull(workId);
  if (!ctx) return { ok: false, error: "couldn't save that ... try again." };

  const phonology = normalizePhonology(input);
  try {
    // merge into settings so a sibling key (a future grammar payload) survives.
    await updateWork(ctx.supabase, workId, {
      settings: { ...ctx.work.settings, phonology },
    });
    return { ok: true, phonology };
  } catch {
    return { ok: false, error: "couldn't save the phonology ... try again." };
  }
}

export interface LexemeFormInput {
  headword: string;
  partOfSpeech: string;
  gloss: string;
  ipa: string;
}

export interface LexiconActionResult {
  ok: boolean;
  error?: string;
  lexemes: LexemeEntry[];
}

export async function addLexemeAction(
  workId: string,
  input: LexemeFormInput,
): Promise<LexiconActionResult> {
  const ctx = await ownWorkOrNull(workId);
  if (!ctx) return { ok: false, error: "couldn't save that ... try again.", lexemes: [] };

  const res = await addLexeme(ctx.supabase, ctx.userId, workId, input);
  const lexemes = await listLexemes(ctx.supabase, workId);
  return res.ok ? { ok: true, lexemes } : { ok: false, error: res.error, lexemes };
}

export async function updateLexemeAction(
  workId: string,
  nodeId: string,
  input: LexemeFormInput,
): Promise<LexiconActionResult> {
  const ctx = await ownWorkOrNull(workId);
  if (!ctx) return { ok: false, error: "couldn't save that ... try again.", lexemes: [] };

  const res = await updateLexeme(ctx.supabase, workId, nodeId, input);
  const lexemes = await listLexemes(ctx.supabase, workId);
  return res.ok ? { ok: true, lexemes } : { ok: false, error: res.error, lexemes };
}

export async function deleteLexemeAction(
  workId: string,
  nodeId: string,
): Promise<LexiconActionResult> {
  const ctx = await ownWorkOrNull(workId);
  if (!ctx) return { ok: false, error: "couldn't remove that ... try again.", lexemes: [] };

  const res = await deleteLexeme(ctx.supabase, workId, nodeId);
  const lexemes = await listLexemes(ctx.supabase, workId);
  return res.ok ? { ok: true, lexemes } : { ok: false, error: res.error, lexemes };
}

export interface CoinWordResult {
  ok: boolean;
  word?: string;
}

// coin a word obeying the work's phonology for a (optional) meaning. the model
// proposes within the rails + the deterministic gate validates / falls back, so the
// returned word is ALWAYS legal. rate-limited like every model boundary.
export async function coinWordAction(workId: string, gloss: string): Promise<CoinWordResult> {
  const ctx = await ownWorkOrNull(workId);
  if (!ctx) return { ok: false };

  const limit = rateLimit(`coin-word:${ctx.userId}`, 12, 60_000);
  if (!limit.allowed) return { ok: false };

  const phonology = normalizePhonology(ctx.work.settings.phonology);
  const meaning = String(gloss ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
  const coined = await coinWord(phonology, meaning);
  return { ok: true, word: coined.word };
}
