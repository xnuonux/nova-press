// nova press · the mythos · the continuity domain.
//
// continuity is the editorial brain's world-aware half: it reads a work's prose
// AGAINST its bible (v0_9_0) and raises descriptive concerns ... a name that
// drifted ("marrik" for "marik"), a noun used before it's introduced, a fact the
// prose contradicts, a timeline slip. a flag mirrors the editorial Finding: a
// descriptive message + a triage status, never a verdict. matches the
// np_continuity_flags CHECKs (v0_10_0).

/** the continuity concern kinds (matches np_continuity_flags.kind). */
export type ContinuityKind = "contradiction" | "unintroduced" | "timeline" | "name_drift" | "other";

/** the triage state, mirroring the editorial Finding (np_continuity_flags.status). */
export type ContinuityStatus = "open" | "accepted" | "dismissed";

/** one continuity concern, before it's written to np_continuity_flags. lowercase,
 *  a mirror never a verdict. the pointers are plain uuids (the work's piece, the
 *  bible entity involved); the scope carries the mention / span. */
export interface ContinuityFinding {
  kind: ContinuityKind;
  message: string;
  entityId?: string | null;
  pieceId?: string | null;
  scope?: Record<string, unknown>;
}

/** a bible entity reduced to what the deterministic pass needs: its id + the
 *  names it answers to (the entity name + every alias). */
export interface KnownName {
  entityId: string;
  name: string;
  aliases: string[];
}

/** one piece's prose to scan, with its id (so a flag points back to where the
 *  concern surfaced). */
export interface ScanPiece {
  pieceId: string;
  text: string;
}
