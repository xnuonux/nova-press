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
type NpPiecesJson = Database["public"]["Tables"]["np_pieces"]["Row"]["body"];

export interface PieceContentUpdate {
  title: string;
  body: NpPiecesJson;
  word_count: number;
  excerpt: string;
}

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

// persist editor content back to a piece. RLS scopes the write to the
// caller's rows via .eq("id"), so the owner check is enforced by postgres,
// not by us passing user_id. word_count + excerpt are derived server-side
// (never trusted from the client) before this is called. both nova-owned
// autosave timestamps are stamped here ... the tg_set_updated_at trigger
// handles updated_at separately.
export async function savePieceContent(
  client: ServerClient,
  id: string,
  update: PieceContentUpdate,
): Promise<void> {
  const typed = client as unknown as TypedClient;
  const nowIso = new Date().toISOString();
  const { error } = await typed
    .from("np_pieces")
    .update({
      title: update.title,
      body: update.body,
      word_count: update.word_count,
      excerpt: update.excerpt,
      last_autosaved_at: nowIso,
      last_edited_at: nowIso,
    })
    .eq("id", id);
  if (error) {
    throw new Error(`failed to save np_pieces content: ${error.message}`);
  }
}
