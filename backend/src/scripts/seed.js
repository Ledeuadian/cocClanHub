/**
 * Seed script — populates initial data (badges, sample content).
 *
 * Usage: npm run seed
 */

import { config } from '../config/index.js'
import { getSupabaseAdmin } from '../config/supabase.js'

const defaultBadges = [
  { name: 'First Donation', description: 'Made your first donation', icon_url: null, criteria: { type: 'donations', threshold: 1 } },
  { name: 'Generous', description: 'Donated 1000 troops', icon_url: null, criteria: { type: 'donations', threshold: 1000 } },
  { name: 'War Hero', description: 'Earned 100 war stars', icon_url: null, criteria: { type: 'war_stars', threshold: 100 } },
  { name: 'Perfect War', description: '3-starred in a clan war', icon_url: null, criteria: { type: 'perfect_attack', threshold: 1 } },
  { name: 'Active Member', description: '30 days in the clan', icon_url: null, criteria: { type: 'membership_days', threshold: 30 } },
  { name: 'Strategist', description: 'Shared 5 attack strategies', icon_url: null, criteria: { type: 'strategies_shared', threshold: 5 } },
  { name: 'Base Builder', description: 'Shared 3 base layouts', icon_url: null, criteria: { type: 'bases_shared', threshold: 3 } },
]

async function main() {
  if (!config.isSupabaseConfigured()) {
    console.error('❌ Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in backend/.env')
    process.exit(1)
  }

  const supabase = getSupabaseAdmin()

  console.log('\n🌱 Seeding badges...\n')

  const { data, error } = await supabase
    .from('badges')
    .upsert(defaultBadges, { onConflict: 'name' })
    .select()

  if (error) {
    console.error('❌ Seed failed:', error.message)
    process.exit(1)
  }

  console.log(`✅ Seeded ${data.length} badges\n`)
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})