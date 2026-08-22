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

  // Web Push (VAPID keys — generate with: npx web-push generate-vapid-keys)
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '',
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || '',
  vapidSubject: process.env.VAPID_SUBJECT || 'mailto:admin@cocclanhub.app',

  // Firebase Cloud Messaging (Android/iOS push via Capacitor)
  fcmServerKey: process.env.FCM_SERVER_KEY || '',

  isSupabaseConfigured() {
    return Boolean(this.supabaseUrl && this.supabaseServiceKey)
  },

  isCocConfigured() {
    return Boolean(this.cocApiToken)
  },

  isPushConfigured() {
    return Boolean(this.vapidPublicKey && this.vapidPrivateKey)
  }
}

export default config