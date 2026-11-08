import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import IconButton from './IconButton'

interface Props {
  title: ReactNode
  onClose: () => void
  footer?: ReactNode
  className?: string
  children: ReactNode
}

/** What Tab can reach inside the dialog */
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
/** The dialogs open, the last on top: only it answers Escape and Tab (a confirm asked from inside a dialog) */
const open: symbol[] = []
/** Where the focus goes first: a field, never a button (Enter must not confirm by accident) */
const FIELDS = 'input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled])'

/**
 * Centered dialog over a dimmed backdrop. Closes on Escape or backdrop click.
 * v4.3: the focus goes inside when it opens, stays there (Tab goes round),
 * and comes back to where it was when it closes.
 */
export default function Modal({ title, onClose, footer, className, children }: Props) {
  const { t } = useI18n()
  // The title names the dialog for screen readers
  const titleId = useId()
  const box = useRef<HTMLDivElement>(null)
  const me = useRef(Symbol('modal'))

  useEffect(() => {
    const id = me.current
    open.push(id)
    return () => { open.splice(open.indexOf(id), 1) }
  }, [])

  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const el = box.current
    // A field that took the focus itself (autoFocus) keeps it
    if (el && !el.contains(document.activeElement)) (el.querySelector<HTMLElement>(FIELDS) ?? el).focus()
    return () => { if (before?.isConnected) before.focus() }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (open[open.length - 1] !== me.current) return
      if (e.key === 'Escape') { onClose(); return }
      const el = box.current
      if (e.key !== 'Tab' || !el) return
      const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(i => i.offsetParent !== null)
      if (!items.length) { e.preventDefault(); return }
      const first = items[0]
      const last = items[items.length - 1]
      const at = document.activeElement
      if (e.shiftKey && (at === first || at === el)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && (at === last || !el.contains(at))) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // On the document itself: a page that moves (its rise as it appears) would otherwise hold it in its own box
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-6 backdrop-blur-[3px]"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn('flex max-h-full w-full max-w-md flex-col rounded-window border border-line bg-surface shadow-pop outline-none', className)}
      >
        <div className="flex items-center justify-between border-b border-line-subtle px-5 py-3.5">
          <h3 id={titleId} className="font-display text-lg font-bold tracking-[-.01em] text-fg">{title}</h3>
          <IconButton title={t.common.close} onClick={onClose}><X size={16} /></IconButton>
        </div>
        <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-line-subtle px-5 py-3">{footer}</div>
        )}
      </div>
    </div>,
    document.body
  )
}
