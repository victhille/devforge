import { useEffect, useRef, type ReactNode } from 'react'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import Spinner from './Spinner'

interface Props {
  text: string
  /** A header over the log; none for a bare one */
  title?: ReactNode
  /** A spinner in the header while the command runs */
  running?: boolean
  /** Buttons at the end of the header (copy, clear…) */
  actions?: ReactNode
  /** Follows the end as lines come (on by default) */
  follow?: boolean
  /** What shows while there is no line yet */
  placeholder?: string
  /** Its name for screen readers, when the title is not plain text */
  label?: string
  className?: string
}

/**
 * v4.3: the output of a command (an install, a backup, a compose up…): the
 * same box on every page, its height capped, kept at its last line.
 */
export default function LogBox({ text, title, running, actions, follow = true, placeholder = '…', label, className }: Props) {
  const { t } = useI18n()
  const name = label ?? (typeof title === 'string' ? title : t.common.output)
  const ref = useRef<HTMLPreElement>(null)
  useEffect(() => { if (follow) ref.current?.scrollTo({ top: ref.current.scrollHeight }) }, [text, follow])
  return (
    <div className={cn('overflow-hidden rounded-card border border-line-subtle bg-console', className)}>
      {(title || actions) && (
        <div className="flex items-center gap-2 border-b border-line-subtle px-4 py-2.5 text-sm font-semibold text-fg">
          {running && <Spinner />}
          <span className="min-w-0 flex-1 truncate">{title}</span>
          {actions}
        </div>
      )}
      <pre ref={ref} tabIndex={0} role="region" aria-label={name} className="max-h-72 overflow-auto px-4 py-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all text-fg-secondary">{text || placeholder}</pre>
    </div>
  )
}
