import Link from "next/link";

import { Atmosphere } from "@/components/chrome/atmosphere";
import { listPiecesForUser, type PieceListItem } from "@/lib/db/pieces";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { newPieceAction } from "./new-piece-action";

export default async function LibraryPage() {
  const supabase = await createSupabaseServerClient();
  const pieces = await listPiecesForUser(supabase);

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
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="font-mono text-[11px] uppercase tracking-[0.22em] transition-colors hover:opacity-80"
              style={{ color: "var(--lunari-fg-subtle)" }}
            >
              sign out
            </button>
          </form>
        </header>

        <main className="mx-auto max-w-3xl px-6 py-14 sm:py-20">
          <div className="np-rise np-rise-1 mb-12 flex items-end justify-between gap-6">
            <div>
              <h1
                className="font-serif text-4xl font-medium tracking-tight"
                style={{ color: "var(--lunari-fg-primary)" }}
              >
                your pieces
              </h1>
              {pieces.length > 0 ? (
                <p
                  className="mt-2 font-mono text-[11px] uppercase tabular-nums tracking-[0.26em]"
                  style={{ color: "var(--lunari-fg-subtle)" }}
                >
                  {pieces.length} {pieces.length === 1 ? "piece" : "pieces"}
                </p>
              ) : null}
            </div>
            <form action={newPieceAction}>
              <button
                type="submit"
                className="np-btn inline-flex h-11 items-center rounded-md px-5 font-sans text-sm font-medium"
                style={{
                  background: "var(--nova-accent)",
                  color: "var(--lunari-bg-deep)",
                  boxShadow: "0 8px 24px -12px rgba(201, 168, 76, 0.7)",
                }}
              >
                new piece
              </button>
            </form>
          </div>

          <div className="np-rise np-rise-2">
            {pieces.length === 0 ? <EmptyState /> : <PieceList pieces={pieces} />}
          </div>
        </main>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="rounded-xl border border-dashed px-6 py-20 text-center"
      style={{ borderColor: "var(--lunari-border)" }}
    >
      <p className="font-serif text-2xl" style={{ color: "var(--lunari-fg-primary)" }}>
        nothing yet
      </p>
      <p
        className="mx-auto mt-3 max-w-xs font-serif text-base leading-relaxed"
        style={{ color: "var(--lunari-fg-muted)" }}
      >
        the page is open. drop something here.
      </p>
    </div>
  );
}

function PieceList({ pieces }: { pieces: PieceListItem[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {pieces.map((piece, i) => {
        // a published piece can be walked to its public page. slug is null until
        // first publish, so the affordance only shows once there's a live url.
        const liveSlug = piece.status === "published" ? piece.slug : null;
        return (
          <li key={piece.id} className="np-rise relative" style={{ animationDelay: `${i * 60}ms` }}>
            <Link
              href={`/editor/${piece.id}`}
              className="np-library-card block rounded-lg px-5 py-5"
              style={{ background: "var(--lunari-bg-surface)" }}
            >
              <div className="flex items-baseline justify-between gap-4">
                <h2
                  className="font-serif text-xl leading-snug"
                  style={{ color: "var(--lunari-fg-primary)" }}
                >
                  {piece.title}
                </h2>
                <StatusPill status={piece.status} />
              </div>
              {piece.excerpt ? (
                <p
                  className="mt-2 line-clamp-2 font-serif text-base leading-relaxed"
                  style={{ color: "var(--lunari-fg-muted)" }}
                >
                  {piece.excerpt}
                </p>
              ) : null}
              <p
                className="mt-3 font-mono text-[11px] uppercase tabular-nums tracking-[0.2em]"
                style={{ color: "var(--lunari-fg-subtle)" }}
              >
                {piece.word_count} {piece.word_count === 1 ? "word" : "words"}
                {" · "}
                {formatRelativeTime(piece.last_edited_at)}
              </p>
            </Link>
            {liveSlug ? (
              // sibling of the card link, never nested ... an anchor inside an
              // anchor is invalid and the whole card already links to the editor.
              // absolute corner, z-10 so the click lands here, not on the card.
              <Link
                href={`/p/${liveSlug}`}
                target="_blank"
                rel="noreferrer"
                className="absolute bottom-4 right-4 z-10 inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] transition-opacity hover:opacity-80"
                style={{ background: "var(--nova-accent-soft)", color: "var(--nova-accent)" }}
              >
                view
                <span aria-hidden>↗</span>
              </Link>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function StatusPill({ status }: { status: string }) {
  const live = status === "published" || status === "scheduled";
  return (
    <span
      className="shrink-0 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em]"
      style={
        live
          ? { background: "var(--nova-accent-soft)", color: "var(--nova-accent)" }
          : {
              border: "1px solid var(--lunari-border)",
              color: "var(--lunari-fg-subtle)",
            }
      }
    >
      {status}
    </span>
  );
}

// tight relative-time helper. lowercase, no marketing fluff. server-rendered
// so it's accurate at the moment of page load; users seeing stale times
// reload to refresh ... that's fine for v1.
function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} hr ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
