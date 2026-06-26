// nova press · the mythos · the pure structure-tree logic.
//
// no server-only, no db ... just the tree assembly, fractional ordering, subtree
// collection, and skeleton flattening. the db layer (src/lib/db/works.ts +
// nodes.ts) leans on these; they are unit-tested in tree.test.ts.

import type { StructureNode, TreeNode } from "@/types/works";
import type { NodeSeed } from "@/lib/forms/types";

// sibling spacing; a midpoint subdivides the gap so an insert/move is one row
// update, never a re-number of the whole list.
const POSITION_GAP = 1;

/**
 * restitch a flat list of nodes into ordered trees, each node tagged with its
 * depth. roots are nodes whose parentId is null or points outside the set (an
 * orphan surfaces rather than vanishing). cycle-safe: a node is placed once, so
 * a corrupt parent loop can never spin us.
 */
export function buildTree(nodes: readonly StructureNode[]): TreeNode[] {
  const byId = new Map<string, StructureNode>();
  for (const n of nodes) byId.set(n.id, n);

  const childrenOf = new Map<string | null, StructureNode[]>();
  for (const n of nodes) {
    const key = n.parentId != null && byId.has(n.parentId) ? n.parentId : null;
    const arr = childrenOf.get(key) ?? [];
    arr.push(n);
    childrenOf.set(key, arr);
  }

  const sortSiblings = (a: StructureNode, b: StructureNode): number =>
    a.position - b.position || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

  const seen = new Set<string>();
  const assemble = (parentKey: string | null, depth: number): TreeNode[] => {
    const kids = (childrenOf.get(parentKey) ?? []).slice().sort(sortSiblings);
    const out: TreeNode[] = [];
    for (const n of kids) {
      if (seen.has(n.id)) continue; // a double-parent / cycle can never loop us
      seen.add(n.id);
      out.push({ ...n, depth, children: assemble(n.id, depth + 1) });
    }
    return out;
  };
  return assemble(null, 0);
}

/**
 * a fractional position between two siblings (lexorank-style midpoint). insert
 * at the head, the tail, between two, or into an empty list ... always one row
 * update, the list never renumbers.
 */
export function midpointPosition(before: number | null, after: number | null): number {
  if (before != null && after != null) return (before + after) / 2;
  if (before != null) return before + POSITION_GAP;
  if (after != null) return after - POSITION_GAP;
  return 0;
}

/** every id in the subtree rooted at rootId, including rootId. the spine has no
 *  FK cascade, so a subtree delete is app-managed off this. cycle-safe. */
export function collectSubtreeIds(nodes: readonly StructureNode[], rootId: string): string[] {
  const childrenOf = new Map<string, StructureNode[]>();
  for (const n of nodes) {
    if (n.parentId == null) continue;
    const arr = childrenOf.get(n.parentId) ?? [];
    arr.push(n);
    childrenOf.set(n.parentId, arr);
  }
  const out: string[] = [];
  const seen = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop();
    if (id == null || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    for (const c of childrenOf.get(id) ?? []) stack.push(c.id);
  }
  return out;
}

/** a node to insert when seeding a form skeleton (always parent-before-child). */
export interface SeedSpec {
  tempId: string;
  parentTempId: string | null;
  nodeType: string;
  title: string;
  position: number;
  isLeaf: boolean;
  pieceKind?: string;
}

/**
 * flatten a form's skeleton (src/lib/forms/registry.ts) into an ordered insert
 * list, parents first, with fractional positions among siblings. createWork
 * resolves each tempId to a real id as it inserts, wiring parent_id.
 */
export function flattenSkeleton(seeds: readonly NodeSeed[]): SeedSpec[] {
  const out: SeedSpec[] = [];
  let counter = 0;
  const walk = (nodes: readonly NodeSeed[], parentTempId: string | null): void => {
    nodes.forEach((seed, i) => {
      const tempId = `seed-${counter}`;
      counter += 1;
      out.push({
        tempId,
        parentTempId,
        nodeType: seed.nodeType,
        title: seed.title,
        position: (i + 1) * POSITION_GAP,
        isLeaf: seed.isLeaf ?? false,
        pieceKind: seed.pieceKind,
      });
      if (seed.children && seed.children.length > 0) walk(seed.children, tempId);
    });
  };
  walk(seeds, null);
  return out;
}
