/**
 * shared types across nova. real database types land via supabase gen types
 * in week 1 (T-005). this file holds hand-rolled api + domain types only.
 */

// the PUBLICATION axis ... exactly the np_pieces.status db CHECK
// (v0_1_0_np_initial). the old 'editing' / 'unpublished' values the db always
// rejected are gone: "editing" was never a publication state, it's the craft
// axis ... see EditorialStage in src/types/editorial.ts (v0_8_0).
export type PieceStatus = "draft" | "published" | "scheduled" | "archived";

export type Visibility = "private" | "unlisted" | "public";

export interface HealthResponse {
  ok: boolean;
  product: "nova-press";
}
