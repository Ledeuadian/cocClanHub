import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, TrendingDown, MessageCircle, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, Circle } from 'lucide-react'
import Avatar from '../components/ui/Avatar.jsx'
import RoleBadge from '../components/ui/RoleBadge.jsx'
import Badge from '../components/ui/Badge.jsx'
import { formatNumber } from '../lib/utils.js'
import { useClan } from '../context/ClanContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase, isSupabaseConfigured } from '../lib/supabase.js'

// Normalize a COC player tag for comparison.
//   "#2g9y2ggpj" -> "2G9Y2GGPJ"
const normalizeTag = (tag) => (tag || '').replace(/^#/, '').toUpperCase()

// Higher = more senior. Sorting by role gives a sensible order
// (Leader first) instead of alphabetical ("coLeader" before "elder").
const ROLE_RANK = {
  leader: 4,
  coLeader: 3,
  elder: 2,
  member: 1,
  notMember: 0
}

const ROLE_LABEL = {
  leader: 'Leader',
  coLeader: 'Co-Leader',
  elder: 'Elder',
  member: 'Member',
  notMember: '—'
}

// Columns the table can be sorted by.
// `accessor` lets us derive a value (e.g. role rank, donation ratio).
const COLUMNS = [
  { key: 'name',          label: 'Member',    sortable: true, align: 'left',   accessor: (m) => (m.name || '').toLowerCase() },
  { key: 'role',          label: 'Role',      sortable: true, align: 'left',   accessor: (m) => ROLE_RANK[m.role] ?? 0 },
  { key: 'townHallLevel', label: 'TH',        sortable: true, align: 'center' },
  { key: 'trophies',      label: 'Trophies',  sortable: true, align: 'right'  },
  { key: 'donations',     label: 'Donations', sortable: true, align: 'right'  },
  { key: 'donationRatio', label: 'Ratio',     sortable: true, align: 'center', accessor: (m) => m.donationsReceived > 0 ? m.donations / m.donationsReceived : 999 },
  { key: 'warStars',      label: 'War Stars', sortable: true, align: 'right'  },
  // Registered = 1 if member's COC tag matches a profile, 0 otherwise.
  // Sorting desc puts registered users on top.
  { key: 'status',        label: 'Status',    sortable: true, align: 'center', accessor: (m) => (m._registered ? 1 : 0) },
]

function SortHeader({ column, sortKey, sortDir, onSort }) {
  if (!column.sortable) {
    return <span className="font-medium">{column.label}</span>
  }
  const active = sortKey === column.key
  return (
    <button
      type="button"
      onClick={() => onSort(column.key)}
      className={`group inline-flex items-center gap-1 font-medium transition-colors ${
        active ? 'text-clan-accent' : 'text-clan-muted hover:text-clan-text'
      }`}
    >
      <span>{column.label}</span>
      {active ? (
        sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
      ) : (
        <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </button>
  )
}

export default function Members() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { members: clanMembers, loading } = useClan()
  const [search, setSearch]   = useState('')
  const [sortKey, setSortKey] = useState('role')   // default: Leader at top
  const [sortDir, setSortDir] = useState('desc')

  // ── Registered accounts (loaded from Supabase) ──────────────────
  // Map of normalized COC tag -> profile data, so we can cross-match
  // members and know who's signed up vs. who's just in the clan.
  const [registeredTags, setRegisteredTags] = useState(() => new Map())
  const [profilesLoading, setProfilesLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function loadProfiles() {
      if (!isSupabaseConfigured()) {
        setProfilesLoading(false)
        return
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, email, avatar_url, coc_player_tag, coc_verified, approval_status, is_admin')
      if (cancelled) return
      if (error) {
        console.warn('Members: failed to load profiles:', error.message)
        setProfilesLoading(false)
        return
      }
      const map = new Map()
      for (const p of data || []) {
        if (!p.coc_player_tag) continue
        map.set(normalizeTag(p.coc_player_tag), p)
      }
      setRegisteredTags(map)
      setProfilesLoading(false)
    }
    loadProfiles()
    return () => { cancelled = true }
  }, [])

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      // Roles / numeric stats / status read best descending (top first)
      const numericDesc = ['role', 'townHallLevel', 'trophies', 'donations', 'donationRatio', 'warStars', 'status']
      setSortDir(numericDesc.includes(key) ? 'desc' : 'asc')
    }
  }

  // Augment each member with a `_registered` flag + profile reference
  // and cache the count for the footer summary.
  const sortedMembers = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sortKey) || COLUMNS[0]
    const accessor = col.accessor || ((m) => m[sortKey])

    const enriched = clanMembers
      .filter((m) => {
        const q = search.toLowerCase()
        return (m.name || '').toLowerCase().includes(q) ||
               (m.tag || '').toLowerCase().includes(q)
      })
      .map((m) => {
        const profile = registeredTags.get(normalizeTag(m.tag))
        return profile ? { ...m, _registered: true, _profile: profile } : { ...m, _registered: false }
      })

    return enriched.sort((a, b) => {
      const av = accessor(a)
      const bv = accessor(b)
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      return sortDir === 'asc' ? (av || 0) - (bv || 0) : (bv || 0) - (av || 0)
    })
  }, [clanMembers, search, sortKey, sortDir, registeredTags])

  // Summary count for the page header (computed over the FULL clan,
  // not just the filtered view, so search doesn't skew the summary).
  const registeredCount = useMemo(
    () => clanMembers.filter((m) => registeredTags.has(normalizeTag(m.tag))).length,
    [clanMembers, registeredTags]
  )

  const startDM = (member) => {
    if (!member?.tag) return
    // Don't allow DMs to yourself
    if (user && user.user_metadata?.coc_player_tag === member.tag) return
    navigate(`/chat?dm=${encodeURIComponent(member.tag)}`)
  }

  const headerClass = (col) => {
    const align = col?.align || 'left'
    return `px-4 py-3 ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'} text-xs`
  }

  return (
    <div className="page-container space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="page-title">Clan Members</h1>
        <p className="text-clan-muted text-sm">
          {loading || profilesLoading
            ? 'Loading…'
            : (
              <>
                {clanMembers.length} active members ·{' '}
                <span className="text-clan-success font-semibold">{registeredCount} connected</span>
                {registeredCount < clanMembers.length && (
                  <>
                    {' · '}
                    <span className="text-clan-danger font-semibold">
                      {clanMembers.length - registeredCount} not registered
                    </span>
                  </>
                )}
                {' · tap any member to chat'}
              </>
            )}
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-clan-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or tag (#ABCD)..."
            className="input pl-9"
          />
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs text-clan-muted whitespace-nowrap">
          <ArrowUpDown className="w-3 h-3" />
          Click any column header to sort
        </div>
      </div>

      {/* Mobile sort selector — sits below the search bar so it's
          visible without scrolling past every member card */}
      <div className="md:hidden flex gap-2 overflow-x-auto pb-1 -mt-3">
        {COLUMNS.map((col) => (
          <button
            key={col.key}
            onClick={() => handleSort(col.key)}
            className={`btn-secondary !py-1 !px-3 text-xs whitespace-nowrap shrink-0 ${
              sortKey === col.key ? '!border-clan-accent !text-clan-accent' : ''
            }`}
          >
            {col.label}
            {sortKey === col.key && (sortDir === 'asc' ? ' ↑' : ' ↓')}
          </button>
        ))}
      </div>

      {/* Members Table - Desktop */}
      <div className="hidden md:block card overflow-hidden !p-0">
        <table className="w-full">
          <thead className="bg-clan-surface border-b border-clan-border">
            <tr>
              <th className={headerClass({ align: 'left' })}>#</th>
              {COLUMNS.map((col) => (
                <th key={col.key} className={headerClass(col)}>
                  <SortHeader column={col} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                </th>
              ))}
              <th className={headerClass({ align: 'right' })}>Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-clan-border">
            {sortedMembers.length === 0 && !loading && (
              <tr>
                <td colSpan={COLUMNS.length + 2} className="px-4 py-8 text-center text-clan-muted">
                  No members match “{search}”.
                </td>
              </tr>
            )}
            {sortedMembers.map((m, i) => {
              const ratio = m.donationsReceived > 0 ? (m.donations / m.donationsReceived).toFixed(1) : '∞'
              const isFreeloader = m.donations < 500 && m.donationsReceived > 500
              const isSelf = user && m.tag && user.user_metadata?.coc_player_tag === m.tag
              return (
                <tr
                  key={m.tag || m.name}
                  onClick={() => startDM(m)}
                  className={`transition-colors cursor-pointer hover:bg-clan-surface/60 ${isSelf ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={isSelf ? "That's you" : 'Click to start a DM'}
                >
                  <td className="px-4 py-3 text-clan-muted text-sm">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar
                        src={m._profile?.avatar_url}
                        fallback={m.name?.[0]}
                        alt={m.name}
                        size="sm"
                      />
                      <div>
                        <div className="text-sm font-medium">
                          {m.name}
                          {isSelf && <span className="ml-2 text-xs text-clan-accent">(you)</span>}
                        </div>
                        <div className="text-xs text-clan-muted font-mono">{m.tag}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><RoleBadge role={m.role} /></td>
                  <td className="px-4 py-3 text-center text-sm">TH {m.townHallLevel || '—'}</td>
                  <td className="px-4 py-3 text-right text-sm">🏆 {formatNumber(m.trophies || 0)}</td>
                  <td className="px-4 py-3 text-right text-sm">🎁 {formatNumber(m.donations || 0)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-sm font-mono ${isFreeloader ? 'text-clan-danger' : 'text-clan-success'}`}>
                      {ratio}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm">⭐ {formatNumber(m.warStars || 0)}</td>
                  <td className="px-4 py-3 text-center">
                    {profilesLoading ? (
                      <span className="text-xs text-clan-muted">…</span>
                    ) : m._registered ? (
                      <span
                        className="inline-flex items-center gap-1 text-xs font-medium text-clan-success"
                        title={m._profile?.email
                          ? `Registered as ${m._profile.display_name} (${m._profile.email})`
                          : 'Has an account in the system'}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span className="hidden lg:inline">Connected</span>
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 text-xs font-medium text-clan-danger"
                        title="Not registered in the system yet"
                      >
                        <Circle className="w-3.5 h-3.5" />
                        <span className="hidden lg:inline">Not connected</span>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); startDM(m) }}
                      disabled={!!isSelf}
                      className="btn-secondary !py-1 !px-2 text-xs inline-flex items-center gap-1 disabled:opacity-50"
                      title={isSelf ? "That's you" : 'Send a DM'}
                    >
                      <MessageCircle className="w-3 h-3" /> DM
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Members Cards - Mobile */}
      <div className="md:hidden space-y-2">
        {sortedMembers.map((m) => {
          const ratio = m.donationsReceived > 0 ? (m.donations / m.donationsReceived).toFixed(1) : '∞'
          const isFreeloader = m.donations < 500 && m.donationsReceived > 500
          const isSelf = user && m.tag && user.user_metadata?.coc_player_tag === m.tag
          return (
            <button
              key={m.tag || m.name}
              type="button"
              onClick={() => startDM(m)}
              disabled={!!isSelf}
              className={`w-full text-left card transition-colors hover:border-clan-accent/50 active:scale-[0.99] disabled:opacity-50`}
            >
              <div className="flex items-start gap-3">
                <Avatar
                  src={m._profile?.avatar_url}
                  fallback={m.name?.[0]}
                  alt={m.name}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">
                      {m.name}
                      {isSelf && <span className="ml-2 text-xs text-clan-accent">(you)</span>}
                    </span>
                    <RoleBadge role={m.role} />
                    {isFreeloader && (
                      <Badge variant="danger">
                        <TrendingDown className="w-3 h-3" /> Low
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-clan-muted font-mono">{m.tag}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-clan-muted flex-wrap">
                    <span className="text-clan-text font-medium">TH {m.townHallLevel || '—'}</span>
                    <span>🏆 {formatNumber(m.trophies || 0)}</span>
                    <span>🎁 {formatNumber(m.donations || 0)}</span>
                    <span className={isFreeloader ? 'text-clan-danger' : 'text-clan-success'}>{ratio}×</span>
                    <span>⭐ {formatNumber(m.warStars || 0)}</span>
                  </div>
                  {/* Mobile sort indicator */}
                  <p className="text-[10px] text-clan-accent mt-1">
                    Sorted by {COLUMNS.find(c => c.key === sortKey)?.label || 'role'} {sortDir === 'asc' ? '↑' : '↓'}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0 mt-1">
                  {profilesLoading ? (
                    <span className="text-xs text-clan-muted">…</span>
                  ) : m._registered ? (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-clan-success"
                      title={m._profile?.email
                        ? `Registered as ${m._profile.display_name} (${m._profile.email})`
                        : 'Has an account in the system'}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Connected
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-clan-danger"
                      title="Not registered in the system yet"
                    >
                      <Circle className="w-3.5 h-3.5" />
                      Not registered
                    </span>
                  )}
                  <MessageCircle className="w-5 h-5 text-clan-accent" />
                </div>
              </div>
            </button>
          )
        })}
        {sortedMembers.length === 0 && !loading && (
          <p className="text-sm text-clan-muted text-center py-6">No members match “{search}”.</p>
        )}
      </div>
    </div>
  )
}
