/**
 * partner rail ... the AI panel mount point.
 *
 * week 1: static placeholder. shows nova glyph + "nova is listening."
 * week 2: wires to plate's AIChatPlugin and `/api/ai/command`.
 *
 * the rail collapses to 32px when the flow detector signals flow state
 * (week 2 work).
 */

export function PartnerRail() {
  return (
    <aside
      className="hidden h-screen w-80 shrink-0 flex-col border-l lg:flex"
      style={{
        background: "var(--lunari-bg-surface)",
        borderColor: "var(--lunari-border)",
      }}
    >
      <header
        className="flex items-center gap-3 border-b px-6 py-5"
        style={{ borderColor: "var(--lunari-border)" }}
      >
        <div
          className="flex h-7 w-7 items-center justify-center rounded-full font-serif text-sm font-medium"
          style={{
            background: "var(--nova-accent)",
            color: "var(--lunari-bg-deep)",
          }}
        >
          N
        </div>
        <span
          className="font-serif text-base"
          style={{ color: "var(--lunari-fg-primary)" }}
        >
          nova
        </span>
        <span
          className="ml-auto h-1.5 w-1.5 rounded-full"
          style={{ background: "var(--lunari-fg-subtle)" }}
          aria-hidden
        />
      </header>

      <div className="flex flex-1 flex-col items-start gap-4 px-6 py-8">
        <p
          className="font-serif text-base leading-relaxed"
          style={{ color: "var(--lunari-fg-muted)" }}
        >
          nova is listening.
        </p>
        <p
          className="font-sans text-xs leading-relaxed"
          style={{ color: "var(--lunari-fg-subtle)" }}
        >
          partner panel comes online in week 2. for now just write. autosave runs every couple
          seconds.
        </p>
      </div>

      <footer
        className="border-t px-6 py-4 font-sans text-[11px] uppercase tracking-[0.18em]"
        style={{
          borderColor: "var(--lunari-border)",
          color: "var(--lunari-fg-subtle)",
        }}
      >
        cmd+j to invoke (later)
      </footer>
    </aside>
  );
}
