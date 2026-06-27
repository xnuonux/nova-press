import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/supabase";
import type { EditorialStage, EditorialPass, Finding } from "@/types/editorial";

import {
  isEditorialStage,
  isPassStale,
  workStage,
  classifyTransition,
} from "@/lib/editorial/stages";
import { evaluateTransition, type TransitionResult } from "@/lib/editorial/state-machine";

// same cast trick as pieces.ts: the ssr client shape mismatches supabase-js v2
// generics, so cast once per function for full Database-typed inference.
type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type TypedClient = SupabaseClient<Database>;
type PassRow = Database["public"]["Tables"]["np_editorial_passes"]["Row"];

// the transition log lives on np_pieces.metadata.editorial.history, trimmed to
// the last N entries (the extraction_history / repurpose trim convention).
const HISTORY_MAX = 20;

// jsonb -> a plain object; anything that is not an object coerces to {}.
function asObj(j: unknown): Record<string, unknown> {
  return j != null && typeof j === "object" && !Array.isArray(j)
    ? (j as Record<string, unknown>)
    : {};
}

// the stored findings jsonb -> Finding[]; a non-array OR a corrupt element (a
// stray null / primitive) is dropped, so a bad write degrades to fewer findings
// rather than throwing downstream in the gate (openFlagCount). mirrors asStrings.
function asFindings(j: unknown): Finding[] {
  return Array.isArray(j) ? (j.filter((x) => x != null && typeof x === "object") as Finding[]) : [];
}

function asStrings(j: unknown): string[] {
  return Array.isArray(j) ? j.filter((x): x is string => typeof x === "string") : [];
}

