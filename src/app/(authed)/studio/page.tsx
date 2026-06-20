import Link from "next/link";

import { Atmosphere } from "@/components/chrome/atmosphere";
import { VoiceTimelineLauncher } from "@/components/editor/voice-timeline-launcher";
import { VoiceTrainer } from "@/components/editor/voice-trainer";
import { VoiceGlanceCard } from "@/components/studio/voice-glance-card";
import { listPiecesForUser } from "@/lib/db/pieces";
import { getActiveWritingFork } from "@/lib/db/user-settings";
import { readVoiceCard } from "@/lib/db/voice-profile";
import { listVoiceSnapshots } from "@/lib/db/voice-snapshots";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// the voice studio ... one calm home for the writer's voice. a read-only portrait
// of the distilled voice up top, then the tools: train, and the breathing timeline
// (forks + compare + interrogate + the "write as" voice-switch). all reads are RLS
// owner-scoped; nothing here writes voice_profiles ... training goes through the
// existing /api/voice/extract path, the rest is read + display.
export default async function StudioPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [voiceCard, snapshots, activeWritingFork, pieces] = user
    ? await Promise.all([
        readVoiceCard(supabase, user.id),
        listVoiceSnapshots(supabase, user.id),
        getActiveWritingFork(supabase, user.id),
        listPiecesForUser(supabase),
      ])
    : [null, [], null, []];

  return (
    <div className="relative min-h-screen overflow-hidden">
      <Atmosphere />

      <div className="relative z-10">
        <header
          className="flex items-center justify-between border-b px-6 py-4 sm:px-10"
          style={{ borderColor: "var(--lunari-border)" }}
        >
          <Link
            href="/"
            className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.32em] transition-opacity hover:opacity-80"
            style={{ color: "var(--lunari-fg-subtle)" }}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--nova-accent)" }}
              aria-hidden
            />
            nova press
          </Link>
          <div className="flex items-center gap-5">
            <Link
              href="/library"
              className="font-mono text-[11px] uppercase tracking-[0.22em] transition-colors hover:opacity-80"
              style={{ color: "var(--lunari-fg-subtle)" }}
            >
              your pieces
            </Link>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="font-mono text-[11px] uppercase tracking-[0.22em] transition-colors hover:opacity-80"
                style={{ color: "var(--lunari-fg-subtle)" }}
              >
                sign out
              </button>
            </form>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-6 py-14 sm:py-20">
          <div className="np-rise np-rise-1 mb-10">
            <h1
              className="font-serif text-4xl font-medium tracking-tight"
              style={{ color: "var(--lunari-fg-primary)" }}
            >
              voice studio
            </h1>
            <p
              className="mt-2 max-w-prose font-serif text-base leading-relaxed"
              style={{ color: "var(--lunari-fg-muted)" }}
            >
              who you sound like, and the tools to tune it. nova mirrors this voice everywhere it
              writes for you ... the partner, the whisper, the repurpose.
            </p>
          </div>

          <div className="np-rise np-rise-2">
            <VoiceGlanceCard card={voiceCard} />
          </div>

          <div className="np-rise np-rise-2 mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <VoiceTrainer />
            <VoiceTimelineLauncher snapshots={snapshots} activeWritingFork={activeWritingFork} />
          </div>

          <p
            className="np-rise np-rise-2 mt-10 max-w-prose font-serif text-sm leading-relaxed"
            style={{ color: "var(--lunari-fg-subtle)" }}
          >
            {pieces.length > 0 ? (
              <>
                nova reads the {pieces.length} {pieces.length === 1 ? "piece" : "pieces"} in your
                library to hear you. to see a single piece&apos;s argument spine, open it and run
                the x-ray from the editor.
              </>
            ) : (
              <>
                write your first piece, then come back ... nova learns your voice from what you
                write.
              </>
            )}
          </p>
        </main>
      </div>
    </div>
  );
}
