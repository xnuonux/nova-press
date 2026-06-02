import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

// the chunk-1 supabase factories return the @supabase/ssr v0.5
// SupabaseClient shape, which has a different generic-count than
// supabase-js v2.106. that mismatch makes table-type inference fail
// downstream (insert payload typed as never[], .single() return typed
// as never). casting to the supabase-js shape once per function gives
// us full Database-typed inference without changing factory signatures.
type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type TypedClient = SupabaseClient<Database>;

const LIST_COLUMNS = "id, title, excerpt, word_count, status, last_edited_at";

export type PieceListItem = Pick<
  Database["public"]["Tables"]["np_pieces"]["Row"],
  "id" | "title" | "excerpt" | "word_count" | "status" | "last_edited_at"
>;

export type Piece = Database["public"]["Tables"]["np_pieces"]["Row"];

// list a user's pieces for the library view. RLS gates auth.uid() = user_id
// so we don't pass user_id explicitly. archived pieces are hidden by
// default ... the library is the "active work" view, not the archive.
export async function listPiecesForUser(client: ServerClient): Promise<PieceListItem[]> {
  const typed = client as unknown as TypedClient;
  const { data, error } = await typed
    .from("np_pieces")
    .select(LIST_COLUMNS)
    .neq("status", "archived")
    .order("last_edited_at", { ascending: false });
  if (error) {
    throw new Error(`failed to list np_pieces: ${error.message}`);
  }
  return (data ?? []) as PieceListItem[];
}

// create a fresh draft. db defaults populate title ('untitled'),
// body ('[]'::jsonb), status ('draft'), visibility ('private'), and the
// timestamps. only user_id is required.
export async function createDraftPiece(
  client: ServerClient,
  userId: string,
): Promise<{ id: string }> {
  const typed = client as unknown as TypedClient;
  const { data, error } = await typed
    .from("np_pieces")
    .insert({ user_id: userId })
    .select("id")
    .single();
  if (error) {
    throw new Error(`failed to create draft piece: ${error.message}`);
  }
  return { id: data.id };
}

// fetch a piece by id. RLS scopes to the caller's rows, so an attacker
// requesting another user's id will see null ... no row-existence oracle.
export async function getPieceById(client: ServerClient, id: string): Promise<Piece | null> {
  const typed = client as unknown as TypedClient;
  const { data, error } = await typed.from("np_pieces").select("*").eq("id", id).maybeSingle();
  if (error) {
    throw new Error(`failed to fetch np_pieces row: ${error.message}`);
  }
  return (data as Piece | null) ?? null;
}
