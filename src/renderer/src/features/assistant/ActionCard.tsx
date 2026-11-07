import { useState } from 'react'
import { AlertTriangle, Ban, Check, Loader2, RotateCcw, ShieldAlert, X, Zap } from 'lucide-react'
import type { AssistantActionStatus } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import { errorText } from '@renderer/lib/errors'

export interface ActionView {
  id: string
  title: string
  preview: string
  reversible: boolean
  status: AssistantActionStatus
  output?: string
}

/** Each state its icon: a refusal and an undo are told apart at a glance, not only by their word */
const ICON: Record<AssistantActionStatus, { icon: typeof Zap; className: string }> = {
  pending: { icon: ShieldAlert, className: 'text-forgy' },
  running: { icon: Zap, className: 'text-fg-muted' },
  done: { icon: Check, className: 'text-success' },
  failed: { icon: AlertTriangle, className: 'text-danger' },
  refused: { icon: Ban, className: 'text-fg-muted' },
  undone: { icon: RotateCcw, className: 'text-fg-muted' }
}

/**
 * An action Forgy proposes: what will happen, then Approve / Refuse. Nothing
 * runs before the click. Once done, a reversible action can be undone here.
 */
export default function ActionCard({ action, onChange }: { action: ActionView; onChange: (patch: Partial<ActionView>) => void }) {
  const { t } = useI18n()
  const a = t.assistant
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [deciding, setDeciding] = useState(false)
  const { status } = action

  // v4.3: one decision only (a double click sent two), and one that does not arrive gives the choice back
  const decide = async (approve: boolean) => {
    if (deciding) return
    setDeciding(true)
    onChange({ status: approve ? 'running' : 'refused' })
    try {
      await window.devforge.assistant.decideAction(action.id, approve)
    } catch (err) {
      onChange({ status: 'pending' })
      toast.show({ tone: 'error', title: a.actionDecideFailed, description: errorText(err) })
    } finally { setDeciding(false) }
  }

  const undo = async () => {
    setBusy(true)
    try {
      const r = await window.devforge.assistant.undoAction(action.id)
      onChange({ status: r.status, output: r.output })
      toast.show({ tone: 'success', title: a.actionUndone.replace('{title}', action.title) })
    } catch (err) {
      toast.show({ tone: 'error', title: a.actionUndoFailed, description: errorText(err) })
    } finally { setBusy(false) }
  }

  // A refused or undone action steps back: nothing of it remains
  const quiet = status === 'refused' || status === 'undone'
  const tone = status === 'pending' ? 'border-forgy/50 bg-forgy-soft'
    : status === 'failed' ? 'border-danger/30 bg-danger-soft'
    : 'border-line-subtle bg-surface'
  const { icon: Icon, className: iconTone } = ICON[status]

  return (
    <div className={cn('df-pop flex flex-col gap-2 rounded-xl border p-3', tone, quiet && 'opacity-75')} role="group" aria-label={action.title}>
      <div className="flex items-center gap-2">
        <Icon size={14} className={cn('shrink-0', iconTone)} aria-hidden />
        <span title={action.title} className={cn('min-w-0 flex-1 truncate text-sm font-semibold', quiet ? 'text-fg-secondary' : 'text-fg', status === 'refused' && 'line-through decoration-fg-muted')}>{action.title}</span>
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 font-mono text-2xs font-medium',
          status === 'done' ? 'bg-success-soft text-success'
            : status === 'failed' ? 'bg-danger-soft text-danger'
            : status === 'pending' ? 'bg-forgy-soft text-forgy'
            : 'bg-elevated text-fg-muted')}>
          {a.actionStatus[status]}
        </span>
      </div>

      <pre className="max-h-40 overflow-auto rounded-lg bg-canvas px-2.5 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all text-fg-secondary">{action.preview}</pre>

      {status === 'pending' && (
        <>
          <span className="text-xs text-fg-secondary">{action.reversible ? a.actionReversible : a.actionIrreversible}</span>
          <div className="flex gap-2">
            <button onClick={() => decide(true)} disabled={deciding}
              className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-forgy text-sm font-semibold text-forgy-fg transition-[transform,background-color] hover:bg-forgy/90 active:scale-95 disabled:opacity-40">
              <Check size={14} /> {a.actionApprove}
            </button>
            <button onClick={() => decide(false)} disabled={deciding}
              className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-elevated text-sm font-medium text-fg hover:bg-hover disabled:opacity-40">
              <X size={14} /> {a.actionRefuse}
            </button>
          </div>
        </>
      )}

      {status === 'running' && <span className="flex items-center gap-1.5 text-xs text-fg-secondary"><Loader2 size={12} className="animate-spin" /> {a.actionRunning}</span>}

      {action.output && status !== 'pending' && (
        <details className="text-xs" open={status === 'failed'}>
          <summary className="cursor-pointer text-fg-muted hover:text-fg">{a.actionOutput}</summary>
          <pre className={cn('mt-1.5 max-h-48 overflow-auto rounded-lg bg-canvas px-2.5 py-2 font-mono text-xs whitespace-pre-wrap break-all', status === 'failed' ? 'text-danger' : 'text-fg-secondary')}>{action.output}</pre>
        </details>
      )}

      {status === 'done' && action.reversible && (
        <button onClick={undo} disabled={busy} className="flex items-center gap-1.5 self-start text-xs font-medium text-fg-secondary hover:text-fg disabled:opacity-50">
          {busy ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} {a.actionUndo}
        </button>
      )}
    </div>
  )
}
