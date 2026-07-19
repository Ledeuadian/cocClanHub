import { useState, useEffect, useRef } from 'react'
import {
  Plus, Home, Star, Search, X, Upload, Link as LinkIcon,
  Loader2, Image as ImageIcon, ExternalLink, Swords,
  Wheat, Trophy, Layers, Trash2
} from 'lucide-react'
import Badge from '../components/ui/Badge.jsx'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../context/AuthContext.jsx'

const TAGS = [
  { id: 'war',     label: 'War',     icon: Swords,  color: 'danger'  },
  { id: 'farming', label: 'Farming', icon: Wheat,   color: 'warning' },
  { id: 'hybrid',  label: 'Hybrid',  icon: Layers,  color: 'elixir'  },
  { id: 'trophy',  label: 'Trophy',  icon: Trophy,  color: 'info'    }
]

export default function Bases() {
  const { user, profile } = useAuth()
  const [bases, setBases] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [favorites, setFavorites] = useState(() => {
    try {
      const stored = localStorage.getItem('coc_base_favorites')
      return stored ? JSON.parse(stored) : {}
    } catch { return {} }
  })

  // Persist favorites whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('coc_base_favorites', JSON.stringify(favorites))
    } catch {}
  }, [favorites])

  function toggleFavorite(baseId) {
    setFavorites((prev) => {
      const next = { ...prev }
      if (next[baseId]) {
        delete next[baseId]
      } else {
        next[baseId] = { at: Date.now() }
      }
      return next
    })
  }

  // Mirror profile.is_admin into local state for fast synchronous checks
  const [isAdmin, setIsAdmin] = useState(!!profile?.is_admin)
  useEffect(() => {
    setIsAdmin(!!profile?.is_admin)
  }, [profile])

  function canDeleteBase(base) {
    if (!user) return false
    if (isAdmin || profile?.is_admin) return true
    return base.author_id === user.id
  }

  async function handleDelete(base) {
    if (!confirm(`Delete "${base.name}"? This cannot be undone.`)) return
    const { error } = await supabase.from('bases').delete().eq('id', base.id)
    if (error) { alert(error.message); return }
    // Optionally remove the uploaded image from storage too
    if (base.image_url) {
      try {
        const marker = `/storage/v1/object/public/bases/`
        const idx = base.image_url.indexOf(marker)
        if (idx !== -1) {
          const path = base.image_url.substring(idx + marker.length)
          await supabase.storage.from('bases').remove([path])
        }
      } catch {}
    }
    setBases((prev) => prev.filter((b) => b.id !== base.id))
  }

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
    .filter((b) => filter === 'all' || (Array.isArray(b.tags) ? b.tags.includes(filter) : b.tag === filter))
    .filter((b) => (b.name || '').toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="page-container space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Base Layouts</h1>
          <p className="text-clan-muted text-sm">Share and discover clan-approved bases</p>
        </div>
        <button className="btn-primary" onClick={() => {
          if (!user) { alert('Please sign in to share a base layout.'); return }
          setModalOpen(true)
        }}>
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
          <button
            onClick={() => setFilter('all')}
            className={`btn-secondary capitalize ${filter === 'all' ? '!border-clan-accent !text-clan-accent' : ''}`}
          >
            all
          </button>
          {TAGS.map((t) => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={`btn-secondary capitalize ${filter === t.id ? '!border-clan-accent !text-clan-accent' : ''}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Base Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((base) => (
          <div key={base.id} className="card hover:border-clan-accent/40 transition-colors group">
            {/* Thumbnail */}
            <div className="aspect-video bg-gradient-to-br from-clan-surface to-clan-darker rounded-lg mb-3 overflow-hidden relative group-hover:scale-[1.02] transition-transform">
              {base.image_url ? (
                <img
                  src={base.image_url}
                  alt={base.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Home className="w-10 h-10 text-clan-muted/50" />
                </div>
              )}
              {base.link && (
                <a
                  href={base.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-md text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Open base link"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="text-sm font-semibold leading-tight">{base.name}</h3>
              <div className="flex flex-wrap gap-1 justify-end">
                {(Array.isArray(base.tags) ? base.tags : base.tag ? [base.tag] : []).map((tg) => (
                  <Badge key={tg} variant={(TAGS.find((t) => t.id === tg)?.color) || 'default'}>
                    {tg}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-clan-muted">
              <span>by {base.author || 'Anonymous'}</span>
              <span className="font-mono">TH{base.town_hall || '?'}</span>
            </div>

            <div className="flex items-center justify-between mt-2 pt-2 border-t border-clan-border">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggleFavorite(base.id) }}
                title={favorites[base.id] ? 'Remove from favorites' : 'Add to favorites'}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors ${
                  favorites[base.id]
                    ? 'text-clan-gold bg-clan-gold/10 hover:bg-clan-gold/20'
                    : 'text-clan-muted hover:text-clan-gold hover:bg-clan-surface'
                }`}
              >
                <Star
                  className={`w-3.5 h-3.5 ${favorites[base.id] ? 'fill-clan-gold text-clan-gold' : 'text-clan-gold'}`}
                />
                {favorites[base.id] ? 'Favorited' : 'Favorite'}
              </button>
              <div className="flex items-center gap-1">
                {canDeleteBase(base) && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDelete(base) }}
                    title="Delete this base layout"
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-md text-clan-muted hover:text-red-400 hover:bg-red-900/30 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                )}
                {base.link ? (
                  <a
                    href={base.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary !py-1 !px-3 !text-xs !gap-1.5"
                  >
                    <ExternalLink className="w-3 h-3" /> Use Layout
                  </a>
                ) : (
                  <span className="text-xs text-clan-muted">{base.downloads || 0} downloads</span>
                )}
              </div>
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

      {/* Share Base Modal */}
      {modalOpen && (
        <ShareBaseModal
          user={user}
          onClose={() => setModalOpen(false)}
          onCreated={(newBase) => {
            setBases((prev) => [newBase, ...prev])
            setModalOpen(false)
          }}
        />
      )}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────
   Share Base Modal
   Fields: name, link (required), screenshot image upload, tag
   ────────────────────────────────────────────────────────────────── */
function ShareBaseModal({ user, onClose, onCreated }) {
  const fileInputRef = useRef(null)
  const [name, setName] = useState('')
  const [link, setLink] = useState('')
  const [tags, setTags] = useState(['war'])
  const [townHall, setTownHall] = useState(12)
  const [description, setDescription] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  function handleImageChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('Image must be under 8 MB')
      return
    }
    setError('')
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setImagePreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  function clearImage() {
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!link.trim()) { setError('A link is required to share a base'); return }
    if (!name.trim()) { setError('Please give your base a name'); return }

    if (tags.length === 0) { setError('Pick at least one category'); return }

    setUploading(true)
    setError('')

    try {
      let imageUrl = null

      // 1. Upload screenshot to storage if provided
      if (imageFile && user) {
        const ext = imageFile.name.split('.').pop() || 'png'
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from('bases')
          .upload(path, imageFile, { upsert: false })
        if (uploadErr) throw uploadErr

        const { data: pub } = supabase.storage
          .from('bases')
          .getPublicUrl(path)
        imageUrl = pub?.publicUrl || null
      }

      // 2. Insert base row
      const { data, error: insertErr } = await supabase
        .from('bases')
        .insert({
          name: name.trim(),
          link: link.trim(),
          tags,
          town_hall: Number(townHall) || 0,
          description: description.trim() || null,
          image_url: imageUrl,
          author_id: user?.id || null
        })
        .select()
        .single()

      if (insertErr) throw insertErr
      onCreated(data)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to share base')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-lg my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold">Share Base Layout</h2>
            <p className="text-xs text-clan-muted">Upload a screenshot, drop a link, pick a category</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-clan-surface text-clan-muted hover:text-clan-text transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Image upload */}
          <div>
            <label className="block text-xs font-medium text-clan-muted mb-1.5">
              Screenshot (optional)
            </label>

            {imagePreview ? (
              <div className="relative rounded-lg overflow-hidden border border-clan-border">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full aspect-video object-cover"
                />
                <button
                  type="button"
                  onClick={clearImage}
                  className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-red-600 rounded-md text-white transition-colors"
                  title="Remove image"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full aspect-video border-2 border-dashed border-clan-border hover:border-clan-accent rounded-lg flex flex-col items-center justify-center gap-2 text-clan-muted hover:text-clan-text transition-colors"
              >
                <ImageIcon className="w-8 h-8" />
                <span className="text-sm font-medium">Click to upload screenshot</span>
                <span className="text-xs">PNG, JPG up to 8 MB</span>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
          </div>

          {/* Name */}
          <div>
            <label htmlFor="base-name" className="block text-xs font-medium text-clan-muted mb-1.5">
              Base name *
            </label>
            <input
              id="base-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Anti-3-Star TH12 War Base"
              className="input"
            />
          </div>

          {/* Link */}
          <div>
            <label htmlFor="base-link" className="block text-xs font-medium text-clan-muted mb-1.5">
              Link *
            </label>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-clan-muted" />
              <input
                id="base-link"
                type="url"
                required
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://link-to-your-base.com"
                className="input pl-9"
              />
            </div>
          </div>

          {/* Town Hall + Notes row */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="base-th" className="block text-xs font-medium text-clan-muted mb-1.5">
                TH Level
              </label>
              <input
                id="base-th"
                type="number"
                min="1"
                max="18"
                value={townHall}
                onChange={(e) => setTownHall(e.target.value)}
                className="input"
              />
            </div>
            <div className="col-span-2">
              <label htmlFor="base-desc" className="block text-xs font-medium text-clan-muted mb-1.5">
                Notes (optional)
              </label>
              <input
                id="base-desc"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Quick notes..."
                className="input"
              />
            </div>
          </div>

          {/* Tag selector */}
          <div>
            <label className="block text-xs font-medium text-clan-muted mb-1.5">
              Categories * <span className="text-clan-muted/70 font-normal">(choose one or more)</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TAGS.map((t) => {
                const Icon = t.icon
                const active = tags.includes(t.id)
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      setTags((prev) =>
                        prev.includes(t.id)
                          ? prev.filter((x) => x !== t.id)
                          : [...prev, t.id]
                      )
                    }
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${
                      active
                        ? 'border-clan-accent bg-clan-accent/10 text-clan-accent'
                        : 'border-clan-border bg-clan-surface/40 text-clan-muted hover:text-clan-text hover:border-clan-border/80'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-semibold">{t.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-900/30 border border-red-700 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
              disabled={uploading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" /> Share Base
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
