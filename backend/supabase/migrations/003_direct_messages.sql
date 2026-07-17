-- ═══════════════════════════════════════════════════════════════════
-- 003_direct_messages.sql — Direct messages table for 1-on-1 chat
-- ═══════════════════════════════════════════════════════════════════
-- Companion to chat_messages (channels). Stores private DMs between
-- two players, addressed by their COC player tag (#ABCD1234 form).
--
-- Run this in the Supabase SQL Editor, or via `supabase db push`.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS direct_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Canonical COC tags (uppercased, no leading #) — e.g. '2G9Y2GGPJ'
  sender_tag      TEXT NOT NULL,
  recipient_tag   TEXT NOT NULL,
  sender_name     TEXT,
  text            TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  read_at         TIMESTAMPTZ       -- when the recipient marked it read
);

-- Fast lookup for a conversation between two users (in either order)
CREATE INDEX IF NOT EXISTS idx_dm_sender_recipient
  ON direct_messages (sender_tag, recipient_tag, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dm_recipient
  ON direct_messages (recipient_tag, created_at DESC);

-- ── Realtime ─────────────────────────────────────────────────────
-- Supabase Realtime requires the publication 'supabase_realtime' to
-- include this table. The default publication covers all tables, but
-- if it was removed, run:
--   ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS direct_messages;

-- ── Row Level Security ───────────────────────────────────────────
-- Server-side code uses the service-role key (bypasses RLS).
-- Authenticated users (via Supabase Auth) can read/write their own
-- conversations. The current schema is intentionally permissive so
-- the clan hub works without individual account setup; tighten if
-- you expose the database to the public internet.
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "dm_read_participants"
    ON direct_messages FOR SELECT
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "dm_insert_anyone_authenticated"
    ON direct_messages FOR INSERT
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;