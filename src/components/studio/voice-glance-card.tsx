import type { VoiceCard } from "@/lib/db/voice-profile";
import { confidenceLabel, formalityLabel, rhythmLabel, trainedAgo } from "@/lib/voice/voice-card";

/**
 * your voice at a glance ... a calm, read-only portrait of the distilled voice.
 * pure display (no client, no interactivity): the register as a headline, a few
 * facets, and the phrases you lean on or steer clear of. an untrained voice
 * gets an honest, quiet prompt instead of a blank card.
 */
export function VoiceGlanceCard({ card }: { card: VoiceCard | null }) {
  if (!card) return <UntrainedGlance />;

  const meta = [
    trainedAgo(card.lastExtractedAt),
    card.writingSamplesCount > 0
      ? `${card.writingSamplesCount} ${card.writingSamplesCount === 1 ? "piece" : "pieces"} read`
      : null,
    confidenceLabel(card.extractionConfidence),
  ]
    .filter(Boolean)
    .join(" · ");

  const facets = [
    rhythmLabel(card.sentenceLengthAvg, card.sentenceLengthVariance),
    formalityLabel(card.formalityScore),
  ].filter((x): x is string => Boolean(x));

  return (
    <section
      className="np-rise rounded-xl border p-8 sm:p-10"
      style={{ background: "var(--lunari-bg-surface)", borderColor: "var(--lunari-border)" }}
    >
      <div className="flex items-baseline justify-between gap-4">
        <span
          className="font-mono text-[11px] uppercase tracking-[0.28em]"
          style={{ color: "var(--lunari-fg-subtle)" }}
        >
          your voice
        </span>
        {meta ? (
          <span
            className="font-mono text-[10px] uppercase tabular-nums tracking-[0.18em]"
            style={{ color: "var(--lunari-fg-subtle)" }}
          >
            {meta}
          </span>
        ) : null}
      </div>

      {card.register ? (
        <p
          className="mt-4 font-serif text-2xl leading-snug tracking-tight sm:text-3xl"
          style={{ color: "var(--lunari-fg-primary)" }}
        >
          {card.register}
        </p>
      ) : null}

      {card.vocabularySignature ? (
        <p
          className="mt-3 max-w-prose font-serif text-base italic leading-relaxed"
          style={{ color: "var(--lunari-fg-muted)" }}
        >
          {card.vocabularySignature}
        </p>
      ) : null}

      {facets.length > 0 ? (
        <div className="mt-6 flex flex-wrap gap-2">
          {facets.map((f) => (
            <span
              key={f}
              className="rounded-full px-3 py-1 font-mono text-[10px] lowercase tracking-[0.08em]"
              style={{ background: "var(--nova-accent-soft)", color: "var(--nova-accent)" }}
            >
              {f}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-7 grid gap-6 sm:grid-cols-2">
        <PhraseList label="opens with" phrases={card.openingPatterns} />
        <PhraseList label="closes with" phrases={card.closingPatterns} />
        <PhraseList label="leans on" phrases={card.idiosyncraticPhrases} />
        <PhraseList label="steers clear of" phrases={card.avoidedPhrases} muted />
      </div>
    </section>
  );
}

function PhraseList({
  label,
  phrases,
  muted = false,
}: {
  label: string;
  phrases: string[];
  muted?: boolean;
}) {
  if (phrases.length === 0) return null;
  return (
    <div>
      <p
        className="font-mono text-[10px] uppercase tracking-[0.2em]"
        style={{ color: "var(--lunari-fg-subtle)" }}
      >
        {label}
      </p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {phrases.slice(0, 4).map((p, i) => (
          <li
            key={`${label}-${i}`}
            className="font-serif text-sm leading-relaxed"
            style={{
              color: muted ? "var(--lunari-fg-subtle)" : "var(--lunari-fg-muted)",
              textDecoration: muted ? "line-through" : "none",
            }}
          >
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

function UntrainedGlance() {
  return (
    <section
      className="np-rise rounded-xl border border-dashed p-10 text-center"
      style={{ borderColor: "var(--lunari-border)" }}
    >
      <p className="font-serif text-2xl" style={{ color: "var(--lunari-fg-primary)" }}>
        nova hasn&apos;t heard you yet
      </p>
      <p
        className="mx-auto mt-3 max-w-sm font-serif text-base leading-relaxed"
        style={{ color: "var(--lunari-fg-muted)" }}
      >
        write a few pieces in your own voice, then train nova below ... it distills the fingerprint
        and starts mirroring you, word by word.
      </p>
    </section>
  );
}
