import { useState, useEffect } from 'react'
import { Plus, Home, Star, Search } from 'lucide-react'
import Badge from '../components/ui/Badge.jsx'
import { supabase } from '../lib/supabase.js'

const tags = ['all', 'war', 'farming', 'hybrid', 'trophy']

export default function Bases() {
  const [bases, setBases] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from('bases')
        .select('*')
        .order('created_at', { ascending: false })
      if (!cancelled) {
        if (!error) setBases(data || [])
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const filtered = bases
    .filter((b) => filter === 'all' || b.tag === filter)
    .filter((b) => (b.name || '').toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="page-container space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Base Layouts</h1>
          <p className="text-clan-muted text-sm">Share and discover clan-approved bases</p>
        </div>
        <button className="btn-primary">
          <Plus className="w-4 h-4" /> Share Base
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-clan-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bases..."
            className="input pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {tags.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`btn-secondary capitalize ${filter === t ? '!border-clan-accent !text-clan-accent' : ''}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Base Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((base) => (
          <div key={base.id} className="card hover:border-clan-accent/40 transition-colors cursor-pointer group">
            {/* Thumbnail placeholder */}
            <div className="aspect-video bg-gradient-to-br from-clan-surface to-clan-darker rounded-lg mb-3 flex items-center justify-center group-hover:scale-[1.02] transition-transform">
              <Home className="w-10 h-10 text-clan-muted/50" />
            </div>

            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="text-sm font-semibold leading-tight">{base.name}</h3>
              <Badge variant={base.tag === 'war' ? 'danger' : base.tag === 'farming' ? 'success' : 'info'}>
                {base.tag}
              </Badge>
            </div>

            <div className="flex items-center justify-between text-xs text-clan-muted">
              <span>by {base.author}</span>
              <span className="font-mono">TH{base.th}</span>
            </div>

            <div className="flex items-center justify-between mt-2 pt-2 border-t border-clan-border">
              <span className="text-xs text-clan-muted flex items-center gap-1">
                <Star className="w-3 h-3 text-clan-gold" /> {base.rating}
              </span>
              <span className="text-xs text-clan-muted">{base.downloads} downloads</span>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="card text-center py-12 text-clan-muted">
          <Home className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No bases found. Be the first to share one!</p>
        </div>
      )}
    </div>
  )
}
