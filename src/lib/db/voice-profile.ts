import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { composeVoiceCompactView, type VoiceProfileFields } from "@/lib/ai/voice-compact";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

// same ssr-vs-supabase-js generic mismatch as lib/db/pieces ... cast once for
// Database-typed inference without changing the factory signatures.
type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type TypedClient = SupabaseClient<Database>;

// only the columns CLAUDE.md lets nova READ off the shared voice_profiles
// table. never the outreach_* columns (gen connect's), and this path never
// writes. it's the read half of the voice wedge ... the distilled signature
// the writer's own corpus extraction fills.
const VOICE_COLUMNS =
  "register, vocabulary_signature, sentence_length_avg, avoided_phrases, idiosyncratic_phrases, opening_patterns, closing_patterns, writing_overrides, active_for_writing";

/**
 * the signed-in writer's distilled voice as the one compact line nova's prompts
 * have a slot for. rls scopes voice_profiles to the caller's own row, so a
 * missing / empty / mirroring-off profile just returns undefined and the prompt
 * keeps its honest "not yet trained" fallback. it NEVER throws ... a voice read
 * must never be the reason a generation fails, so a degraded read is silent.
 */
export async function getWriterVoice(client: ServerClient, userId: string): Promise<string | undefined> {
  const typed = client as unknown as TypedClient;
  try {
    const { data, error } = await typed
      .from("voice_profiles")
      .select(VOICE_COLUMNS)
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return undefined;
    // the runtime shape is the readable subset; the double-cast just sidesteps
    // supabase's select-string inference, which the compose fn doesn't need.
    return composeVoiceCompactView(data as unknown as VoiceProfileFields);
  } catch {
    return undefined;
  }
}
