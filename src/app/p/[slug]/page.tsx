import Link from "next/link";
import { notFound } from "next/navigation";

import { Atmosphere } from "@/components/chrome/atmosphere";
import { ReadingProgress } from "@/components/reading/reading-progress";
import { ShareRow } from "@/components/reading/share-row";

interface ReadingPageProps {
  params: Promise<{ slug: string }>;
}

const PLACEHOLDER = {
  title: "the thing nobody says about AI writing tools",
  byline: "dom · founder, lunari",
  publishedAt: "may 21, 2026",
  readingTime: "3 min",
  paragraphs: [
    "every AI writing tool sells the same promise. write faster. and every one of them keeps it the same way ... by writing for you instead of with you. you press tab, the screen fills, and somewhere in the fill your voice goes quiet. you ship the draft anyway. it reads fine. that's the problem. fine is how a sentence sounds when nobody was home when it got written.",
    "your voice was never your vocabulary. it's the small wrong choices. the comma you keep that the rule says to cut. the sentence that runs long because the thought ran long. the word you reach for at 2am that you'd never reach for at noon. a model trained on everyone reads all of that as error and sands it off. what's left is smooth, and smooth is nobody.",
    "nova works from the other end. before it writes a word, it reads you ... your last essays, your last paragraphs, the rhythm of how you actually move down a page. it builds a fingerprint and stays inside it. when it hands you a line, the line sounds like you on a good day, not like the internet on an average one.",
    "and it knows when to shut up. one sentence at a time, never the whole paragraph. it offers, you decide, it never closes the deal for you. catch a real flow and it goes dark, because the worst thing a writing tool can do is talk while you're talking.",
    "then there's the part the other tools forget. the published piece. the thing a stranger actually opens. that's the artifact. that's what gets screenshotted at midnight and sent to one friend with no caption. if the editor is the kitchen, this page is the plate. most tools hand you the food on a napkin.",
    "so the page is the product too. wide margins. type that was chosen, not defaulted. a column you can sit inside for an hour without your eyes giving out. it should feel like print, because print spent four hundred years earning that feeling ... a screen can have it too, if anyone bothers to try.",
    "that's the whole thing. write in your voice. keep your voice. publish something that looks like you meant it. everything nova does underneath that is plumbing, and plumbing works best when you can't see it.",
    "the tools that write for you will keep getting faster. let them. speed was never the hard part. sounding like yourself on the page, every time ... that's the part worth building.",
  ],
};

export default async function ReadingPage({ params }: ReadingPageProps) {
  const { slug } = await params;

  // placeholder routing: only "example" resolves in week 1.
  // week 3 (T-033) hooks this to supabase pieces table.
  if (slug !== "example") {
    notFound();
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const canonical = `${base}/p/${slug}`;

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
              {PLACEHOLDER.title}
            </h1>
            <div
              className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tabular-nums tracking-[0.22em]"
              style={{ color: "var(--lunari-fg-muted)" }}
            >
              <span>{PLACEHOLDER.byline}</span>
              <span aria-hidden style={{ color: "var(--lunari-fg-subtle)" }}>
                ·
              </span>
              <span>{PLACEHOLDER.publishedAt}</span>
              <span aria-hidden style={{ color: "var(--lunari-fg-subtle)" }}>
                ·
              </span>
              <span>{PLACEHOLDER.readingTime}</span>
            </div>
            <div
              className="mt-8 h-px w-14"
              style={{ background: "var(--nova-accent)" }}
              aria-hidden
            />
          </header>

          <div className="prose-nova np-dropcap mx-auto">
            {PLACEHOLDER.paragraphs.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>

          <div className="np-print-hide mx-auto mt-16 max-w-[65ch]">
            <div
              className="mb-6 h-px w-full"
              style={{ background: "var(--lunari-border)" }}
              aria-hidden
            />
            <ShareRow url={canonical} title={PLACEHOLDER.title} />
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
