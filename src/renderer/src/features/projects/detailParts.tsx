import { useId, type CSSProperties, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import Card from '@renderer/components/ui/Card'
import IconButton from '@renderer/components/ui/IconButton'
import Badge from '@renderer/components/ui/Badge'

// ─── Small pieces ─────────────────────────────────────────────────────────────

/** A card of the overview, as in the mock-up: icon, title, a link (« Voir ») or a state on the right */
export function Tile({
  title,
  icon,
  onSee,
  seeLabel,
  aside,
  i,
  className,
  children
}: {
  title: string
  icon: ReactNode
  onSee?: () => void
  seeLabel?: string
  aside?: ReactNode
  i: number
  className?: string
  children: ReactNode
}) {
  const { t } = useI18n()
  const id = useId()
  return (
    <Card role="region" aria-labelledby={id} className={cn('df-rise flex min-w-0 flex-col gap-3.5 p-4.5', className)} style={{ '--i': i } as CSSProperties}>
      <div className="flex min-h-6 items-center gap-2.5">
        <span aria-hidden className="text-fg-secondary">
          {icon}
        </span>
        <h2 id={id} className="flex-1 truncate font-display text-md font-bold tracking-[-.01em] text-fg">
          {title}
        </h2>
        {aside}
        {onSee && (
          <button type="button" onClick={onSee} aria-describedby={id} className="text-sm font-semibold text-accent hover:text-accent-hover">
            {seeLabel ?? t.hub.see}
          </button>
        )}
      </div>
      {children}
    </Card>
  )
}

/** A row of an overview card: a thin line between rows */
export const ROW = 'flex min-h-9 min-w-0 items-center gap-2.5 border-b border-line-subtle last:border-b-0'

function Origin({ origin }: { origin: 'auto' | 'manual' }) {
  const { t } = useI18n()
  return <Badge>{origin === 'auto' ? t.hub.auto : t.hub.manual}</Badge>
}

export const Muted = ({ children }: { children: ReactNode }) => <p className="text-sm text-fg-muted">{children}</p>

/** A linked resource row: label, origin, actions, and untie */
export function LinkRow({ children, origin, onUntie, actions }: { children: ReactNode; origin: 'auto' | 'manual'; onUntie: () => void; actions?: ReactNode }) {
  const { t } = useI18n()
  return (
    <div className="group flex items-center gap-3 border-t border-line-subtle px-4.5 py-3 first:border-t-0">
      <div className="min-w-0 flex-1">{children}</div>
      <Origin origin={origin} />
      {actions}
      <IconButton
        size="sm"
        title={t.hub.untie}
        onClick={onUntie}
        className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
      >
        <X size={13} />
      </IconButton>
    </div>
  )
}

/** Resources DevForge found but the user hid, with a way back */
export function HiddenList({ items, onShow }: { items: { ref: string; label: string }[]; onShow: (ref: string) => void }) {
  const { t } = useI18n()
  if (!items.length) return null
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold tracking-[.04em] text-fg-muted uppercase">{t.hub.hiddenTitle}</span>
      {items.map(i => (
        <div key={i.ref} className="flex items-center gap-2 text-sm text-fg-secondary">
          <span className="min-w-0 flex-1 truncate">{i.label}</span>
          <button onClick={() => onShow(i.ref)} className="text-xs font-medium text-accent hover:underline">
            {t.hub.showAgain}
          </button>
        </div>
      ))}
    </div>
  )
}
