// nova press · the mythos · the export ledger (np_exports, v0_12_0).
//
// receipts, not vault: one row per export attempt, no artifact bytes. the
// ledger is BEST-EFFORT on the write side ... recordExport swallows its own
// failures, because a receipt miss must never fail the export the writer is
// holding. reads never throw and degrade to [] (the panel just shows no
// history). RLS owner-only; work_id / piece_id are plain uuids.

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { reportError } from "@/lib/observability/report-error";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type TypedClient = SupabaseClient<Database>;

export type ExportFormat = "markdown" | "docx" | "epub" | "pdf";

export interface ExportRecordInput {
  workId?: string | null;
  pieceId?: string | null;
  format: ExportFormat;
  ok: boolean;
  byteSize?: number;
  /** the short failure note on a failed attempt ... never a stack. */
  detail?: string;
}

/** land one receipt row. fire-and-forget by design: any failure is reported
 *  to observability and swallowed ... the export itself already succeeded or
 *  failed on its own terms. */
export async function recordExport(
  client: ServerClient,
  userId: string,
  input: ExportRecordInput,
): Promise<void> {
  const typed = client as unknown as TypedClient;
  try {
    const { error } = await typed.from("np_exports").insert({
      user_id: userId,
      work_id: input.workId ?? null,
      piece_id: input.pieceId ?? null,
      format: input.format,
      status: input.ok ? "complete" : "failed",
      byte_size: input.ok ? (input.byteSize ?? null) : null,
      detail: input.ok ? "" : (input.detail ?? "").slice(0, 300),
    });
    if (error) {
      reportError(new Error(`np_exports insert failed: ${error.message}`), {
        tag: "export-ledger-miss",
        userId,
      });
    }
  } catch (err) {
    reportError(err, { tag: "export-ledger-miss", userId });
  }
}

export interface ExportReceipt {
  format: string;
  status: string;
  createdAt: string;
}

/** the work's recent receipts, newest first ... the typesetter panel's quiet
 *  history line. never throws; an error reads as no history. */
export async function listRecentWorkExports(
  client: ServerClient,
  workId: string,
  limit = 3,
): Promise<ExportReceipt[]> {
  const typed = client as unknown as TypedClient;
  try {
    const { data, error } = await typed
      .from("np_exports")
      .select("format, status, created_at")
      .eq("work_id", workId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data.map((r) => ({ format: r.format, status: r.status, createdAt: r.created_at }));
  } catch {
    return [];
  }
}
