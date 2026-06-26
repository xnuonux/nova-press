// nova press · the mythos · the universal Work / structure-tree domain.
//
// the one idea: every written thing is a tree of typed units under a form.
// a Work (the project) owns a recursive np_nodes tree; a leaf carries one of
// four payloads ... a prose/verse body (np_pieces), a typed record (jsonb:
// lexeme / infobox / character), a sub-Work (a series volume), or nothing
// (a container). the form vocabulary lives in src/lib/forms/registry.ts;
// the database just stores the tree.
//
// matches supabase/migrations/v0_7_0_np_works.sql. design doc:
// docs/08-editorial-system-architecture.md.

export type WorkStatus = "draft" | "published" | "scheduled" | "archived";
export type Visibility = "private" | "unlisted" | "public";
export type CanonMode = "canon_only" | "include_drafts";
export type NodeStatus = "active" | "archived";

/** the registry "family", cached on the work for fast filtering. */
export type FormFamily = "poem" | "prose" | "reference" | "collection" | "script";

/** np_pieces.kind ... the content-type discriminator the editor + reading view switch on. */
export type PieceKind =
  | "prose"
  | "poem"
  | "chapter"
  | "scene"
  | "entry"
  | "lexeme"
  | "article"
  | "outline"
  | "note"
  | "screenplay";

/** a creative container (np_works). */
export interface Work {
  id: string;
  userId: string;
  title: string;
  /** a FormProfileKey (app-validated against src/lib/forms/registry.ts). */
  formProfile: string;
  family: FormFamily | null;
  slug: string | null;
  status: WorkStatus;
  visibility: Visibility;
  /** series membership ... a Work-of-Works. */
  parentWorkId: string | null;
  /** which work owns the shared bible (a book points at its series). */
  bibleWorkId: string | null;
  canonMode: CanonMode;
  rootNodeId: string | null;
  /** subtree rollup cache. */
  wordCount: number;
  /** per-work form overrides; for a conlang, the phonology + grammar payload. */
  settings: Record<string, unknown>;
  metadata: Record<string, unknown>;
  publishedAt: string | null;
  scheduledPublishAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** a node in the structure tree (np_nodes). */
export interface StructureNode {
  id: string;
  userId: string;
  workId: string;
  parentId: string | null;
  /** app-validated against the form profile (not a db enum). */
  nodeType: string;
  title: string;
  /** fractional ordering among siblings (lexorank-style midpoint). */
  position: number;
  isLeaf: boolean;
  /** prose/verse payload -> np_pieces. */
  pieceId: string | null;
  /** work-ref payload -> np_works (a series volume). */
  childWorkId: string | null;
  /** typed payload (a lexeme / infobox / character sheet). */
  record: Record<string, unknown>;
  /** the corkboard card. */
  synopsis: string | null;
  canon: boolean;
  wordCount: number;
  status: NodeStatus;
  nodeMetadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * which of the four payload shapes a node holds, discriminated by which
 * slots are filled. a node carrying BOTH a piece body and a non-empty
 * record is an encyclopaedia article (infobox + prose) ... "record_prose".
 */
export type NodeShape = "container" | "prose" | "record" | "record_prose" | "work_ref";

export function shapeOf(
  node: Pick<StructureNode, "pieceId" | "childWorkId" | "record">,
): NodeShape {
  const hasPiece = node.pieceId != null;
  const hasRecord = node.record != null && Object.keys(node.record).length > 0;
  const hasWork = node.childWorkId != null;
  if (hasWork) return "work_ref";
  if (hasPiece && hasRecord) return "record_prose";
  if (hasPiece) return "prose";
  if (hasRecord) return "record";
  return "container";
}

/** a document-level cross-reference (np_links) ... the navigation plane. */
export interface NodeLink {
  id: string;
  userId: string;
  workId: string;
  sourceNodeId: string;
  /** null = unresolved (a red link). */
  targetNodeId: string | null;
  /** headword / slug / href when unresolved. */
  targetRef: string | null;
  /** see_also | cross_ref | cognate_of | derives_from | appears_in. */
  relation: string;
  context: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** a node enriched for the binder: depth + restitched children. */
export interface TreeNode extends StructureNode {
  depth: number;
  children: TreeNode[];
}
