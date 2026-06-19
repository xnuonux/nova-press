import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { RepurposeFormat } from "@/lib/ai/prompts/repurpose-prompt";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

// same generic-count mismatch the rest of lib/db works around: the @supabase/ssr
// client has a different shape than supabase-js, so we take the server client
// and cast once per function for full Database-typed inference.
type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type TypedClient = SupabaseClient<Database>;

export type RepurposeChannel = RepurposeFormat;

export interface RepurposeOutput {
  id: string;
  channel: RepurposeChannel;
  body: string;
  sourceEditedAt: string; // iso watermark: the piece's last_edited_at at gen time
  generatedAt: string; // iso
}

const SELECT = "id, channel, body, source_edited_at, generated_at";

/**
 * pure: an output is stale when the source piece has been edited SINCE the
 * output was generated. computed on read, never stored ... there is nothing to
 * keep in sync, and a refresh is always the writer's call. a bad/missing
 * timestamp degrades to "not stale" rather than nagging.
 */
export function isOutputStale(
  output: { sourceEditedAt: string },
  pieceLastEditedAt: string,
): boolean {
  const made = Date.parse(output.sourceEditedAt);
  const edited = Date.parse(pieceLastEditedAt);
  if (Number.isNaN(made) || Number.isNaN(edited)) return false;
  return made < edited;
}

/**
 * upsert the current output for (piece, channel). a refresh overwrites the row,
 * so there is exactly one live output per channel per piece. sourceEditedAt is
 * the piece's last_edited_at captured at generation time (the staleness
 * watermark). RLS gates the write to the caller's own rows.
 */
export async function saveRepurposeOutput(
  client: ServerClient,
  input: {
    userId: string;
    pieceId: string;
    channel: RepurposeChannel;
    body: string;
    sourceEditedAt: string;
  },
): Promise<RepurposeOutput | null> {
  const typed = client as unknown as TypedClient;
  const { data, error } = await typed
    .from("np_repurpose_outputs")
    .upsert(
      {
        user_id: input.userId,
        piece_id: input.pieceId,
        channel: input.channel,
        body: input.body,
        source_edited_at: input.sourceEditedAt,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "piece_id,channel" },
    )
    .select(SELECT)
    .single();

  if (error || !data) return null;
  return {
    id: data.id,
    channel: data.channel as RepurposeChannel,
    body: data.body,
    sourceEditedAt: data.source_edited_at,
    generatedAt: data.generated_at,
  };
}

/** the saved outputs for a piece (RLS scopes to the caller's own rows). */
export async function listOutputsByPiece(
  client: ServerClient,
  pieceId: string,
): Promise<RepurposeOutput[]> {
  const typed = client as unknown as TypedClient;
  const { data, error } = await typed
    .from("np_repurpose_outputs")
    .select(SELECT)
    .eq("piece_id", pieceId);

  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    channel: r.channel as RepurposeChannel,
    body: r.body,
    sourceEditedAt: r.source_edited_at,
    generatedAt: r.generated_at,
  }));
}
