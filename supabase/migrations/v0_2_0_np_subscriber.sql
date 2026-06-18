-- nova press · v0_2_0_np_subscriber
-- =====================================================================
-- subscriber capture for the published reading view. an anonymous reader on
-- /p/[slug] leaves their email; it is attributed to the PIECE OWNER (the
-- writer). owner-only RLS so a writer manages their own list; the anonymous
-- INSERT is done server-side via the service role (the same boundary the
-- public read of np_pieces already uses), never through a public RLS policy.
--
-- substrate invariants upheld: np_ prefix, cross-product FK only to
-- auth.users(id) (piece_id is a plain uuid, no FK, to stay clear of the
-- "nothing else" rule), RLS four-policy CRUD on auth.uid()=user_id, reuses
-- public.tg_set_updated_at(). nova semver v0.2.0.
-- design doc: docs/06-database-design.md.
-- =====================================================================
CREATE TABLE np_subscriber (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email        text NOT NULL CHECK (position('@' in email) > 1 AND length(email) <= 320),
  piece_id     uuid,
  source_slug  text,
  status       text NOT NULL DEFAULT 'subscribed' CHECK (status IN ('subscribed','unsubscribed')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- one email per writer (case-insensitive); a re-subscribe is idempotent.
CREATE UNIQUE INDEX np_subscriber_user_email_uniq
  ON np_subscriber (user_id, lower(email));

-- the writer's list, newest first.
CREATE INDEX np_subscriber_user_created_idx
  ON np_subscriber (user_id, created_at DESC);

ALTER TABLE np_subscriber ENABLE ROW LEVEL SECURITY;

CREATE POLICY np_subscriber_select_own ON np_subscriber
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY np_subscriber_insert_own ON np_subscriber
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY np_subscriber_update_own ON np_subscriber
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY np_subscriber_delete_own ON np_subscriber
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER np_subscriber_set_updated_at
  BEFORE UPDATE ON np_subscriber
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

COMMENT ON TABLE np_subscriber IS
  'Nova Press subscriber capture from /p/[slug]. Attributed to the piece owner (writer). RLS owner-only; anonymous reader inserts go through the service role server-side, never a public insert policy.';
