import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@renderer/lib/cn'
import IconButton from './IconButton'

interface Props {
  title: ReactNode
  onClose: () => void
  footer?: ReactNode
  className?: string
  children: ReactNode
}

/** Centered dialog over a dimmed backdrop. Closes on Escape or backdrop click. */
export default function Modal({ title, onClose, footer, className, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6 backdrop-blur-[2px]"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn('flex max-h-full w-full max-w-md flex-col rounded-xl border border-line bg-surface shadow-pop', className)}
      >
        <div className="flex items-center justify-between border-b border-line-subtle px-5 py-3.5">
          <h3 className="text-md font-semibold text-fg">{title}</h3>
          <IconButton title="Close" onClick={onClose}><X size={16} /></IconButton>
        </div>
        <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-line-subtle px-5 py-3">{footer}</div>
        )}
      </div>
    </div>
  )
}
