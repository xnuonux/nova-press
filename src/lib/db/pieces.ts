import "server-only";

import { randomBytes } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { coercePlateValue, plateText } from "@/components/editor/plate-text";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

import { slugify, slugWithSuffix } from "./slug";

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

export interface PublishedPiece {
  title: string;
  body: NpPiecesJson;
  excerpt: string | null;
  word_count: number;
  published_at: string | null;
  slug: string | null;
}

// publish a piece. owner-scoped via RLS (.eq id), so postgres enforces that the
// caller owns the row. resolves a globally-unique slug against the partial
// unique index (np_pieces_published_slug_uniq): try the clean slug, and on a
// 23505 collision (some other published piece, maybe another user's, holds it)
// retry with a short suffix. a piece that already has a slug keeps it, so the
// url stays stable across re-publishes.
export async function publishPiece(client: ServerClient, id: string): Promise<{ slug: string }> {
  const typed = client as unknown as TypedClient;

  const piece = await getPieceById(client, id);
  if (!piece) {
    throw new Error("piece not found");
  }

  // don't ship a blank artifact to a public url. a piece with no words isn't
  // ready ... the writer can publish once there's something to read.
  if (!plateText(coercePlateValue(piece.body)).trim()) {
    throw new Error("can't publish an empty piece ... add some words first");
  }

  const baseSlug = piece.slug ?? slugify(piece.title);
  const nowIso = new Date().toISOString();

  let candidate = baseSlug;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data, error } = await typed
      .from("np_pieces")
      .update({
        slug: candidate,
        status: "published",
        visibility: "public",
        published_at: piece.published_at ?? nowIso,
      })
      .eq("id", id)
      .select("slug")
      .maybeSingle();
    if (!error) {
      // a null row back means the write matched nothing ... RLS filtered us out
      // or the row vanished between the read and the update. that's a false
      // "published", not a success.
      if (!data) {
        throw new Error("failed to publish: piece not found or not owned");
      }
      return { slug: data.slug ?? candidate };
    }
    // 23505 = unique_violation on the published-slug index.
    if (error.code !== "23505") {
      throw new Error(`failed to publish np_pieces row: ${error.message}`);
    }
    // a published piece keeps its stable slug, so a collision on its own slug is
    // a real conflict, not a fresh-name race ... don't spin a new suffix. (gate
    // on status, not slug-presence: a slug can outlive being published.)
    if (piece.status === "published") {
      throw new Error("failed to publish: slug already in use");
    }
    candidate = slugWithSuffix(baseSlug, randomBytes(3).toString("hex"));
  }
  throw new Error("failed to publish: could not find a free slug");
}

// public read for /p/[slug]. MUST run on the service-role (admin) client: the
// reader is usually anonymous and the np_pieces RLS policies are owner-only, so
// an owner-scoped client would return null for a stranger's piece. the WHERE
// filter is the real gate ... only published + shareable rows, only the fields
// safe to expose. never select user_id or internal columns here.
export async function getPublishedPieceBySlug(
  admin: TypedClient,
  slug: string,
): Promise<PublishedPiece | null> {
  const { data, error } = await admin
    .from("np_pieces")
    .select("title, body, excerpt, word_count, published_at, slug")
    .eq("slug", slug)
    .eq("status", "published")
    .in("visibility", ["unlisted", "public"])
    .maybeSingle();
  if (error) {
    throw new Error(`failed to fetch published piece: ${error.message}`);
  }
  return (data as PublishedPiece | null) ?? null;
}
