// nova press · the mythos · the scrivener import (the db arm).
//
// walk an assembled scrivener draft (src/lib/scrivener/project.ts) into a
// real Work on the universal np_nodes tree: a binder folder becomes a
// container node (part at the top, chapter below), a text document becomes a
// scene leaf whose piece carries the imported paragraphs. runs on the SESSION
// client ... RLS stamps everything into the caller's own library, exactly like
// hand-built works. a text doc that scrivener let carry children imports as a
// chapter holding its own prose as the first scene, so no words are dropped.

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Value } from "platejs";

import { deriveExcerpt } from "@/components/editor/plate-text";
import { getForm } from "@/lib/forms/constraints";
import type { ImportedItem, ImportedProject } from "@/lib/scrivener/project";
import { countWords } from "@/lib/utils";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

import { createNode, createLeafNode } from "./nodes";
import { savePieceContent, type PieceContentUpdate } from "./pieces";
import { recomputeWorkWordCounts } from "./works";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type TypedClient = SupabaseClient<Database>;

/** imported paragraphs as a plate value ... plain paragraphs, the writer's own
 *  characters kept as written. an empty doc is one empty paragraph (a valid,
 *  openable page). */
export function paragraphsToValue(paragraphs: readonly string[]): Value {
  if (paragraphs.length === 0) {
    return [{ type: "p", children: [{ text: "" }] }] as unknown as Value;
  }
  return paragraphs.map((text) => ({ type: "p", children: [{ text }] })) as unknown as Value;
}

async function importLeaf(
  client: ServerClient,
  userId: string,
  workId: string,
  parentId: string | null,
  item: ImportedItem,
  position: number,
): Promise<number> {
  const { pieceId } = await createLeafNode(client, userId, {
    workId,
    parentId,
    nodeType: "scene",
    title: item.title,
    position,
    pieceKind: "scene",
  });
  const text = item.paragraphs.join("\n");
  const update: PieceContentUpdate = {
    title: item.title,
    body: paragraphsToValue(item.paragraphs) as unknown as PieceContentUpdate["body"],
    word_count: countWords(text),
    excerpt: deriveExcerpt(paragraphsToValue(item.paragraphs)),
  };
  await savePieceContent(client, pieceId, update);
  return 1;
}

async function importItems(
  client: ServerClient,
  userId: string,
  workId: string,
  parentId: string | null,
  items: readonly ImportedItem[],
  depth: number,
): Promise<number> {
  let pages = 0;
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]!;
    const position = i + 1;

    if (item.isText && item.children.length === 0) {
      pages += await importLeaf(client, userId, workId, parentId, item, position);
      continue;
    }

    // a folder ... or a text doc scrivener let hold children (its prose
    // becomes the first scene under it, so nothing is lost).
    const node = await createNode(client, userId, {
      workId,
      parentId,
      nodeType: depth === 0 ? "part" : "chapter",
      title: item.title,
      position,
      isLeaf: false,
    });
    if (item.isText) {
      pages += await importLeaf(client, userId, workId, node.id, item, 0.5);
    }
    pages += await importItems(client, userId, workId, node.id, item.children, depth + 1);
  }
  return pages;
}

/**
 * land a whole assembled scrivener draft as a new novel-profile Work. returns
 * the work + how many pages (leaves) imported. the work row is inserted
 * directly ... the binder IS the skeleton, so the form's seeded scaffold
 * would only collide with it.
 *
 * all-or-nothing at the WORK level: a failure mid-tree walks the whole import
 * back (pieces, nodes, then the work row) so a half-imported manuscript never
 * strands in the library. the rollback is best-effort ... if it too fails,
 * the original error still surfaces and the orphans are RLS-invisible noise
 * the writer can delete.
 */
export async function importScrivenerProject(
  client: ServerClient,
  userId: string,
  project: ImportedProject,
): Promise<{ workId: string; pages: number }> {
  const typed = client as unknown as TypedClient;
  const form = getForm("novel");

  const { data: work, error } = await typed
    .from("np_works")
    .insert({
      user_id: userId,
      title: project.title,
      form_profile: "novel",
      family: form ? form.family : null,
    })
    .select("id")
    .single();
  if (error) {
    throw new Error(`failed to create imported np_works row: ${error.message}`);
  }

  let pages = 0;
  try {
    pages = await importItems(client, userId, work.id, null, project.items, 0);

    // the imported words roll up once, so the binder cards + the work header
    // are right on first open (autosave keeps them right from then on).
    await recomputeWorkWordCounts(client, work.id);
  } catch (err) {
    // walk the partial import back: pieces then nodes then the work (the
    // reverse of how they landed, so nothing dangles mid-delete).
    await typed.from("np_pieces").delete().eq("work_id", work.id);
    await typed.from("np_nodes").delete().eq("work_id", work.id);
    await typed.from("np_works").delete().eq("id", work.id);
    throw err;
  }

  return { workId: work.id, pages };
}
