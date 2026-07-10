/**
 * Supabase data service
 * All database operations go through here.
 *
 * Once Supabase is configured (client/.env), these methods will work.
 * Tables needed (see backend/supabase/migrations for schema):
 *
 * - profiles: user profiles (id, display_name, coc_player_tag, avatar_url, role)
 * - bases: base layout sharing
 * - strategies: attack strategy library
 * - announcements: leadership announcements
 * - events: calendar events
 * - chat_messages: chat history (with channel)
 * - war_rosters: CWL war assignments
 * - badges: user achievements
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase.js'

// ── Profiles ──────────────────────────────────────────────────

export const profilesService = {
  async getProfile(userId) {
    if (!isSupabaseConfigured()) return null
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (error) throw error
    return data
  },

  async updateProfile(userId, updates) {
    if (!isSupabaseConfigured()) return null
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async linkPlayerTag(userId, playerTag) {
    return this.updateProfile(userId, { coc_player_tag: playerTag })
  }
}

// ── Bases ─────────────────────────────────────────────────────

export const basesService = {
  async list(tag = null) {
    if (!isSupabaseConfigured()) return []
    let query = supabase
      .from('bases')
      .select(`
        *,
        author:profiles(display_name, avatar_url)
      `)
      .order('created_at', { ascending: false })

    if (tag) query = query.eq('tag', tag)

    const { data, error } = await query
    if (error) throw error
    return data
  },

  async create(base) {
    if (!isSupabaseConfigured()) return null
    const { data, error } = await supabase
      .from('bases')
      .insert(base)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async delete(id) {
    if (!isSupabaseConfigured()) return
    const { error } = await supabase.from('bases').delete().eq('id', id)
    if (error) throw error
  }
}

// ── Strategies ────────────────────────────────────────────────

export const strategiesService = {
  async list(thLevel = null) {
    if (!isSupabaseConfigured()) return []
    let query = supabase
      .from('strategies')
      .select(`
        *,
        author:profiles(display_name, avatar_url)
      `)
      .order('created_at', { ascending: false })

    if (thLevel) query = query.eq('town_hall', thLevel)

    const { data, error } = await query
    if (error) throw error
    return data
  },

  async create(strategy) {
    if (!isSupabaseConfigured()) return null
    const { data, error } = await supabase
      .from('strategies')
      .insert(strategy)
      .select()
      .single()
    if (error) throw error
    return data
  }
}

// ── Announcements ─────────────────────────────────────────────

export const announcementsService = {
  async list() {
    if (!isSupabaseConfigured()) return []
    const { data, error } = await supabase
      .from('announcements')
      .select(`
        *,
        author:profiles(display_name, role)
      `)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  },

  async create(announcement) {
    if (!isSupabaseConfigured()) return null
    const { data, error } = await supabase
      .from('announcements')
      .insert(announcement)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async togglePin(id, pinned) {
    if (!isSupabaseConfigured()) return
    const { error } = await supabase
      .from('announcements')
      .update({ pinned })
      .eq('id', id)
    if (error) throw error
  }
}

// ── Events / Calendar ─────────────────────────────────────────

export const eventsService = {
  async list(month = null) {
    if (!isSupabaseConfigured()) return []
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('start_date', { ascending: true })

    if (error) throw error
    return data
  },

  async create(event) {
    if (!isSupabaseConfigured()) return null
    const { data, error } = await supabase
      .from('events')
      .insert(event)
      .select()
      .single()
    if (error) throw error
    return data
  }
}

// ── Chat Messages (persistence, real-time via Socket.IO) ─────

export const chatService = {
  async getMessages(channelId, limit = 50) {
    if (!isSupabaseConfigured()) return []
    const { data, error } = await supabase
      .from('chat_messages')
      .select(`
        *,
        author:profiles(display_name, avatar_url)
      `)
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data.reverse()
  }
}
