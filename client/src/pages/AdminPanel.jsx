/**
 * AdminPanel — review pending user registrations
 *
 * Shows each pending user as a request card with:
 * - Their in-game COC profile (mirrored from the game)
 * - Approve / Reject buttons
 *
 * Authorization: the current user must have is_admin = true in their
 * profiles row. The backend checks this from the Supabase access token.
 *
 * To make yourself admin, run in Supabase SQL Editor:
 *   UPDATE profiles SET is_admin = TRUE WHERE email = 'your@email.com';
 *
 * The in-game profile card shows: name, TH level, league, trophies,
 * best trophies, war stars, donations, clan info, role, hero levels, etc.
 * It's the same data shown in Clash of Clans → tap your profile.
 */

import { useState, useEffect } from 'react'
import { adminApi } from '../services/adminApi.js'
import { useAuth } from '../context/AuthContext.jsx'
import {
  Users, CheckCircle2, XCircle, Loader2, Trophy, Star, Gift,
  Sword, Shield, Crown, ChevronDown, ChevronUp, AlertCircle,
  Settings, RefreshCw
} from 'lucide-react'
import { formatNumber } from '../lib/utils.js'
import { cn } from '../lib/utils.js'
import { useClan } from '../context/ClanContext.jsx'

export default function AdminPanel() {
  const { profile: currentProfile } = useAuth()
  const { clanTag } = useClan()
  // Live clan tag from the backend env (via ClanContext).
  const COC_CLAN_TAG = clanTag || ''

  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [actionInProgress, setActionInProgress] = useState(null)

  const isAdmin = currentProfile?.is_admin === true

  useEffect(() => {
    if (isAdmin) loadPending()
    else setLoading(false)
  }, [isAdmin])

  async function loadPending() {
    setLoading(true)
    setError(null)
    try {
      const data = await adminApi.listPendingUsers()
      setPending(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(userId) {
    setActionInProgress(userId)
    try {
      await adminApi.approveUser(userId)
      await loadPending()
    } catch (e) {
      setError(e.message)
    } finally {
      setActionInProgress(null)
    }
  }

  async function handleReject(userId) {
    const note = window.prompt('Reason for rejection (optional):', '')
    setActionInProgress(userId)
    try {
      await adminApi.rejectUser(userId, note || '')
      await loadPending()
    } catch (e) {
      setError(e.message)
    } finally {
      setActionInProgress(null)
    }
  }

  return (
    <div className="page-container space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Shield className="w-7 h-7 text-clan-accent" /> Admin Panel
          </h1>
          <p className="text-clan-muted text-sm">Review and approve clan member registrations</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadPending} disabled={loading} className="btn-secondary text-sm">
            {loading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <><RefreshCw className="w-4 h-4" /> Refresh</>}
          </button>
        </div>
      </div>

      {/* Non-admin notice */}
      {!isAdmin && !loading && (
        <div className="card border-clan-accent/30 space-y-3">
          <div className="flex items-start gap-3">
            <Shield className="w-6 h-6 text-clan-accent shrink-0" />
            <div>
              <h2 className="font-display text-lg font-semibold">Admin privileges required</h2>
              <p className="text-sm text-clan-muted mt-1">
                Your account isn't marked as an admin. To enable admin features, run this in the Supabase SQL Editor (replace the email):
              </p>
              <pre className="mt-2 text-xs bg-clan-bg border border-clan-border rounded-lg p-3 overflow-x-auto text-clan-text">
{`UPDATE profiles
SET is_admin = TRUE,
    approval_status = 'approved'
WHERE email = 'your@email.com';`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-300 bg-red-900/20 border border-red-700/50 rounded-lg p-3 flex gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="card !p-4">
          <Users className="w-5 h-5 text-clan-accent mb-1" />
          <div className="text-2xl font-bold">{pending.length}</div>
          <div className="text-xs text-clan-muted">Pending requests</div>
        </div>
        <div className="card !p-4">
          <Trophy className="w-5 h-5 text-clan-gold mb-1" />
          <div className="text-2xl font-bold">{COC_CLAN_TAG}</div>
          <div className="text-xs text-clan-muted">Required clan</div>
        </div>
        <div className="card !p-4 col-span-2 md:col-span-1">
          <Shield className="w-5 h-5 text-clan-elixir mb-1" />
          <div className="text-2xl font-bold">
            {pending.filter(p => p.coc_full?.clan?.tag === COC_CLAN_TAG).length}
          </div>
          <div className="text-xs text-clan-muted">In our clan</div>
        </div>
      </div>

      {/* Pending list */}
      {loading ? (
        <div className="card text-center py-12 text-clan-muted">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          Loading pending users…
        </div>
      ) : pending.length === 0 ? (
        <div className="card text-center py-12 text-clan-muted">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-clan-success opacity-50" />
          <p className="text-sm">No pending registrations. All caught up!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((user) => (
            <PendingUserCard
              key={user.id}
              user={user}
              expanded={expandedId === user.id}
              onToggle={() => setExpandedId(expandedId === user.id ? null : user.id)}
              onApprove={() => handleApprove(user.id)}
              onReject={() => handleReject(user.id)}
              actionLoading={actionInProgress === user.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PendingUserCard({ user, expanded, onToggle, onApprove, onReject, actionLoading }) {
  const profile = user
  const coc = user.coc_full
  const leagueHistory = user.coc_league_history
  const inOurClan = coc?.clan?.tag === COC_CLAN_TAG
  const requestedAt = new Date(profile.approval_requested_at).toLocaleString()

  return (
    <div className={cn('card overflow-hidden', !inOurClan && 'border-red-700/50')}>
      {/* Header row */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-clan-accent to-clan-gold-dark flex items-center justify-center text-clan-darker font-bold shrink-0">
            {coc?.name?.[0] || profile.display_name?.[0] || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold truncate">{coc?.name || profile.display_name}</span>
              {coc?.role && (
                <span className={cn('text-xs px-1.5 py-0.5 rounded', roleColor(coc.role))}>
                  {roleLabel(coc.role)}
                </span>
              )}
              {inOurClan ? (
                <span className="text-xs px-1.5 py-0.5 rounded bg-green-900/40 text-green-300 border border-green-700">
                  ✓ In {COC_CLAN_TAG}
                </span>
              ) : (
                <span className="text-xs px-1.5 py-0.5 rounded bg-red-900/40 text-red-300 border border-red-700">
                  ⚠ Wrong clan ({coc?.clan?.tag || 'none'})
                </span>
              )}
            </div>
            <p className="text-xs text-clan-muted">
              {profile.email} · Requested {requestedAt}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button onClick={onToggle} className="btn-ghost text-sm">
            {expanded ? 'Hide' : 'View'} profile
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            onClick={onReject}
            disabled={actionLoading}
            className="btn-ghost text-sm text-clan-danger"
          >
            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            Reject
          </button>
          <button
            onClick={onApprove}
            disabled={actionLoading}
            className="btn-primary text-sm"
          >
            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Approve
          </button>
        </div>
      </div>

      {/* Expanded: full COC profile (mirrored from in-game) */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-clan-border">
          {user.coc_error ? (
            <div className="text-sm text-red-300">
              Could not fetch COC data: {user.coc_error}
            </div>
          ) : coc ? (
            <COCProfileCard coc={coc} leagueHistory={leagueHistory} />
          ) : (
            <div className="text-sm text-clan-muted">No COC data available.</div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * COCProfileCard — mirrors the in-game player profile screen.
 * Shows: TH level, trophies, league, war stars, donations, clan, heroes, etc.
 */
function COCProfileCard({ coc, leagueHistory }) {
  return (
    <div className="space-y-3">
      {/* Top hero: name + TH + trophies */}
      <div className="flex items-center gap-4 p-3 rounded-lg bg-gradient-to-br from-clan-surface to-clan-bg border border-clan-border">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-clan-accent to-clan-gold-dark flex flex-col items-center justify-center text-clan-darker shadow-lg">
          <span className="text-[10px] font-semibold opacity-75">TH</span>
          <span className="text-2xl font-bold leading-none">{coc.townHallLevel}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold truncate">{coc.name}</h3>
          <p className="text-xs text-clan-muted font-mono">{coc.tag}</p>
          <div className="flex items-center gap-2 mt-1">
            {coc.leagueTier?.iconUrls?.small && (
              <img src={coc.leagueTier.iconUrls.small} alt="" className="w-5 h-5" />
            )}
            <span className="text-xs text-clan-muted">{coc.leagueTier?.name}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-clan-gold">🏆 {formatNumber(coc.trophies)}</div>
          <div className="text-[10px] text-clan-muted">Best: {formatNumber(coc.bestTrophies)}</div>
        </div>
      </div>

      {/* Quick stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
        <Stat icon={Star} label="War Stars" value={coc.warStars} color="text-clan-primary" />
        <Stat icon={Gift} label="Donations" value={coc.donations} color="text-clan-elixir" />
        <Stat icon={Gift} label="Received" value={coc.donationsReceived} color="text-clan-gold" />
        <Stat icon={Sword} label="XP Level" value={coc.expLevel} color="text-clan-text" />
      </div>

      {/* Clan section */}
      {coc.clan && (
        <div className="p-3 rounded-lg bg-clan-surface border border-clan-border">
          <p className="text-xs text-clan-muted mb-2">Clan</p>
          <div className="flex items-center gap-3">
            {coc.clan.badgeUrls?.medium && (
              <img src={coc.clan.badgeUrls.medium} alt="" className="w-12 h-12" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{coc.clan.name}</p>
              <p className="text-xs text-clan-muted font-mono">
                {coc.clan.tag} · Level {coc.clan.clanLevel}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Heroes */}
      {coc.heroes?.length > 0 && (
        <div className="p-3 rounded-lg bg-clan-surface border border-clan-border">
          <p className="text-xs text-clan-muted mb-2">Heroes</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {coc.heroes.map((h) => (
              <div key={h.name} className="text-xs flex items-center justify-between px-2 py-1 rounded bg-clan-bg">
                <span className="truncate">{h.name}</span>
                <span className="font-mono text-clan-accent">Lv {h.level}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* League history */}
      {leagueHistory?.items?.length > 0 && (
        <div className="p-3 rounded-lg bg-clan-surface border border-clan-border">
          <p className="text-xs text-clan-muted mb-2">League History</p>
          <div className="space-y-1">
            {leagueHistory.items.slice(0, 5).map((season) => (
              <div key={season.id} className="flex items-center gap-2 text-xs">
                {season.leagueTier?.iconUrls?.tiny && (
                  <img src={season.leagueTier.iconUrls.tiny} alt="" className="w-4 h-4" />
                )}
                <span className="flex-1 truncate">{season.leagueTier?.name}</span>
                <span className="text-clan-gold font-mono">🏆 {season.trophies}</span>
                {season.rank > 0 && (
                  <span className="text-clan-muted">#{season.rank}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <details className="text-xs text-clan-muted">
        <summary className="cursor-pointer hover:text-clan-text">Show all achievements ({coc.achievements?.length || 0})</summary>
        <div className="mt-2 max-h-40 overflow-y-auto space-y-0.5">
          {(coc.achievements || []).map((a) => (
            <div key={a.name} className="flex items-center gap-2">
              <span className={a.stars === 3 ? 'text-clan-gold' : a.stars === 2 ? 'text-clan-muted' : 'text-clan-muted/50'}>
                {'★'.repeat(a.stars)}{'☆'.repeat(3 - a.stars)}
              </span>
              <span className="truncate flex-1">{a.name}</span>
              <span className="font-mono">{formatNumber(a.value)}/{a.target}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}

function Stat({ icon: Icon, label, value, color = 'text-clan-text' }) {
  return (
    <div className="p-2 rounded bg-clan-surface border border-clan-border">
      <div className="flex items-center gap-1 text-[10px] text-clan-muted">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <div className={cn('text-base font-bold', color)}>{formatNumber(value)}</div>
    </div>
  )
}

function roleColor(role) {
  return {
    leader: 'bg-red-900/40 text-red-300 border border-red-700',
    coLeader: 'bg-amber-900/40 text-amber-300 border border-amber-700',
    elder: 'bg-purple-900/40 text-purple-300 border border-purple-700',
    member: 'bg-slate-800 text-slate-300 border border-slate-700'
  }[role] || 'bg-slate-800 text-slate-300 border border-slate-700'
}

function roleLabel(role) {
  return { leader: 'Leader', coLeader: 'Co-Leader', elder: 'Elder', member: 'Member' }[role] || role
}
