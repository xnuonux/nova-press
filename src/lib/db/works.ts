import "server-only";

import { randomBytes } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/supabase";
import type { Work, TreeNode } from "@/types/works";

import { coercePlateValue, plateText } from "@/components/editor/plate-text";
import { getForm } from "@/lib/forms/constraints";
import { rowToWork, rowToNode } from "@/lib/works/map";
import {
  buildTree,
  flattenSkeleton,
  rollupWordCounts,
  flattenForReading,
  pruneEmptyReading,
} from "@/lib/works/tree";
import { listNodesForWork, listNodeRollupRows } from "./nodes";
import { slugify, slugWithSuffix } from "./slug";

// the np_nodes columns the reading tree needs ... explicitly NOT user_id, so the
// service-role read never pulls an owner column into memory (matching the
// piece-reader discipline). rowToNode tolerates the absent user_id (it maps to
// undefined, which the reading projection never reads).
const READING_NODE_COLUMNS =
  "id, work_id, parent_id, node_type, title, position, is_leaf, piece_id, child_work_id, record, synopsis, canon, word_count, status, node_metadata, created_at, updated_at";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type TypedClient = SupabaseClient<Database>;
type WorkRow = Database["public"]["Tables"]["np_works"]["Row"];
type NodeRow = Database["public"]["Tables"]["np_nodes"]["Row"];

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

// patch a work's settings / metadata jsonb (RLS owner-scoped). settings carries
// per-form payloads ... the conlang phonology rides settings.phonology. the caller
// merges (read-modify-write) so a patch never clobbers a sibling key.
export async function updateWork(
  client: ServerClient,
  workId: string,
  patch: Partial<{ settings: Record<string, unknown>; metadata: Record<string, unknown> }>,
): Promise<void> {
  const typed = client as unknown as TypedClient;
  const update: Database["public"]["Tables"]["np_works"]["Update"] = {};
  if (patch.settings !== undefined) update.settings = patch.settings as unknown as Json;
  if (patch.metadata !== undefined) update.metadata = patch.metadata as unknown as Json;
  if (Object.keys(update).length === 0) return;
  const { error } = await typed.from("np_works").update(update).eq("id", workId);
  if (error) {
    throw new Error(`failed to update np_works: ${error.message}`);
  }
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

// roll the work's leaf word counts up the tree: each node's word_count becomes
// its subtree total, the work's word_count the grand total. the leaf source is
// the bound piece (np_pieces.word_count, derived server-side on autosave), so
// the count is always real words, never a client claim. only rows whose total
// actually drifted are written. RLS scopes every read + write to the caller.
// called from the editor's save action when a piece belongs to a Work; a
// standalone library piece never triggers it, so /editor carries zero extra cost.
export async function recomputeWorkWordCounts(
  client: ServerClient,
  workId: string,
): Promise<{ workTotal: number }> {
  const typed = client as unknown as TypedClient;
  const nodes = await listNodeRollupRows(client, workId);

  // a leaf's words live on its piece; map both node_id and piece id -> count so
  // a leaf resolves whichever way it was bound.
  const { data: pieces, error } = await typed
    .from("np_pieces")
    .select("id, node_id, word_count")
    .eq("work_id", workId);
  if (error) {
    throw new Error(`failed to read piece counts: ${error.message}`);
  }
  const byNodeId = new Map<string, number>();
  const byPieceId = new Map<string, number>();
  for (const p of pieces ?? []) {
    if (p.node_id) byNodeId.set(p.node_id, p.word_count ?? 0);
    byPieceId.set(p.id, p.word_count ?? 0);
  }

  const leafCounts = new Map<string, number>();
  for (const n of nodes) {
    if (!n.isLeaf) continue;
    const count = byNodeId.get(n.id) ?? (n.pieceId ? byPieceId.get(n.pieceId) : undefined) ?? 0;
    leafCounts.set(n.id, count);
  }

  const { totals, workTotal } = rollupWordCounts(nodes, leafCounts);

  // write back only the nodes whose stored count drifted (most saves touch one
  // leaf + its ancestor chain, so this is a handful of rows, not the whole tree).
  for (const n of nodes) {
    const next = totals.get(n.id) ?? 0;
    if (next === n.wordCount) continue;
    const { error: upErr } = await typed
      .from("np_nodes")
      .update({ word_count: next })
      .eq("id", n.id);
    if (upErr) {
      throw new Error(`failed to update node word_count: ${upErr.message}`);
    }
  }

  // gate the work write the same way the node writes are gated: the stored work
  // total is the sum of the root nodes' stored counts (recompute is the sole
  // writer of both), so when it already equals workTotal a save changed no
  // counts ... skip the round-trip + the updated_at bump it would churn. root =
  // parentId null or pointing outside the set (mirrors the orphan-as-root rule).
  const idSet = new Set(nodes.map((n) => n.id));
  const prevWorkTotal = nodes
    .filter((n) => n.parentId == null || !idSet.has(n.parentId))
    .reduce((sum, n) => sum + n.wordCount, 0);

  if (workTotal !== prevWorkTotal) {
    const { error: workErr } = await typed
      .from("np_works")
      .update({ word_count: workTotal })
      .eq("id", workId);
    if (workErr) {
      throw new Error(`failed to update work word_count: ${workErr.message}`);
    }
  }

  return { workTotal };
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

// publish a Work to /w/[slug]. owner-scoped via RLS (.eq id), mirroring
// publishPiece exactly: resolve a globally-unique slug against the partial
// unique index (np_works_published_slug_uniq), retrying with a short suffix on a
// 23505 collision, and keep an already-published work's slug stable across
// re-publishes. an empty work (no rolled-up words) can't ship ... the public
// reading view would have nothing to read.
export async function publishWork(client: ServerClient, workId: string): Promise<{ slug: string }> {
  const typed = client as unknown as TypedClient;

  const work = await getWorkById(client, workId);
  if (!work) {
    throw new Error("work not found");
  }
  if (work.wordCount <= 0) {
    throw new Error("can't publish an empty work ... write a page or two first");
  }

  const baseSlug = work.slug ?? slugify(work.title);
  const nowIso = new Date().toISOString();

  let candidate = baseSlug;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data, error } = await typed
      .from("np_works")
      .update({
        slug: candidate,
        status: "published",
        visibility: "public",
        published_at: work.publishedAt ?? nowIso,
      })
      .eq("id", workId)
      .select("slug")
      .maybeSingle();
    if (!error) {
      // a null row back means the write matched nothing ... RLS filtered us out
      // or the row vanished between the read and the update.
      if (!data) {
        throw new Error("failed to publish: work not found or not owned");
      }
      return { slug: data.slug ?? candidate };
    }
    if (error.code !== "23505") {
      throw new Error(`failed to publish np_works row: ${error.message}`);
    }
    // a published work keeps its stable slug, so a collision on its own slug is a
    // real conflict, not a fresh-name race ... don't spin a new suffix.
    if (work.status === "published") {
      throw new Error("failed to publish: slug already in use");
    }
    candidate = slugWithSuffix(baseSlug, randomBytes(3).toString("hex"));
  }
  throw new Error("failed to publish: could not find a free slug");
}

