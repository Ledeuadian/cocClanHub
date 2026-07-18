/**
 * <Dashboard>
 *
 * Single-scroll dashboard. Each section is a preview of one nav page:
 * clan overview → members → wars → CWL → chat → bases → strategies →
 * announcements → calendar. Each section has its own character PNG
 * (with emoji fallback) and a GSAP ScrollTrigger entrance animation.
 *
 * Sections are wired via <DashboardSection> + <StatChip> and read live
 * data from useClan / useChat. If data isn't loaded yet, a skeleton
 * placeholder appears.
 *
 * Detail pages are unchanged — every section has a "View All →" link.
 */
import { useMemo } from 'react'
import {
  Users,
  Swords,
  Gift,
  Trophy,
  TrendingUp,
  Shield,
  Megaphone,
  CalendarDays,
  Hammer,
  Target,
  Sparkles,
  Loader2,
  RefreshCw,
  AlertCircle,
  MessageSquare,
  Layers,
} from 'lucide-react'
import Badge from '../components/ui/Badge.jsx'
import ScrollVideoIntro from '../components/ScrollVideoIntro.jsx'
import DashboardSection, { StatChip } from '../components/DashboardSection.jsx'
import { useClan } from '../context/ClanContext.jsx'
import { useChat } from '../context/ChatContext.jsx'
import { formatNumber } from '../lib/utils.js'

