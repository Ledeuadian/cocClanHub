/**
 * Run SQL migrations against Supabase via the Postgres /pg/query endpoint.
 *
 * Usage:
 *   node src/scripts/run-migrations.js
 *
 * The endpoint needs the SUPABASE_SERVICE_KEY (postgres_admin role) and
 * runs the SQL as the postgres user — full admin, no RLS.
 *
 * Files are read in lexical order from backend/supabase/migrations/.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { config } from '../config/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function main() {
  if (!config.isSupabaseConfigured()) {
    console.error('❌ Supabase not configured.')
    process.exit(1)
  }

  const baseUrl = config.supabaseUrl.replace(/\/$/, '')
  // pg_meta API — accepts SQL via POST /pg/query with the service role key
  const endpoint = `${baseUrl}/pg/query`

  const migrationsDir = path.join(__dirname, '..', '..', 'supabase', 'migrations')
  if (!fs.existsSync(migrationsDir)) {
    console.error(`❌ No migrations dir: ${migrationsDir}`)
    process.exit(1)
  }

  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()
  console.log(`\n📦  Running ${files.length} migration(s) against ${baseUrl}\n`)

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8')
    process.stdout.write(`  ▶️  ${file} ... `)

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.supabaseServiceKey}`,
        'apikey': config.supabaseServiceKey
      },
      body: JSON.stringify({ query: sql })
    })

    if (!res.ok) {
      const txt = await res.text()
      // Most "errors" are idempotent no-ops (IF NOT EXISTS conflicts, etc.)
      // — surface the text but keep going so the user can see what happened.
      console.log(`⚠️  HTTP ${res.status}`)
      console.log(txt.slice(0, 400))
      continue
    }

    const json = await res.json().catch(() => null)
    if (json?.error) {
      console.log(`⚠️  ${json.error.slice(0, 200)}`)
    } else {
      console.log(`✅`)
    }
  }

  console.log(`\n✅  Migrations complete.\n`)
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
