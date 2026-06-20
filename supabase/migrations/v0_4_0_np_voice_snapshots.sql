-- nova press . v0_4_0_np_voice_snapshots
-- =====================================================================
-- the longitudinal self. every time a writer trains nova on their voice,
-- nova also photographs the freshly-distilled fingerprint into one immutable,
-- fully DENORMALIZED, append-only row here ... a point-in-time COPY, never a
-- view over voice_profiles, never an FK into its mutable body. so a snapshot
-- can NEVER drift from live voice_profiles (there is nothing joined to keep in
-- sync) and it SURVIVES gen connect's last-writer-wins churn on the shared row.
-- captured in nova's OWN code off nova's OWN ExtractedVoice, NOT a trigger on
-- the shared voice_profiles table ... a row trigger there would also fire on
-- gen connect's outreach extraction and snapshot ITS numbers into nova's
-- history (a cross-product leak), and nova does not own voice_profiles' ddl.
--
-- substrate invariants upheld: np_ prefix; the ONLY cross-product FK is
-- user_id -> auth.users(id) ON DELETE CASCADE (the user_id chain already binds
-- this to voice_profiles(user_id), so NO second FK, honouring 'nothing else');
-- four-policy RLS on auth.uid()=user_id (no redundant service-role-bypass
-- policy, atlas pattern); reuses public.tg_set_updated_at() (rows are append-
-- only in practice, but the table stays 1:1 with every other np_ table).
-- nova semver v0.4.0. design doc: docs/06-database-design.md.
-- =====================================================================
CREATE TABLE np_voice_snapshots (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- the timeline x-axis. the semantic capture-moment, distinct from created_at
  -- (row housekeeping). fed the SAME nowIso saveWriterVoice writes to
  -- voice_profiles.last_extracted_at, so a snapshot and its live row agree.
  captured_at                timestamptz NOT NULL DEFAULT now(),
  -- how this snapshot was made. text CHECK enum, the v0_3_0 channel pattern.
  -- chunk 1 always writes 'extraction'. future: 'manual' | 'import'.
  source                     text NOT NULL DEFAULT 'extraction'
                               CHECK (source IN ('extraction','manual','import')),
  -- which named fork this belongs to. null = your one true voice ('your voice').
  -- chunk 1 ALWAYS writes null; the column + its index ship now so chunk 3
  -- forks are a query change, never a migration. bounded so a label stays a tag.
  fork_label                 text CHECK (fork_label IS NULL OR char_length(fork_label) <= 40),
  -- denormalized quantitative stats (the y-axes), native types matching
  -- voice_profiles exactly (avg = integer, variance = numeric) so the copy is
  -- lossless and the rounding posture is identical to saveWriterVoice.
  sentence_length_avg        integer,
  sentence_length_variance   numeric,
  paragraph_length_avg       integer,
  paragraph_length_variance  numeric,
  formality_score            numeric,    -- 0..1
  -- denormalized jsonb fingerprints, frozen verbatim from voice-stats.
  punctuation_style          jsonb NOT NULL DEFAULT '{}'::jsonb,  -- marks per 1000 words
  emoji_signature            jsonb NOT NULL DEFAULT '{}'::jsonb,  -- {count, per_1000_words}
  -- denormalized qualitative distillation, frozen verbatim. stored jsonb here
  -- regardless of how voice_profiles types them (opening/closing_patterns are
  -- json there, idiosyncratic/avoided_phrases are text[]) ... the source is
  -- ExtractedVoice's string[] in every case, and jsonb is the clean frozen-blob
  -- shape for an immutable copy. the read layer narrows defensively either way.
  register                   text,
  vocabulary_signature       text,
  opening_patterns           jsonb NOT NULL DEFAULT '[]'::jsonb,
  closing_patterns           jsonb NOT NULL DEFAULT '[]'::jsonb,
  idiosyncratic_phrases      jsonb NOT NULL DEFAULT '[]'::jsonb,
  avoided_phrases            jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary                    text,       -- the one compact writing_overrides.summary line at capture
  -- extraction provenance, copied so each dot knows where it came from.
  extraction_model           text NOT NULL,
  extraction_confidence      numeric,    -- 0..1
  -- writing_samples_count at capture: how many pieces fed this snapshot.
  samples_count              integer NOT NULL DEFAULT 0,
  -- future-proofing slot (atlas/np pattern), no schema change for later metadata.
  metadata                   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  -- present ONLY to honour the reuse-tg_set_updated_at template; rows are
  -- append-only in practice (nova's code exposes no update path).
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

-- the timeline query: a writer's snapshots newest-first. mirrors
-- np_repurpose_outputs' (user_id, time DESC) index shape.
CREATE INDEX np_voice_snapshots_user_captured_idx
  ON np_voice_snapshots (user_id, captured_at DESC);

-- ships now (cheap, future-proof) so chunk-3 fork timelines are an added
-- .eq('fork_label', label), never a migration.
CREATE INDEX np_voice_snapshots_user_fork_captured_idx
  ON np_voice_snapshots (user_id, fork_label, captured_at DESC);

ALTER TABLE np_voice_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY np_voice_snapshots_select_own ON np_voice_snapshots
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY np_voice_snapshots_insert_own ON np_voice_snapshots
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY np_voice_snapshots_update_own ON np_voice_snapshots
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY np_voice_snapshots_delete_own ON np_voice_snapshots
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER np_voice_snapshots_set_updated_at
  BEFORE UPDATE ON np_voice_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

COMMENT ON TABLE np_voice_snapshots IS
  'nova press longitudinal voice snapshots (the longitudinal self). one immutable, fully denormalized point-in-time copy of the distilled voice per extraction. never drifts from voice_profiles because nothing is joined ... every stat is frozen in-row, surviving gen connect last-writer-wins churn on the shared row. append-only in practice, rls owner-only, written by nova press only on each voice extraction.';
