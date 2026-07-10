import {
  Users,
  Swords,
  Gift,
  Trophy,
  TrendingUp,
  Shield,
  Megaphone,
  CalendarDays,
  ArrowRight,
  Loader2,
  RefreshCw,
  AlertCircle
} from 'lucide-react'
import { Link } from 'react-router-dom'
import StatCard from '../components/ui/StatCard.jsx'
import Badge from '../components/ui/Badge.jsx'
import { useClan } from '../context/ClanContext.jsx'
import { formatNumber } from '../lib/utils.js'

export default function Dashboard() {
  const { clan, warLog, loading, error, refresh } = useClan()

  // Real recent wars (last 3) from the war log.
  // Drop entries with a private/anonymized opponent or unknown team size —
  // those rows don't appear in the in-game war log UI and shouldn't show here either.
  const recentWars = (warLog || [])
    .filter((w) => w?.opponent?.name && w.teamSize > 0)
    .slice(0, 3)
    .map((w) => ({
      opponent: w.opponent.name,
      opponentTag: w.opponent.tag || '',
      result: w.result,
      stars: `${w.clan?.stars || 0}/${w.teamSize || 0}`,
      destruction: w.clan?.destructionPercentage || 0,
      date: w.endTime ? new Date(w.endTime).toLocaleDateString() : ''
    }))

  return (
    <div className="page-container space-y-6">
      {/* Error banner */}
      {error && (
        <div className="text-sm text-amber-300 bg-amber-900/20 border border-amber-700/50 rounded-lg p-3 flex gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Clan data: {error}. Showing cached or placeholder data.</span>
        </div>
      )}

      {/* Clan Header */}
      <div className="card flex flex-col md:flex-row md:items-center gap-4 relative overflow-hidden">
        {/* Decorative gradient corner */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-clan-accent/20 to-transparent rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-center gap-3 relative">
          {loading ? (
            <div className="w-16 h-16 rounded-2xl bg-clan-card flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-clan-accent animate-spin" />
            </div>
          ) : clan?.badgeUrls?.large ? (
            <img
              src={clan.badgeUrls.large}
              alt={clan.name}
              className="w-16 h-16 rounded-2xl shadow-lg shadow-clan-accent/30"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-clan-accent to-clan-gold-dark flex items-center justify-center text-clan-darker shadow-lg shadow-clan-accent/30">
              <Shield className="w-8 h-8" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="page-title text-gold-shimmer">{clan?.name || 'Loading…'}</h1>
              {clan?.level > 0 && <Badge variant="warning">Lvl {clan.level}</Badge>}
            </div>
            <p className="text-clan-muted text-sm font-mono">{clan?.tag}</p>
          </div>
        </div>
        <p className="text-clan-muted text-sm md:ml-auto md:text-right md:max-w-sm">
          {clan?.description || '—'}
        </p>
        <button
          onClick={refresh}
          disabled={loading}
          className="btn-ghost !p-2 absolute top-2 right-2 md:static"
          title="Refresh clan data"
        >
          <RefreshCw className={loading ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={Users} label="Members" value={clan?.members || 0} />
        <StatCard
          icon={Trophy}
          label="Clan Trophies"
          value={formatNumber(clan?.trophies || 0)}
          color="text-clan-gold"
        />
        <StatCard
          icon={Swords}
          label="War Wins"
          value={clan?.warWins || 0}
          color="text-clan-primary"
        />
        <StatCard
          icon={TrendingUp}
          label="Win Streak"
          value={clan?.warWinStreak || 0}
          color="text-clan-success"
        />
        <StatCard
          icon={Gift}
          label="Donations"
          value={clan?.donations?.toLocaleString() || '—'}
          color="text-clan-elixir"
        />
        <StatCard
          icon={CalendarDays}
          label="CWL"
          value={clan?.warLeague?.name || 'Unranked'}
          color="text-clan-danger"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Wars */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title !mb-0">Recent Wars</h2>
            <Link to="/wars" className="text-xs text-clan-accent hover:underline flex items-center gap-1">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {recentWars.length === 0 ? (
              <p className="text-sm text-clan-muted text-center py-4">
                {loading ? 'Loading wars…' : 'No recent wars (war log may be private)'}
              </p>
            ) : (
              recentWars.map((war, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-clan-surface border border-clan-border">
                  <div>
                    <p className="text-sm font-medium">vs {war.opponent}</p>
                    <p className="text-xs text-clan-muted">
                      {war.opponentTag} · {war.date} · {war.destruction}% destruction
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono">{war.stars}</span>
                    <Badge variant={war.result === 'win' ? 'success' : war.result === 'loss' ? 'danger' : 'default'}>
                      {war.result?.toUpperCase() || 'TIE'}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick actions + clan info */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title !mb-0">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Link to="/chat" className="btn-secondary !justify-start text-sm">
              <Megaphone className="w-4 h-4" /> Announcements
            </Link>
            <Link to="/wars" className="btn-secondary !justify-start text-sm">
              <Swords className="w-4 h-4" /> War Tracker
            </Link>
            <Link to="/members" className="btn-secondary !justify-start text-sm">
              <Users className="w-4 h-4" /> Members
            </Link>
            <Link to="/calendar" className="btn-secondary !justify-start text-sm">
              <CalendarDays className="w-4 h-4" /> Calendar
            </Link>
          </div>

          {/* Clan info summary */}
          {clan && (
            <div className="mt-4 pt-4 border-t border-clan-border space-y-2 text-xs text-clan-muted">
              {clan.location?.name && <p>📍 {clan.location.name}</p>}
              {clan.chatLanguage?.name && <p>💬 {clan.chatLanguage.name}</p>}
              {clan.requiredTrophies > 0 && <p>🏆 Required: {formatNumber(clan.requiredTrophies)}+</p>}
              {clan.requiredTownhallLevel > 1 && <p>🏰 TH{clan.requiredTownhallLevel}+ required</p>}
              {clan.isFamilyFriendly !== null && (
                <p>{clan.isFamilyFriendly ? '👨‍👩‍👧 Family friendly' : '🔞 Not family friendly'}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
