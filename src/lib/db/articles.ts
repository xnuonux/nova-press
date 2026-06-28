import "server-only";

import {
  infoboxToRecord,
  normalizeInfobox,
  recordToInfobox,
  type InfoboxDraft,
  type InfoboxView,
} from "@/lib/encyclopaedia/infobox";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  createLeafNode,
  deleteNodeSubtree,
  getNodeById,
  listNodesForWork,
  updateNode,
} from "./nodes";

// the encyclopaedia article db layer ... an article is a record_prose node on the
// universal np_nodes tree: it carries BOTH an infobox `record` (the INFOBOX_SCHEMA
// shape) AND a prose `piece` (the body, edited in the normal editor). RLS
// owner-scopes every read + write; reads NEVER throw (a degraded read yields []);
// writes return a discriminated result. rides the existing node + piece model, so
// no new table + no migration ... the encyclopaedia form already exists in the
// registry. mirrors db/lexicon.ts.

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export interface ArticleEntry extends InfoboxView {
  nodeId: string;
  pieceId: string | null;
}

export type ArticleResult =
  | { ok: true; nodeId: string; pieceId: string | null }
  | { ok: false; error: string };

/** the work's articles (node_type "article"), title-ordered. RLS owner-scoped.
 *  never throws (a degraded read yields []). */
export async function listArticles(client: ServerClient, workId: string): Promise<ArticleEntry[]> {
  try {
    const nodes = await listNodesForWork(client, workId);
    return nodes
      .filter((n) => n.nodeType === "article")
      .map((n) => ({ nodeId: n.id, pieceId: n.pieceId, ...recordToInfobox(n.record) }))
      .filter((a) => a.title.length > 0)
      .sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()));
  } catch {
    return [];
  }
}

// the parent the articles nest under: the encyclopaedia skeleton's "category" node,
// else the work's root, else null (a flat article directly under the work).
async function articleParentId(client: ServerClient, workId: string): Promise<string | null> {
  const nodes = await listNodesForWork(client, workId);
  const category = nodes.find((n) => n.nodeType === "category");
  if (category) return category.id;
  const root = nodes.find((n) => n.parentId === null);
  return root ? root.id : null;
}

/** add an article: mint its prose piece + leaf node, then stamp the infobox record.
 *  returns the node id + the piece id (so the caller can open the prose editor). */
export async function addArticle(
  client: ServerClient,
  userId: string,
  workId: string,
  draft: InfoboxDraft,
): Promise<ArticleResult> {
  const norm = normalizeInfobox(draft);
  if (!norm.ok || !norm.infobox) {
    return { ok: false, error: norm.error ?? "couldn't read that article." };
  }
  try {
    const parentId = await articleParentId(client, workId);
    // land the node WITH its infobox record in one insert (no second updateNode):
    // a failed two-step used to leave an orphan article node + prose piece that
    // listArticles silently drops and a retry would compound. mirrors lexicon.ts.
    const { node, pieceId } = await createLeafNode(client, userId, {
      workId,
      parentId,
      nodeType: "article",
      title: norm.infobox.title,
      pieceKind: "article",
      record: infoboxToRecord(norm.infobox),
    });
    return { ok: true, nodeId: node.id, pieceId };
  } catch {
    return { ok: false, error: "couldn't save that article ... try again." };
  }
}

/** edit an article's infobox (the prose body is edited separately in the editor).
 *  scoped to this work + the article node_type. */
export async function updateArticleInfobox(
  client: ServerClient,
  workId: string,
  nodeId: string,
  draft: InfoboxDraft,
): Promise<ArticleResult> {
  const norm = normalizeInfobox(draft);
  if (!norm.ok || !norm.infobox) {
    return { ok: false, error: norm.error ?? "couldn't read that article." };
  }
  try {
    const node = await getNodeById(client, nodeId);
    if (!node || node.workId !== workId || node.nodeType !== "article") {
      return { ok: false, error: "couldn't find that article." };
    }
    await updateNode(client, nodeId, {
      title: norm.infobox.title,
      record: infoboxToRecord(norm.infobox),
    });
    return { ok: true, nodeId, pieceId: node.pieceId };
  } catch {
    return { ok: false, error: "couldn't save that article ... try again." };
  }
}

/** remove an article (its prose piece is freed to a standalone library piece by
 *  deleteNodeSubtree). scoped to this work + the article node_type. */
export async function deleteArticle(
  client: ServerClient,
  workId: string,
  nodeId: string,
): Promise<ArticleResult> {
  try {
    const node = await getNodeById(client, nodeId);
    if (!node || node.workId !== workId || node.nodeType !== "article") {
      return { ok: false, error: "couldn't find that article." };
    }
    await deleteNodeSubtree(client, workId, nodeId);
    return { ok: true, nodeId, pieceId: node.pieceId };
  } catch {
    return { ok: false, error: "couldn't remove that article ... try again." };
  }
}
