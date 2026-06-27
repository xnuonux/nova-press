-- nova press · v0_8_0_np_editorial
-- =====================================================================
-- scope: the editorial brain ... the craft axis. a piece moves along a
-- ladder of editorial STAGES (drafting -> developmental -> line -> copy ->
-- proof -> typeset -> exported), forward-gated + backward-free, orthogonal
-- to the PUBLICATION status (draft / published / scheduled / archived). a
-- PASS is one editorial review run over a piece at a stage: the lenses'
-- findings + the source watermark that makes a pass go stale when the
-- writer edits past it.
--
--   + np_pieces gains editorial_stage (the craft axis; status stays the
--     publication axis ... they are different things, finally untangled).
--   + np_editorial_passes ... one current pass per (piece, stage); a re-run
--     upserts. findings is the Finding[] jsonb; staleness is computed on
--     read (source_edited_at < the piece's last_edited_at), never stored,
--     exactly like np_repurpose_outputs.
--
-- additive + nova-scoped: every np_pieces change is a nullable / defaulted
-- ADD, so every existing row stays valid and /library + /editor + /p +
-- /w all keep working. plain-uuid spine for piece_id (no FK, the
-- np_subscriber.piece_id / np_repurpose_outputs convention) so the
-- pg_dump --table='np_*' exit ramp stays clean. RLS owner-only on the new
-- table; reuses the existing public.tg_set_updated_at() trigger.
--
-- a work has no stage column: its stage is min() over its pieces, derived
-- on read (you cannot ship the book until every chapter clears proof). the
-- transition log rides np_pieces.metadata.editorial.history (app-managed,
-- trimmed), so it needs no schema.
-- =====================================================================

-- ---------------------------------------------------------------------
-- the craft axis on np_pieces
-- additive: defaulted NOT NULL, so existing rows become 'drafting'. the
-- forward-gate + backward-free transitions are app logic (the state
-- machine); the db only bounds the value to the seven stages.
-- ---------------------------------------------------------------------
ALTER TABLE np_pieces ADD COLUMN IF NOT EXISTS editorial_stage text NOT NULL DEFAULT 'drafting'
  CHECK (editorial_stage IN
    ('drafting','developmental','line','copy','proof','typeset','exported'));

-- the work-stage rollup (min stage over a work's pieces)
CREATE INDEX IF NOT EXISTS np_pieces_stage_idx
  ON np_pieces (work_id, editorial_stage) WHERE work_id IS NOT NULL;


-- ---------------------------------------------------------------------
-- np_editorial_passes
-- one editorial review run over a piece at a stage. findings is the
-- descriptive-first Finding[] the lenses produced (lowercase, scoped to a
-- block / range, severity note|flag, never error). a pass is current for
-- its (piece, stage); a re-run upserts. staleness is read-time: a pass is
-- stale iff source_edited_at < the piece's last_edited_at (the writer has
-- edited past the words the pass reviewed). lens_keys records which lenses
-- ran (audit + selective re-run). piece_id is a PLAIN uuid (no FK), the
-- exit-ramp rule; an orphaned pass is harmless and app-cleaned.
-- ---------------------------------------------------------------------
CREATE TABLE np_editorial_passes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- denormalized so RLS is a column compare
  piece_id         uuid NOT NULL,                       -- plain uuid -> np_pieces
  stage            text NOT NULL
                     CHECK (stage IN
                       ('drafting','developmental','line','copy','proof','typeset','exported')),
  findings         jsonb NOT NULL DEFAULT '[]'::jsonb,  -- the Finding[] from the lenses
  lens_keys        text[] NOT NULL DEFAULT '{}',        -- which lenses produced this pass
  source_edited_at timestamptz NOT NULL,                -- the staleness watermark (vs piece.last_edited_at)
  pass_metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,  -- model / token / provenance, extensible
  generated_at     timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- one current pass per (piece, stage); a re-run upserts on this index
CREATE UNIQUE INDEX np_editorial_passes_piece_stage_uniq
  ON np_editorial_passes (piece_id, stage);
-- the pass-panel fetch: all of a piece's passes
CREATE INDEX np_editorial_passes_piece_idx
  ON np_editorial_passes (piece_id);

ALTER TABLE np_editorial_passes ENABLE ROW LEVEL SECURITY;

CREATE POLICY np_editorial_passes_select_own ON np_editorial_passes
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY np_editorial_passes_insert_own ON np_editorial_passes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY np_editorial_passes_update_own ON np_editorial_passes
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY np_editorial_passes_delete_own ON np_editorial_passes
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER np_editorial_passes_set_updated_at
  BEFORE UPDATE ON np_editorial_passes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

COMMENT ON TABLE np_editorial_passes IS
  'nova press editorial passes (the perfection loop). one current pass per (piece_id, stage); a re-run upserts. findings is the Finding[] jsonb from the lenses. staleness is computed on read (source_edited_at < piece.last_edited_at), never stored. plain-uuid piece_id (no FK) so the pg_dump exit ramp stays clean. rls owner-only; written by nova press only.';

COMMENT ON COLUMN np_pieces.editorial_stage IS
  'the craft axis (drafting->developmental->line->copy->proof->typeset->exported), orthogonal to the publication status. forward-gated + backward-free in app logic; a work''s stage is min() over its pieces, derived on read.';