/** one rendered section of a published Work ... a container heading or a leaf
 *  whose body renders beneath it. `body` is the raw stored jsonb (the page
 *  coerces it), null for a container. */
export interface PublishedWorkSection {
  id: string;
  title: string;
  depth: number;
  isLeaf: boolean;
  /** the raw stored jsonb leaf body (the page coerces it); null for a container. */
  body: unknown;
}

export interface PublishedWork {
  title: string;
  slug: string;
  publishedAt: string | null;
  wordCount: number;
  sections: PublishedWorkSection[];
}

export interface WorkExport {
  title: string;
  /** the work's form ("novel", "encyclopaedia", ...) ... the typeset title
   *  page names it; docx/epub ignore it. */
  formProfile: string;
  sections: PublishedWorkSection[];
}

// the OWNER's read for export (docx / epub). RLS-scoped via the authed client,
// so a writer only ever exports their own Work ... a stranger's id returns null.
// unlike the public reader this has NO published gate (you export your drafts)
// and NO empty-prune (the export is your full manuscript, scaffold and all).
export async function getWorkSectionsForOwner(
  client: ServerClient,
  workId: string,
): Promise<WorkExport | null> {
  const typed = client as unknown as TypedClient;

  const work = await getWorkById(client, workId);
  if (!work) {
    return null;
  }

  const skeleton = flattenForReading(await getWorkTree(client, workId));
  const leafPieceIds = skeleton
    .filter((s) => s.isLeaf && s.pieceId)
    .map((s) => s.pieceId as string);
  const bodyByPiece = new Map<string, unknown>();
  if (leafPieceIds.length > 0) {
    const { data: pieces, error } = await typed
      .from("np_pieces")
      .select("id, body")
      .eq("work_id", workId)
      .in("id", leafPieceIds);
    if (error) {
      throw new Error(`failed to read work pieces for export: ${error.message}`);
    }
    for (const p of pieces ?? []) {
      bodyByPiece.set(p.id, p.body);
    }
  }

  const sections: PublishedWorkSection[] = skeleton.map((s) => ({
    id: s.id,
    title: s.title,
    depth: s.depth,
    isLeaf: s.isLeaf,
    body: s.isLeaf && s.pieceId ? (bodyByPiece.get(s.pieceId) ?? null) : null,
  }));

  return { title: work.title, formProfile: work.formProfile, sections };
}

