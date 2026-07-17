import {
  Swords,
  Star,
  Target,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Lock,
  Inbox,
  RefreshCw,
} from 'lucide-react'
import Badge from '../components/ui/Badge.jsx'
import ComingSoon from '../components/ui/ComingSoon.jsx'
import { useClan } from '../context/ClanContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useEffect } from 'react'

export default function Wars() {
  const { warLog, loading, warError, refresh } = useClan()
  const { toast } = useToast()

  // Surface the war-log error as a toast the first time we see it,
  // so the user gets immediate feedback even if they don't scroll down.
  // Wrapped in try/catch so a toast-context glitch can never crash the page.
  useEffect(() => {
    if (!warError) return
    try {
      toast?.warning?.('War log unavailable', String(warError), { duration: 6000 })
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[Wars] toast failed:', e)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warError])

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
            {loading
              ? 'Loading…'
              : wars.length
              ? `Recent ${wars.length} wars · ${wins} wins · ${wars.length - wins} losses`
              : warError
              ? 'War history unavailable'
              : 'No wars recorded yet'}
          </p>
        </div>
        {wars.length > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="success">
              <CheckCircle2 className="w-3 h-3" />
              {' '}Win Rate {Math.round((wins / wars.length) * 100)}%
            </Badge>
          </div>
        )}
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

        {/* ── War-log unavailable (private / API error) ────────────── */}
        {warError && (
          <div className="card border-amber-700/40 bg-amber-900/15">
            <div className="flex items-start gap-3">
              {/private|403|forbidden/i.test(warError) ? (
                <Lock className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-200">
                  {/private|403|forbidden/i.test(warError)
                    ? 'Clan war log is set to Private'
                    : 'Could not load war log'}
                </p>
                <p className="text-xs text-amber-300/80 mt-1 leading-relaxed">
                  {warError}
                </p>
                {/private|403|forbidden/i.test(warError) && (
                  <ol className="text-xs text-amber-300/80 mt-2 space-y-1 list-decimal list-inside">
                    <li>Open Clash of Clans and go to your clan.</li>
                    <li>Tap the settings gear icon.</li>
                    <li>
                      Toggle <span className="font-semibold">War Log</span> to{' '}
                      <span className="font-semibold">Public</span>.
                    </li>
                    <li>Come back here and tap Retry.</li>
                  </ol>
                )}
                <button
                  onClick={refresh}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-200 hover:text-amber-100 underline underline-offset-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── No wars returned (empty but no error) ───────────────── */}
        {wars.length === 0 && !loading && !warError && (
          <div className="card text-center py-8">
            <Inbox className="w-8 h-8 text-clan-muted mx-auto mb-2" />
            <p className="text-sm font-semibold text-clan-text">No war history yet</p>
            <p className="text-xs text-clan-muted mt-1">
              Once your clan finishes its first wars, the last 15 will appear here.
            </p>
            <button
              onClick={refresh}
              className="mt-3 btn-secondary !py-1.5 !px-3 text-xs"
            >
              Refresh
            </button>
          </div>
        )}

        {/* ── Loading skeleton ─────────────────────────────────────── */}
        {loading && wars.length === 0 && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card animate-pulse h-24" />
            ))}
          </div>
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
