import Link from "next/link";
import { notFound } from "next/navigation";

import { Binder } from "@/components/binder/binder";
import { Atmosphere } from "@/components/chrome/atmosphere";
import { VoiceTrainer } from "@/components/editor/voice-trainer";
import { getWorkById, getWorkTree } from "@/lib/db/works";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TreeNode } from "@/types/works";

import { createLeafAction, reorderNodeAction, setCardAction, publishWorkAction } from "./actions";

function countLeaves(tree: TreeNode[]): number {
  let n = 0;
  for (const node of tree) {
    if (node.isLeaf) n += 1;
    else n += countLeaves(node.children);
  }
  return n;
}

export default async function WorkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const work = await getWorkById(supabase, id);
  if (!work) {
    notFound();
  }
  const tree = await getWorkTree(supabase, id);
  const pages = countLeaves(tree);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <Atmosphere />

      <div className="relative z-10">
        <header
          className="flex items-center justify-between border-b px-6 py-4 sm:px-10"
          style={{ borderColor: "var(--lunari-border)" }}
        >
          <Link
            href="/library"
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
              {work.title}
            </h1>
            <p
              className="mt-2 font-mono text-[11px] uppercase tabular-nums tracking-[0.26em]"
              style={{ color: "var(--lunari-fg-subtle)" }}
            >
              {work.formProfile}
              {" · "}
              {pages} {pages === 1 ? "page" : "pages"}
              {work.wordCount > 0 ? ` · ${work.wordCount.toLocaleString()} words` : ""}
            </p>

            {/* train nova on THIS work's prose ... a book's own voice, distilled
                from the book. the source scopes to the work; the result lands in
                your one voice profile (last-writer-wins). */}
            <div className="mt-5 flex flex-col gap-3">
              <VoiceTrainer workId={work.id} label="train nova on this work" />

              {/* publish to /w/[slug] ... a whole Work as one reading experience.
                  only offered once there are words to read; once live, the read
                  link opens the public view and the button re-publishes. */}
              {work.status === "published" && work.slug ? (
                <div className="flex flex-wrap items-center gap-4">
                  <a
                    href={`/w/${work.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[11px] uppercase tracking-[0.2em] transition-opacity hover:opacity-80"
                    style={{ color: "var(--nova-accent)" }}
                  >
                    published ... read it
                  </a>
                  <form action={publishWorkAction}>
                    <input type="hidden" name="workId" value={work.id} />
                    <button
                      type="submit"
                      className="font-mono text-[11px] uppercase tracking-[0.2em] transition-opacity hover:opacity-80"
                      style={{ color: "var(--lunari-fg-subtle)" }}
                    >
                      republish
                    </button>
                  </form>
                </div>
              ) : work.wordCount > 0 ? (
                <form action={publishWorkAction}>
                  <input type="hidden" name="workId" value={work.id} />
                  <button
                    type="submit"
                    className="np-btn inline-flex h-9 items-center rounded-full px-4 font-mono text-[11px] uppercase tracking-[0.18em]"
                    style={{ background: "var(--nova-accent)", color: "var(--lunari-bg-deep)" }}
                  >
                    publish this work
                  </button>
                </form>
              ) : (
                <span
                  className="font-mono text-[11px] uppercase tracking-[0.18em]"
                  style={{ color: "var(--lunari-fg-subtle)" }}
                >
                  write a page or two to publish
                </span>
              )}
            </div>
          </div>

          <Binder
            workId={work.id}
            tree={tree}
            createLeaf={createLeafAction}
            reorder={reorderNodeAction}
            setCard={setCardAction}
          />
        </main>
      </div>
    </div>
  );
}
