import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { Atmosphere } from "@/components/chrome/atmosphere";
import { coercePlateValue } from "@/components/editor/plate-text";
import { PieceBody } from "@/components/reading/piece-body";
import { ReadingProgress } from "@/components/reading/reading-progress";
import { ShareRow } from "@/components/reading/share-row";
import { getPublishedPieceBySlug } from "@/lib/db/pieces";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

interface ReadingPageProps {
  params: Promise<{ slug: string }>;
}

// generateMetadata + the page both need the piece; react cache collapses the
// two service-role reads in one request into a single query (the 200ms reading
// budget doesn't have room for a redundant cross-network hit).
const loadPiece = cache((slug: string) => getPublishedPieceBySlug(createSupabaseAdminClient(), slug));

// ~200 wpm, never under a minute.
function readingTime(words: number): string {
  return `${Math.max(1, Math.round(words / 200))} min`;
}

// "may 21, 2026", lowercased to match nova's voice. pinned to utc so the
// rendered day is deterministic across deploy regions (the server runs in utc),
// not silently off by one.
function formatPublished(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso)
    .toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    })
    .toLowerCase();
}

export async function generateMetadata({ params }: ReadingPageProps): Promise<Metadata> {
  const { slug } = await params;
  const piece = await loadPiece(slug);
  if (!piece) {
    return { title: "not found ... nova press" };
  }
  // the share preview IS the product's wedge, so the og/twitter card has to be
  // the piece, not the generic site card the layout would otherwise inherit.
  return {
    title: `${piece.title} ... nova press`,
    description: piece.excerpt ?? undefined,
    alternates: { canonical: `/p/${slug}` },
    openGraph: {
      title: piece.title,
      description: piece.excerpt ?? undefined,
      type: "article",
      url: `/p/${slug}`,
      publishedTime: piece.published_at ?? undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: piece.title,
      description: piece.excerpt ?? undefined,
    },
  };
}

export default async function ReadingPage({ params }: ReadingPageProps) {
  const { slug } = await params;
  // service-role read: the reader is anonymous and np_pieces is RLS owner-only,
  // so the fetch bypasses RLS but the WHERE filter (published + shareable) is
  // the real gate. drafts and private pieces can never surface here.
  const piece = await loadPiece(slug);
  if (!piece) {
    notFound();
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const canonical = `${base}/p/${slug}`;
  const body = coercePlateValue(piece.body);

  return (
    <main className="relative min-h-screen w-full overflow-hidden">
      <Atmosphere />
      <ReadingProgress />
      <div className="np-skyline absolute inset-x-0 top-0 h-px" aria-hidden />

      <div className="relative z-10">
        <nav
          className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6 font-mono text-[11px] uppercase tracking-[0.3em]"
          style={{ color: "var(--lunari-fg-subtle)" }}
        >
          <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--nova-accent)" }}
              aria-hidden
            />
            nova press
          </Link>
          <Link href="/" className="transition-opacity hover:opacity-80">
            all pieces
          </Link>
        </nav>

        <article className="mx-auto px-6 pb-32 pt-16 md:pt-24">
          <header className="mx-auto mb-12 max-w-[65ch] md:mb-16">
            <h1
              className="font-serif text-4xl font-medium leading-[1.05] tracking-tight md:text-[3.25rem]"
              style={{ color: "var(--lunari-fg-primary)" }}
            >
              {piece.title}
            </h1>
            <div
              className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tabular-nums tracking-[0.22em]"
              style={{ color: "var(--lunari-fg-muted)" }}
            >
              <span>{formatPublished(piece.published_at)}</span>
              <span aria-hidden style={{ color: "var(--lunari-fg-subtle)" }}>
                ·
              </span>
              <span>{readingTime(piece.word_count)}</span>
            </div>
            <div
              className="mt-8 h-px w-14"
              style={{ background: "var(--nova-accent)" }}
              aria-hidden
            />
          </header>

          <div className="prose-nova np-dropcap mx-auto">
            <PieceBody value={body} />
          </div>

          <div className="np-print-hide mx-auto mt-16 max-w-[65ch]">
            <div
              className="mb-6 h-px w-full"
              style={{ background: "var(--lunari-border)" }}
              aria-hidden
            />
            <ShareRow url={canonical} title={piece.title} />
          </div>

          <footer
            className="mx-auto mt-20 max-w-[65ch] font-mono text-[11px] uppercase tracking-[0.24em]"
            style={{ color: "var(--lunari-fg-subtle)" }}
          >
            <span style={{ color: "var(--nova-accent)" }}>nova press</span>
            <span className="px-2" aria-hidden>
              ·
            </span>
            the writing studio
          </footer>
        </article>
      </div>
    </main>
  );
}
