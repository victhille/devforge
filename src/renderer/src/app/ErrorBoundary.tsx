import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface Props {
  /** Changing it (e.g. the current route) clears the error */
  resetKey?: string
  labels: { title: string; retry: string }
  children: ReactNode
}

interface State { error: Error | null }

/**
 * Keeps a crashing page from taking down the whole window:
 * the sidebar stays usable and the page can be retried.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Page crashed:', error, info.componentStack)
  }

  componentDidUpdate(prev: Props): void {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="flex h-full items-center justify-center p-10">
        <div className="flex max-w-lg flex-col items-center gap-4 rounded-xl border border-danger/30 bg-surface p-8 text-center">
          <AlertTriangle size={28} className="text-danger" />
          <div>
            <p className="text-md font-semibold text-fg">{this.props.labels.title}</p>
            <p className="mt-2 max-h-32 overflow-auto rounded-lg bg-canvas p-3 text-left font-mono text-xs text-fg-secondary">
              {error.message}
            </p>
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-elevated px-4 text-fg hover:bg-hover"
          >
            <RotateCcw size={14} /> {this.props.labels.retry}
          </button>
        </div>
      </div>
    )
  }
}
