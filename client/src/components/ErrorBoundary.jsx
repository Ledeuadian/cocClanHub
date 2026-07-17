/**
 * <ErrorBoundary>
 *
 * Catches render-time errors in any subtree and shows a friendly fallback
 * with the actual error message + a "Try again" button. Without this,
 * a single component crash unmounts the whole page (which looks like
 * "the page vanished").
 *
 * Usage in App.jsx:
 *   <ErrorBoundary>
 *     <AppRoutes />
 *   </ErrorBoundary>
 */
import { Component } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, info: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Surface to console so we can fix it during development.
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info)
    this.setState({ info })
  }

  handleReset = () => {
    this.setState({ error: null, info: null })
  }

  handleReload = () => {
    if (typeof window !== 'undefined') window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="page-container">
        <div className="card border-red-700/40 bg-red-900/15 mt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-300 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-200">
                Something went wrong on this page
              </p>
              <p className="text-xs text-red-300/80 mt-1 leading-relaxed break-words">
                <span className="font-mono">
                  {String(this.state.error?.message || this.state.error)}
                </span>
              </p>
              {this.state.info?.componentStack && (
                <details className="mt-2">
                  <summary className="text-xs text-red-300/70 cursor-pointer">
                    Component stack
                  </summary>
                  <pre className="text-[10px] text-red-300/70 whitespace-pre-wrap break-words mt-1 max-h-40 overflow-auto">
                    {this.state.info.componentStack}
                  </pre>
                </details>
              )}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={this.handleReset}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-200 hover:text-red-100 underline underline-offset-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Try again
                </button>
                <button
                  onClick={this.handleReload}
                  className="btn-secondary !py-1.5 !px-3 text-xs"
                >
                  Reload page
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
}