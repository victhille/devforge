import { useEffect, useRef, useState } from 'react'
import type { HistoryPoint } from '@shared/types'
import { cn } from '@renderer/lib/cn'

const time = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

/** Width of the element, followed while it resizes */
function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    setW(el.clientWidth)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

/**
 * One series over time as a thin line on a light area (one hue, one axis),
 * an optional threshold line, and a crosshair + tooltip on hover.
 */
export function TimeChart({ points, field = 0, max, label, format, threshold, height = 72 }: {
  points: HistoryPoint[]
  /** Index of the value to draw in each point */
  field?: number
  /** Top of the axis; the highest value when omitted */
  max?: number
  label: string
  format: (v: number) => string
  threshold?: number
  height?: number
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const values = points.map(p => p.v[field])
  const known = values.filter((v): v is number => v !== null)
  const top = max ?? Math.max(1, ...known) * 1.15
  const last = [...values].reverse().find((v): v is number => v !== null)
  const t0 = points[0]?.t ?? 0
  const t1 = points[points.length - 1]?.t ?? 1
  const x = (t: number) => (t1 === t0 ? width : ((t - t0) / (t1 - t0)) * width)
  const y = (v: number) => height - 2 - (Math.min(v, top) / top) * (height - 6)

  // Gaps (no measure) break the line instead of drawing a false slope
  const segments: string[] = []
  let current = ''
  points.forEach((p, i) => {
    const v = values[i]
    if (v === null) { if (current) segments.push(current); current = ''; return }
    current += `${current ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(v).toFixed(1)}`
  })
  if (current) segments.push(current)
  const areas = segments.map(d => {
    const xs = [...d.matchAll(/[ML]([\d.]+),/g)].map(m => m[1])
    return `${d}L${xs[xs.length - 1]},${height}L${xs[0]},${height}Z`
  })

  const onMove = (e: React.MouseEvent) => {
    if (!points.length) return
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left
    let best = 0
    points.forEach((p, i) => { if (Math.abs(x(p.t) - px) < Math.abs(x(points[best].t) - px)) best = i })
    setHover(best)
  }

  const hv = hover !== null ? values[hover] : null
  return (
    <figure className="m-0 flex flex-col gap-1.5">
      <figcaption className="flex items-baseline justify-between text-xs">
        <span className="text-fg-secondary">{label}</span>
        <span className="font-mono font-medium text-fg">{last !== undefined ? format(last) : '—'}</span>
      </figcaption>
      <div ref={ref} className="relative" style={{ height }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}
        role="img" aria-label={`${label}: ${known.length ? `${format(Math.min(...known))} – ${format(Math.max(...known))}` : '—'}`}>
        {width > 0 && (
          <svg width={width} height={height} className="block overflow-visible" aria-hidden="true">
            <line x1={0} x2={width} y1={height - 0.5} y2={height - 0.5} className="stroke-line" />
            {threshold !== undefined && threshold <= top && (
              <line x1={0} x2={width} y1={y(threshold)} y2={y(threshold)} className="stroke-warning" strokeDasharray="3 3" strokeWidth={1} />
            )}
            {areas.map((d, i) => <path key={`a${i}`} d={d} className="fill-accent/15" />)}
            {segments.map((d, i) => <path key={`l${i}`} d={d} className="fill-none stroke-accent" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />)}
            {hover !== null && (
              <>
                <line x1={x(points[hover].t)} x2={x(points[hover].t)} y1={0} y2={height} className="stroke-fg-muted" strokeWidth={1} />
                {hv !== null && <circle cx={x(points[hover].t)} cy={y(hv)} r={4} className="fill-accent stroke-surface" strokeWidth={2} />}
              </>
            )}
          </svg>
        )}
        {hover !== null && (
          <div className={cn('pointer-events-none absolute -top-8 z-10 rounded-md border border-line bg-elevated px-2 py-1 font-mono text-[11px] whitespace-nowrap text-fg shadow-pop',
            x(points[hover].t) > width / 2 ? '-translate-x-full' : '')}
            style={{ left: x(points[hover].t) }}>
            {time(points[hover].t)} · {hv !== null ? format(hv) : '—'}
          </div>
        )}
      </div>
    </figure>
  )
}

/** Share of time up per bucket: one cell each, with the state in words on hover */
export function UptimeStrip({ points, field = 0, labels }: {
  points: HistoryPoint[]
  field?: number
  labels: { up: string; partial: string; down: string; none: string }
}) {
  return (
    <div className="flex h-6 items-stretch gap-[2px]">
      {points.length === 0 && <div className="flex-1 rounded-sm bg-elevated" />}
      {points.map(p => {
        const v = p.v[field]
        const state = v === null ? 'none' : v >= 0.999 ? 'up' : v <= 0.001 ? 'down' : 'partial'
        return (
          <div key={p.t} title={`${time(p.t)} · ${labels[state]}${state === 'partial' ? ` (${Math.round((v ?? 0) * 100)} %)` : ''}`}
            className={cn('min-w-[2px] flex-1 rounded-sm', state === 'up' ? 'bg-success/70' : state === 'down' ? 'bg-danger' : state === 'partial' ? 'bg-warning' : 'bg-elevated')} />
        )
      })}
    </div>
  )
}
