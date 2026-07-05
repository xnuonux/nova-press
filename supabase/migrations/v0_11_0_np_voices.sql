-- nova press · v0_11_0_np_voices
-- =====================================================================
-- scope: multi-voice STORAGE (the schema). a work holds a CAST of voices ...
-- the writer's resolved base voice is the narrator, and each row here is a
-- named DELTA voice (a character voice) that OVERLAYS the base: only the
-- fields it sets diverge. the resolve + drift-gate + per-span tagging logic is
-- pure (src/lib/voices); this is the one table the cast persists in.
--
--   - np_voices ... one named delta voice per (work, writer). name / register /
--     summary are columns (the identity + the steer); the rest of the sparse
--     overlay (vocabulary signature, opening/closing patterns, signature +
--     avoided phrases, in-voice exemplars, the optional sentence-length /
--     formality targets) rides the `overrides` jsonb so adding an overlay field
--     is never a migration. work_id is PLAIN uuid (the exit-ramp spine): a
--     deleted work leaves a harmless orphan the app never lists (reads are
--     work-scoped), no FK cascade. a voice references NOTHING in voice_profiles
--     ... it's an overlay computed at generation time, never a write to the
--     shared voice row (CLAUDE.md: nova never overloads voice_profiles with
--     per-work strands).
--
-- the per-span tagging (which blocks a voice speaks) + the work's active voice
-- ride existing jsonb (the owning node's node_metadata.voiceSpans + the work's
-- settings.activeVoiceId), so they need no column here.
--
-- substrate invariants upheld: np_ prefix; cross-product FK only to
-- auth.users(id); all intra-nova pointers plain uuid; RLS four-policy owner;
-- reuses public.tg_set_updated_at(); nova's own v0.x.
-- =====================================================================

-- ---------------------------------------------------------------------
-- np_voices
-- the work's cast of delta voices. name is the display + selection identity
-- (the stable key is the row id, so duplicate names are tolerated ... a span
-- points at an id, never a name). register + summary are the lead steer; the
-- overrides jsonb holds the rest of the sparse overlay. position orders the
-- cast in the panel. work_id plain uuid (no FK), owner-scoped by user_id.
-- ---------------------------------------------------------------------
CREATE TABLE np_voices (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- denormalized so RLS is a column compare
  work_id     uuid NOT NULL,                       -- plain uuid -> np_works
  name        text NOT NULL,                       -- the voice's name + selection label
  register    text NOT NULL DEFAULT '',            -- the lead steer: how the voice sounds
  summary     text NOT NULL DEFAULT '',            -- a one-line plain-language description
  overrides   jsonb NOT NULL DEFAULT '{}'::jsonb,  -- the rest of the sparse overlay (patterns/phrases/exemplars/targets)
  position    numeric NOT NULL DEFAULT 0,          -- cast order in the panel
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- the panel lists a work's cast in order.
CREATE INDEX np_voices_work_idx ON np_voices (work_id, position);

ALTER TABLE np_voices ENABLE ROW LEVEL SECURITY;

CREATE POLICY np_voices_select_own ON np_voices
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY np_voices_insert_own ON np_voices
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY np_voices_update_own ON np_voices
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY np_voices_delete_own ON np_voices
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER np_voices_set_updated_at
  BEFORE UPDATE ON np_voices
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

COMMENT ON TABLE np_voices IS
  'nova press multi-voice cast ... one named delta voice per (work, writer) that OVERLAYS the writer base voice (the narrator). name/register/summary are columns, the rest of the sparse overlay rides the overrides jsonb. plain-uuid work_id (no FK; reads work-scoped, orphans never listed). never writes voice_profiles ... an overlay computed at generation time. rls owner-only.';
