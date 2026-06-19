-- nova press · v0_3_0_np_repurpose_outputs
-- =====================================================================
-- the living edition. a repurpose output (newsletter / thread / linkedin) used
-- to be ephemeral ... generated, copied, gone. now each one is persisted and
-- linked to its source piece, so when the source drifts the derivative knows it
-- is out of date and the writer can refresh it ON COMMAND. one current output
-- per piece per channel (a refresh overwrites). staleness is computed on READ
-- (source_edited_at < the piece's current last_edited_at), never stored, so
-- there is nothing to keep in sync and nothing rewrites itself behind the
-- writer's back.
--
-- substrate invariants upheld: np_ prefix; cross-product FK only to
-- auth.users(id) ... piece_id is a PLAIN uuid, no FK, exactly like
-- np_subscriber.piece_id, to honour the "nothing else" rule (an orphaned output
-- after a piece delete is harmless and RLS-scoped, never queried); RLS
-- four-policy CRUD on auth.uid()=user_id; reuses public.tg_set_updated_at().
-- nova semver v0.3.0. design doc: docs/06-database-design.md.
-- =====================================================================
CREATE TABLE np_repurpose_outputs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  piece_id         uuid NOT NULL,
  channel          text NOT NULL CHECK (channel IN ('newsletter', 'thread', 'linkedin')),
  body             text NOT NULL,
  -- watermark: the source piece's last_edited_at at the moment this was
  -- generated. the read-time staleness check is source_edited_at < the piece's
  -- current last_edited_at.
  source_edited_at timestamptz NOT NULL,
  generated_at     timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- one current output per piece per channel ... a refresh upserts on this.
CREATE UNIQUE INDEX np_repurpose_outputs_piece_channel_uniq
  ON np_repurpose_outputs (piece_id, channel);

-- the writer's outputs, most recently touched first.
CREATE INDEX np_repurpose_outputs_user_updated_idx
  ON np_repurpose_outputs (user_id, updated_at DESC);

ALTER TABLE np_repurpose_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY np_repurpose_outputs_select_own ON np_repurpose_outputs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY np_repurpose_outputs_insert_own ON np_repurpose_outputs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY np_repurpose_outputs_update_own ON np_repurpose_outputs
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY np_repurpose_outputs_delete_own ON np_repurpose_outputs
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER np_repurpose_outputs_set_updated_at
  BEFORE UPDATE ON np_repurpose_outputs
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

COMMENT ON TABLE np_repurpose_outputs IS
  'Nova Press persisted repurpose outputs (the living edition). One current row per (piece_id, channel); a refresh upserts. Staleness is computed on read (source_edited_at < piece.last_edited_at), never stored. RLS owner-only; written by nova press only.';
