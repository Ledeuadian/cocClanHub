/**
 * Placeholder for features not yet implemented.
 * Shows a clean, styled message with an icon and description.
 */
import { Construction } from 'lucide-react'

export default function ComingSoon({ title, description, children }) {
  return (
    <div className="page-container">
      <h1 className="page-title mb-2">{title}</h1>
      {description && <p className="text-clan-muted text-sm mb-6">{description}</p>}

      <div className="card flex flex-col items-center justify-center py-16 text-center">
        <Construction className="w-12 h-12 text-clan-accent mb-4" />
        <h2 className="section-title">Under Construction</h2>
        <p className="text-clan-muted text-sm max-w-md">
          This feature is wired up and ready for development. The data layer and backend
          endpoints are scaffolded — just build out the UI and logic.
        </p>
        {children}
      </div>
    </div>
  )
}