import "server-only";

import {
  lexemeToRecord,
  normalizeLexeme,
  recordToLexeme,
  type LexemeDraft,
  type LexemeView,
} from "@/lib/conlang/lexeme";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

import { createNode, deleteNodeSubtree, getNodeById, listNodesForWork, updateNode } from "./nodes";

// the conlang lexicon db layer ... a work's words are node_type "lexeme"
// record-leaves on the universal np_nodes tree (the record jsonb holds the
// LEXEME_SCHEMA shape, no prose piece). RLS owner-scopes every read + write; reads
// NEVER throw (a degraded read yields []); writes return a discriminated result.
// this rides the existing node model, so no new table + no migration.

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export interface LexemeEntry extends LexemeView {
  nodeId: string;
}

export type LexiconResult = { ok: true; nodeId: string } | { ok: false; error: string };

/** the work's lexicon, headword-ordered. RLS owner-scoped. never throws. */
export async function listLexemes(client: ServerClient, workId: string): Promise<LexemeEntry[]> {
  try {
    const nodes = await listNodesForWork(client, workId);
    return nodes
      .filter((n) => n.nodeType === "lexeme")
      .map((n) => ({ nodeId: n.id, ...recordToLexeme(n.record) }))
      .filter((l) => l.headword.length > 0)
      .sort((a, b) => a.headword.localeCompare(b.headword));
  } catch {
    return [];
  }
}

// resolve the parent the lexemes nest under: the conlang skeleton's "lexicon" node,
// else the work's root, else null (a flat lexeme directly under the work).
async function lexiconParentId(client: ServerClient, workId: string): Promise<string | null> {
  const nodes = await listNodesForWork(client, workId);
  const lexicon = nodes.find((n) => n.nodeType === "lexicon");
  if (lexicon) return lexicon.id;
  const root = nodes.find((n) => n.parentId === null);
  return root ? root.id : null;
}

/** add a lexeme (a word-record) to the work's lexicon. */
export async function addLexeme(
  client: ServerClient,
  userId: string,
  workId: string,
  draft: LexemeDraft,
): Promise<LexiconResult> {
  const norm = normalizeLexeme(draft);
  if (!norm.ok || !norm.lexeme) {
    return { ok: false, error: norm.error ?? "couldn't read that lexeme." };
  }
  try {
    const parentId = await lexiconParentId(client, workId);
    const node = await createNode(client, userId, {
      workId,
      parentId,
      nodeType: "lexeme",
      title: norm.lexeme.headword,
      isLeaf: true,
      record: lexemeToRecord(norm.lexeme),
    });
    return { ok: true, nodeId: node.id };
  } catch {
    return { ok: false, error: "couldn't save that lexeme ... try again." };
  }
}

/** edit a lexeme in place, scoped to this work + the lexeme node_type (RLS owns). */
export async function updateLexeme(
  client: ServerClient,
  workId: string,
  nodeId: string,
  draft: LexemeDraft,
): Promise<LexiconResult> {
  const norm = normalizeLexeme(draft);
  if (!norm.ok || !norm.lexeme) {
    return { ok: false, error: norm.error ?? "couldn't read that lexeme." };
  }
  try {
    const node = await getNodeById(client, nodeId);
    if (!node || node.workId !== workId || node.nodeType !== "lexeme") {
      return { ok: false, error: "couldn't find that lexeme." };
    }
    await updateNode(client, nodeId, {
      title: norm.lexeme.headword,
      record: lexemeToRecord(norm.lexeme),
    });
    return { ok: true, nodeId };
  } catch {
    return { ok: false, error: "couldn't save that lexeme ... try again." };
  }
}

/** remove a lexeme from the lexicon. scoped to this work + the lexeme node_type. */
export async function deleteLexeme(
  client: ServerClient,
  workId: string,
  nodeId: string,
): Promise<LexiconResult> {
  try {
    const node = await getNodeById(client, nodeId);
    if (!node || node.workId !== workId || node.nodeType !== "lexeme") {
      return { ok: false, error: "couldn't find that lexeme." };
    }
    await deleteNodeSubtree(client, workId, nodeId);
    return { ok: true, nodeId };
  } catch {
    return { ok: false, error: "couldn't remove that lexeme ... try again." };
  }
}
