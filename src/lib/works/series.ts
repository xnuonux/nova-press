// pure series-graph helpers over a flat list of {id, parentWorkId}. a work joins a
// series by pointing parent_work_id at another work (a "Work-of-Works"); this
// computes the descendants of a work (so the UI can forbid attaching it under its
// own child) and whether a proposed attach would close a cycle. no db imports, so
// it's unit-tested headless; the series db layer feeds it the user's flat work
// list.

export interface SeriesNode {
  id: string;
  parentWorkId: string | null;
}

/**
 * every work reachable downward from rootId (its children, their children, ...),
 * NOT including rootId itself. cycle-safe ... a malformed pre-existing loop in the
 * data terminates instead of spinning.
 */
export function descendantIds(nodes: readonly SeriesNode[], rootId: string): Set<string> {
  const childrenOf = new Map<string, string[]>();
  for (const n of nodes) {
    if (!n.parentWorkId) continue;
    const arr = childrenOf.get(n.parentWorkId) ?? [];
    arr.push(n.id);
    childrenOf.set(n.parentWorkId, arr);
  }

  const out = new Set<string>();
  const stack = [...(childrenOf.get(rootId) ?? [])];
  while (stack.length > 0) {
    const id = stack.pop() as string;
    if (out.has(id)) continue;
    out.add(id);
    for (const child of childrenOf.get(id) ?? []) stack.push(child);
  }
  return out;
}

/**
 * would attaching workId under parentId close a cycle? true when parentId IS
 * workId, or is a descendant of workId (so the parent chain would loop back). a
 * null parent (a detach) never cycles.
 */
export function wouldCycle(
  nodes: readonly SeriesNode[],
  workId: string,
  parentId: string | null,
): boolean {
  if (!parentId) return false;
  if (parentId === workId) return true;
  return descendantIds(nodes, workId).has(parentId);
}

/**
 * the works a given work may legally attach under: every other work, minus itself
 * and minus its own descendants (either would cycle). returns the candidate ids;
 * the caller pairs them with titles for the picker.
 */
export function parentCandidateIds(nodes: readonly SeriesNode[], workId: string): string[] {
  const blocked = descendantIds(nodes, workId);
  return nodes.map((n) => n.id).filter((id) => id !== workId && !blocked.has(id));
}
