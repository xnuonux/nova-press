/**
 * voice forks ... the pure lens behind named strands of voice history.
 *
 * a fork is not an entity, a row, or a settings object. it IS the set of
 * np_voice_snapshots rows that share the same non-null fork_label, owned by one
 * writer. "your voice" is the null strand (every chunk-1/2 snapshot, since they
 * are born with fork_label null). a snapshot belongs to exactly one strand at a
 * time, so strands PARTITION a writer's history. the roster is derived from the
 * loaded rows (never stored), the active strand is client state, and switching
 * strands is a read-time re-color ... it never mutates voice_profiles and never
 * touches the live writing voice.
 *
 * pure (imports only the VoiceSnapshot type), so the panel and a unit test share
 * it. the null-lens pass-through below is the byte-identity gate: the default
 * view feeds the chunk-1/2 timeline the exact same array reference it always had.
 */

import type { VoiceSnapshot } from "@/lib/db/voice-snapshots";

const LABEL_MAX = 40;

/**
 * the lens. active === null is a STRICT referential pass-through ... it returns
 * the SAME array (never a copy, never all.filter), so the default timeline +
 * compare + ask see byte-identical input to chunk 2. a named strand is an
 * order-preserving filter.
 */
export function resolveForkView(all: VoiceSnapshot[], active: string | null): VoiceSnapshot[] {
  if (active === null) return all;
  return all.filter((s) => s.forkLabel === active);
}

/**
 * the writer's named strands, derived from the loaded snapshots ... never stored,
 * so it can never disagree with the rows. first-seen order, null excluded, deduped.
 */
export function deriveForkRoster(snapshots: VoiceSnapshot[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of snapshots) {
    const label = s.forkLabel;
    if (label && !seen.has(label)) {
      seen.add(label);
      out.push(label);
    }
  }
  return out;
}

/**
 * canonicalize a raw label into one strand key: trim, collapse internal
 * whitespace, lowercase (the voice rule), and cap to 40 CODE POINTS to match the
 * postgres char_length(<=40) CHECK ... Array.from counts code points, not utf-16
 * units, so an emoji can't slip past the column constraint and silently fail the
 * write. empty / whitespace-only becomes null (un-name).
 */
export function normalizeForkLabel(raw: string): string | null {
  const collapsed = raw.trim().replace(/\s+/g, " ").toLowerCase();
  if (collapsed.length === 0) return null;
  const points = Array.from(collapsed);
  return points.length > LABEL_MAX ? points.slice(0, LABEL_MAX).join("") : collapsed;
}
