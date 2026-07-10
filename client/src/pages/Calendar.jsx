import { useState, useEffect } from 'react'
import { CalendarDays, Swords, Trophy, Users, Gift, Clock } from 'lucide-react'
import Badge from '../components/ui/Badge.jsx'
import { supabase } from '../lib/supabase.js'

const today = new Date()
const currentMonth = today.toLocaleString('default', { month: 'long', year: 'numeric' })

const ICON_MAP = { cwl: Swords, games: Trophy, social: Users }

export default function Calendar() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: true })
      if (!cancelled) {
        if (!error) setEvents(data || [])
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])
  return (
    <div className="page-container space-y-6">
      <div>
        <h1 className="page-title">Clan Calendar</h1>
        <p className="text-clan-muted text-sm">{currentMonth}</p>
      </div>

      {/* Calendar grid placeholder */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title !mb-0">{currentMonth}</h2>
          <div className="flex gap-2">
            <button className="btn-secondary !p-2 text-xs">‹</button>
            <button className="btn-secondary !p-2 text-xs">›</button>
          </div>
        </div>
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="text-center text-xs text-clan-muted font-medium py-2">{d}</div>
          ))}
        </div>
        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }, (_, i) => {
            const day = i - 1 // Adjust for month start
            const isToday = day === today.getDate() - 1
            const hasEvent = events.some((e) => (e.event_date || '').includes(`-${String(day + 1).padStart(2, '0')}`))
            return (
              <div
                key={i}
                className={`aspect-square rounded-lg p-1 text-xs flex flex-col items-center justify-center ${
                  isToday
                    ? 'bg-clan-accent/20 border border-clan-accent text-clan-accent font-bold'
                    : day >= 0 && day < 31
                    ? 'bg-clan-surface text-clan-text hover:bg-clan-card transition-colors cursor-pointer'
                    : 'opacity-30'
                }`}
              >
                {day >= 0 && day < 31 && day + 1}
                {hasEvent && day >= 0 && day < 31 && (
                  <div className="w-1 h-1 rounded-full bg-clan-danger mt-0.5" />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Upcoming events */}
      <div>
        <h2 className="section-title">Upcoming Events</h2>
        <div className="space-y-2">
          {events.length === 0 && !loading && (
            <p className="text-sm text-clan-muted text-center py-6">No upcoming events.</p>
          )}
          {events.map((e) => {
            const Icon = ICON_MAP[e.type] || CalendarDays
            return (
              <div key={e.id} className="card flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg flex flex-col items-center justify-center shrink-0 bg-clan-surface text-clan-accent">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{e.title}</p>
                  <div className="flex items-center gap-2 text-xs text-clan-muted">
                    <CalendarDays className="w-3 h-3" /> {e.event_date}
                    <Clock className="w-3 h-3 ml-1" /> {e.event_time || '—'}
                  </div>
                </div>
                <Badge variant="info">{(e.type || 'event').toUpperCase()}</Badge>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}