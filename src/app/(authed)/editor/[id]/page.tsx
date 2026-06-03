import { notFound } from "next/navigation";

import { PartnerRail } from "@/components/editor/partner-rail";
import { PlateShell } from "@/components/editor/plate-shell";
import { coercePlateValue } from "@/components/editor/plate-text";
import { getPieceById } from "@/lib/db/pieces";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { savePieceContentAction } from "./save-action";

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
        initialValue={coercePlateValue(piece.body)}
        initialStatus={piece.status}
        onSave={savePieceContentAction.bind(null, piece.id)}
      />
      <PartnerRail />
    </main>
  );
}
