import { useState, useEffect, useMemo } from 'react'
import { CalendarDays, Swords, Trophy, Users, Gift, Clock, ChevronLeft, ChevronRight } from 'lucide-react'
import Badge from '../components/ui/Badge.jsx'
import { supabase } from '../lib/supabase.js'

const ICON_MAP = { cwl: Swords, games: Trophy, social: Users }
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * Parse a date string loosely:
 *   - 'YYYY-MM-DD' (ISO, e.g. from a Supabase date column)
 *   - 'YYYY-MM-DDTHH:mm:ssZ'
 *   Returns a { year, month0, day } triple so we don't trip on timezones.
 */
function parseEventDate(value) {
  if (!value) return null
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  return {
    year: Number(m[1]),
    month0: Number(m[2]) - 1,
    day: Number(m[3]),
  }
}

/** Build a month grid (6 rows × 7 cols) for the given year/month. */
function buildMonthGrid(year, month0) {
  const firstOfMonth = new Date(year, month0, 1)
  const startWeekday = firstOfMonth.getDay() // 0 = Sun
  const daysInMonth = new Date(year, month0 + 1, 0).getDate()
  const daysInPrev = new Date(year, month0, 0).getDate()

  const cells = []
  // Leading days from previous month
  for (let i = startWeekday - 1; i >= 0; i--) {
    cells.push({ day: daysInPrev - i, inMonth: false, monthOffset: -1 })
  }
  // Days of this month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, inMonth: true, monthOffset: 0 })
  }
  // Trailing days from next month to fill 6 rows (42 cells)
  let nextDay = 1
  while (cells.length < 42) {
    cells.push({ day: nextDay++, inMonth: false, monthOffset: 1 })
  }
  return cells
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export default function Calendar() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  // Viewed month — starts on "today's" month, but the user can navigate.
  const [viewDate, setViewDate] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const today = useMemo(() => new Date(), [])

  // Load events
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

  // Pre-index event days within the viewed month for O(1) lookup
  const eventDayMap = useMemo(() => {
    const map = new Map() // day-of-month -> [events]
    for (const e of events) {
      const parsed = parseEventDate(e.event_date)
      if (!parsed) continue
      if (parsed.year === viewDate.getFullYear() && parsed.month0 === viewDate.getMonth()) {
        const list = map.get(parsed.day) || []
        list.push(e)
        map.set(parsed.day, list)
      }
    }
    return map
  }, [events, viewDate])

  const monthLabel = viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })
  const cells = useMemo(
    () => buildMonthGrid(viewDate.getFullYear(), viewDate.getMonth()),
    [viewDate]
  )

  const goPrev = () =>
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  const goNext = () =>
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
  const goToday = () => {
    const now = new Date()
    setViewDate(new Date(now.getFullYear(), now.getMonth(), 1))
  }

  return (
    <div className="page-container space-y-6">
      <div>
        <h1 className="page-title">Clan Calendar</h1>
        <p className="text-clan-muted text-sm">{monthLabel}</p>
      </div>

      {/* Calendar grid */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title !mb-0">{monthLabel}</h2>
          <div className="flex gap-2">
            <button onClick={goPrev} className="btn-secondary !p-2 text-xs" aria-label="Previous month">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={goToday} className="btn-secondary !px-3 !py-1.5 text-xs">
              Today
            </button>
            <button onClick={goNext} className="btn-secondary !p-2 text-xs" aria-label="Next month">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {WEEKDAY_LABELS.map((d) => (
            <div key={d} className="text-center text-xs text-clan-muted font-medium py-2">{d}</div>
          ))}
        </div>

        {/* Calendar cells */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, i) => {
            const isToday = cell.inMonth && isSameDay(
              new Date(viewDate.getFullYear(), viewDate.getMonth(), cell.day),
              today
            )
            const dayEvents = cell.inMonth ? eventDayMap.get(cell.day) || [] : []
            return (
              <div
                key={i}
                className={`aspect-square rounded-lg p-1 text-xs flex flex-col items-center justify-center transition-colors ${
                  isToday
                    ? 'bg-clan-accent/20 border border-clan-accent text-clan-accent font-bold'
                    : cell.inMonth
                    ? 'bg-clan-surface text-clan-text hover:bg-clan-card cursor-pointer'
                    : 'opacity-30'
                }`}
                title={dayEvents.map((e) => e.title).join(', ') || undefined}
              >
                {cell.day}
                {dayEvents.length > 0 && cell.inMonth && (
                  <div className="flex gap-0.5 mt-0.5">
                    {dayEvents.slice(0, 3).map((_, idx) => (
                      <span key={idx} className="w-1 h-1 rounded-full bg-clan-danger" />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Upcoming events (everything from today onwards, sorted) */}
      <div>
        <h2 className="section-title">Upcoming Events</h2>
        <div className="space-y-2">
          {events.length === 0 && !loading && (
            <p className="text-sm text-clan-muted text-center py-6">No upcoming events.</p>
          )}
          {events
            .filter((e) => {
              const p = parseEventDate(e.event_date)
              if (!p) return false
              const d = new Date(p.year, p.month0, p.day)
              return d >= new Date(today.getFullYear(), today.getMonth(), today.getDate())
            })
            .map((e) => {
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