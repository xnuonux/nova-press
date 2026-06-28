import "server-only";

import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { coercePlateValue, plateText } from "@/components/editor/plate-text";
import { analyzeContinuity } from "@/lib/ai/continuity-analyze";
import { detectWork } from "@/lib/continuity/detect";
import { contentHash } from "@/lib/continuity/hash";
import type {
  ContinuityFinding,
  ContinuityKind,
  ContinuityStatus,
  ScanPiece,
} from "@/lib/continuity/types";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/supabase";

import { readBibleForWork, readBibleNames } from "./bible";

// the continuity db layer + the resumable scan orchestration. it reads a work's
// prose + its bible, runs the deterministic pass (detect) THEN the model pass
// (analyzeContinuity, degrades to []), writes the concerns to np_continuity_flags
// (RLS owner), and walks the np_continuity_scans watermark to complete. the scan
// is keyed on (work_id, body_hash): an unchanged work is the same hash, so a
// re-scan is SKIPPED; an edit is a new hash = a new scan. same cast trick as
// pieces.ts / editorial.ts for the Database-typed inference.

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type TypedClient = SupabaseClient<Database>;
type FlagRow = Database["public"]["Tables"]["np_continuity_flags"]["Row"];

function asObj(j: unknown): Record<string, unknown> {
  return j != null && typeof j === "object" && !Array.isArray(j)
    ? (j as Record<string, unknown>)
    : {};
}

export interface ContinuityFlag {
  id: string;
  workId: string;
  pieceId: string | null;
  entityId: string | null;
  kind: ContinuityKind;
  message: string;
  status: ContinuityStatus;
  scope: Record<string, unknown>;
}

function rowToFlag(r: FlagRow): ContinuityFlag {
  return {
    id: r.id,
    workId: r.work_id,
    pieceId: r.piece_id,
    entityId: r.entity_id,
    kind: r.kind as ContinuityKind,
    message: r.message,
    status: r.status as ContinuityStatus,
    scope: asObj(r.scope),
  };
}

export interface ScanResult {
  // 'skipped': an unchanged work (prose + bible) was already fully scanned.
  // 'complete': this call ran BOTH passes + wrote the flags.
  // 'partial': the deterministic flags were written but the model pass failed,
  //   so the scan row is left in_progress to retry the model on the next scan.
  status: "skipped" | "complete" | "partial";
  flagsFound: number;
  bodyHash: string;
}

/** a work's pieces' prose, flattened to plain text for the scan. RLS owner-scoped. */
export async function readWorkProse(client: ServerClient, workId: string): Promise<ScanPiece[]> {
  const typed = client as unknown as TypedClient;
  const { data, error } = await typed
    .from("np_pieces")
    .select("id, body")
    .eq("work_id", workId)
    .order("created_at", { ascending: true });
  if (error) {
    throw new Error(`failed to read work prose for scan: ${error.message}`);
  }
  return (data ?? []).map((p) => ({
    pieceId: p.id,
    text: plateText(coercePlateValue(p.body)),
  }));
}

/** the work's OPEN continuity flags (the rail's read). RLS owner-scoped. */
export async function listOpenFlags(
  client: ServerClient,
  workId: string,
): Promise<ContinuityFlag[]> {
  const typed = client as unknown as TypedClient;
  const { data, error } = await typed
    .from("np_continuity_flags")
    .select("*")
    .eq("work_id", workId)
    .eq("status", "open")
    .order("created_at", { ascending: true });
  if (error) {
    throw new Error(`failed to list continuity flags: ${error.message}`);
  }
  return (data ?? []).map((r) => rowToFlag(r as FlagRow));
}

// the only triage states a flag may take. validated at the boundary because a
// server action is a public surface ... a caller outside the typed client could
// hand any string. mirrors the editorial finding triage.
const FLAG_STATES: readonly ContinuityStatus[] = ["open", "accepted", "dismissed"];
export function isContinuityStatus(s: string): s is ContinuityStatus {
  return (FLAG_STATES as readonly string[]).includes(s);
}

/**
 * accept / dismiss / re-open one continuity flag. RLS scopes the write to the
 * owner; the work_id scope ties it to this work (so a forged flag id from another
 * work can't be flipped here). returns the updated flag, or null when it wasn't
 * found / not owned. a dismissed flag stays dismissed across re-scans ... the scan
 * writes deterministic-id flags and ignores a collision, so triage is durable.
 */
export async function triageFlag(
  client: ServerClient,
  workId: string,
  flagId: string,
  status: ContinuityStatus,
): Promise<ContinuityFlag | null> {
  const typed = client as unknown as TypedClient;
  const { data, error } = await typed
    .from("np_continuity_flags")
    .update({ status })
    .eq("id", flagId)
    .eq("work_id", workId)
    .select("*")
    .maybeSingle();
  if (error || !data) return null;
  return rowToFlag(data as FlagRow);
}

