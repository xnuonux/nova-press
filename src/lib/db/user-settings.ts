import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { reportError } from "@/lib/observability/report-error";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeForkLabel } from "@/lib/voice/forks";
import type { Database, Json } from "@/types/supabase";

// same ssr-vs-supabase-js generic mismatch as the rest of lib/db ... cast once
// per function for Database-typed inference.
type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type TypedClient = SupabaseClient<Database>;

/**
 * PURE: narrow a preferences jsonb (unknown shape, owned upstream) down to the
 * active writing fork ... preferences.voiceForks.activeWritingFork as a non-empty
 * string, or null. an object-not-array guard at each level + a non-empty-string
 * check, so a malformed historical write degrades to "your voice" (null) rather
 * than poisoning the read. unit-tested with zero db mocks.
 */
export function readActiveWritingFork(preferences: unknown): string | null {
  if (!preferences || typeof preferences !== "object" || Array.isArray(preferences)) return null;
  const voiceForks = (preferences as Record<string, unknown>).voiceForks;
  if (!voiceForks || typeof voiceForks !== "object" || Array.isArray(voiceForks)) return null;
  const label = (voiceForks as Record<string, unknown>).activeWritingFork;
  return typeof label === "string" && label.trim().length > 0 ? label : null;
}

/**
 * the writer's active writing fork (which named strand nova writes in), or null
 * for "your voice" = today's live voice. RLS scopes np_user_settings to the
 * caller's own row. returns null on missing row / error / any non-string, so the
 * write-source seam always degrades to today. NEVER throws.
 */
export async function getActiveWritingFork(
  client: ServerClient,
  userId: string,
): Promise<string | null> {
  try {
    const typed = client as unknown as TypedClient;
    const { data, error } = await typed
      .from("np_user_settings")
      .select("preferences")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return null;
    return readActiveWritingFork((data as { preferences?: unknown }).preferences);
  } catch {
    return null;
  }
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * set (or clear) the active writing fork. the ONLY write the voice-switch makes,
 * and it lands EXCLUSIVELY in nova's own np_user_settings ... voice_profiles is
 * never opened. pre-normalizes the label so the stored value can only equal a
 * fork_label that could exist (empty -> null = "your voice"). a read-modify-write
 * merge touches ONLY preferences.voiceForks.activeWritingFork, so any other
 * preferences.* key (and a non-object voiceForks) is preserved, not clobbered.
 * owner-scoped via the authed client + the four-policy RLS. non-fatal: returns
 * { ok: false } on error, never throws.
 */
export async function setActiveWritingFork(
  client: ServerClient,
  userId: string,
  label: string | null,
): Promise<{ ok: boolean }> {
  const value = label === null ? null : normalizeForkLabel(label);
  try {
    const typed = client as unknown as TypedClient;
    const { data } = await typed
      .from("np_user_settings")
      .select("preferences")
      .eq("user_id", userId)
      .maybeSingle();
    const prefs = asObject((data as { preferences?: unknown } | null)?.preferences);
    const voiceForks = asObject(prefs.voiceForks);
    const preferences = { ...prefs, voiceForks: { ...voiceForks, activeWritingFork: value } };
    const { error } = await typed
      .from("np_user_settings")
      .upsert(
        { user_id: userId, preferences: preferences as unknown as Json },
        { onConflict: "user_id" },
      );
    if (error) {
      reportError(new Error(error.message), { tag: "active-writing-fork-failed", userId });
      return { ok: false };
    }
    return { ok: true };
  } catch (err) {
    reportError(err, { tag: "active-writing-fork-failed", userId });
    return { ok: false };
  }
}
