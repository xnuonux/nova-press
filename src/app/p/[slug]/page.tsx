import Link from "next/link";
import { notFound } from "next/navigation";

interface ReadingPageProps {
  params: Promise<{ slug: string }>;
}

const PLACEHOLDER = {
  title: "the thing nobody says about ai writing tools",
  byline: "dom · founder, lunari",
  publishedAt: "may 21, 2026",
  readingTime: "4 min",
  paragraphs: [
    "most ai writing tools auto-complete you out of your own voice. you start with something sharp, hit tab once, and ten sentences later you're reading a corporate ghost of the thing you actually meant. that's the wedge nova bites.",
    "the way to fix it isn't smarter completions. it's smaller ones. one sentence at a time. one suggestion at a time. the AI as a sparring partner, never the closer.",
    "the model has to read you back to you. your last twenty paragraphs. your last ten essays. your function-word fingerprint, your sentence rhythm, your em-dash policy. then it speaks in that grammar.",
    "and the published piece. that's the artifact. that's what people share. that's what their friends screenshot and send to other friends. if the editor is the kitchen, the published page is the plating. press treats the plate like the product.",
    "everything else is plumbing.",
  ],
};

export default async function ReadingPage({ params }: ReadingPageProps) {
  const { slug } = await params;

  // placeholder routing: only "example" resolves in week 1.
  // week 3 (T-033) hooks this to supabase pieces table.
  if (slug !== "example") {
    notFound();
  }

  return (
    <main
      className="min-h-screen w-full"
      style={{
        background: "var(--lunari-bg-deep)",
      }}
    >
      <nav
        className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6 font-sans text-xs uppercase tracking-[0.28em]"
        style={{ color: "var(--lunari-fg-subtle)" }}
      >
        <Link href="/" className="transition-colors hover:opacity-80">
          nova press
        </Link>
        <Link href="/" className="transition-colors hover:opacity-80">
          all pieces
        </Link>
      </nav>

      <article className="mx-auto px-6 pb-32 pt-16 md:pt-24">
        <header className="mx-auto mb-12 max-w-[65ch] md:mb-16">
          <h1
            className="font-serif text-4xl font-medium leading-[1.05] tracking-tight md:text-5xl"
            style={{ color: "var(--lunari-fg-primary)" }}
          >
            {PLACEHOLDER.title}
          </h1>
          <div
            className="mt-6 flex items-center gap-3 font-sans text-sm tabular-nums"
            style={{ color: "var(--lunari-fg-muted)" }}
          >
            <span>{PLACEHOLDER.byline}</span>
            <span aria-hidden>·</span>
            <span>{PLACEHOLDER.publishedAt}</span>
            <span aria-hidden>·</span>
            <span>{PLACEHOLDER.readingTime}</span>
          </div>
          <div
            className="mt-8 h-px w-12"
            style={{ background: "var(--nova-accent)" }}
            aria-hidden
          />
        </header>

        <div className="prose-nova mx-auto">
          {PLACEHOLDER.paragraphs.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>

        <footer
          className="mx-auto mt-24 max-w-[65ch] border-t pt-8 font-sans text-xs uppercase tracking-[0.22em]"
          style={{
            borderColor: "var(--lunari-border)",
            color: "var(--lunari-fg-subtle)",
          }}
        >
          published with nova press
        </footer>
      </article>
    </main>
  );
}