// the public read for /w/[slug]. MUST run on the service-role (admin) client:
// the reader is anonymous and np_works / np_nodes / np_pieces are all RLS
// owner-only, so an owner-scoped client returns nothing for a stranger. the
// WHERE gate on the WORK (published + shareable) is the real boundary; once the
// work passes, its whole tree + leaf bodies are readable (publishing a work
// publishes its contents). never selects user_id or any owner column.
export async function getPublishedWorkBySlug(
  admin: TypedClient,
  slug: string,
): Promise<PublishedWork | null> {
  const { data: work, error } = await admin
    .from("np_works")
    .select("id, title, slug, published_at, word_count")
    .eq("slug", slug)
    .eq("status", "published")
    .in("visibility", ["unlisted", "public"])
    .maybeSingle();
  if (error) {
    throw new Error(`failed to fetch published work: ${error.message}`);
  }
  if (!work) {
    return null;
  }

  // the node tree, ordered by sibling position, restitched + flattened into
  // reading order (the work gate above is the boundary, not these reads). the
  // explicit column set keeps user_id off the service-role payload.
  const { data: nodeRows, error: nodeErr } = await admin
    .from("np_nodes")
    .select(READING_NODE_COLUMNS)
    .eq("work_id", work.id)
    .order("position", { ascending: true });
  if (nodeErr) {
    throw new Error(`failed to fetch published work nodes: ${nodeErr.message}`);
  }
  const nodes = (nodeRows ?? []).map((r) => rowToNode(r as unknown as NodeRow));
  const skeleton = flattenForReading(buildTree(nodes));

  // the leaf bodies, by piece id. scoped to THIS work (work_id), so a stray /
  // forged piece_id pointer can never resolve another owner's piece on this
  // rls-bypassed read ... the where-clause does the ownership scoping, never the
  // unvalidated pointer. only id + body, never user_id / owner columns.
  const leafPieceIds = skeleton
    .filter((s) => s.isLeaf && s.pieceId)
    .map((s) => s.pieceId as string);
  const bodyByPiece = new Map<string, unknown>();
  if (leafPieceIds.length > 0) {
    const { data: pieces, error: pieceErr } = await admin
      .from("np_pieces")
      .select("id, body")
      .eq("work_id", work.id)
      .in("id", leafPieceIds);
    if (pieceErr) {
      throw new Error(`failed to fetch published work bodies: ${pieceErr.message}`);
    }
    for (const p of pieces ?? []) {
      bodyByPiece.set(p.id, p.body);
    }
  }

  // a published work shows only what's written: drop empty leaves + the
  // containers they leave hollow, so the reading view never dangles a bare
  // "scene 1" marker over an unwritten placeholder.
  const hasText = (s: { isLeaf: boolean; pieceId: string | null }): boolean => {
    if (!s.isLeaf || !s.pieceId) return false;
    return plateText(coercePlateValue(bodyByPiece.get(s.pieceId))).trim().length > 0;
  };
  const sections: PublishedWorkSection[] = pruneEmptyReading(skeleton, hasText).map((s) => ({
    id: s.id,
    title: s.title,
    depth: s.depth,
    isLeaf: s.isLeaf,
    body: s.isLeaf && s.pieceId ? (bodyByPiece.get(s.pieceId) ?? null) : null,
  }));

  return {
    title: work.title,
    slug: work.slug as string,
    publishedAt: work.published_at,
    wordCount: work.word_count,
    sections,
  };
}
