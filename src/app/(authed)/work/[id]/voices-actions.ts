"use server";

import { proposeVoice } from "@/lib/ai/propose-voice-analyze";
import {
  addVoice,
  deleteVoice,
  getActiveVoiceId,
  listVoices,
  setActiveVoice,
  updateVoice,
  type VoiceEntry,
} from "@/lib/db/voices";
import { getWorkById } from "@/lib/db/works";
import { rateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { VoiceDelta } from "@/lib/voices/delta";

// the multi-voice cast writes ... a work's named delta voices + which one is
// active for generation. each re-checks the session AND that the caller owns the
// work (getWorkById is RLS-gated, so a stranger's work reads null), validates
// inside the db / pure layer, and hands back the fresh cast + the active id so the
// panel re-renders without a reload. mirrors the conlang + encyclopaedia actions.

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
  return { supabase, userId: user.id };
}

// the form's fields ... a concrete VoiceDeltaDraft the db layer re-normalizes.
export interface VoiceFormInput {
  name: string;
  summary: string;
  register: string;
  vocabularySignature: string;
  openingPatterns: string[];
  closingPatterns: string[];
  idiosyncraticPhrases: string[];
  avoidedPhrases: string[];
  exemplars: string[];
  sentenceLengthTarget: number | null;
  formalityTarget: number | null;
}

export interface VoiceActionResult {
  ok: boolean;
  error?: string;
  voices: VoiceEntry[];
  activeVoiceId: string | null;
}

async function snapshot(
  ctx: { supabase: Awaited<ReturnType<typeof createSupabaseServerClient>> },
  workId: string,
): Promise<{ voices: VoiceEntry[]; activeVoiceId: string | null }> {
  const voices = await listVoices(ctx.supabase, workId);
  const activeVoiceId = await getActiveVoiceId(ctx.supabase, workId);
  return { voices, activeVoiceId };
}

export async function addVoiceAction(
  workId: string,
  input: VoiceFormInput,
): Promise<VoiceActionResult> {
  const ctx = await ownWorkOrNull(workId);
  if (!ctx)
    return {
      ok: false,
      error: "couldn't save that ... try again.",
      voices: [],
      activeVoiceId: null,
    };

  const res = await addVoice(ctx.supabase, ctx.userId, workId, input);
  const snap = await snapshot(ctx, workId);
  return res.ok ? { ok: true, ...snap } : { ok: false, error: res.error, ...snap };
}

export async function updateVoiceAction(
  workId: string,
  voiceId: string,
  input: VoiceFormInput,
): Promise<VoiceActionResult> {
  const ctx = await ownWorkOrNull(workId);
  if (!ctx)
    return {
      ok: false,
      error: "couldn't save that ... try again.",
      voices: [],
      activeVoiceId: null,
    };

  const res = await updateVoice(ctx.supabase, workId, voiceId, input);
  const snap = await snapshot(ctx, workId);
  return res.ok ? { ok: true, ...snap } : { ok: false, error: res.error, ...snap };
}

export async function deleteVoiceAction(
  workId: string,
  voiceId: string,
): Promise<VoiceActionResult> {
  const ctx = await ownWorkOrNull(workId);
  if (!ctx)
    return {
      ok: false,
      error: "couldn't remove that ... try again.",
      voices: [],
      activeVoiceId: null,
    };

  const res = await deleteVoice(ctx.supabase, workId, voiceId);
  const snap = await snapshot(ctx, workId);
  return res.ok ? { ok: true, ...snap } : { ok: false, error: res.error, ...snap };
}

/** switch the work's active voice (null = back to the narrator). */
export async function setActiveVoiceAction(
  workId: string,
  voiceId: string | null,
): Promise<VoiceActionResult> {
  const ctx = await ownWorkOrNull(workId);
  if (!ctx)
    return {
      ok: false,
      error: "couldn't switch the voice ... try again.",
      voices: [],
      activeVoiceId: null,
    };

  const res = await setActiveVoice(ctx.supabase, workId, voiceId);
  const snap = await snapshot(ctx, workId);
  return res.ok ? { ok: true, ...snap } : { ok: false, error: res.error, ...snap };
}

export interface VoiceProposeResult {
  ok: boolean;
  error?: string;
  delta?: VoiceDelta;
}

/** let nova draft a voice overlay from a plain-language description. rate-limited
 *  (a real model call); degrades to a minimal delta inside proposeVoice, so it
 *  always at least hands back the name + description as the steer. */
export async function proposeVoiceAction(
  workId: string,
  name: string,
  description: string,
): Promise<VoiceProposeResult> {
  const ctx = await ownWorkOrNull(workId);
  if (!ctx) return { ok: false, error: "couldn't reach nova ... try again." };

  const limit = rateLimit(`propose-voice:${ctx.userId}`, 12, 60_000);
  if (!limit.allowed) return { ok: false, error: "easy ... give nova a second." };

  const delta = await proposeVoice(name, description);
  if (!delta) return { ok: false, error: "give the voice a name first." };
  return { ok: true, delta };
}
