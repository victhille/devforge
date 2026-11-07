import type { ReactNode } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Info, type LucideIcon } from 'lucide-react'
import { cn } from '@renderer/lib/cn'

export type NoticeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

const TONES: Record<NoticeTone, { box: string; icon: LucideIcon; iconTone: string }> = {
  // A plain word from the app (a conversation stopped…): no color of its own
  neutral: { box: 'bg-elevated text-fg-secondary', icon: Info, iconTone: 'text-fg-muted' },
  // Blue, the accent (orange) stays for actions and Forgy
  info: { box: 'bg-info-soft', icon: Info, iconTone: 'text-info' },
  success: { box: 'bg-success-soft', icon: CheckCircle2, iconTone: 'text-success' },
  warning: { box: 'bg-warning-soft', icon: AlertTriangle, iconTone: 'text-warning' },
  danger: { box: 'bg-danger-soft', icon: AlertCircle, iconTone: 'text-danger' }
}

interface Props {
  tone?: NoticeTone
  /** A bold first line, when the message has one */
  title?: ReactNode
  children?: ReactNode
  /** A button at the end (Retry, Open the settings…) */
  action?: ReactNode
  /** Said to screen readers as soon as it appears (a message that comes after an action): an alert for a warning or an error */
  live?: boolean
  /** A role given as is (`note`, `status`…), over the one `live` chooses */
  role?: 'note' | 'status' | 'alert'
  className?: string
}

/**
 * v4.3: a message set in the page (a warning, an error, a hint), the same
 * everywhere: its tone shown by an icon as well as a color.
 */
export default function Notice({ tone = 'info', title, children, action, live, role, className }: Props) {
  const { box, icon: Icon, iconTone } = TONES[tone]
  return (
    <div role={role ?? (live ? (tone === 'danger' || tone === 'warning' ? 'alert' : 'status') : undefined)}
      className={cn('flex items-start gap-2.5 rounded-control px-3 py-2.5 text-base text-fg', box, className)}>
      <Icon size={15} className={cn('mt-0.5 shrink-0', iconTone)} aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5 text-sm text-fg-secondary')}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  )
}
