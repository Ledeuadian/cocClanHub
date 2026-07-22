import ComingSoon from '../components/ui/ComingSoon.jsx'
import GuestBlocker from '../components/GuestBlocker.jsx'
import { Shield, Users, Swords, CalendarDays } from 'lucide-react'
import Badge from '../components/ui/Badge.jsx'

const rounds = [
  { day: 1, opponent: 'Phoenix Rising', assigned: 12, total: 15, status: 'prep' },
  { day: 2, opponent: 'Shadow Wolves', assigned: 8, total: 15, status: 'pending' },
  { day: 3, opponent: 'Thunder Gods', assigned: 0, total: 15, status: 'pending' },
]

export default function CWLPlanner() {
  return (
    <GuestBlocker
      title="Members Only"
      message="The CWL Planner is available to signed-in clan members. Sign in or create a free account to plan your war league."
    >
      <div className="page-container space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">CWL Planner</h1>
            <p className="text-clan-muted text-sm">Clan War League · Season planning</p>
          </div>
          <Badge variant="warning">
            <Shield className="w-3 h-3" /> Masters I
          </Badge>
        </div>

        {/* Roster builder placeholder */}
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-5 h-5 text-clan-accent" />
            <h2 className="section-title !mb-0">Roster Builder</h2>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 15 }, (_, i) => (
              <div
                key={i}
                className={`aspect-square rounded-lg flex items-center justify-center text-sm font-bold border ${
                  i < 12
                    ? 'bg-green-900/30 border-green-700 text-green-300'
                    : 'bg-clan-surface border-clan-border text-clan-muted border-dashed'
                }`}
              >
                {i < 12 ? `✓` : `+`}
              </div>
            ))}
          </div>
          <p className="text-xs text-clan-muted mt-2">12 / 15 slots filled · Click empty slots to assign members</p>
        </div>

        {/* Day-by-day schedule */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="w-5 h-5 text-clan-accent" />
            <h2 className="section-title !mb-0">7-Day Schedule</h2>
          </div>
          <div className="space-y-2">
            {rounds.map((r) => (
              <div key={r.day} className="flex items-center gap-3 p-3 rounded-lg bg-clan-surface border border-clan-border">
                <div className="w-10 h-10 rounded-lg bg-clan-card flex items-center justify-center text-sm font-bold text-clan-accent">
                  D{r.day}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">vs {r.opponent}</p>
                  <p className="text-xs text-clan-muted">{r.assigned}/{r.total} attacks assigned</p>
                </div>
                <Badge variant={r.status === 'prep' ? 'info' : 'default'}>
                  {r.status === 'prep' ? 'PREP DAY' : 'PENDING'}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        <ComingSoon title="CWL Matchup Predictions">
          <p className="text-clan-muted text-sm">
            The full CWL planner with matchup predictions, attack assignments, and real-time
            star tracking will activate once the backend COC API integration is live.
          </p>
        </ComingSoon>
      </div>
    </GuestBlocker>
  )
}
