import { notFound } from "next/navigation";

import { Atmosphere } from "@/components/chrome/atmosphere";
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
    <main className="relative flex h-screen w-screen overflow-hidden">
      {/* grain only, no dawn glow ... the canvas wants to read like paper,
          not catch light. */}
      <Atmosphere glow={false} />
      <div className="relative z-10 flex h-full w-full">
        <PlateShell
          initialTitle={piece.title}
          initialValue={coercePlateValue(piece.body)}
          initialStatus={piece.status}
          onSave={savePieceContentAction.bind(null, piece.id)}
        />
        <PartnerRail />
      </div>
    </main>
  );
}
