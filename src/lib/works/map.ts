// nova press · the mythos · row <-> domain mappers.
//
// the db layer speaks the generated snake_case Row types (src/types/supabase.ts);
// the app speaks the camelCase domain (src/types/works.ts). these three mappers
// are the one translation seam. pure (no server-only) so they are unit-testable.

import type { Database } from "@/types/supabase";
import type {
  Work,
  StructureNode,
  NodeLink,
  WorkStatus,
  Visibility,
  CanonMode,
  FormFamily,
  NodeStatus,
} from "@/types/works";

type WorkRow = Database["public"]["Tables"]["np_works"]["Row"];
type NodeRow = Database["public"]["Tables"]["np_nodes"]["Row"];
type LinkRow = Database["public"]["Tables"]["np_links"]["Row"];

// jsonb columns come back as Json (which includes arrays + primitives). the
// domain wants a plain object; anything that is not an object coerces to {}.
function asObj(j: unknown): Record<string, unknown> {
  return j != null && typeof j === "object" && !Array.isArray(j)
    ? (j as Record<string, unknown>)
    : {};
}

export function rowToWork(r: WorkRow): Work {
  return {
    id: r.id,
    userId: r.user_id,
    title: r.title,
    formProfile: r.form_profile,
    family: r.family as FormFamily | null,
    slug: r.slug,
    status: r.status as WorkStatus,
    visibility: r.visibility as Visibility,
    parentWorkId: r.parent_work_id,
    bibleWorkId: r.bible_work_id,
    canonMode: r.canon_mode as CanonMode,
    rootNodeId: r.root_node_id,
    wordCount: r.word_count,
    settings: asObj(r.settings),
    metadata: asObj(r.metadata),
    publishedAt: r.published_at,
    scheduledPublishAt: r.scheduled_publish_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function rowToNode(r: NodeRow): StructureNode {
  return {
    id: r.id,
    userId: r.user_id,
    workId: r.work_id,
    parentId: r.parent_id,
    nodeType: r.node_type,
    title: r.title,
    position: r.position,
    isLeaf: r.is_leaf,
    pieceId: r.piece_id,
    childWorkId: r.child_work_id,
    record: asObj(r.record),
    synopsis: r.synopsis,
    canon: r.canon,
    wordCount: r.word_count,
    status: r.status as NodeStatus,
    nodeMetadata: asObj(r.node_metadata),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function rowToLink(r: LinkRow): NodeLink {
  return {
    id: r.id,
    userId: r.user_id,
    workId: r.work_id,
    sourceNodeId: r.source_node_id,
    targetNodeId: r.target_node_id,
    targetRef: r.target_ref,
    relation: r.relation,
    context: asObj(r.context),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
