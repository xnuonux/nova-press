import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import type { NodeLink } from "@/types/works";

import { rowToLink } from "@/lib/works/map";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type TypedClient = SupabaseClient<Database>;
type LinkRow = Database["public"]["Tables"]["np_links"]["Row"];

export interface CreateLinkInput {
  workId: string;
  sourceNodeId: string;
  targetNodeId?: string | null;
  targetRef?: string | null;
  relation?: string;
}

// the document navigation plane: a node -> node cross-reference. a [[wiki-link]]
// writes one of these; an unresolved one carries target_ref (a red link) until
// it resolves. distinct from the bible knowledge graph (v0_9_0). RLS-scoped.
export async function createLink(
  client: ServerClient,
  userId: string,
  input: CreateLinkInput,
): Promise<NodeLink> {
  const typed = client as unknown as TypedClient;
  const { data, error } = await typed
    .from("np_links")
    .insert({
      user_id: userId,
      work_id: input.workId,
      source_node_id: input.sourceNodeId,
      target_node_id: input.targetNodeId ?? null,
      target_ref: input.targetRef ?? null,
      relation: input.relation ?? "see_also",
    })
    .select("*")
    .single();
  if (error) {
    throw new Error(`failed to create np_links row: ${error.message}`);
  }
  return rowToLink(data as LinkRow);
}

// what this node points at (see-also, cross-ref, cognate-of, ...).
export async function outgoingLinks(
  client: ServerClient,
  workId: string,
  sourceNodeId: string,
): Promise<NodeLink[]> {
  const typed = client as unknown as TypedClient;
  const { data, error } = await typed
    .from("np_links")
    .select("*")
    .eq("work_id", workId)
    .eq("source_node_id", sourceNodeId);
  if (error) {
    throw new Error(`failed to list outgoing links: ${error.message}`);
  }
  return (data ?? []).map((r) => rowToLink(r as LinkRow));
}

// "what links here" ... every node that points AT this one (the np_links_target_idx).
export async function backlinks(
  client: ServerClient,
  workId: string,
  targetNodeId: string,
): Promise<NodeLink[]> {
  const typed = client as unknown as TypedClient;
  const { data, error } = await typed
    .from("np_links")
    .select("*")
    .eq("work_id", workId)
    .eq("target_node_id", targetNodeId);
  if (error) {
    throw new Error(`failed to list backlinks: ${error.message}`);
  }
  return (data ?? []).map((r) => rowToLink(r as LinkRow));
}

// resolve a red link: a [[ref]] that pointed at a target_ref now binds to a real
// node. RLS-scoped; only the owner's links update.
export async function resolveLink(
  client: ServerClient,
  linkId: string,
  targetNodeId: string,
): Promise<void> {
  const typed = client as unknown as TypedClient;
  const { error } = await typed
    .from("np_links")
    .update({ target_node_id: targetNodeId, target_ref: null })
    .eq("id", linkId);
  if (error) {
    throw new Error(`failed to resolve link: ${error.message}`);
  }
}
