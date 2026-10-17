import type { ReactNode } from 'react'
import { Sparkles } from 'lucide-react'
import { cn } from '@renderer/lib/cn'

interface Item { key: string; label: ReactNode; hint?: ReactNode; onPick: () => void }

/** Row of one-click suggestions, hidden when empty */
export default function Suggestions({ title, items, className }: { title: string; items: Item[]; className?: string }) {
  if (items.length === 0) return null
  return (
    <div className={cn('flex flex-col gap-2 rounded-xl border border-accent/20 bg-accent-soft/40 p-3', className)}>
      <span className="flex items-center gap-1.5 text-xs font-medium text-accent"><Sparkles size={13} /> {title}</span>
      <div className="flex flex-wrap gap-1.5">
        {items.map(i => (
          <button
            key={i.key}
            onClick={i.onPick}
            className="flex items-center gap-2 rounded-lg border border-line-subtle bg-surface px-2.5 py-1.5 text-left text-sm transition-colors hover:border-accent hover:bg-elevated"
          >
            <span className="text-fg">{i.label}</span>
            {i.hint && <span className="text-2xs text-fg-muted">{i.hint}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
