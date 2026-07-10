import { useState, useEffect } from 'react'
import { Trophy, Search, Plus, ExternalLink } from 'lucide-react'
import Badge from '../components/ui/Badge.jsx'
import { supabase } from '../lib/supabase.js'

export default function Strategies() {
  const [strategies, setStrategies] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from('strategies')
        .select('*')
        .order('created_at', { ascending: false })
      if (!cancelled) {
        if (!error) setStrategies(data || [])
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])
  return (
    <div className="page-container space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Attack Strategies</h1>
          <p className="text-clan-muted text-sm">Learn and share attack compositions by Town Hall</p>
        </div>
        <button className="btn-primary">
          <Plus className="w-4 h-4" /> Add Strategy
        </button>
      </div>

      {/* TH filter */}
      <div className="flex gap-2 flex-wrap">
        {['All', 'TH16', 'TH15', 'TH14', 'TH13', 'TH12'].map((th, i) => (
          <button
            key={th}
            className={`btn-secondary ${i === 0 ? '!border-clan-accent !text-clan-accent' : ''}`}
          >
            {th}
          </button>
        ))}
      </div>

      {/* Strategy cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {strategies.length === 0 && !loading && (
          <p className="text-sm text-clan-muted text-center py-6 col-span-full">
            No strategies yet. Tap “Add Strategy” to share one.
          </p>
        )}
        {strategies.map((s) => (
          <div key={s.id} className="card hover:border-clan-accent/40 transition-colors cursor-pointer">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-clan-accent to-clan-gold-dark flex items-center justify-center">
                <Trophy className="w-5 h-5 text-clan-darker" />
              </div>
              <div className="flex gap-1">
                <Badge variant="info">{s.th || 'TH?'}</Badge>
                <Badge variant={s.difficulty === 'Hard' ? 'danger' : s.difficulty === 'Medium' ? 'warning' : 'success'}>
                  {s.difficulty || '—'}
                </Badge>
              </div>
            </div>

            <h3 className="text-sm font-semibold mb-1">{s.name}</h3>
            <p className="text-xs text-clan-muted mb-3">
              Army type: <span className="text-clan-text font-medium">{s.army || '—'}</span>
            </p>

            <div className="flex items-center justify-between text-xs text-clan-muted pt-2 border-t border-clan-border">
              <span>by {s.author || 'Anonymous'}</span>
              <span>{s.views || 0} views</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tip box */}
      <div className="card bg-clan-surface border-clan-accent/30">
        <div className="flex items-start gap-3">
          <ExternalLink className="w-5 h-5 text-clan-accent mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold mb-1">Share Your Knowledge</h3>
            <p className="text-sm text-clan-muted">
              Link YouTube videos, ClashCoach replays, or write up your own attack guides.
              Tag by TH level and army composition so clanmates can easily find what they need.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
