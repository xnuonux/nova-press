import { notFound } from "next/navigation";

import { getPieceById } from "@/lib/db/pieces";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// stub for chunk 4. confirms the row exists + renders title and status.
// chunk 4 mounts the real plate editor here and wires autosave back to
// np_pieces. RLS scopes getPieceById to the caller's rows, so an
// attacker requesting another user's id sees the 404 path.
export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const piece = await getPieceById(supabase, id);

  if (!piece) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8">
        <h1 className="font-serif text-3xl">{piece.title}</h1>
        <p className="text-muted-foreground mt-2 text-xs uppercase tracking-wider">
          {piece.status} · {piece.word_count} words
        </p>
      </header>
      <p className="text-muted-foreground text-sm">
        the editor lands here in chunk 4. for now this is a placeholder confirming the row was
        created and rls is gating reads correctly.
      </p>
    </main>
  );
}
