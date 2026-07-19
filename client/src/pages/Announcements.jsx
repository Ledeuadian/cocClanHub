import { useState, useEffect, useMemo } from 'react'
import {
  Megaphone, Pin, Plus, Clock, X, Loader2,
  Edit3, Trash2, AlertCircle, User
} from 'lucide-react'
import Badge from '../components/ui/Badge.jsx'
import Avatar from '../components/ui/Avatar.jsx'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../context/AuthContext.jsx'

/* ─── time-ago helper ────────────────────────────────────────── */
function timeAgo(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

/* ─── main page ───────────────────────────────────────────────── */
export default function Announcements() {
  const { user, profile } = useAuth()
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [composerOpen, setComposerOpen] = useState(false)
  const [editing, setEditing] = useState(null) // announcement being edited

  // Load announcements with author profile join
  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from('announcements')
        .select(`
          *,
          author:profiles!announcements_author_id_fkey (
            id, display_name, avatar_url, is_admin, platform_role
          )
        `)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })

      if (!cancelled) {
        if (!error) setAnnouncements(data || [])
        else console.error('Announcements load error:', error)
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const { pinned, others } = useMemo(() => {
    const p = announcements.filter((a) => a.pinned)
    const o = announcements.filter((a) => !a.pinned)
    return { pinned: p, others: o }
  }, [announcements])

  function canEdit(a) {
    if (!user || !profile) return false
    if (profile.is_admin) return true
    return a.author_id === user.id
  }

  function handleCreated(created) {
    setAnnouncements((prev) => [created, ...prev])
    setComposerOpen(false)
  }

  function handleUpdated(updated) {
    setAnnouncements((prev) =>
      prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a))
    )
    setEditing(null)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this announcement?')) return
    const { error } = await supabase.from('announcements').delete().eq('id', id)
    if (error) { alert(error.message); return }
    setAnnouncements((prev) => prev.filter((a) => a.id !== id))
  }

  async function handleTogglePin(a) {
    const { error } = await supabase
      .from('announcements')
      .update({ pinned: !a.pinned })
      .eq('id', a.id)
    if (error) { alert(error.message); return }
    setAnnouncements((prev) =>
      prev.map((x) => (x.id === a.id ? { ...x, pinned: !x.pinned } : x))
    )
  }

  return (
    <div className="page-container space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Announcements</h1>
          <p className="text-clan-muted text-sm">Official updates from clan leadership</p>
        </div>
        {user ? (
          <button
            className="btn-primary"
            onClick={() => setComposerOpen(true)}
          >
            <Plus className="w-4 h-4" /> New Post
          </button>
        ) : null}
      </div>

      {!user && (
        <div className="card flex items-center gap-3 text-sm text-clan-muted">
          <AlertCircle className="w-4 h-4" />
          Sign in to post announcements.
        </div>
      )}

      {loading ? (
        <div className="card text-center py-12 text-clan-muted">
          <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin" />
          Loading announcements...
        </div>
      ) : announcements.length === 0 ? (
        <div className="card text-center py-12 text-clan-muted">
          <Megaphone className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No announcements yet.</p>
          {user && (
            <button
              onClick={() => setComposerOpen(true)}
              className="btn-secondary mt-4"
            >
              <Plus className="w-4 h-4" /> Be the first to post
            </button>
          )}
        </div>
      ) : (
        <>
          {pinned.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-clan-muted text-xs uppercase tracking-wider">
                <Pin className="w-4 h-4" /> Pinned
              </div>
              {pinned.map((a) => (
                <AnnouncementCard
                  key={a.id}
                  announcement={a}
                  canEdit={canEdit(a)}
                  onEdit={() => setEditing(a)}
                  onDelete={() => handleDelete(a.id)}
                  onTogglePin={() => handleTogglePin(a)}
                />
              ))}
            </div>
          )}

          {others.length > 0 && (
            <div className="space-y-3">
              <div className="text-clan-muted text-xs uppercase tracking-wider">
                {pinned.length > 0 ? 'Recent' : 'All Announcements'}
              </div>
              {others.map((a) => (
                <AnnouncementCard
                  key={a.id}
                  announcement={a}
                  canEdit={canEdit(a)}
                  onEdit={() => setEditing(a)}
                  onDelete={() => handleDelete(a.id)}
                  onTogglePin={() => handleTogglePin(a)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {composerOpen && (
        <AnnouncementComposer
          user={user}
          onClose={() => setComposerOpen(false)}
          onCreated={handleCreated}
        />
      )}

      {editing && (
        <AnnouncementComposer
          user={user}
          initial={editing}
          onClose={() => setEditing(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  )
}

/* ─── card ────────────────────────────────────────────────────── */
function AnnouncementCard({ announcement, canEdit, onEdit, onDelete, onTogglePin }) {
  const { title, body, pinned, created_at, author } = announcement

  return (
    <div className={`card ${pinned ? 'border-clan-accent/30 bg-clan-accent/5' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          {author?.avatar_url ? (
            <Avatar src={author.avatar_url} alt={author.display_name} size="md" />
          ) : (
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              pinned ? 'bg-clan-accent/20 text-clan-accent' : 'bg-clan-card text-clan-muted'
            }`}>
              <Megaphone className="w-5 h-5" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="text-sm font-semibold">{title}</h3>
            {pinned && (
              <Badge variant="warning">
                <Pin className="w-3 h-3" /> Pinned
              </Badge>
            )}
          </div>

          {body && (
            <p className="text-sm text-clan-text/90 whitespace-pre-wrap mb-2">{body}</p>
          )}

          <div className="flex items-center gap-2 text-xs text-clan-muted flex-wrap">
            <span className="flex items-center gap-1.5">
              {author?.avatar_url ? (
                <Avatar src={author.avatar_url} alt={author.display_name} size="sm" className="!w-4 !h-4" />
              ) : (
                <User className="w-3 h-3" />
              )}
              <span className="font-medium text-clan-text">
                {author?.display_name || 'Unknown'}
              </span>
            </span>
            {author?.platform_role && (
              <Badge variant="info" className="capitalize">
                {author.platform_role}
              </Badge>
            )}
            {author?.is_admin && (
              <Badge variant="warning">Admin</Badge>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> {timeAgo(created_at)}
            </span>
          </div>
        </div>

        {canEdit && (
          <div className="flex flex-col gap-1 shrink-0">
            <button
              type="button"
              onClick={onTogglePin}
              title={pinned ? 'Unpin' : 'Pin'}
              className="p-1.5 rounded-md hover:bg-clan-surface text-clan-muted hover:text-clan-text transition-colors"
            >
              <Pin className={`w-3.5 h-3.5 ${pinned ? 'text-clan-accent' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onEdit}
              title="Edit"
              className="p-1.5 rounded-md hover:bg-clan-surface text-clan-muted hover:text-clan-text transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              title="Delete"
              className="p-1.5 rounded-md hover:bg-red-900/40 text-clan-muted hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── composer (new + edit) ───────────────────────────────────── */
function AnnouncementComposer({ user, initial, onClose, onCreated, onUpdated }) {
  const isEdit = Boolean(initial)
  const [title, setTitle] = useState(initial?.title || '')
  const [body, setBody] = useState(initial?.body || '')
  const [pinned, setPinned] = useState(initial?.pinned || false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required'); return }
    if (!body.trim()) { setError('Body is required'); return }
    if (!user) { setError('You must be signed in'); return }

    setSaving(true)
    setError('')

    const payload = {
      title: title.trim(),
      body: body.trim(),
      pinned
    }

    const selectQuery = `
      *,
      author:profiles!announcements_author_id_fkey (
        id, display_name, avatar_url, is_admin, platform_role
      )
    `

    try {
      if (isEdit) {
        const { data, error: err } = await supabase
          .from('announcements')
          .update(payload)
          .eq('id', initial.id)
          .select(selectQuery)
          .single()
        if (err) throw err
        onUpdated(data)
      } else {
        const { data, error: err } = await supabase
          .from('announcements')
          .insert({ ...payload, author_id: user.id })
          .select(selectQuery)
          .single()
        if (err) throw err
        onCreated(data)
      }
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to save announcement')
    } finally {
      setSaving(false)
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">
            {isEdit ? 'Edit Announcement' : 'New Announcement'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-clan-surface text-clan-muted hover:text-clan-text"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label htmlFor="ann-title" className="block text-xs font-medium text-clan-muted mb-1.5">
              Title *
            </label>
            <input
              id="ann-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="War schedule update"
              className="input"
              maxLength={120}
            />
          </div>

          {/* Body */}
          <div>
            <label htmlFor="ann-body" className="block text-xs font-medium text-clan-muted mb-1.5">
              Body *
            </label>
            <textarea
              id="ann-body"
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Share the details..."
              className="input min-h-[140px] resize-y"
              rows={6}
              maxLength={2000}
            />
            <div className="text-xs text-clan-muted text-right mt-1">
              {body.length} / 2000
            </div>
          </div>

          {/* Pin toggle */}
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="w-4 h-4 rounded border-clan-border bg-clan-surface accent-clan-accent"
            />
            <Pin className="w-3.5 h-3.5 text-clan-accent" />
            <span>Pin this announcement</span>
          </label>

          {error && (
            <div className="p-3 rounded-lg bg-red-900/30 border border-red-700 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                </>
              ) : isEdit ? (
                'Save Changes'
              ) : (
                <>
                  <Plus className="w-4 h-4" /> Post
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}