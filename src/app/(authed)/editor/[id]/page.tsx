import { notFound } from "next/navigation";
import type { Value } from "platejs";

import { PartnerRail } from "@/components/editor/partner-rail";
import { PlateShell } from "@/components/editor/plate-shell";
import { getPieceById } from "@/lib/db/pieces";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { savePieceContentAction } from "./save-action";

// a plate document needs at least one node, so an empty/invalid draft body
// falls back to a single empty paragraph.
const EMPTY_DOC: Value = [{ type: "p", children: [{ text: "" }] }];

function coerceBody(body: unknown): Value {
  return Array.isArray(body) && body.length > 0 ? (body as Value) : EMPTY_DOC;
}

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const piece = await getPieceById(supabase, id);

  if (!piece) {
    notFound();
  }

  return (
    <main className="flex h-screen w-screen overflow-hidden">
      <PlateShell
        initialTitle={piece.title}
        initialValue={coerceBody(piece.body)}
        initialStatus={piece.status}
        onSave={savePieceContentAction.bind(null, piece.id)}
      />
      <PartnerRail />
    </main>
  );
}
