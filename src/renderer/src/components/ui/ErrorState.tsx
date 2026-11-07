import type { ReactNode } from 'react'
import { AlertCircle, RotateCcw } from 'lucide-react'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import Button from './Button'

interface Props {
  /** What could not be done; « Lecture impossible » by default */
  title?: ReactNode
  /** The error itself, under the title */
  error?: string
  /** A way to try again */
  onRetry?: () => void
  className?: string
}

/** v4.3: a reading that failed, said where its content would be, with a way to try again (never a spinner that turns forever) */
export default function ErrorState({ title, error, onRetry, className }: Props) {
  const { t } = useI18n()
  return (
    <div role="alert" className={cn('flex flex-wrap items-center gap-3 rounded-card border border-danger/25 bg-danger-soft px-4 py-3', className)}>
      <AlertCircle size={16} className="shrink-0 text-danger" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-danger">{title ?? t.common.loadFailed}</p>
        {error && <p className="mt-0.5 text-xs break-words text-fg-secondary">{error}</p>}
      </div>
      {onRetry && <Button size="sm" variant="secondary" onClick={onRetry}><RotateCcw size={13} /> {t.common.retry}</Button>}
    </div>
  )
}
