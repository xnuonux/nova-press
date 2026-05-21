/**
 * shared types across nova. real database types land via supabase gen types
 * in week 1 (T-005). this file holds hand-rolled api + domain types only.
 */

export type PieceStatus =
  | "draft"
  | "editing"
  | "published"
  | "scheduled"
  | "unpublished"
  | "archived";

export type Visibility = "private" | "unlisted" | "public";

export interface HealthResponse {
  ok: boolean;
  product: "nova-press";
}
