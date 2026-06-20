import { notFound } from "next/navigation";

import { Atmosphere } from "@/components/chrome/atmosphere";
import { PartnerRail } from "@/components/editor/partner-rail";
import { PlateShell } from "@/components/editor/plate-shell";
import { coercePlateValue } from "@/components/editor/plate-text";
import { getPieceById } from "@/lib/db/pieces";
import { getActiveWritingFork } from "@/lib/db/user-settings";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { publishPieceAction } from "./publish-action";
import { savePieceContentAction } from "./save-action";

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const piece = await getPieceById(supabase, id);

  if (!piece) {
    notFound();
  }

  // the named strand nova is writing in (or null = your live voice), read once
  // server-side so the rail footer is correct on first paint with no client fetch.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const activeWritingFork = user ? await getActiveWritingFork(supabase, user.id) : null;

  return (
    <main className="relative flex h-screen w-screen overflow-hidden">
      {/* grain only, no dawn glow ... the canvas wants to read like paper,
          not catch light. */}
      <Atmosphere glow={false} />
      <div className="relative z-10 flex h-full w-full">
        <PlateShell
          pieceId={piece.id}
          initialTitle={piece.title}
          initialValue={coercePlateValue(piece.body)}
          initialStatus={piece.status}
          initialSlug={piece.slug}
          onSave={savePieceContentAction.bind(null, piece.id)}
          onPublish={publishPieceAction.bind(null, piece.id)}
        />
        <PartnerRail activeWritingFork={activeWritingFork} />
      </div>
    </main>
  );
}
