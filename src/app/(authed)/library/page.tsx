import { listPiecesForUser, type PieceListItem } from "@/lib/db/pieces";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { newPieceAction } from "./new-piece-action";

export default async function LibraryPage() {
  const supabase = await createSupabaseServerClient();
  const pieces = await listPiecesForUser(supabase);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-10 flex items-center justify-between">
        <h1 className="font-serif text-2xl">your pieces</h1>
        <form action={newPieceAction}>
          <button
            type="submit"
            className="rounded-md bg-[#c9a84c] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#b8983e]"
          >
            new piece
          </button>
        </form>
      </header>

      {pieces.length === 0 ? <EmptyState /> : <PieceList pieces={pieces} />}
    </main>
  );
}

function EmptyState() {
  return (
    <div className="border-border rounded-md border border-dashed py-16 text-center">
      <p className="text-foreground text-lg">nothing yet</p>
      <p className="text-muted-foreground mt-2 text-sm">the page is open. drop something here.</p>
    </div>
  );
}

function PieceList({ pieces }: { pieces: PieceListItem[] }) {
  return (
    <ul className="divide-border divide-y">
      {pieces.map((piece) => (
        <li key={piece.id} className="py-4">
          <a
            href={`/editor/${piece.id}`}
            className="hover:bg-muted/50 -mx-2 block rounded-md px-2 py-2 transition"
          >
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-serif text-lg">{piece.title}</h2>
              <span className="text-muted-foreground text-xs uppercase tracking-wider">
                {piece.status}
              </span>
            </div>
            {piece.excerpt ? (
              <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">{piece.excerpt}</p>
            ) : null}
            <p className="text-muted-foreground mt-2 text-xs">
              {piece.word_count} words · {formatRelativeTime(piece.last_edited_at)}
            </p>
          </a>
        </li>
      ))}
    </ul>
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
