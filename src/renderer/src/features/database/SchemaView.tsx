import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Eye, KeyRound, LayoutTemplate, Maximize2, Minus, Plus, X } from 'lucide-react'
import type { DbConnection, DbDiagram, DbTableRef } from '@shared/types'
import {
  arrowHead, autoLayout, boxSize, bounds, diagramSvg, HEADER, linkPath, ROW, shownLinks, tableKey, withNeighbours, type Box, type Point
} from '@shared/lib/schemaLayout'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { usePersistentState } from '@renderer/hooks/usePersistentState'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import IconButton from '@renderer/components/ui/IconButton'
import Spinner from '@renderer/components/ui/Spinner'

/** Over that many tables, the user picks the ones to show */
const MANY = 60
const MINI = { w: 200, h: 130 }

const errorText = (err: unknown) => String(err instanceof Error ? err.message : err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

interface Saved { pos: Record<string, Point>; shown: string[] | null }

/**
 * v3.8 lot 4 (piste B): the database's schema, full screen. The tables to
 * show on the left; cards placed on their own, then moved by hand (kept per
 * database); zoom, fit, a minimap, PNG or SVG export. A click on a card opens
 * its Structure.
 */
export default function SchemaView({ conn, dbName, onClose, onOpenTable }: {
  conn: DbConnection
  dbName: string
  onClose: () => void
  onOpenTable: (t: DbTableRef) => void
}) {
  const { t } = useI18n()
  const s = t.schema
  const toast = useToast()
  const [diagram, setDiagram] = useState<DbDiagram | null>(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = usePersistentState<Saved>(`devforge:db-schema:${conn.id}`, { pos: {}, shown: null })
  const [pos, setPos] = useState<Record<string, Point>>(saved.pos)
  const [search, setSearch] = useState('')
  const [hover, setHover] = useState<string | null>(null)
  const [view, setView] = useState({ x: 40, y: 40, k: 1 })
  const [size, setSize] = useState({ w: 800, h: 600 })
  const viewport = useRef<HTMLDivElement>(null)
  const drag = useRef<{ kind: 'pan' | 'move'; key?: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null)
  const dragged = useRef(false)
  const fitted = useRef(false)

  useEffect(() => {
    window.devforge.db.diagram(conn.id).then(setDiagram).catch(err => setError(errorText(err)))
  }, [conn.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useLayoutEffect(() => {
    const el = viewport.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [diagram])

  const byKey = useMemo(() => new Map((diagram?.tables ?? []).map(tb => [tableKey(tb), tb])), [diagram])
  const shown = useMemo(() => {
    if (!diagram) return new Set<string>()
    if (saved.shown) return new Set(saved.shown.filter(k => byKey.has(k)))
    return new Set(diagram.tables.length > MANY ? [] : diagram.tables.map(tableKey))
  }, [diagram, saved.shown, byKey])
  const links = useMemo(() => shownLinks(diagram?.links ?? [], shown), [diagram, shown])

  // Tables shown without a place: all placed when none has one, else beside the others
  useEffect(() => {
    if (!diagram) return
    const missing = [...shown].filter(k => !pos[k])
    if (!missing.length) return
    const placed = [...shown].filter(k => pos[k])
    const tables = missing.map(k => byKey.get(k)!)
    const fresh = autoLayout(tables, shownLinks(diagram.links, new Set(missing)))
    let next: Record<string, Point>
    if (!placed.length) next = { ...pos, ...fresh }
    else {
      const there = bounds(placed.map(k => ({ ...pos[k], ...boxSize(byKey.get(k)!) })))
      next = { ...pos, ...Object.fromEntries(Object.entries(fresh).map(([k, p]) => [k, { x: p.x + there.x + there.w + 160, y: p.y + there.y }])) }
    }
    setPos(next)
    setSaved(v => ({ ...v, pos: next }))
  }, [diagram, shown]) // eslint-disable-line react-hooks/exhaustive-deps

  const boxes = useMemo(() => {
    const out = new Map<string, Box>()
    for (const k of shown) if (pos[k]) out.set(k, { ...pos[k], ...boxSize(byKey.get(k)!) })
    return out
  }, [shown, pos, byKey])
  const all = bounds([...boxes.values()])

  const fit = () => {
    if (!all.w) return
    const k = Math.min(1, (size.w - 80) / all.w, (size.h - 80) / all.h)
    setView({ k, x: (size.w - all.w * k) / 2 - all.x * k, y: (size.h - all.h * k) / 2 - all.y * k })
  }
  // Fitted once, when the first cards are placed
  useEffect(() => { if (!fitted.current && boxes.size && size.w > 100) { fitted.current = true; fit() } }, [boxes.size, size.w]) // eslint-disable-line react-hooks/exhaustive-deps

  const zoom = (factor: number, cx = size.w / 2, cy = size.h / 2) => setView(v => {
    const k = Math.min(2, Math.max(0.15, v.k * factor))
    return { k, x: cx - (cx - v.x) * (k / v.k), y: cy - (cy - v.y) * (k / v.k) }
  })

  const setShown = (keys: Set<string>) => setSaved(v => ({ ...v, shown: [...keys] }))
  const toggle = (k: string, on: boolean) => { const n = new Set(shown); if (on) n.add(k); else n.delete(k); setShown(n) }
  const relayout = () => {
    if (!diagram) return
    const next = autoLayout([...shown].map(k => byKey.get(k)!), links)
    setPos(next)
    setSaved(v => ({ ...v, pos: next }))
    fitted.current = false
  }

  // Pan the background, move a card by its header
  const down = (e: ReactPointerEvent, key?: string) => {
    if (e.button !== 0) return
    e.stopPropagation()
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    const p = key ? pos[key] : view
    drag.current = { kind: key ? 'move' : 'pan', key, sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y, moved: false }
  }
  const move = (e: ReactPointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true
    if (d.kind === 'pan') setView(v => ({ ...v, x: d.ox + dx, y: d.oy + dy }))
    else if (d.moved) setPos(p => ({ ...p, [d.key!]: { x: Math.round(d.ox + dx / view.k), y: Math.round(d.oy + dy / view.k) } }))
  }
  const up = () => {
    const d = drag.current
    drag.current = null
    dragged.current = !!d?.moved
    if (d?.kind === 'move' && d.moved) setSaved(v => ({ ...v, pos }))
  }

  async function exportAs(ext: 'png' | 'svg') {
    if (!diagram) return
    const css = getComputedStyle(document.documentElement)
    const v = (name: string) => css.getPropertyValue(name).trim() || '#888'
    const svg = diagramSvg([...shown].map(k => byKey.get(k)!), pos, links, {
      canvas: v('--color-canvas'), card: v('--color-surface'), header: v('--color-elevated'), line: v('--color-line'),
      text: v('--color-fg'), muted: v('--color-fg-muted'), key: v('--color-warning'), link: v('--color-accent')
    })
    let content = svg
    if (ext === 'png') {
      const img = new Image()
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
      await img.decode()
      const canvas = document.createElement('canvas')
      canvas.width = img.width * 2
      canvas.height = img.height * 2
      const ctx = canvas.getContext('2d')!
      ctx.scale(2, 2)
      ctx.drawImage(img, 0, 0)
      content = canvas.toDataURL('image/png')
    }
    try {
      const path = await window.devforge.db.saveImage(`${dbName}-schema`, content, ext)
      if (path) toast.show({ tone: 'success', title: s.exported, description: path })
    } catch (err) { toast.show({ tone: 'error', title: s.exportFailed, description: errorText(err) }) }
  }

  // The minimap: everything shown and the part on screen, both in it
  const seen = { x: -view.x / view.k, y: -view.y / view.k, w: size.w / view.k, h: size.h / view.k }
  const world = bounds([all, seen])
  const mini = world.w ? Math.min((MINI.w - 12) / world.w, (MINI.h - 12) / world.h) : 1
  const toMini = (p: Point) => ({ x: 6 + (p.x - world.x) * mini, y: 6 + (p.y - world.y) * mini })

  const listed = (diagram?.tables ?? []).filter(tb => tableKey(tb).toLowerCase().includes(search.trim().toLowerCase()))
  const label = (tb: DbTableRef) => `${tb.schema && tb.schema !== 'public' ? `${tb.schema}.` : ''}${tb.name}`

  return (
    <div role="dialog" aria-modal="true" aria-label={s.title.replace('{db}', dbName)} className="fixed inset-x-0 top-[42px] bottom-0 z-40 flex flex-col bg-canvas">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line-subtle px-4">
        <h2 className="min-w-0 truncate text-md font-semibold text-fg">{s.title.replace('{db}', dbName)}</h2>
        <span className="hidden items-center gap-3 text-xs text-fg-muted md:flex">
          <span className="flex items-center gap-1"><KeyRound size={11} className="text-warning" /> {s.legendKey}</span>
          <span><span className="font-mono">!</span> {s.legendRequired}</span>
        </span>
        <span className="flex-1" />
        <span className="flex items-center gap-0.5 rounded-lg border border-line px-0.5">
          <IconButton size="sm" title={s.zoomOut} onClick={() => zoom(1 / 1.2)}><Minus size={13} /></IconButton>
          <span className="w-11 text-center font-mono text-xs text-fg-secondary" aria-live="polite">{Math.round(view.k * 100)} %</span>
          <IconButton size="sm" title={s.zoomIn} onClick={() => zoom(1.2)}><Plus size={13} /></IconButton>
        </span>
        <Button variant="secondary" size="sm" onClick={fit} disabled={!boxes.size}><Maximize2 size={13} /> {s.fit}</Button>
        <Button variant="secondary" size="sm" onClick={relayout} disabled={!boxes.size}><LayoutTemplate size={13} /> {s.relayout}</Button>
        <Button variant="secondary" size="sm" onClick={() => exportAs('png')} disabled={!boxes.size}>PNG</Button>
        <Button variant="secondary" size="sm" onClick={() => exportAs('svg')} disabled={!boxes.size}>SVG</Button>
        <Button size="sm" onClick={onClose}><X size={13} /> {t.common.close}</Button>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside aria-label={s.tables} className="flex w-[240px] shrink-0 flex-col border-r border-line-subtle bg-sidebar">
          <div className="flex flex-col gap-2 border-b border-line-subtle p-2.5">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={s.search} aria-label={s.search}
              className="h-8 w-full rounded-md border border-line-subtle bg-canvas px-2.5 text-sm text-fg outline-none placeholder:text-fg-muted focus:border-accent" />
            <div className="flex gap-1">
              <button onClick={() => setShown(new Set([...shown, ...listed.map(tableKey)]))} className="rounded-md border border-line px-2 py-0.5 text-xs text-fg-secondary hover:text-fg">{s.all}</button>
              <button onClick={() => setShown(new Set([...shown].filter(k => !listed.some(tb => tableKey(tb) === k))))} className="rounded-md border border-line px-2 py-0.5 text-xs text-fg-secondary hover:text-fg">{s.none}</button>
              <button onClick={() => setShown(withNeighbours(shown, diagram?.links ?? []))} disabled={!shown.size} title={s.neighboursHint}
                className="rounded-md border border-line px-2 py-0.5 text-xs text-fg-secondary hover:text-fg disabled:opacity-40">{s.neighbours}</button>
            </div>
          </div>
          <ul className="flex-1 overflow-y-auto p-1.5">
            {listed.map(tb => {
              const k = tableKey(tb)
              return (
                <li key={k}>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-hover">
                    <input type="checkbox" checked={shown.has(k)} onChange={e => toggle(k, e.target.checked)} className="accent-[var(--color-accent)]" />
                    {tb.type === 'view' && <Eye size={11} className="shrink-0 text-fg-muted" />}
                    <span className={cn('truncate font-mono text-xs', shown.has(k) ? 'text-fg' : 'text-fg-secondary')}>{label(tb)}</span>
                  </label>
                </li>
              )
            })}
          </ul>
          {diagram && <p className="border-t border-line-subtle px-3 py-2 text-xs text-fg-muted">{s.count.replace('{n}', String(shown.size)).replace('{total}', String(diagram.tables.length))}</p>}
        </aside>

        <div ref={viewport} className="relative min-w-0 flex-1 cursor-grab overflow-hidden bg-canvas active:cursor-grabbing"
          style={{ backgroundImage: 'radial-gradient(var(--color-line-subtle) 1px, transparent 1px)', backgroundSize: `${20 * view.k}px ${20 * view.k}px`, backgroundPosition: `${view.x}px ${view.y}px` }}
          onPointerDown={e => down(e)} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          onWheel={e => { const r = viewport.current!.getBoundingClientRect(); zoom(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top) }}
          data-testid="schema-canvas">
          {error ? <p className="m-6 rounded-lg bg-danger-soft p-3 text-sm text-danger">{s.loadFailed} : {error}</p>
            : !diagram ? <Spinner className="m-6" />
            : !shown.size ? (
              <p className="absolute inset-x-0 top-1/3 mx-auto max-w-md text-center text-sm text-fg-secondary">
                {diagram.tables.length === 0 ? s.empty : diagram.tables.length > MANY ? s.tooMany.replace('{n}', String(diagram.tables.length)) : s.noneShown}
              </p>
            ) : (
              <div className="absolute top-0 left-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
                <svg className="pointer-events-none absolute top-0 left-0 overflow-visible" width="1" height="1" aria-hidden>
                  {links.map((l, i) => {
                    const a = boxes.get(tableKey(l.from)), b = boxes.get(tableKey(l.to))
                    if (!a || !b) return null
                    const p = linkPath(a, byKey.get(tableKey(l.from))!, b, byKey.get(tableKey(l.to))!, l)
                    const lit = hover !== null && (hover === tableKey(l.from) || hover === tableKey(l.to))
                    const color = lit ? 'var(--color-accent)' : 'var(--color-fg-muted)'
                    return (
                      <g key={i} opacity={hover && !lit ? 0.25 : 0.9}>
                        <path d={p.d} fill="none" stroke={color} strokeWidth={lit ? 2 : 1.4} />
                        <path d={arrowHead(p.end, p.toRight)} fill={color} />
                      </g>
                    )
                  })}
                </svg>
                {[...boxes].map(([k, b]) => {
                  const tb = byKey.get(k)!
                  return (
                    <div key={k} data-table={k} className={cn('absolute overflow-hidden rounded-[10px] border bg-surface shadow-sm', hover === k ? 'border-accent' : 'border-line')}
                      style={{ left: b.x, top: b.y, width: b.w, height: b.h }} onPointerEnter={() => setHover(k)} onPointerLeave={() => setHover(h => (h === k ? null : h))}>
                      <button className="flex w-full cursor-move items-center gap-2 border-b border-line bg-elevated px-3 text-left" style={{ height: HEADER }}
                        aria-label={s.open.replace('{name}', label(tb))} onPointerDown={e => down(e, k)}
                        onClick={() => { if (!dragged.current) onOpenTable({ name: tb.name, schema: tb.schema }); dragged.current = false }}>
                        {tb.type === 'view' && <Eye size={12} className="shrink-0 text-fg-muted" />}
                        <span className="truncate font-mono text-[13px] font-semibold text-fg">{label(tb)}</span>
                      </button>
                      {tb.columns.map(c => (
                        <div key={c.name} className="flex items-center gap-1.5 px-3 font-mono text-[11.5px]" style={{ height: ROW }}>
                          {c.pk ? <KeyRound size={10} className="shrink-0 text-warning" /> : <span className="w-[10px] shrink-0" />}
                          <span className={cn('truncate', c.pk ? 'text-fg' : 'text-fg-secondary')}>{c.name}</span>
                          <span className="ml-auto shrink-0 pl-2 text-[11px] text-fg-muted">{c.type}{c.nullable ? '' : ' !'}</span>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}

          {boxes.size > 0 && (
            <svg width={MINI.w} height={MINI.h} role="img" aria-label={s.minimap} data-testid="schema-minimap"
              className="absolute right-3 bottom-3 cursor-pointer rounded-lg border border-line bg-surface/90"
              onPointerDown={e => {
                e.stopPropagation()
                const r = e.currentTarget.getBoundingClientRect()
                const wx = world.x + (e.clientX - r.left - 6) / mini, wy = world.y + (e.clientY - r.top - 6) / mini
                setView(v => ({ ...v, x: size.w / 2 - wx * v.k, y: size.h / 2 - wy * v.k }))
              }}>
              {[...boxes].map(([k, b]) => {
                const p = toMini(b)
                return <rect key={k} x={p.x} y={p.y} width={Math.max(2, b.w * mini)} height={Math.max(2, b.h * mini)} rx={1.5} fill={hover === k ? 'var(--color-accent)' : 'var(--color-fg-muted)'} opacity={0.6} />
              })}
              {(() => { const p = toMini(seen); return <rect x={p.x} y={p.y} width={seen.w * mini} height={seen.h * mini} fill="none" stroke="var(--color-accent)" strokeWidth={1.5} /> })()}
            </svg>
          )}
        </div>
      </div>
    </div>
  )
}
