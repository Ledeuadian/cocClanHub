-- ═══════════════════════════════════════════════════════════════════
-- COC Clan Hub — Supabase Database Schema
-- ═══════════════════════════════════════════════════════════════════
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- Or via: npx supabase db push (if using Supabase CLI)
-- ═══════════════════════════════════════════════════════════════════

-- ── Enums ─────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE clan_role AS ENUM ('leader', 'coLeader', 'elder', 'member', 'guest');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE channel_type AS ENUM ('text', 'announcement', 'voice');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE event_type AS ENUM ('war', 'cwl', 'clan_games', 'social', 'raid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── PROFILES ──────────────────────────────────────────────────────
-- Linked to auth.users(id) via trigger

CREATE TABLE IF NOT EXISTS profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name    TEXT NOT NULL DEFAULT 'New Member',
  avatar_url      TEXT,
  email           TEXT,
  -- Clash of Clans linkage (the "Supercell OAuth" replacement)
  coc_player_tag  TEXT UNIQUE,
  coc_player_name TEXT,
  coc_town_hall   INTEGER,
  coc_trophies    INTEGER,
  coc_verified    BOOLEAN DEFAULT FALSE,
  coc_verified_at TIMESTAMPTZ,    -- when token verification happened
  coc_linked_at   TIMESTAMPTZ,    -- when tag was first linked
  -- Admin approval workflow
  -- status: 'pending' (default) | 'approved' | 'rejected'
  approval_status           TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approval_requested_at     TIMESTAMPTZ DEFAULT NOW(),
  approval_reviewed_at      TIMESTAMPTZ,
  approval_reviewed_by      UUID REFERENCES profiles(id),
  approval_note             TEXT,        -- admin's reason on rejection
  is_admin                  BOOLEAN DEFAULT FALSE,   -- admins can approve others
  -- Platform role
  platform_role   clan_role DEFAULT 'member',
  bio             TEXT DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_approval_status ON profiles(approval_status);
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin) WHERE is_admin = TRUE;

-- ── CLAN SETTINGS (single clan or multi-clan) ────────────────────

CREATE TABLE IF NOT EXISTS clans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  tag         TEXT NOT NULL UNIQUE,
  description TEXT,
  badge_url   TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── CHAT CHANNELS ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS channels (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  type        channel_type DEFAULT 'text',
  description TEXT,
  position    INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── CHAT MESSAGES ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id  TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  author_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  text        TEXT NOT NULL,
  edited      BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── ANNOUNCEMENTS ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS announcements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  author_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  pinned      BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── BASE LAYOUTS ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bases (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  link        TEXT,
  tag         TEXT CHECK (tag IN ('war', 'farming', 'hybrid', 'trophy')),
  town_hall   INTEGER NOT NULL,
  author_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  rating      REAL DEFAULT 0,
  downloads   INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── ATTACK STRATEGIES ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS strategies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  video_url   TEXT,
  army_type   TEXT,
  difficulty  TEXT CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  town_hall   INTEGER NOT NULL,
  author_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  views       INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── EVENTS / CALENDAR ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  description TEXT,
  type        event_type DEFAULT 'social',
  start_date  TIMESTAMPTZ NOT NULL,
  end_date    TIMESTAMPTZ,
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── WAR ROSTERS (CWL) ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS war_rosters (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  war_id      TEXT,
  day_number  INTEGER NOT NULL,
  member_tag  TEXT NOT NULL,
  assigned    BOOLEAN DEFAULT FALSE,
  attacked    BOOLEAN DEFAULT FALSE,
  stars       INTEGER DEFAULT 0,
  destruction REAL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── BADGES / ACHIEVEMENTS ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS badges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  icon_url    TEXT,
  criteria    JSONB
);

CREATE TABLE IF NOT EXISTS user_badges (
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id    UUID REFERENCES badges(id) ON DELETE CASCADE,
  awarded_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, badge_id)
);

-- ── POLLS / VOTES ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS polls (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question    TEXT NOT NULL,
  options     JSONB NOT NULL DEFAULT '[]',
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  closes_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS poll_votes (
  poll_id     UUID REFERENCES polls(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  option_idx  INTEGER NOT NULL,
  voted_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (poll_id, user_id)
);

-- ═══════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_chat_messages_channel ON chat_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_bases_tag ON bases(tag);
CREATE INDEX IF NOT EXISTS idx_bases_th ON bases(town_hall);
CREATE INDEX IF NOT EXISTS idx_strategies_th ON strategies(town_hall);
CREATE INDEX IF NOT EXISTS idx_events_start ON events(start_date);
CREATE INDEX IF NOT EXISTS idx_announcements_pinned ON announcements(pinned);

-- ═══════════════════════════════════════════════════════════════════
-- AUTO-CREATE PROFILE ON SIGNUP
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    display_name,
    coc_player_tag,
    coc_player_name,
    coc_town_hall,
    coc_trophies,
    coc_verified,
    coc_linked_at,
    approval_status,
    approval_requested_at
  )
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'display_name', 'New Member'),
    new.raw_user_meta_data->>'coc_player_tag',
    new.raw_user_meta_data->>'coc_player_name',
    (new.raw_user_meta_data->>'coc_town_hall')::INTEGER,
    (new.raw_user_meta_data->>'coc_trophies')::INTEGER,
    CASE WHEN new.raw_user_meta_data->>'coc_player_tag' IS NOT NULL THEN TRUE ELSE FALSE END,
    CASE WHEN new.raw_user_meta_data->>'coc_player_tag' IS NOT NULL THEN NOW() ELSE NULL END,
    -- New users start as 'pending' unless explicitly marked approved in metadata
    COALESCE(new.raw_user_meta_data->>'approval_status', 'pending'),
    NOW()
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ═══════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE war_rosters ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all, update own
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Admins can update any profile (for approval workflow).
-- The check compares the caller's id against a profile with is_admin = true.
CREATE POLICY "profiles_update_admin" ON profiles FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

-- Chat: authenticated users can read/write
CREATE POLICY "chat_select_auth" ON chat_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "chat_insert_auth" ON chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);

-- Announcements: all can read, only co-leaders+ can write (simplified for now)
CREATE POLICY "ann_select_all" ON announcements FOR SELECT USING (true);
CREATE POLICY "ann_insert_auth" ON announcements FOR INSERT TO authenticated WITH CHECK (true);

-- Bases: all can read, authenticated can insert own
CREATE POLICY "bases_select_all" ON bases FOR SELECT USING (true);
CREATE POLICY "bases_insert_auth" ON bases FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "bases_update_own" ON bases FOR UPDATE TO authenticated USING (auth.uid() = author_id);

-- Strategies: same pattern
CREATE POLICY "strat_select_all" ON strategies FOR SELECT USING (true);
CREATE POLICY "strat_insert_auth" ON strategies FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);

-- Events: all can read, authenticated can create
CREATE POLICY "events_select_all" ON events FOR SELECT USING (true);
CREATE POLICY "events_insert_auth" ON events FOR INSERT TO authenticated WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════
-- SEED DATA (default channels)
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO channels (id, name, type, description, position) VALUES
  ('general',           'general',           'text',          'General clan chat', 0),
  ('war-planning',      'war-planning',      'text',          'War strategy and attack planning', 1),
  ('base-building',     'base-building',     'text',          'Base design discussion', 2),
  ('off-topic',         'off-topic',         'text',          'Non-Clash discussions', 3),
  ('donation-requests', 'donation-requests', 'text',          'Request troops here', 4)
ON CONFLICT (id) DO NOTHING;