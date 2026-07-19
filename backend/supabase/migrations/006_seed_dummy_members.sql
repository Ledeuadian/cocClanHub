-- ═══════════════════════════════════════════════════════════════════
-- SEED DUMMY CLAN MEMBERS
-- ═══════════════════════════════════════════════════════════════════
-- Creates a lightweight roster table the backend merges into
-- cocService.getClanMembers when the live COC API returns an empty
-- or error result. Lets chat, member linking and war planning work
-- without a second real COC account.
--
-- Run after 005_announcement_policies.sql.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS clan_members_roster (
  tag         TEXT PRIMARY KEY,           -- COC player tag, uppercased, no '#'
  name        TEXT NOT NULL,
  role        TEXT DEFAULT 'member',      -- leader | coLeader | elder | member
  town_hall   INTEGER DEFAULT 1,
  trophies    INTEGER DEFAULT 0,
  donations   INTEGER DEFAULT 0,
  is_dummy    BOOLEAN DEFAULT TRUE        -- true = synthetic; false = your real account
);

-- The admin account's real COC tag (update this after running create-test-admin.js
-- if you used a different tag).
-- The dummy entry simulates a mid-level clan member.

INSERT INTO clan_members_roster (tag, name, role, town_hall, trophies, donations, is_dummy)
VALUES
  -- YOUR REAL TAG — change '#TEST00001' to your actual COC tag (no '#').
  -- is_dummy=FALSE so the COC API can enrich it later with live data.
  ('TEST00001', 'TestAdmin', 'leader', 16, 5200, 12000, FALSE),
  -- Dummy member for DM/chat testing
  ('DUMMY0001', 'Archer_God', 'member', 13, 4100, 3400, TRUE),
  ('DUMMY0002', 'Barb_King',  'elder',  14, 4500, 5600, TRUE),
  ('DUMMY0003', 'LavaLoon_Pro','coLeader',15, 4900, 8200, TRUE)
ON CONFLICT (tag) DO UPDATE SET
  name      = EXCLUDED.name,
  role      = EXCLUDED.role,
  town_hall = EXCLUDED.town_hall,
  trophies  = EXCLUDED.trophies,
  donations = EXCLUDED.donations;
