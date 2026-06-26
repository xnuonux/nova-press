import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import type { Work, TreeNode } from "@/types/works";

import { getForm } from "@/lib/forms/constraints";
import { rowToWork } from "@/lib/works/map";
import { buildTree, flattenSkeleton } from "@/lib/works/tree";
import { listNodesForWork } from "./nodes";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type TypedClient = SupabaseClient<Database>;
type WorkRow = Database["public"]["Tables"]["np_works"]["Row"];

const WORK_LIST_COLUMNS =
  "id, title, form_profile, family, status, visibility, slug, word_count, updated_at";

export type WorkListItem = Pick<
  WorkRow,
  | "id"
  | "title"
  | "form_profile"
  | "family"
  | "status"
  | "visibility"
  | "slug"
  | "word_count"
  | "updated_at"
>;

// the works library view ... a user's works by recency, archived hidden. RLS
// scopes auth.uid() = user_id so we never pass user_id. /library (pieces) is
// untouched; this is the new /works shelf beside it.
export async function listWorksForUser(client: ServerClient): Promise<WorkListItem[]> {
  const typed = client as unknown as TypedClient;
  const { data, error } = await typed
    .from("np_works")
    .select(WORK_LIST_COLUMNS)
    .neq("status", "archived")
    .order("updated_at", { ascending: false });
  if (error) {
    throw new Error(`failed to list np_works: ${error.message}`);
  }
  return (data ?? []) as WorkListItem[];
}

export async function getWorkById(client: ServerClient, id: string): Promise<Work | null> {
  const typed = client as unknown as TypedClient;
  const { data, error } = await typed.from("np_works").select("*").eq("id", id).maybeSingle();
  if (error) {
    throw new Error(`failed to fetch np_works row: ${error.message}`);
  }
  return data ? rowToWork(data as WorkRow) : null;
}

// create a work for a form profile, seeding its skeleton (a novel's three acts,
// a sonnet's line slot). the form registry is the only source of the shape; an
// unknown profile falls back to 'prose' (a single open page). the first root
// node becomes the work's root_node_id. RLS gates every write.
export async function createWork(
  client: ServerClient,
  userId: string,
  formProfile: string,
): Promise<{ workId: string }> {
  const typed = client as unknown as TypedClient;
  const form = getForm(formProfile);
  const profileKey = form ? formProfile : "prose";
  const family = form ? form.family : null;

  const { data: work, error } = await typed
    .from("np_works")
    .insert({ user_id: userId, form_profile: profileKey, family })
    .select("id")
    .single();
  if (error) {
    throw new Error(`failed to create np_works: ${error.message}`);
  }
  const workId = work.id;

  if (form?.skeleton && form.skeleton.length > 0) {
    const specs = flattenSkeleton(form.skeleton);
    const tempToReal = new Map<string, string>();
    let firstRoot: string | null = null;
    for (const spec of specs) {
      const parentId = spec.parentTempId ? (tempToReal.get(spec.parentTempId) ?? null) : null;
      const { data: nodeRow, error: nodeErr } = await typed
        .from("np_nodes")
        .insert({
          user_id: userId,
          work_id: workId,
          parent_id: parentId,
          node_type: spec.nodeType,
          title: spec.title,
          position: spec.position,
          is_leaf: spec.isLeaf,
        })
        .select("id")
        .single();
      if (nodeErr) {
        throw new Error(`failed to seed skeleton node: ${nodeErr.message}`);
      }
      tempToReal.set(spec.tempId, nodeRow.id);
      if (parentId === null && firstRoot === null) {
        firstRoot = nodeRow.id;
      }
    }
    if (firstRoot) {
      const { error: rootErr } = await typed
        .from("np_works")
        .update({ root_node_id: firstRoot })
        .eq("id", workId);
      if (rootErr) {
        throw new Error(`failed to set root_node_id: ${rootErr.message}`);
      }
    }
  }

  return { workId };
}

// the binder's data: a work's whole node tree, restitched + depth-tagged.
export async function getWorkTree(client: ServerClient, workId: string): Promise<TreeNode[]> {
  const nodes = await listNodesForWork(client, workId);
  return buildTree(nodes);
}

// the zero-friction on-ramp: wrap an existing standalone piece in a one-leaf
// Work, so a writer who started in /library can grow it into a manuscript
// without losing the piece. the piece IS the leaf ... its body, slug, voice all
// carry over untouched. RLS scopes each write to the caller.
export async function promotePieceToWork(
  client: ServerClient,
  userId: string,
  pieceId: string,
): Promise<{ workId: string; nodeId: string }> {
  const typed = client as unknown as TypedClient;

  // borrow the piece's title for the work + the leaf (RLS-scoped read).
  const { data: piece, error: pieceErr } = await typed
    .from("np_pieces")
    .select("title")
    .eq("id", pieceId)
    .maybeSingle();
  if (pieceErr) {
    throw new Error(`failed to read piece for promotion: ${pieceErr.message}`);
  }
  if (!piece) {
    throw new Error("piece not found or not owned");
  }
  const title = piece.title;

  const { data: work, error: workErr } = await typed
    .from("np_works")
    .insert({ user_id: userId, form_profile: "prose", family: "prose", title })
    .select("id")
    .single();
  if (workErr) {
    throw new Error(`failed to create work for promotion: ${workErr.message}`);
  }
  const workId = work.id;

  const { data: nodeRow, error: nodeErr } = await typed
    .from("np_nodes")
    .insert({
      user_id: userId,
      work_id: workId,
      parent_id: null,
      node_type: "document",
      title,
      position: 0,
      is_leaf: true,
      piece_id: pieceId,
    })
    .select("id")
    .single();
  if (nodeErr) {
    throw new Error(`failed to create leaf node for promotion: ${nodeErr.message}`);
  }
  const nodeId = nodeRow.id;

  const { error: rootErr } = await typed
    .from("np_works")
    .update({ root_node_id: nodeId })
    .eq("id", workId);
  if (rootErr) {
    throw new Error(`failed to set root for promotion: ${rootErr.message}`);
  }

  const { error: linkErr } = await typed
    .from("np_pieces")
    .update({ work_id: workId, node_id: nodeId })
    .eq("id", pieceId);
  if (linkErr) {
    throw new Error(`failed to link piece to work: ${linkErr.message}`);
  }

  return { workId, nodeId };
}
