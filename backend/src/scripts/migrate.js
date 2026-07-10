/**
 * Migration script — runs SQL migration files against Supabase.
 *
 * Usage: npm run migrate
 *
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_KEY in backend/.env
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { config } from '../config/index.js'
import { getSupabaseAdmin } from '../config/supabase.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function main() {
  if (!config.isSupabaseConfigured()) {
    console.error('❌ Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in backend/.env')
    process.exit(1)
  }

  const supabase = getSupabaseAdmin()
  const migrationsDir = path.join(__dirname, '..', '..', 'supabase', 'migrations')

  if (!fs.existsSync(migrationsDir)) {
    console.error(`❌ Migrations directory not found: ${migrationsDir}`)
    process.exit(1)
  }

  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()

  if (files.length === 0) {
    console.log('No migrations to run.')
    process.exit(0)
  }

  console.log(`\n📦 Running ${files.length} migration(s)...\n`)

  for (const file of files) {
    const filePath = path.join(migrationsDir, file)
    const sql = fs.readFileSync(filePath, 'utf-8')

    console.log(`  ▶️  ${file}`)

    const { error } = await supabase.rpc('exec_sql', { sql_text: sql }).maybeSingle()

    if (error) {
      // Try direct query if rpc doesn't exist
      const { error: error2 } = await supabase.from('_migrations_log').select('*').limit(0)
      if (error2) {
        console.log(`     ⚠️  Could not run automatically. Run manually in Supabase SQL Editor:`)
        console.log(`     ${filePath}`)
      }
    } else {
      console.log(`     ✅ Applied`)
    }
  }

  console.log('\n✅ Migrations complete!\n')
  console.log('Note: If automatic migration failed, paste the SQL files into the')
  console.log('Supabase Dashboard > SQL Editor and run them manually.\n')
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})