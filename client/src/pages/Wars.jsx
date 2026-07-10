import { Swords, Star, Target, CheckCircle2, XCircle, Clock } from 'lucide-react'
import Badge from '../components/ui/Badge.jsx'
import ComingSoon from '../components/ui/ComingSoon.jsx'
import { useClan } from '../context/ClanContext.jsx'

export default function Wars() {
  const { warLog, loading } = useClan()

  // COC warLog items have: { result, endTime, teamSize, opponent: { name, ... }, clan: { stars, destructionPercentage }, opponent: { stars } }
  // Note: when the opponent clan has their war log set to private, Supercell still
  // returns the item but with opponent.name missing. We drop those entries here
  // because they are not present in the in-game war log UI for the clan.
  const wars = (warLog || [])
    .filter((w) => w?.opponent?.name && w.teamSize > 0)
    .map((w, i) => {
      const isWin = w.result === 'win'
      return {
        id: w.endTime || i,
        opponent: w.opponent.name,
        opponentTag: w.opponent.tag || '',
        clanStars: w.clan?.stars ?? 0,
        enemyStars: w.opponent?.stars ?? 0,
        destruction: w.clan?.destructionPercentage ?? 0,
        attacksUsed: 0,
        attacksTotal: w.teamSize * 2,
        result: isWin ? 'win' : (w.result || 'loss'),
        teamSize: w.teamSize,
        startTime: w.endTime ? new Date(w.endTime).toLocaleDateString() : '—'
      }
    })

  const wins = wars.filter((w) => w.result === 'win').length

  return (
    <div className="page-container space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">War Tracker</h1>
          <p className="text-clan-muted text-sm">
            {loading ? 'Loading…' : `Recent ${wars.length} wars · ${wins} wins · ${wars.length - wins} losses`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success">
            <CheckCircle2 className="w-3 h-3" />
            {' '}Win Rate {wars.length ? Math.round((wins / wars.length) * 100) : 0}%
          </Badge>
        </div>
      </div>

      {/* Active War Summary (placeholder) */}
      <div className="card border-clan-accent/30 bg-gradient-to-r from-clan-card to-clan-surface">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-5 h-5 text-clan-accent" />
          <span className="text-sm font-semibold text-clan-accent">No Active War</span>
        </div>
        <p className="text-sm text-clan-muted mb-3">CWL is starting soon. War prep begins in 2 days.</p>
        <div className="flex gap-2">
          <button className="btn-primary text-xs">Start War Search</button>
          <button className="btn-secondary text-xs">View CWL Planner</button>
        </div>
      </div>

      {/* War History */}
      <div className="space-y-3">
        <h2 className="section-title">War History</h2>
        {wars.length === 0 && !loading && (
          <p className="text-sm text-clan-muted text-center py-6">No war history yet.</p>
        )}
        {wars.map((war) => (
          <div key={war.id} className="card hover:border-clan-muted transition-colors cursor-pointer">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  war.result === 'win' ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'
                }`}>
                  {war.result === 'win' ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                </div>
                <div>
                  <p className="text-sm font-semibold">vs {war.opponent}</p>
                  <p className="text-xs text-clan-muted">{war.startTime} · {war.teamSize}v{war.teamSize}</p>
                </div>
              </div>
              <Badge variant={war.result === 'win' ? 'success' : 'danger'}>
                {(war.result || '—').toString().toUpperCase()}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-clan-surface rounded-lg p-2">
                <Star className="w-4 h-4 text-clan-gold mx-auto mb-1" />
                <div className="text-sm font-bold">{war.clanStars} <span className="text-clan-muted">vs</span> {war.enemyStars}</div>
                <div className="text-xs text-clan-muted">Stars</div>
              </div>
              <div className="bg-clan-surface rounded-lg p-2">
                <Target className="w-4 h-4 text-clan-primary mx-auto mb-1" />
                <div className="text-sm font-bold">{war.destruction}%</div>
                <div className="text-xs text-clan-muted">Destruction</div>
              </div>
              <div className="bg-clan-surface rounded-lg p-2">
                <Swords className="w-4 h-4 text-clan-elixir mx-auto mb-1" />
                <div className="text-sm font-bold">{war.attacksUsed}/{war.attacksTotal}</div>
                <div className="text-xs text-clan-muted">Attacks</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <ComingSoon title="Detailed Attack Tracker">
        <p className="text-clan-muted text-sm">
          Per-member attack breakdowns, missed attack tracking, and average destruction
          will populate here once the COC API service and backend are connected.
        </p>
      </ComingSoon>
    </div>
  )
}
