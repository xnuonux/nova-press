// nova press · the mythos · the editorial brain domain (the craft axis).
//
// the craft axis is orthogonal to the publication status (src/types/index.ts):
// a piece can be a published draft still in line-editing, or an unpublished one
// already at proof. a PASS is one review run over a piece at a stage ... the
// lenses' findings + the source watermark that makes a pass go stale when the
// writer edits past it. matches supabase/migrations/v0_8_0_np_editorial.sql.

/** the editorial ladder, in order. matches the np_pieces.editorial_stage CHECK
 *  + the np_editorial_passes.stage CHECK. */
export type EditorialStage =
  | "drafting"
  | "developmental"
  | "line"
  | "copy"
  | "proof"
  | "typeset"
  | "exported";

/** a finding is descriptive-first, never an "error". a note observes; a flag
 *  asks the writer to look. severity is the loudest a lens may ever be. */
export type FindingSeverity = "note" | "flag";

/** the pass-panel triage state of a single finding. */
export type FindingStatus = "open" | "accepted" | "dismissed";

/** where a finding points. a finding is scoped to the whole piece, one block,
 *  or a character range within the plain text ... never vaguer than that. */
export interface FindingScope {
  /** the block index in the plate Value, when the finding is block-scoped. */
  blockIndex?: number;
  /** a character range in the piece's plain text, when finer than a block. */
  range?: { start: number; end: number };
}

/** one observation from one lens. lowercase, voice-keeper'd, scoped, triable. */
export interface Finding {
  /** the lens that produced it (mechanical, voice-drift, structure, ...). */
  lens: string;
  /** the message, lowercase + in nova's voice. descriptive, not imperative. */
  message: string;
  severity: FindingSeverity;
  scope: FindingScope;
  /** triage state; defaults to open until the writer accepts / dismisses it. */
  status: FindingStatus;
}

/** one editorial pass over a piece at a stage (np_editorial_passes). */
export interface EditorialPass {
  id: string;
  userId: string;
  pieceId: string;
  stage: EditorialStage;
  findings: Finding[];
  /** which lenses produced this pass (audit + selective re-run). */
  lensKeys: string[];
  /** the staleness watermark: the piece's last_edited_at when the pass ran. */
  sourceEditedAt: string;
  /** model / token / provenance bag (np_editorial_passes.pass_metadata). */
  passMetadata: Record<string, unknown>;
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
}
