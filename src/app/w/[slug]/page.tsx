import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { Atmosphere } from "@/components/chrome/atmosphere";
import { coercePlateValue } from "@/components/editor/plate-text";
import { PieceBody } from "@/components/reading/piece-body";
import { ReadingProgress } from "@/components/reading/reading-progress";
import { ShareRow } from "@/components/reading/share-row";
import { getPublishedWorkBySlug } from "@/lib/db/works";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

interface WorkReadingPageProps {
  params: Promise<{ slug: string }>;
}

// generateMetadata + the page both need the work; react cache collapses the two
// service-role reads in one request into a single query.
const loadWork = cache((slug: string) => getPublishedWorkBySlug(createSupabaseAdminClient(), slug));

// ~200 wpm, never under a minute.
function readingTime(words: number): string {
  return `${Math.max(1, Math.round(words / 200))} min`;
}

// "may 21, 2026", lowercased, pinned to utc so the day is deterministic across
// deploy regions.
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

export async function generateMetadata({ params }: WorkReadingPageProps): Promise<Metadata> {
  const { slug } = await params;
  const work = await loadWork(slug);
  if (!work) {
    return { title: "not found ... nova press" };
  }
  return {
    title: `${work.title} ... nova press`,
    alternates: { canonical: `/w/${slug}` },
    openGraph: {
      title: work.title,
      type: "book",
      url: `/w/${slug}`,
      releaseDate: work.publishedAt ?? undefined,
    },
    twitter: { card: "summary_large_image", title: work.title },
  };
}

// a container heading, sized by its depth in the tree (the work title is the h1,
// so a part is the next step down). a depth-0 part carries a small accent rule.
// the first body section sheds its top gap (the header already gives it room);
// later parts keep the breathing space that separates one act from the last.
function ContainerHeading({
  title,
  depth,
  isFirst,
}: {
  title: string;
  depth: number;
  isFirst: boolean;
}) {
  if (depth === 0) {
    return (
      <div className={`mx-auto mb-10 max-w-[65ch] ${isFirst ? "mt-0" : "mt-24"}`}>
        <div className="mb-4 h-px w-10" style={{ background: "var(--nova-accent)" }} aria-hidden />
        <h2
          className="font-mono text-sm uppercase tracking-[0.3em]"
          style={{ color: "var(--lunari-fg-muted)" }}
        >
          {title}
        </h2>
      </div>
    );
  }
  const size = depth === 1 ? "text-2xl md:text-3xl" : "text-xl md:text-2xl";
  return (
    <h3
      className={`mx-auto mb-6 max-w-[65ch] font-serif font-medium leading-tight ${isFirst ? "mt-0" : "mt-16"} ${size}`}
      style={{ color: "var(--lunari-fg-primary)" }}
    >
      {title}
    </h3>
  );
}

export default async function WorkReadingPage({ params }: WorkReadingPageProps) {
  const { slug } = await params;
  // service-role read gated on the work's published + shareable status; a draft
  // or private work can never surface here.
  const work = await loadWork(slug);
  if (!work) {
    notFound();
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const canonical = `${base}/w/${slug}`;
  const leafSections = work.sections.filter((s) => s.isLeaf);

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
              {work.title}
            </h1>
            <div
              className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tabular-nums tracking-[0.22em]"
              style={{ color: "var(--lunari-fg-muted)" }}
            >
              {work.publishedAt ? (
                <>
                  <span>{formatPublished(work.publishedAt)}</span>
                  <span aria-hidden style={{ color: "var(--lunari-fg-subtle)" }}>
                    ·
                  </span>
                </>
              ) : null}
              <span>{readingTime(work.wordCount)}</span>
              {work.wordCount > 0 ? (
                <>
                  <span aria-hidden style={{ color: "var(--lunari-fg-subtle)" }}>
                    ·
                  </span>
                  <span>{work.wordCount.toLocaleString()} words</span>
                </>
              ) : null}
            </div>
            <div
              className="mt-8 h-px w-14"
              style={{ background: "var(--nova-accent)" }}
              aria-hidden
            />
          </header>

          {/* the table of contents ... every section, indented by depth, anchored
              to its body below. a single-leaf work skips it (nothing to navigate). */}
          {work.sections.length > 1 ? (
            <nav
              aria-label="contents"
              className="mx-auto mb-16 max-w-[65ch] border-y py-6"
              style={{ borderColor: "var(--lunari-border)" }}
            >
              <p
                className="mb-4 font-mono text-[11px] uppercase tracking-[0.28em]"
                style={{ color: "var(--lunari-fg-subtle)" }}
              >
                contents
              </p>
              <ul className="flex flex-col gap-1.5">
                {work.sections.map((s) => (
                  <li key={s.id} style={{ paddingLeft: `${s.depth * 18}px` }}>
                    <a
                      href={`#section-${s.id}`}
                      className={
                        s.isLeaf
                          ? "font-serif text-[15px] transition-opacity hover:opacity-70"
                          : "font-mono text-[11px] uppercase tracking-[0.18em] transition-opacity hover:opacity-70"
                      }
                      style={{
                        color: s.isLeaf ? "var(--lunari-fg-muted)" : "var(--lunari-fg-subtle)",
                      }}
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}

          {/* the body ... each section in reading order. a container is a heading,
              a leaf is its title marker (a real heading, so the outline keeps
              every scene boundary) + the magazine prose beneath. */}
          {work.sections.map((s, i) => {
            const isFirst = i === 0;
            if (!s.isLeaf) {
              return (
                <section id={`section-${s.id}`} key={s.id} className="scroll-mt-24">
                  <ContainerHeading title={s.title} depth={s.depth} isFirst={isFirst} />
                </section>
              );
            }
            // a leaf sits one level below its container in the outline, capped at h6.
            const LeafHeading = `h${Math.min(s.depth + 2, 6)}` as "h2" | "h3" | "h4" | "h5" | "h6";
            return (
              <section id={`section-${s.id}`} key={s.id} className="scroll-mt-24">
                {leafSections.length > 1 ? (
                  <LeafHeading
                    className={`mx-auto mb-5 max-w-[65ch] font-mono text-[11px] font-normal uppercase tracking-[0.26em] ${isFirst ? "mt-0" : "mt-12"}`}
                    style={{ color: "var(--lunari-fg-subtle)" }}
                  >
                    {s.title}
                  </LeafHeading>
                ) : null}
                <div className="prose-nova mx-auto">
                  <PieceBody value={coercePlateValue(s.body)} />
                </div>
              </section>
            );
          })}

          <div className="np-print-hide mx-auto mt-16 max-w-[65ch]">
            <div
              className="mb-6 h-px w-full"
              style={{ background: "var(--lunari-border)" }}
              aria-hidden
            />
            <ShareRow url={canonical} title={work.title} />
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
