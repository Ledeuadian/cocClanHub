import { createClient } from '@supabase/supabase-js'
import { config } from './index.js'

/**
 * Supabase admin client using the service role key.
 * This bypasses RLS — use ONLY on the backend, never expose to frontend.
 */
let supabaseAdmin = null

export function getSupabaseAdmin() {
  if (!supabaseAdmin && config.isSupabaseConfigured()) {
    supabaseAdmin = createClient(config.supabaseUrl, config.supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  }
  return supabaseAdmin
}

export { supabaseAdmin }
