-- ═══════════════════════════════════════════════════════════════════
-- 007_push_subscriptions.sql
-- ═══════════════════════════════════════════════════════════════════
-- Stores per-device push notification tokens so the backend can send
-- system notifications when a user is offline (no active socket).
--
-- Supports two platforms:
--   • 'web'   → Web Push API (VAPID + Push service endpoint)
--   • 'fcm'   → Firebase Cloud Messaging (Android/iOS via Capacitor)
--
-- A single user can have many subscriptions (phone + laptop + tablet).
-- The platform column lets the sender pick the right delivery path.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  coc_tag       TEXT,                            -- COC player tag (uppercase, no '#') for tag-based lookup
  platform      TEXT NOT NULL DEFAULT 'web',     -- 'web' | 'fcm'
  endpoint      TEXT NOT NULL,                   -- Web Push endpoint URL or FCM token
  p256dh_key    TEXT,                            -- Web Push: ECDH public key (browser-generated)
  auth_key      TEXT,                            -- Web Push: auth secret (browser-generated)
  user_agent    TEXT,                            -- device label for debugging (e.g. "Pixel 7 / Chrome 120")
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_push_sub_user_id   ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_sub_coc_tag   ON push_subscriptions(coc_tag);
CREATE INDEX IF NOT EXISTS idx_push_sub_endpoint  ON push_subscriptions(endpoint);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_push_sub_updated ON push_subscriptions;
CREATE TRIGGER trg_push_sub_updated
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own subscriptions (matched by auth.uid → user_id)
CREATE POLICY "Users manage own push subs"
  ON push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
