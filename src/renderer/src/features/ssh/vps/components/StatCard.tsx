import type { ReactNode } from 'react'
import { cn } from '@renderer/lib/cn'
import Card from '@renderer/components/ui/Card'
import { usageBar, usageTone } from '../stats'

/** Forge meter: a 6 px track, filled in green, amber or red with the use */
export function UsageBar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-active">
      <div className={cn('h-full rounded-full transition-[width] duration-500', usageBar(pct))} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  )
}

/** The last readings as bars, as in the mock-up (the most recent on the right) */
function HistoryBars({ data }: { data: number[] }) {
  const bars = data.slice(-12)
  return (
    <div className="flex h-7 items-end gap-1" aria-hidden>
      {bars.map((v, i) => (
        <span key={i} className="flex-1 rounded-sm bg-accent/40" style={{ height: `${Math.max(12, Math.min(100, v))}%` }} />
      ))}
    </div>
  )
}

/** A card's name in muted words, its value on the right in the code font */
export function CardLabel({ icon, children, right }: { icon?: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm text-fg-muted">
      {icon && <span aria-hidden>{icon}</span>}
      <span className="flex-1 truncate">{children}</span>
      {right}
    </div>
  )
}

interface Props {
  label:    string
  pct:      number
  /** The value on the right (the percentage when none) */
  value?:   string
  detail:   string
  history?: number[]
}

/** As in the mock-up: one resource of the server, its value, its history (CPU) or its meter */
export default function StatCard({ label, pct, value, detail, history }: Props) {
  return (
    <Card className="flex flex-col gap-2.5 p-3.5">
      <CardLabel right={<span className="font-mono text-sm font-semibold text-fg">{value ?? `${Math.round(pct)} %`}</span>}>
        {label}
      </CardLabel>
      {history && history.length > 1 ? <HistoryBars data={history} /> : <UsageBar pct={pct} />}
      <span className={cn('text-xs', history ? 'font-mono text-fg-secondary' : usageTone(pct) === 'text-danger' ? 'text-danger' : 'text-fg-muted')}>{detail}</span>
    </Card>
  )
}
