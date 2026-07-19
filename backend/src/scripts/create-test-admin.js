/**
 * Create a test admin account + link a COC tag for development.
 *
 * Usage:
 *   node src/scripts/create-test-admin.js
 *
 * Creates a Supabase Auth user via the service-role key, then:
 *   - Marks is_admin = TRUE
 *   - Sets approval_status = 'approved'
 *   - Links the COC player tag to the profile
 *
 * ⚠️  Only run this in development. The password is hardcoded for convenience.
 */

import { config } from '../config/index.js'
import { getSupabaseAdmin } from '../config/supabase.js'

const EMAIL     = 'admin@clan.test'
const PASSWORD  = 'ClanTest123!'
const TAG       = '#TEST00001'      // Dummy COC tag — linked to this admin
const NAME      = 'TestAdmin'

async function main() {
  if (!config.isSupabaseConfigured()) {
    console.error('❌ Supabase not configured. Set SUPABASE_URL + SUPABASE_SERVICE_KEY in backend/.env')
    process.exit(1)
  }

  const supabase = getSupabaseAdmin()

  console.log('\n🔧  Creating test admin account...\n')
  console.log(`   Email   : ${EMAIL}`)
  console.log(`   Password: ${PASSWORD}`)
  console.log(`   COC Tag : ${TAG}\n`)

  // ── 1. Create auth user (idempotent — skip if already exists) ─────────
  let userId

  // Try to find an existing user with this email
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const existing = list?.users?.find(u => u.email === EMAIL)

  if (existing) {
    console.log(`ℹ️  User already exists (id: ${existing.id}). Skipping creation.`)
    userId = existing.id
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,          // auto-verified
      user_metadata: { display_name: NAME }
    })
    if (error) {
      console.error('❌  Failed to create auth user:', error.message)
      process.exit(1)
    }
    userId = data.user.id
    console.log(`✅  Auth user created → ${userId}`)
  }

  // ── 2. Upsert profile row ─────────────────────────────────────────────
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      display_name: NAME,
      email: EMAIL,
      coc_player_tag: TAG,
      coc_player_name: NAME,
      coc_linked_at: new Date().toISOString(),
      coc_verified: true,
      coc_verified_at: new Date().toISOString(),
      is_admin: true,
      approval_status: 'approved',
      approval_reviewed_at: new Date().toISOString(),
      platform_role: 'leader'
    }, { onConflict: 'id' })
    .select()
    .single()

  if (profileErr) {
    console.error('❌  Profile upsert failed:', profileErr.message)
    process.exit(1)
  }

  console.log(`✅  Profile upserted:`)
  console.log(`     display_name  : ${profile.display_name}`)
  console.log(`     is_admin      : ${profile.is_admin}`)
  console.log(`     approval      : ${profile.approval_status}`)
  console.log(`     coc_player_tag: ${profile.coc_player_tag}`)

  console.log(`\n🎉  Done! Log in with ${EMAIL} / ${PASSWORD}\n`)
}

main().catch((err) => {
  console.error('Script failed:', err)
  process.exit(1)
})