// de-dupe the merged findings: one flag per (kind, piece, message). the
// deterministic + model passes can land on the same concern from two angles.
function dedupe(findings: readonly ContinuityFinding[]): ContinuityFinding[] {
  const seen = new Set<string>();
  const out: ContinuityFinding[] = [];
  for (const f of findings) {
    const key = `${f.kind}|${f.pieceId ?? ""}|${f.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

// a deterministic flag id (a uuid derived from the concern's identity), so the
// SAME concern always lands on the SAME row. two effects: a concurrent re-scan's
// double-insert collides on the PK instead of duplicating, and a concern the
// writer already DISMISSED (its row keeps this id) is not re-raised by a later
// scan ... the insert collides + is ignored, the dismissal stands.
function flagId(workId: string, f: ContinuityFinding): string {
  const h = createHash("sha256")
    .update(`${workId}|${f.kind}|${f.pieceId ?? ""}|${f.message}`)
    .digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

// replace the work's auto-raised OPEN flags with the fresh scan result. a writer's
// accepted / dismissed flags are LEFT ALONE (only status='open' is cleared) AND,
// via the deterministic id, a re-detected dismissed concern is not re-raised
// (the insert collides with the dismissed row + is ignored). so a re-scan
// refreshes the live concerns without losing triage or duplicating under a race.
async function replaceOpenFlags(
  typed: TypedClient,
  userId: string,
  workId: string,
  findings: readonly ContinuityFinding[],
): Promise<void> {
  const { error: delErr } = await typed
    .from("np_continuity_flags")
    .delete()
    .eq("work_id", workId)
    .eq("status", "open");
  if (delErr) throw new Error(`failed to clear continuity flags: ${delErr.message}`);

  if (findings.length === 0) return;
  const rows = findings.map((f) => ({
    id: flagId(workId, f),
    user_id: userId,
    work_id: workId,
    piece_id: f.pieceId ?? null,
    entity_id: f.entityId ?? null,
    kind: f.kind,
    message: f.message,
    status: "open",
    scope: (f.scope ?? {}) as unknown as Json,
  }));
  // upsert ignoring duplicates: a row already present (a concurrent insert, or a
  // dismissed/accepted concern at the same id) is left as-is, never duplicated.
  const { error: insErr } = await typed
    .from("np_continuity_flags")
    .upsert(rows, { onConflict: "id", ignoreDuplicates: true });
  if (insErr) throw new Error(`failed to write continuity flags: ${insErr.message}`);
}

/**
 * scan a work for continuity concerns ... resumable + skip-if-unchanged, keyed on
 * a hash of BOTH the prose AND the bible (editing either should re-scan). an
 * already-'complete' scan at this exact content is SKIPPED. otherwise: open (or
 * resume) the in_progress scan, run the deterministic pass + the model pass,
 * replace the open flags, walk the scan to complete (only if the model pass
 * actually ran ... a model FAILURE leaves it in_progress so the next scan
 * retries, never a false 'complete' over a half-run). RLS scopes every read +
 * write to the caller.
 *
 * the scan_token + a 'preview' phase exist in the schema for a future UI-driven
 * preview/commit spend-gate (4.3); this inline scan is single-phase ... its
 * resumability is the in_progress -> complete walk + the content-hash skip, which
 * is what 4.2 needs.
 */
export async function scanWork(
  client: ServerClient,
  userId: string,
  workId: string,
): Promise<ScanResult> {
  const typed = client as unknown as TypedClient;

  // read the prose AND the bible up front: both feed the passes, and BOTH go into
  // the staleness hash so editing the bible (a new entity, a fixed name) re-scans
  // even when the prose is untouched.
  const pieces = await readWorkProse(client, workId);
  const known = await readBibleNames(client, workId);
  const bible = await readBibleForWork(client, workId);
  const bodyHash = contentHash(`${pieces.map((p) => p.text).join("\n\n")} bible ${bible}`);

  // skip-if-unchanged: a completed scan at this exact content is authoritative.
  const { data: existing } = await typed
    .from("np_continuity_scans")
    .select("status, flags_found")
    .eq("work_id", workId)
    .eq("body_hash", bodyHash)
    .maybeSingle();
  if (existing?.status === "complete") {
    return { status: "skipped", flagsFound: existing.flags_found ?? 0, bodyHash };
  }

  // open (or resume) the scan as in_progress. a guarded UPDATE (never a blind
  // upsert) so a concurrent runner that already completed this content isn't
  // downgraded; an insert race on the unique (work_id, body_hash) is harmless
  // (the other runner opened it ... both write idempotent, deterministic-id flags).
  if (existing) {
    const { error: upErr } = await typed
      .from("np_continuity_scans")
      .update({ status: "in_progress" })
      .eq("work_id", workId)
      .eq("body_hash", bodyHash)
      .neq("status", "complete");
    if (upErr) throw new Error(`failed to resume continuity scan: ${upErr.message}`);
  } else {
    const { error: insErr } = await typed
      .from("np_continuity_scans")
      .insert({ user_id: userId, work_id: workId, body_hash: bodyHash, status: "in_progress" });
    if (insErr && insErr.code !== "23505") {
      throw new Error(`failed to open continuity scan: ${insErr.message}`);
    }
  }

  // the deterministic pass (cheap, exact) THEN the model pass (degrades to []).
  const deterministic = detectWork(pieces, known);
  const model = await analyzeContinuity(pieces, bible);

  const findings = dedupe([...deterministic, ...model.findings]);
  await replaceOpenFlags(typed, userId, workId, findings);

  // only mark 'complete' when the model pass actually ran. on a model FAILURE the
  // deterministic flags are still written, but the row stays in_progress so a
  // re-scan of the same content retries the model once the provider recovers
  // (the model-pass analogue of "a crash stays in_progress, never a false
  // complete").
  if (model.failed) {
    return { status: "partial", flagsFound: findings.length, bodyHash };
  }

  const { error: doneErr } = await typed
    .from("np_continuity_scans")
    .update({
      status: "complete",
      flags_found: findings.length,
      completed_at: new Date().toISOString(),
    })
    .eq("work_id", workId)
    .eq("body_hash", bodyHash);
  if (doneErr) throw new Error(`failed to complete continuity scan: ${doneErr.message}`);

  return { status: "complete", flagsFound: findings.length, bodyHash };
}
