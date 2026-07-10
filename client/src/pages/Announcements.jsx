import { useState, useEffect } from 'react'
import { Megaphone, Pin, Plus, Clock } from 'lucide-react'
import Badge from '../components/ui/Badge.jsx'
import { supabase } from '../lib/supabase.js'

export default function Announcements() {
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
      if (!cancelled) {
        if (!error) setAnnouncements(data || [])
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const pinned = announcements.filter((a) => a.pinned)
  const others = announcements.filter((a) => !a.pinned)

  return (
    <div className="page-container space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Announcements</h1>
          <p className="text-clan-muted text-sm">Official updates from clan leadership</p>
        </div>
        <button className="btn-primary">
          <Plus className="w-4 h-4" /> New Post
        </button>
      </div>

      {/* Pinned */}
      {pinned.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-clan-muted text-xs uppercase tracking-wider">
            <Pin className="w-4 h-4" /> Pinned
          </div>
          {pinned.map((a) => (
            <AnnouncementCard key={a.id} announcement={a} />
          ))}
        </div>
      )}

      {/* Recent */}
      <div className="space-y-3">
        <div className="text-clan-muted text-xs uppercase tracking-wider">Recent</div>
        {others.map((a) => (
          <AnnouncementCard key={a.id} announcement={a} />
        ))}
      </div>
    </div>
  )
}

function AnnouncementCard({ announcement }) {
  const { title, body, author, role, time, pinned } = announcement
  return (
    <div className={`card ${pinned ? 'border-clan-accent/30' : ''}`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
          pinned ? 'bg-clan-accent/20 text-clan-accent' : 'bg-clan-card text-clan-muted'
        }`}>
          <Megaphone className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold">{title}</h3>
            {pinned && <Badge variant="warning"><Pin className="w-3 h-3" /> Pinned</Badge>}
          </div>
          <p className="text-sm text-clan-muted mb-2">{body}</p>
          <div className="flex items-center gap-2 text-xs text-clan-muted">
            <span className="font-medium text-clan-text">— {author}</span>
            <Badge variant="info" className="capitalize">{role}</Badge>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> {time}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}