export function rowToPass(r: PassRow): EditorialPass {
  return {
    id: r.id,
    userId: r.user_id,
    pieceId: r.piece_id,
    stage: (isEditorialStage(r.stage) ? r.stage : "drafting") as EditorialStage,
    findings: asFindings(r.findings),
    lensKeys: asStrings(r.lens_keys),
    sourceEditedAt: r.source_edited_at,
    passMetadata: asObj(r.pass_metadata),
    generatedAt: r.generated_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export interface UpsertPassInput {
  pieceId: string;
  stage: EditorialStage;
  findings: Finding[];
  lensKeys: string[];
  /** the piece's last_edited_at at the moment the pass ran (the watermark). */
  sourceEditedAt: string;
  passMetadata?: Record<string, unknown>;
}

// write (or refresh) the pass for a (piece, stage). one current row per pair ...
// the unique index np_editorial_passes_piece_stage_uniq makes the conflict
// target, so a re-run upserts in place. RLS gates the write to the caller.
export async function upsertPass(
  client: ServerClient,
  userId: string,
  input: UpsertPassInput,
): Promise<EditorialPass> {
  const typed = client as unknown as TypedClient;
  const { data, error } = await typed
    .from("np_editorial_passes")
    .upsert(
      {
        user_id: userId,
        piece_id: input.pieceId,
        stage: input.stage,
        findings: input.findings as unknown as Json,
        lens_keys: input.lensKeys,
        source_edited_at: input.sourceEditedAt,
        pass_metadata: (input.passMetadata ?? {}) as unknown as Json,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "piece_id,stage" },
    )
    .select("*")
    .single();
  if (error) {
    throw new Error(`failed to upsert editorial pass: ${error.message}`);
  }
  return rowToPass(data as PassRow);
}

// every pass for a piece, RLS-scoped. the pass-panel reads this, then annotates
// each with staleness via getPiecePasses.
export async function listPassesForPiece(
  client: ServerClient,
  pieceId: string,
): Promise<EditorialPass[]> {
  const typed = client as unknown as TypedClient;
  const { data, error } = await typed
    .from("np_editorial_passes")
    .select("*")
    .eq("piece_id", pieceId);
  if (error) {
    throw new Error(`failed to list editorial passes: ${error.message}`);
  }
  return (data ?? []).map((r) => rowToPass(r as PassRow));
}

/** a single (piece, stage) pass, or null if none has run. */
export async function getPass(
  client: ServerClient,
  pieceId: string,
  stage: EditorialStage,
): Promise<EditorialPass | null> {
  const typed = client as unknown as TypedClient;
  const { data, error } = await typed
    .from("np_editorial_passes")
    .select("*")
    .eq("piece_id", pieceId)
    .eq("stage", stage)
    .maybeSingle();
  if (error) {
    throw new Error(`failed to read editorial pass: ${error.message}`);
  }
  return data ? rowToPass(data as PassRow) : null;
}

export interface PassWithStaleness {
  pass: EditorialPass;
  stale: boolean;
}

// a piece's passes, each annotated with read-time staleness (source_edited_at <
// the piece's current last_edited_at). one piece read + one passes read; the
// staleness is never stored.
export async function getPiecePasses(
  client: ServerClient,
  pieceId: string,
): Promise<PassWithStaleness[]> {
  const typed = client as unknown as TypedClient;
  const { data: piece, error: pieceErr } = await typed
    .from("np_pieces")
    .select("last_edited_at")
    .eq("id", pieceId)
    .maybeSingle();
  if (pieceErr) {
    throw new Error(`failed to read piece watermark: ${pieceErr.message}`);
  }
  if (!piece) return [];
  const lastEdited = piece.last_edited_at;
  const passes = await listPassesForPiece(client, pieceId);
  return passes.map((pass) => ({ pass, stale: isPassStale(pass.sourceEditedAt, lastEdited) }));
}

/** a piece's current craft stage (the publication status is separate). */
export async function getPieceStage(
  client: ServerClient,
  pieceId: string,
): Promise<EditorialStage | null> {
  const typed = client as unknown as TypedClient;
  const { data, error } = await typed
    .from("np_pieces")
    .select("editorial_stage")
    .eq("id", pieceId)
    .maybeSingle();
  if (error) {
    throw new Error(`failed to read editorial stage: ${error.message}`);
  }
  if (!data) return null;
  return isEditorialStage(data.editorial_stage) ? data.editorial_stage : "drafting";
}

// move a piece to a target stage THROUGH the gate. a retreat / no-op is free; an
// advance is gated on the current stage's pass being current + fully triaged
// (evaluateTransition). on an allowed move the editorial_stage is written and
// the transition appended to metadata.editorial.history (trimmed). the result is
// returned descriptively whether or not it was allowed; a blocked move writes
// nothing. RLS scopes every read + write to the caller.
export async function setStage(
  client: ServerClient,
  pieceId: string,
  target: EditorialStage,
): Promise<TransitionResult> {
  const typed = client as unknown as TypedClient;

  const { data: piece, error } = await typed
    .from("np_pieces")
    .select("editorial_stage, last_edited_at, metadata")
    .eq("id", pieceId)
    .maybeSingle();
  if (error) {
    throw new Error(`failed to read piece for stage change: ${error.message}`);
  }
  if (!piece) {
    throw new Error("piece not found");
  }

  const current: EditorialStage = isEditorialStage(piece.editorial_stage)
    ? piece.editorial_stage
    : "drafting";

  // only an advance needs the gating pass; resolve it lazily.
  const transition = classifyTransition(current, target);
  let pass: EditorialPass | null = null;
  let stale = false;
  if (transition === "advance") {
    pass = await getPass(client, pieceId, current);
    stale = pass ? isPassStale(pass.sourceEditedAt, piece.last_edited_at) : false;
  }

  const result = evaluateTransition(current, target, { pass, stale });
  if (!result.allowed || transition === "same") {
    return result;
  }

  const nowIso = new Date().toISOString();
  const meta = asObj(piece.metadata);
  const editorial = asObj(meta.editorial);
  const priorHistory = Array.isArray(editorial.history) ? (editorial.history as Json[]) : [];
  const history: Json[] = [...priorHistory, { at: nowIso, from: current, to: target }].slice(
    -HISTORY_MAX,
  );
  const nextMeta = { ...meta, editorial: { ...editorial, history } } as unknown as Json;

  const { error: upErr } = await typed
    .from("np_pieces")
    .update({ editorial_stage: target, metadata: nextMeta })
    .eq("id", pieceId);
  if (upErr) {
    throw new Error(`failed to write editorial stage: ${upErr.message}`);
  }
  return result;
}

// a work's craft stage = min over its pieces' stages (only as finished as its
// least-finished chapter), derived on read. RLS scopes the pieces to the caller.
export async function deriveWorkStage(
  client: ServerClient,
  workId: string,
): Promise<EditorialStage> {
  const typed = client as unknown as TypedClient;
  const { data, error } = await typed
    .from("np_pieces")
    .select("editorial_stage")
    .eq("work_id", workId);
  if (error) {
    throw new Error(`failed to derive work stage: ${error.message}`);
  }
  const stages = (data ?? [])
    .map((r) => r.editorial_stage)
    .filter((s): s is EditorialStage => isEditorialStage(s));
  return workStage(stages);
}
