import { Link } from 'react-router-dom'
import { Home, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="glow-orb w-96 h-96 bg-clan-accent/20 -top-32 -left-32" />
        <div className="glow-orb glow-orb-delay w-96 h-96 bg-clan-elixir/20 -bottom-32 -right-32" />
      </div>
      <div className="text-center space-y-4 relative">
        <h1 className="font-display text-9xl font-bold text-gold-shimmer">404</h1>
        <p className="text-clan-muted text-lg">This page got raided by goblins.</p>
        <div className="flex gap-2 justify-center pt-2">
          <Link to="/" className="btn-primary">
            <Home className="w-4 h-4" /> Go Home
          </Link>
          <button onClick={() => window.history.back()} className="btn-secondary">
            <ArrowLeft className="w-4 h-4" /> Go Back
          </button>
        </div>
      </div>
    </div>
  )
}