import { notFound } from "next/navigation";

import { Atmosphere } from "@/components/chrome/atmosphere";
import { EditorialPanel } from "@/components/editor/editorial-panel";
import { NewsletterSendPanel } from "@/components/editor/newsletter-send-panel";
import { PartnerRail } from "@/components/editor/partner-rail";
import { PlateShell } from "@/components/editor/plate-shell";
import { coercePlateValue } from "@/components/editor/plate-text";
import { WritingRoom } from "@/components/studio/writing-room";
import { getPiecePasses } from "@/lib/db/editorial";
import { getPieceById } from "@/lib/db/pieces";
import { getActiveWritingFork } from "@/lib/db/user-settings";
import { isEditorialStage } from "@/lib/editorial/stages";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { publishPieceAction } from "./publish-action";
import { savePieceContentAction } from "./save-action";
import { schedulePieceAction } from "./schedule-action";

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const piece = await getPieceById(supabase, id);
  if (!piece) notFound();

  const { data: { user } } = await supabase.auth.getUser();
  const activeWritingFork = user ? await getActiveWritingFork(supabase, user.id) : null;
  const stage = isEditorialStage(piece.editorial_stage) ? piece.editorial_stage : "drafting";
  const passes = await getPiecePasses(supabase, piece.id);
  const currentPass = passes.find((p) => p.pass.stage === stage);

  return (
    <main className="relative h-screen w-full overflow-hidden">
      <Atmosphere glow={false} />
      {/* changing rooms never unmounts the page. changing pieces must reset it. */}
      <WritingRoom
        key={piece.id}
        scopeId={piece.id}
        page={
          <PlateShell
            key={piece.id}
            pieceId={piece.id}
            initialTitle={piece.title}
            initialValue={coercePlateValue(piece.body)}
            initialStatus={piece.status}
            initialSlug={piece.slug}
            initialScheduledAt={piece.scheduled_publish_at}
            onSave={savePieceContentAction.bind(null, piece.id)}
            onPublish={publishPieceAction.bind(null, piece.id)}
            onSchedule={schedulePieceAction.bind(null, piece.id)}
          />
        }
        partner={<PartnerRail key={piece.id} embedded activeWritingFork={activeWritingFork} pieceId={piece.id} />}
        editorial={
          <EditorialPanel
            key={piece.id}
            embedded
            pieceId={piece.id}
            initialStage={stage}
            initialFindings={currentPass?.pass.findings ?? []}
            initialHasPass={!!currentPass}
            initialStale={currentPass?.stale ?? false}
          />
        }
        delivery={piece.status === "published" ? <NewsletterSendPanel key={piece.id} pieceId={piece.id} published /> : undefined}
      />
    </main>
  );
}
