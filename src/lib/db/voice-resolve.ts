import "server-only";

import { applyVoiceDelta, gateDelta } from "@/lib/voices/resolve";

import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { readWriterVoiceFields, type WriterVoice } from "./voice-profile";
import { readActiveVoice } from "./voices";

// resolve the EFFECTIVE voice a generation should speak in: the writer's base
// voice, overlaid with the work's ACTIVE character voice (if one is selected),
// drift-gated so the overlay stays anchored to the writer. server-only ... it
// stitches the pure resolve/gate spine to the db reads. NEVER throws: any hiccup
// degrades to the base voice, so a voice read is never the reason a generation
// fails (mirrors getWriterVoice's own discipline).

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export interface GenerationVoiceInput {
  // the work whose active voice to resolve; null for a standalone piece (base only).
  workId: string | null;
  // the writer's already-composed base voice (from getWriterVoice), the anchor.
  base: WriterVoice;
}

export async function resolveGenerationVoice(
  client: ServerClient,
  userId: string,
  input: GenerationVoiceInput,
): Promise<WriterVoice> {
  if (!input.workId) return input.base;
  try {
    const governing = await readActiveVoice(client, input.workId);
    if (!governing) return input.base;
    // gate the delta against the writer's raw base fields so a heavy character
    // overlay can never fully erase the writer, then overlay it on the compact base.
    const baseFields = await readWriterVoiceFields(client, userId);
    const { delta } = gateDelta(baseFields, governing);
    return applyVoiceDelta(input.base, delta);
  } catch {
    return input.base;
  }
}
