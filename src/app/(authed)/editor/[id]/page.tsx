import { notFound } from "next/navigation";

import { Atmosphere } from "@/components/chrome/atmosphere";
import { EditorialPanel } from "@/components/editor/editorial-panel";
import { NewsletterSendPanel } from "@/components/editor/newsletter-send-panel";
import { PartnerRail } from "@/components/editor/partner-rail";
import { PlateShell } from "@/components/editor/plate-shell";
import { coercePlateValue } from "@/components/editor/plate-text";
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

  if (!piece) {
    notFound();
  }

  // the named strand nova is writing in (or null = your live voice), read once
  // server-side so the rail footer is correct on first paint with no client fetch.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const activeWritingFork = user ? await getActiveWritingFork(supabase, user.id) : null;

  // the craft axis: the current editorial stage + the current stage's pass (with
  // read-time staleness), resolved server-side so the panel is right on first
  // paint. the publication status is a separate axis, untouched here.
  const stage = isEditorialStage(piece.editorial_stage) ? piece.editorial_stage : "drafting";
  const passes = await getPiecePasses(supabase, piece.id);
  const currentPass = passes.find((p) => p.pass.stage === stage);

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
          initialScheduledAt={piece.scheduled_publish_at}
          onSave={savePieceContentAction.bind(null, piece.id)}
          onPublish={publishPieceAction.bind(null, piece.id)}
          onSchedule={schedulePieceAction.bind(null, piece.id)}
        />
        <PartnerRail activeWritingFork={activeWritingFork} pieceId={piece.id} />
      </div>
      {/* the editorial ladder + pass panel ... the craft axis, made visible. a
          fixed slim bar across the top, calm until you run a pass. */}
      <EditorialPanel
        pieceId={piece.id}
        initialStage={stage}
        initialFindings={currentPass?.pass.findings ?? []}
        initialHasPass={!!currentPass}
        initialStale={currentPass?.stale ?? false}
      />
      {/* writer-commanded newsletter blast ... a quiet affordance, bottom-left so
          it never collides with the partner rail. only renders once published. */}
      <div className="fixed bottom-5 left-5 z-40">
        <NewsletterSendPanel pieceId={piece.id} published={piece.status === "published"} />
      </div>
    </main>
  );
}
