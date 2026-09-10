-- ═══════════════════════════════════════════════════════════════════
-- 008_chat_messages_realtime.sql — add chat_messages to Realtime
-- ═══════════════════════════════════════════════════════════════════
-- 003 only added direct_messages to the supabase_realtime publication.
-- Without the publication entry, INSERTs on chat_messages never emit
-- realtime events — so channel chat had NO live delivery path (only
-- the 15s HTTP poll). This fixes live channel messages.
-- ═══════════════════════════════════════════════════════════════════

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
