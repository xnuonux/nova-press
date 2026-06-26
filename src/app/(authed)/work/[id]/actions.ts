"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { listNodesForWork, createLeafNode, moveNode } from "@/lib/db/nodes";
import { midpointPosition } from "@/lib/works/tree";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// add a fresh leaf (a page) under a parent node, or at the root when parentId is
// blank. the new piece is minted + bound by createLeafNode, so opening the leaf
// drops straight into the existing editor. invoked from a binder form, so it
// re-checks session defensively and refreshes the binder via revalidatePath.
export async function createLeafAction(formData: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const workId = String(formData.get("workId") ?? "");
  if (!workId) return;
  const parentRaw = formData.get("parentId");
  const parentId = parentRaw && String(parentRaw) ? String(parentRaw) : null;
  const nodeType = String(formData.get("nodeType") ?? "document");
  const pieceKind = String(formData.get("pieceKind") ?? "prose");
  const title = String(formData.get("title") ?? "untitled page");

  // append after the last sibling (fractional, so no renumber).
  const nodes = await listNodesForWork(supabase, workId);
  const siblings = nodes.filter((n) => n.parentId === parentId);
  const lastPos = siblings.length > 0 ? Math.max(...siblings.map((s) => s.position)) : 0;

  await createLeafNode(supabase, user.id, {
    workId,
    parentId,
    nodeType,
    title,
    position: lastPos + 1,
    pieceKind,
  });

  revalidatePath(`/work/${workId}`);
}

// nudge a node up or down among its siblings ... one row update of the
// fractional position (midpointPosition slots it past its neighbor). a no-op at
// the ends. RLS scopes the write; the binder refreshes via revalidatePath.
export async function reorderNodeAction(formData: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const workId = String(formData.get("workId") ?? "");
  const nodeId = String(formData.get("nodeId") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (!workId || !nodeId || (direction !== "up" && direction !== "down")) return;

  const nodes = await listNodesForWork(supabase, workId);
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return;

  const siblings = nodes
    .filter((n) => n.parentId === node.parentId)
    .sort((a, b) => a.position - b.position);
  const idx = siblings.findIndex((s) => s.id === nodeId);

  if (direction === "up" && idx > 0) {
    const prev = siblings[idx - 1]!;
    const beforePrev = siblings[idx - 2] ?? null;
    await moveNode(
      supabase,
      nodeId,
      node.parentId,
      midpointPosition(beforePrev?.position ?? null, prev.position),
    );
  } else if (direction === "down" && idx >= 0 && idx < siblings.length - 1) {
    const next = siblings[idx + 1]!;
    const afterNext = siblings[idx + 2] ?? null;
    await moveNode(
      supabase,
      nodeId,
      node.parentId,
      midpointPosition(next.position, afterNext?.position ?? null),
    );
  }

  revalidatePath(`/work/${workId}`);
}
