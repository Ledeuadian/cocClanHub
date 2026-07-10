# 🔐 Supabase Auth & Database Setup Guide

This guide walks you through connecting your COC Clan Hub to Supabase for real authentication, persistent data, and **Clash of Clans account linking** (no Google/Discord — just your in-game player tag verified via the official Supercell API).

---

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up (free)
2. Click **"New project"**
3. Pick a name (e.g. `coc-clan-hub`) and a strong database password
4. Choose the **closest region** to your users
5. Wait ~2 minutes for it to provision

---

## 2. Get Your API Keys

1. In your Supabase project, go to **Project Settings → API** (gear icon in left sidebar)
2. You'll see three values:
   - **Project URL** — looks like `https://abcdefg.supabase.co`
   - **`anon` `public` key** — long JWT starting with `eyJ...`
   - **`service_role` `secret` key** — long JWT, keep this SECRET (server only)

---

## 3. Add Credentials to `.env`

### Frontend (`client/.env`)
```env
VITE_SUPABASE_URL=https://abcdefg.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...your-anon-key
```

### Backend (`backend/.env`) — optional, for server-side actions
```env
SUPABASE_URL=https://abcdefg.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOi...your-service-role-key
```

> ⚠️ **Never** put the `service_role` key in `client/.env` — it has admin access to your entire database. Only the backend uses it.

---

## 4. Run the Database Migration

The migration creates 11 tables, Row Level Security policies, triggers (auto-creates a profile when a user signs up), and seed data for chat channels.

### Option A — Supabase SQL Editor (easiest)
1. In your Supabase project, go to **SQL Editor** (left sidebar)
2. Click **"New query"**
3. Open the file `backend/supabase/migrations/001_initial_schema.sql` from this repo
4. Copy **all** its contents and paste into the editor
5. Click **"Run"** (or press Ctrl/Cmd + Enter)
6. You should see "Success. No rows returned" — that's expected

### Option B — CLI
```bash
cd backend
npm install
npm run migrate
```

---

## 5. Set Up the COC API (for "Sign in with Clash of Clans")

The Login page has a **"Sign in with Clash of Clans"** button that lets users sign up/log in by entering their in-game player tag. To enable this:

1. Register at [developer.clashofclans.com](https://developer.clashofclans.com)
2. Create a new API key
3. **Whitelist your backend server's IP** (required by Supercell)
4. Add to `backend/.env`:
   ```env
   COC_API_TOKEN=your-api-token
   COC_CLAN_TAG=#YOURCLANTAG
   ```
5. Restart the backend server

When a user signs in with COC, the app:
1. Calls your backend's `/api/coc/players/:tag` endpoint
2. The backend proxies to `api.clashofclans.com/v1/players/:tag` using your API key
3. If the player exists, the tag is verified and stored in their `profiles` row

**How users find their tag:** in-game, tap their profile → the tag (e.g. `#P8L8Y0QJ`) is shown under their name.

> Note: You can also sign up the old-fashioned way (email + password). The COC tag is then linked separately on the Profile page. The COC login is just the "Supercell-native" path — no third-party OAuth.

---

## 6. Configure Email Auth (Optional)

By default, Supabase requires email confirmation before sign-in. To change this:

1. In Supabase: **Authentication → Providers → Email**
2. Toggle **"Confirm email"** off if you want passwordless instant login

---

> **Note on email branding:** Supabase's built-in emails will come from `noreply@mail.app.supabase.com` with sender name "Supabase Auth". Supabase **does not allow** changing the sender name, subject, or "from" address unless you set up **custom SMTP** — which requires owning a domain (e.g. `clanhub.com`) and an email-sending service like Resend, Amazon SES, or Postmark. Until you have a domain, the emails will look like they come from Supabase. This is a Supabase platform limitation, not a bug.

---

## 7. Restart Your Dev Server

```bash
# Stop your current vite process (Ctrl+C)
cd client
npx vite
```

You should see the **dev-mode warning banner disappear** from the Login page.

---

## 8. Make Yourself the First Admin

After running the migration, sign up with your account. Then promote yourself to admin in Supabase:

```sql
-- Replace 'your@email.com' with the email you signed up with
UPDATE profiles
SET is_admin = TRUE,
    approval_status = 'approved'
WHERE email = 'your@email.com';
```

Now visit `http://localhost:5173/admin` — if you've been marked as admin (next step), you'll see the pending approval queue. No secret needed — your Supabase login IS your admin auth.

---

## ✅ Test the Full Flow

1. **Sign Up** with your email + password
   - You should be redirected to a "Check your inbox" screen
   - Click the confirmation link in the email
   - You land on the dashboard, signed in
2. **Sign Out** from the topbar menu
3. **Sign In** with the same credentials
4. Try **"Sign in with Clash of Clans"** — enter your in-game tag, get verified, land on the dashboard
5. Check **Table Editor → profiles** in Supabase — your user has a profile row automatically (via the trigger in the migration)

---

## 🗂️ What Got Created

| Table | Purpose |
|-------|---------|
| `profiles` | Auto-created on signup. Stores display name, avatar, COC player tag, role |
| `clans` | Multi-clan support (future) |
| `channels` | Chat channels (5 seeded) |
| `chat_messages` | Channel chat history |
| `announcements` | Pinned + recent posts from leadership |
| `bases` | Base layout sharing |
| `strategies` | Attack strategy library |
| `events` | Calendar events |
| `war_rosters` | CWL assignments |
| `badges` + `user_badges` | Achievements |
| `polls` + `poll_votes` | Clan voting |

All tables have **Row Level Security** policies:
- Anyone can read profiles, channels, announcements, bases, strategies, events
- Authenticated users can create/edit their own content
- Chat messages are tied to the author

---

## 🐛 Troubleshooting

**"Invalid API key"** — Double-check the URL and anon key in `client/.env`. Restart vite.

**"relation 'profiles' does not exist"** — Run the SQL migration in step 4.

**OAuth button does nothing** — Check that you enabled the provider in Supabase and the redirect URI matches exactly.

**Email confirmation never arrives** — Check spam. In dev, you can disable email confirmation under Authentication → Providers → Email.

**Profile doesn't auto-create on signup** — Make sure you ran the **full** migration including the trigger at the bottom.

---

## 🚀 Next Steps

Once auth works, you're ready to:
- Wire the existing `services/data.js` to read/write real Supabase data
- Add real-time chat via the backend Socket.IO server
- Set up push notifications for war alerts
- Build the recruitment page with COC API + Supabase form submission