export default function Dashboard() {
  const { clan, members, warLog, loading, error, refresh } = useClan()
  const chat = useChat() || {}

  // ── Derived data ─────────────────────────────────────────────────
  const topMembers = useMemo(
    () => [...(members || [])]
      .filter((m) => typeof m.trophies === 'number')
      .sort((a, b) => (b.trophies || 0) - (a.trophies || 0))
      .slice(0, 3),
    [members]
  )

  const recentWars = useMemo(
    () => (warLog || [])
      .filter((w) => w?.opponent?.name && w.teamSize > 0)
      .slice(0, 3)
      .map((w) => ({
        opponent: w.opponent.name,
        result: w.result,
        stars: `${w.clan?.stars || 0}/${w.teamSize || 0}`,
        destruction: w.clan?.destructionPercentage || 0,
      })),
    [warLog]
  )

  const chatChannelCount = chat.channels?.length || 0
  const chatMemberCount = chat.members?.length || 0
  const latestMessage = chat.messages?.[chat.messages.length - 1]

  return (
    <>
      <ScrollVideoIntro />
      <div className="page-container !space-y-0 !p-0">

        {/* ── Hero / clan header (full viewport) ────────────────── */}
        <header
          className="relative px-4 pt-8 pb-10 overflow-hidden flex flex-col justify-center"
          style={{
            minHeight: '100vh',
            height: '100vh',
            background:
              'radial-gradient(circle at 20% 0%, rgba(245,158,11,.18) 0%, transparent 60%), radial-gradient(circle at 80% 100%, rgba(168,85,247,.15) 0%, transparent 60%)',
          }}
        >
          {error && (
            <div className="text-sm text-amber-300 bg-amber-900/20 border border-amber-700/50 rounded-lg p-3 flex gap-2 mb-4 max-w-5xl mx-auto">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Clan data: {error}. Showing cached or placeholder data.</span>
            </div>
          )}

          <div className="card flex flex-col md:flex-row md:items-center gap-4 relative max-w-5xl mx-auto">
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
                  <h1 className="page-title text-gold-shimmer">
                    {clan?.name || 'Loading…'}
                  </h1>
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

          {/* ── Stat grid lives inside the hero so the first paint
                 already shows the numbers while sections load. ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 max-w-5xl mx-auto">
            <StatChip icon={Users}      label="Members"       value={clan?.members || 0} color="text-clan-text" />
            <StatChip icon={Trophy}     label="Trophies"      value={formatNumber(clan?.trophies || 0)} color="text-clan-gold" />
            <StatChip icon={Swords}     label="War Wins"      value={clan?.warWins || 0} color="text-clan-primary" />
            <StatChip icon={TrendingUp} label="Win Streak"    value={clan?.warWinStreak || 0} color="text-clan-success" />
            <StatChip icon={Gift}       label="Donations"     value={clan?.donations?.toLocaleString() || '—'} color="text-clan-elixir" />
            <StatChip icon={CalendarDays} label="CWL"         value={clan?.warLeague?.name || 'Unranked'} color="text-clan-danger" />
          </div>
        </header>

        {/* ── 1. Members ─────────────────────────────────────────── */}
        <DashboardSection
          index={0}
          characterKey="barbarian"
          title="Members"
          to="/members"
          icon={Users}
          loading={loading}
        >
          <div className="space-y-3">
            <p className="text-sm text-clan-muted">
              {clan?.members || 0} active members · {topMembers.length} top performers
            </p>
            <div className="flex flex-wrap gap-2">
              <StatChip label="Roster" value={clan?.members || 0} accent="#ef4444" />
              {topMembers[0] && (
                <StatChip
                  label={`#1 ${topMembers[0].name}`}
                  value={`🏆 ${formatNumber(topMembers[0].trophies)}`}
                  accent="#ef4444"
                />
              )}
              {topMembers[1] && (
                <StatChip
                  label={`#2 ${topMembers[1].name}`}
                  value={`🏆 ${formatNumber(topMembers[1].trophies)}`}
                  accent="#ef4444"
                />
              )}
              {topMembers[2] && (
                <StatChip
                  label={`#3 ${topMembers[2].name}`}
                  value={`🏆 ${formatNumber(topMembers[2].trophies)}`}
                  accent="#ef4444"
                />
              )}
            </div>
          </div>
        </DashboardSection>

        {/* ── 2. Wars ────────────────────────────────────────────── */}
        <DashboardSection
          index={1}
          characterKey="archer"
          title="War Tracker"
          to="/wars"
          icon={Swords}
          loading={loading}
        >
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <StatChip label="War Wins" value={clan?.warWins || 0} accent="#10b981" />
              <StatChip label="Streak" value={clan?.warWinStreak || 0} accent="#10b981" />
              <StatChip label="League" value={clan?.warLeague?.name || '—'} accent="#10b981" />
            </div>
            <div className="space-y-2">
              {recentWars.length === 0 ? (
                <p className="text-xs text-clan-muted">
                  {loading ? 'Loading recent wars…' : 'No recent wars (war log may be private)'}
                </p>
              ) : (
                recentWars.map((w, i) => (
                  <div
                    key={i}
                    data-stat-chip
                    className="flex items-center justify-between p-2 rounded-lg bg-clan-surface border border-clan-border"
                  >
                    <div>
                      <p className="text-sm font-medium">vs {w.opponent}</p>
                      <p className="text-xs text-clan-muted">{w.destruction}% destruction</p>
                    </div>
                    <Badge variant={w.result === 'win' ? 'success' : w.result === 'loss' ? 'danger' : 'default'}>
                      {w.result?.toUpperCase() || 'TIE'} · {w.stars}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </div>
        </DashboardSection>

        {/* ── 3. CWL Planner ─────────────────────────────────────── */}
        <DashboardSection
          index={2}
          characterKey="wizard"
          title="CWL Planner"
          to="/cwl"
          icon={Trophy}
        >
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <StatChip label="League" value={clan?.warLeague?.name || 'Unranked'} accent="#a855f7" />
              <StatChip label="CWL Wins" value={clan?.warWins || 0} accent="#a855f7" />
            </div>
            <p className="text-xs text-clan-muted">
              Coordinate CWL attacks, plan rosters, and track rounds. Tap View All to open the planner.
            </p>
          </div>
        </DashboardSection>

        {/* ── 4. Chat ────────────────────────────────────────────── */}
        <DashboardSection
          index={3}
          characterKey="minion"
          title="Chat"
          to="/chat"
          icon={MessageSquare}
        >
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <StatChip label="Channels" value={chatChannelCount} accent="#ec4899" />
              <StatChip label="Online" value={chatMemberCount} accent="#ec4899" />
            </div>
            {latestMessage && (
              <div
                data-stat-chip
                className="p-2 rounded-lg bg-clan-surface border border-clan-border"
              >
                <p className="text-xs text-clan-muted mb-0.5">Latest</p>
                <p className="text-sm">
                  <span className="font-semibold">{latestMessage.displayName || 'Member'}:</span>{' '}
                  <span className="text-clan-muted">{latestMessage.text}</span>
                </p>
              </div>
            )}
          </div>
        </DashboardSection>

        {/* ── 5. Bases ───────────────────────────────────────────── */}
        <DashboardSection
          index={4}
          characterKey="builder"
          title="Bases"
          to="/bases"
          icon={Layers}
        >
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <StatChip label="TH Level" value={clan?.requiredTownhallLevel ? `TH${clan.requiredTownhallLevel}+` : 'All'} accent="#f97316" />
              <StatChip label="Required Trophies" value={formatNumber(clan?.requiredTrophies || 0)} accent="#f97316" />
            </div>
            <p className="text-xs text-clan-muted">
              Browse war and farming bases shared by the clan.
            </p>
          </div>
        </DashboardSection>

        {/* ── 6. Strategies ──────────────────────────────────────── */}
        <DashboardSection
          index={5}
          characterKey="dragon"
          title="Strategies"
          to="/strategies"
          icon={Target}
        >
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <StatChip label="Attacks" value={clan?.warWins || 0} accent="#dc2626" />
              <StatChip label="Tip" value="Drag & drop" accent="#dc2626" />
            </div>
            <p className="text-xs text-clan-muted">
              Shared attack strategies with star ratings and replays.
            </p>
          </div>
        </DashboardSection>

        {/* ── 7. Announcements ───────────────────────────────────── */}
        <DashboardSection
          index={6}
          characterKey="goblin"
          title="Announcements"
          to="/announcements"
          icon={Megaphone}
        >
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <StatChip label="From" value="Leadership" accent="#84cc16" />
              <StatChip label="Pinned" value="0" accent="#84cc16" />
            </div>
            <p className="text-xs text-clan-muted">
              Clan-wide news and updates. Tap View All to read them all.
            </p>
          </div>
        </DashboardSection>

        {/* ── 8. Calendar ────────────────────────────────────────── */}
        <DashboardSection
          index={7}
          characterKey="giant"
          title="Calendar"
          to="/calendar"
          icon={CalendarDays}
        >
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <StatChip label="CWL" value={clan?.warLeague?.name || '—'} accent="#f59e0b" />
              <StatChip label="Wars" value="On schedule" accent="#f59e0b" />
            </div>
            <p className="text-xs text-clan-muted">
              Upcoming war, CWL rounds, and clan events.
            </p>
          </div>
        </DashboardSection>

        {/* ── Footer / breathing room ────────────────────────────── */}
        <div className="h-16" />
      </div>
    </>
  )
}
