import type { ReactNode } from 'react'
import { cn } from '@renderer/lib/cn'
import Card from '@renderer/components/ui/Card'
import { usageBar, usageTone } from '../stats'

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
    <svg className={cn('h-8 w-full', usageTone(pct))} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

export function CardLabel({ icon, children, right }: { icon: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm font-medium text-fg-secondary">
      <span className="text-fg-muted">{icon}</span>
      <span className="flex-1">{children}</span>
      {right}
    </div>
  )
}

interface Props {
  icon:     ReactNode
  label:    string
  pct:      number
  detail:   string
  extra?:   string
  history?: number[]
}

export default function StatCard({ icon, label, pct, detail, extra, history }: Props) {
  return (
    <Card className="flex flex-col gap-2.5 p-4">
      <CardLabel icon={icon} right={<span className={cn('text-lg font-semibold', usageTone(pct))}>{Math.round(pct)}%</span>}>
        {label}
      </CardLabel>
      {history && history.length > 1 && <Sparkline data={history} pct={pct} />}
      <UsageBar pct={pct} />
      <span className="font-mono text-xs text-fg-secondary">{detail}</span>
      {extra && <span className="text-xs text-fg-muted">{extra}</span>}
    </Card>
  )
}
