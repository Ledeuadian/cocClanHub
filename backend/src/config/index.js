import dotenv from 'dotenv'

dotenv.config()

export const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  // Supabase
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || '',

  // COC API
  cocApiToken: process.env.COC_API_TOKEN || '',
  cocApiBase: 'https://api.clashofclans.com/v1',
  cocClanTag: process.env.COC_CLAN_TAG || '#2PP00000',

  isSupabaseConfigured() {
    return Boolean(this.supabaseUrl && this.supabaseServiceKey)
  },

  isCocConfigured() {
    return Boolean(this.cocApiToken)
  }
}

export default config