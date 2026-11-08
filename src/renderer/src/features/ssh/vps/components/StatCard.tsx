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

function Sparkline({ data, pct }: { data: number[]; pct: number }) {
  const W = 180, H = 32
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W
    const y = H - (Math.min(100, Math.max(0, v)) / 100) * (H - 2) - 1
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg className={cn('h-8 w-full', usageTone(pct))} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

/** A card's name in muted words, its value on the right in the code font */
export function CardLabel({ icon, children, right }: { icon: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm text-fg-muted">
      <span aria-hidden>{icon}</span>
      <span className="flex-1 truncate">{children}</span>
      {right}
    </div>
  )
}

interface Props {
  icon:     ReactNode
  label:    string
  pct:      number
  /** The value on the right (the percentage when none) */
  value?:   string
  detail:   string
  extra?:   string
  history?: number[]
}

/** Forge: one resource of the server, its value, its curve and its meter */
export default function StatCard({ icon, label, pct, value, detail, extra, history }: Props) {
  return (
    <Card className="flex flex-col gap-2.5 p-3.5">
      <CardLabel icon={icon} right={<span className={cn('font-mono text-sm font-semibold', usageTone(pct))}>{value ?? `${Math.round(pct)} %`}</span>}>
        {label}
      </CardLabel>
      {history && history.length > 1 && <Sparkline data={history} pct={pct} />}
      <UsageBar pct={pct} />
      <span className="font-mono text-xs text-fg-secondary">{detail}</span>
      {extra && <span className="-mt-1.5 text-xs text-fg-muted">{extra}</span>}
    </Card>
  )
}
