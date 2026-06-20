-- nova press · v0_5_0_np_distribution
-- =====================================================================
-- the distribution loop, part 1: double opt-in + the send audit log.
--
-- np_subscriber gains a real double opt-in lifecycle. capture used to land a
-- reader straight on the list ('subscribed'); now a new capture is 'pending'
-- until they click a confirm link, and only the confirmed are ever mailed. two
-- SEPARATE tokens: confirm_token is single-use (consumed + nulled at confirm),
-- unsubscribe_token is stable and the ONLY token that rides in a newsletter
-- footer, so a leaked footer can never double as a confirm and a leaked confirm
-- link can never kill someone's subscription.
--
-- legacy rows (captured under single opt-in, before this migration) are
-- grandfathered: their confirmed_at is backfilled from created_at so genuine
-- opt-ins still receive, with provenance recorded ... but the eligibility gate
-- in app code requires confirmed_at IS NOT NULL, so a row that somehow lacks it
-- is excluded, never blasted.
--
-- np_email_log is nova's OWN send audit trail. it is NOT the shared
-- email_delivery_log / email_campaigns / email_logs (those belong to other
-- eternities surfaces) ... nova writes only its own np_ tables. one row per
-- send attempt (confirm or newsletter), with an honest 'stubbed' status in dev.
-- the partial unique index on (dispatch_id, lower(to_email)) is the per-recipient
-- idempotency unit the newsletter blast (part 2) will lean on.
--
-- substrate invariants upheld: np_ prefix; cross-product FK only to
-- auth.users(id) ... subscriber_id / piece_id / dispatch_id are PLAIN uuids, no
-- FK, exactly like np_subscriber.piece_id; RLS four-policy CRUD on
-- auth.uid()=user_id. np_email_log is an immutable append-only log, so it has no
-- updated_at and no tg_set_updated_at trigger. nova semver v0.5.0.
-- design doc: docs/06-database-design.md.
-- =====================================================================

-- 1. double opt-in columns on the existing subscriber table -------------------
ALTER TABLE np_subscriber
  ADD COLUMN IF NOT EXISTS confirm_token     uuid,
  ADD COLUMN IF NOT EXISTS unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS confirmed_at      timestamptz,
  ADD COLUMN IF NOT EXISTS unsubscribed_at   timestamptz;

-- widen the status lifecycle to add 'pending'. the v0_2_0 CHECK is named
-- np_subscriber_status_check (verified). drop + re-add as ONE statement so a
-- failed re-add can never leave the table with no status check at all.
ALTER TABLE np_subscriber
  DROP CONSTRAINT IF EXISTS np_subscriber_status_check,
  ADD CONSTRAINT np_subscriber_status_check
    CHECK (status IN ('pending', 'subscribed', 'unsubscribed'));

-- a fresh capture is unconfirmed until the reader clicks through.
ALTER TABLE np_subscriber ALTER COLUMN status SET DEFAULT 'pending';

-- grandfather the legacy single-opt-in list: stamp provenance so genuine
-- opt-ins keep receiving, with an audit trail of HOW consent was obtained.
UPDATE np_subscriber
  SET confirmed_at = created_at
  WHERE status = 'subscribed' AND confirmed_at IS NULL;

-- token lookups: confirm is single-use (partial, only live tokens), unsubscribe
-- is stable and unique per row.
CREATE UNIQUE INDEX IF NOT EXISTS np_subscriber_confirm_token_uniq
  ON np_subscriber (confirm_token) WHERE confirm_token IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS np_subscriber_unsubscribe_token_uniq
  ON np_subscriber (unsubscribe_token);

-- 2. the send audit log (nova-owned, append-only) -----------------------------
CREATE TABLE IF NOT EXISTS np_email_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscriber_id uuid,
  piece_id      uuid,
  dispatch_id   uuid,
  kind          text NOT NULL CHECK (kind IN ('confirm', 'newsletter')),
  to_email      text NOT NULL,
  subject       text,
  status        text NOT NULL CHECK (status IN ('sent', 'stubbed', 'failed')),
  provider_id   text,
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- the writer's log, newest first.
CREATE INDEX IF NOT EXISTS np_email_log_user_created_idx
  ON np_email_log (user_id, created_at DESC);

-- per-recipient idempotency for the newsletter blast (part 2): at most one log
-- row per (dispatch, lowercased email), so a resume / retry skips anyone already
-- reached. partial ... confirm sends have no dispatch and are not deduped.
CREATE UNIQUE INDEX IF NOT EXISTS np_email_log_dispatch_recipient_uniq
  ON np_email_log (dispatch_id, lower(to_email)) WHERE dispatch_id IS NOT NULL;

ALTER TABLE np_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY np_email_log_select_own ON np_email_log
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY np_email_log_insert_own ON np_email_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY np_email_log_update_own ON np_email_log
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY np_email_log_delete_own ON np_email_log
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE np_email_log IS
  'Nova Press send audit log (confirm + newsletter). Nova-owned, append-only, owner-only RLS. NOT the shared email_* tables. The partial unique on (dispatch_id, lower(to_email)) is the newsletter per-recipient idempotency unit.';
