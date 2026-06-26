import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/supabase";
import type { StructureNode } from "@/types/works";

import { createDraftPiece } from "./pieces";
import { rowToNode } from "@/lib/works/map";
import { collectSubtreeIds } from "@/lib/works/tree";

// same cast trick as pieces.ts: the ssr v0.5 client shape mismatches supabase-js
// v2 generics, so cast once per function to get full Database-typed inference.
type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type TypedClient = SupabaseClient<Database>;
type NodeRow = Database["public"]["Tables"]["np_nodes"]["Row"];

// every node in a work, ordered by sibling position. the binder restitches this
// flat list into a tree client-side (buildTree). RLS scopes to the caller.
export async function listNodesForWork(
  client: ServerClient,
  workId: string,
): Promise<StructureNode[]> {
  const typed = client as unknown as TypedClient;
  const { data, error } = await typed
    .from("np_nodes")
    .select("*")
    .eq("work_id", workId)
    .order("position", { ascending: true });
  if (error) {
    throw new Error(`failed to list np_nodes: ${error.message}`);
  }
  return (data ?? []).map((r) => rowToNode(r as NodeRow));
}

export interface CreateNodeInput {
  workId: string;
  parentId: string | null;
  nodeType: string;
  title?: string;
  position?: number;
  isLeaf?: boolean;
  pieceId?: string | null;
  record?: Record<string, unknown>;
}

// create a structure node. node_type is validated against the form profile by
// the caller (canNest) ... the db only bounds its length. RLS gates the write.
export async function createNode(
  client: ServerClient,
  userId: string,
  input: CreateNodeInput,
): Promise<StructureNode> {
  const typed = client as unknown as TypedClient;
  const insert: Database["public"]["Tables"]["np_nodes"]["Insert"] = {
    user_id: userId,
    work_id: input.workId,
    parent_id: input.parentId,
    node_type: input.nodeType,
    title: input.title ?? "untitled",
    position: input.position ?? 0,
    is_leaf: input.isLeaf ?? false,
    piece_id: input.pieceId ?? null,
  };
  if (input.record !== undefined) {
    insert.record = input.record as unknown as Json;
  }
  const { data, error } = await typed.from("np_nodes").insert(insert).select("*").single();
  if (error) {
    throw new Error(`failed to create np_nodes row: ${error.message}`);
  }
  return rowToNode(data as NodeRow);
}

// a leaf with a body: mint a fresh draft piece and a leaf node bound to it, and
// stamp the piece's denormalized work/node cache + kind. the existing plate
// editor opens on the returned pieceId verbatim ... a leaf IS a piece.
export async function createLeafNode(
  client: ServerClient,
  userId: string,
  input: {
    workId: string;
    parentId: string | null;
    nodeType: string;
    title?: string;
    position?: number;
    pieceKind?: string;
  },
): Promise<{ node: StructureNode; pieceId: string }> {
  const typed = client as unknown as TypedClient;
  const { id: pieceId } = await createDraftPiece(client, userId);
  const node = await createNode(client, userId, {
    workId: input.workId,
    parentId: input.parentId,
    nodeType: input.nodeType,
    title: input.title,
    position: input.position,
    isLeaf: true,
    pieceId,
  });
  const { error } = await typed
    .from("np_pieces")
    .update({ work_id: input.workId, node_id: node.id, kind: input.pieceKind ?? "prose" })
    .eq("id", pieceId);
  if (error) {
    throw new Error(`failed to link leaf piece: ${error.message}`);
  }
  return { node, pieceId };
}

// reorder / renest: one row update of parent_id + the fractional position
// (midpointPosition computes the slot client-side). RLS scopes the write.
export async function moveNode(
  client: ServerClient,
  id: string,
  parentId: string | null,
  position: number,
): Promise<void> {
  const typed = client as unknown as TypedClient;
  const { error } = await typed
    .from("np_nodes")
    .update({ parent_id: parentId, position })
    .eq("id", id);
  if (error) {
    throw new Error(`failed to move node: ${error.message}`);
  }
}

export async function updateNode(
  client: ServerClient,
  id: string,
  patch: {
    title?: string;
    synopsis?: string | null;
    nodeType?: string;
    record?: Record<string, unknown>;
  },
): Promise<void> {
  const typed = client as unknown as TypedClient;
  const update: Database["public"]["Tables"]["np_nodes"]["Update"] = {};
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.synopsis !== undefined) update.synopsis = patch.synopsis;
  if (patch.nodeType !== undefined) update.node_type = patch.nodeType;
  if (patch.record !== undefined) update.record = patch.record as unknown as Json;
  if (Object.keys(update).length === 0) return;
  const { error } = await typed.from("np_nodes").update(update).eq("id", id);
  if (error) {
    throw new Error(`failed to update node: ${error.message}`);
  }
}

// delete a node and its whole subtree. the spine has no FK cascade (plain-uuid,
// so the pg_dump exit ramp stays clean), so the subtree is collected app-side
// and deleted by id. any leaf pieces are freed (work_id/node_id nulled) so they
// survive as standalone library pieces rather than being orphaned.
export async function deleteNodeSubtree(
  client: ServerClient,
  workId: string,
  nodeId: string,
): Promise<{ deleted: number }> {
  const typed = client as unknown as TypedClient;
  const nodes = await listNodesForWork(client, workId);
  const ids = collectSubtreeIds(nodes, nodeId);
  if (ids.length === 0) {
    return { deleted: 0 };
  }
  const idSet = new Set(ids);
  const freedPieceIds = nodes
    .filter((n) => idSet.has(n.id) && n.pieceId)
    .map((n) => n.pieceId as string);
  const { error } = await typed.from("np_nodes").delete().in("id", ids);
  if (error) {
    throw new Error(`failed to delete subtree: ${error.message}`);
  }
  if (freedPieceIds.length > 0) {
    const { error: freeErr } = await typed
      .from("np_pieces")
      .update({ work_id: null, node_id: null })
      .in("id", freedPieceIds);
    if (freeErr) {
      throw new Error(`failed to free subtree pieces: ${freeErr.message}`);
    }
  }
  return { deleted: ids.length };
}
