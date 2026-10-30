import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Check, Copy, FileCode2, KeyRound, LayoutTemplate, Maximize2, Minus, Plus, Redo2, RefreshCw, RotateCcw, Trash2, Undo2 } from 'lucide-react'
import type { ModelFile, MpdColumn, MpdModel, MpdTable, MpdType, SqlEngine } from '@shared/types'
import { uid } from '@shared/lib/mcd'
import { checkMpd, DEFAULT_NAMING, generateMpd, mcdHash, MPD_TYPES, mpdDiagram, mpdSql, placeNew, SQL_ENGINES, sqlType, syncForeignKeys } from '@shared/lib/mpd'
import { arrowHead, boxSize, bounds, diagramSvg, HEADER, linkPath, ROW, type Box, type Point } from '@shared/lib/schemaLayout'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { errorText } from '@renderer/lib/errors'
import { formatRelative } from '@renderer/lib/format'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import IconButton from '@renderer/components/ui/IconButton'
import Spinner from '@renderer/components/ui/Spinner'
import { saveDrawing, schemaColors } from './colors'
import ModelTabs, { siblings, useSiblings } from './ModelTabs'
import { fill } from './MldView'

const MINI = { w: 180, h: 110 }
const SAVE_DELAY = 500
const SIZED: MpdType[] = ['varchar', 'char', 'decimal']

const isTyping = (t: EventTarget | null) => t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement

/** A new type, with the sizes it needs (a text's length, a decimal's digits) */
function retype(c: MpdColumn, type: MpdType): Partial<MpdColumn> {
  if (type === 'varchar') return { type, length: c.type === 'varchar' || c.type === 'char' ? c.length : 255, scale: undefined }
  if (type === 'char') return { type, length: c.type === 'varchar' || c.type === 'char' ? c.length : 1, scale: undefined }
  if (type === 'decimal') return { type, length: c.type === 'decimal' ? c.length : 10, scale: c.type === 'decimal' ? c.scale : 2 }
  return { type, length: undefined, scale: undefined }
}

/**
 * v3.9 lot 3: the MPD, made from the MCD and touched up by hand (names, types,
 * lengths, indexes), drawn like the database schema; and its SQL for the
 * engine chosen, written next to it in conception/.
 */
export default function MpdView({ projectPath, file, tab }: { projectPath: string; file: string; tab: 'mpd' | 'sql' }) {
  const { t, lang } = useI18n()
  const m = t.modeling
  const p = m.mpd
  const e = m.editor
  const toast = useToast()
  const navigate = useNavigate()
  const [tick, setTick] = useState(0)
  const found = useSiblings(projectPath, file, tick)
  const [model, setModel] = useState<ModelFile | null>(null)
  const [mpd, setMpd] = useState<MpdModel | null>(null)
  const [error, setError] = useState('')
  const [sel, setSel] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'failed'>('saved')
  const [changedSinceWrite, setChangedSinceWrite] = useState(false)
  const [view, setView] = useState({ x: 40, y: 40, k: 1 })
  const [size, setSize] = useState({ w: 800, h: 600 })
  const viewport = useRef<HTMLDivElement>(null)
  const history = useRef<{ past: MpdModel[]; future: MpdModel[]; mergeKey: string | null; at: number }>({ past: [], future: [], mergeKey: null, at: 0 })
  const [, setHistoryTick] = useState(0)
  const drag = useRef<{ kind: 'pan' | 'move'; id?: string; sx: number; sy: number; ox: number; oy: number; moved: boolean; before?: MpdModel } | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<MpdModel | null>(null)
  const touched = useRef(false)
  const sib = siblings(file)

  // ── Load and save (as the MCD editor) ──────────────────────────────────────
  useEffect(() => {
    window.devforge.modeling.read(projectPath, file)
      .then(f => { setModel(f); setMpd(f.mpd ?? null) })
      .catch(err => setError(errorText(err)))
  }, [projectPath, file])

  const flush = useCallback(async () => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
    const next = pending.current
    if (!next || !model) return
    pending.current = null
    setSaveState('saving')
    try { await window.devforge.modeling.save(projectPath, file, { ...model, mpd: next }); setSaveState('saved') }
    catch (err) { setSaveState('failed'); toast.show({ tone: 'error', title: e.saveFailed, description: errorText(err) }) }
  }, [model, projectPath, file, toast, e.saveFailed])
  const flushRef = useRef(flush)
  flushRef.current = flush
  useEffect(() => () => { void flushRef.current() }, [])

  const schedule = (next: MpdModel) => {
    pending.current = next
    setSaveState('saving')
    setChangedSinceWrite(true)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { void flushRef.current() }, SAVE_DELAY)
  }

  const change = (fn: (x: MpdModel) => MpdModel, mergeKey: string | null = null, before?: MpdModel) => {
    setMpd(cur => {
      if (!cur) return cur
      const next = fn(cur)
      const h = history.current
      const merge = mergeKey !== null && h.mergeKey === mergeKey && Date.now() - h.at < 1500
      if (!merge) h.past = [...h.past.slice(-99), before ?? cur]
      h.future = []
      h.mergeKey = mergeKey
      h.at = Date.now()
      schedule(next)
      return next
    })
    setHistoryTick(x => x + 1)
  }
  const undo = () => {
    const h = history.current
    if (!h.past.length || !mpd) return
    h.future = [mpd, ...h.future]
    const prev = h.past[h.past.length - 1]
    h.past = h.past.slice(0, -1)
    h.mergeKey = null
    setMpd(prev); schedule(prev); setHistoryTick(x => x + 1)
  }
  const redo = () => {
    const h = history.current
    if (!h.future.length || !mpd) return
    h.past = [...h.past, mpd]
    const next = h.future[0]
    h.future = h.future.slice(1)
    h.mergeKey = null
    setMpd(next); schedule(next); setHistoryTick(x => x + 1)
  }

  const editTable = (id: string, fn: (x: MpdTable) => MpdTable, key: string | null = null) =>
    change(x => syncForeignKeys({ ...x, tables: x.tables.map(tb => (tb.id === id ? fn(tb) : tb)) }), key)
  const editColumn = (tid: string, cid: string, patch: Partial<MpdColumn>, key: string | null = null) =>
    editTable(tid, tb => ({ ...tb, columns: tb.columns.map(c => (c.id === cid ? { ...c, ...patch, edited: true } : c)) }), key)

  // ── The MCD it comes from ──────────────────────────────────────────────────
  const mcd = found?.mcd?.mcd
  const stale = !!(mpd && mcd && mpd.sourceHash !== mcdHash(mcd, found?.mcd?.naming ?? DEFAULT_NAMING))
  const update = () => { if (mcd) change(x => generateMpd(mcd, found?.mcd?.naming ?? DEFAULT_NAMING, x.engine, x, sib.mcd)) }
  /** A column back to what the MCD gives (when the MPD is up to date, nothing else moves) */
  const resetColumn = (tid: string, cid: string) => {
    if (!mcd) return
    change(x => generateMpd(mcd, x.naming, x.engine, {
      ...x, tables: x.tables.map(tb => (tb.id === tid ? { ...tb, columns: tb.columns.map(c => (c.id === cid ? { ...c, edited: false } : c)) } : tb))
    }, sib.mcd))
  }

  // ── Geometry ───────────────────────────────────────────────────────────────
  const drawn = useMemo(() => (mpd ? mpdDiagram(mpd) : null), [mpd])
  const boxes = useMemo(() => {
    const out = new Map<string, Box>()
    mpd?.tables.forEach((tb, i) => out.set(tb.id, { x: tb.x, y: tb.y, ...boxSize(drawn!.diagram.tables[i]) }))
    return out
  }, [mpd, drawn])
  const all = bounds([...boxes.values()])

  useLayoutEffect(() => {
    const el = viewport.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [mpd !== null, tab]) // eslint-disable-line react-hooks/exhaustive-deps

  const fit = () => {
    if (!all.w) return
    const k = Math.min(1, (size.w - 80) / all.w, (size.h - 80) / all.h)
    setView({ k, x: (size.w - all.w * k) / 2 - all.x * k, y: (size.h - all.h * k) / 2 - all.y * k })
  }
  useEffect(() => { if (!touched.current && mpd && size.w > 100) fit() }, [mpd !== null, size.w, size.h]) // eslint-disable-line react-hooks/exhaustive-deps

  const zoom = (factor: number, cx = size.w / 2, cy = size.h / 2) => { touched.current = true; setView(v => {
    const k = Math.min(2, Math.max(0.15, v.k * factor))
    return { k, x: cx - (cx - v.x) * (k / v.k), y: cy - (cy - v.y) * (k / v.k) }
  }) }
  const zoomAt = useRef<(ev: WheelEvent) => void>(() => {})
  zoomAt.current = ev => { const r = viewport.current!.getBoundingClientRect(); zoom(Math.exp(-ev.deltaY * 0.0015), ev.clientX - r.left, ev.clientY - r.top) }
  useEffect(() => {
    const el = viewport.current
    if (!el) return
    const onWheel = (ev: WheelEvent) => { ev.preventDefault(); zoomAt.current(ev) }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [mpd !== null, tab]) // eslint-disable-line react-hooks/exhaustive-deps

  const keys = useRef<(ev: KeyboardEvent) => void>(() => {})
  keys.current = ev => {
    if (isTyping(ev.target)) return
    const mod = ev.ctrlKey || ev.metaKey
    if (mod && ev.key.toLowerCase() === 'z') { ev.preventDefault(); if (ev.shiftKey) redo(); else undo() }
    else if (mod && ev.key.toLowerCase() === 'y') { ev.preventDefault(); redo() }
    else if (ev.key === 'Escape') setSel(null)
  }
  useEffect(() => {
    const on = (ev: KeyboardEvent) => keys.current(ev)
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [])

  // Pan the background, move a table by its header
  const down = (ev: ReactPointerEvent, id?: string) => {
    if (ev.button !== 0) return
    ev.preventDefault()
    ev.stopPropagation()
    ;(ev.currentTarget as Element).setPointerCapture(ev.pointerId)
    setSel(id ?? null)
    const b = id ? boxes.get(id) : null
    drag.current = { kind: id ? 'move' : 'pan', id, sx: ev.clientX, sy: ev.clientY, ox: b ? b.x : view.x, oy: b ? b.y : view.y, moved: false, before: mpd ?? undefined }
  }
  const move = (ev: ReactPointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = ev.clientX - d.sx, dy = ev.clientY - d.sy
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true
    if (d.kind === 'pan') { if (d.moved) touched.current = true; setView(v => ({ ...v, x: d.ox + dx, y: d.oy + dy })); return }
    if (!d.moved) return
    const x = Math.round(d.ox + dx / view.k), y = Math.round(d.oy + dy / view.k)
    setMpd(cur => cur && ({ ...cur, tables: cur.tables.map(tb => (tb.id === d.id ? { ...tb, x, y } : tb)) }))
  }
  const up = () => {
    const d = drag.current
    drag.current = null
    if (d?.kind === 'move' && d.moved) change(x => x, null, d.before)
  }

  // ── SQL ────────────────────────────────────────────────────────────────────
  const sql = useMemo(() => (mpd ? mpdSql(mpd, [fill(p.sqlHeader, { file: sib.sql, engine: p.engines[mpd.engine] })]) : ''), [mpd, p, sib.sql])
  const issues = useMemo(() => (mpd ? checkMpd(mpd) : []), [mpd])
  const errors = issues.filter(i => i.level === 'error').length
  const sqlAt = found?.mpd?.sqlAt
  const sqlStale = !!sqlAt && (changedSinceWrite || (found?.mpd?.updatedAt ?? '') > sqlAt)

  async function copySql() {
    await navigator.clipboard.writeText(sql)
    toast.show({ tone: 'success', title: p.copied })
  }
  async function writeSql() {
    try {
      await flush()
      const path = await window.devforge.modeling.writeSql(projectPath, file, sql)
      setChangedSinceWrite(false)
      setTick(x => x + 1)
      toast.show({ tone: 'success', title: p.written, description: path })
    } catch (err) { toast.show({ tone: 'error', title: p.writeFailed, description: errorText(err) }) }
  }
  async function exportAs(ext: 'png' | 'svg') {
    if (!mpd || !drawn) return
    try {
      const path = await saveDrawing(diagramSvg(drawn.diagram.tables, drawn.positions, drawn.diagram.links, schemaColors()), sib.base, ext)
      if (path) toast.show({ tone: 'success', title: e.exported, description: path })
    } catch (err) { toast.show({ tone: 'error', title: e.exportFailed, description: errorText(err) }) }
  }

  // The minimap
  const seen = { x: -view.x / view.k, y: -view.y / view.k, w: size.w / view.k, h: size.h / view.k }
  const world = bounds([all.w ? all : seen, seen])
  const mini = world.w ? Math.min((MINI.w - 12) / world.w, (MINI.h - 12) / world.h) : 1
  const toMini = (pt: Point) => ({ x: 6 + (pt.x - world.x) * mini, y: 6 + (pt.y - world.y) * mini })

  if (error) return <div className="p-8"><p className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{m.loadFailed} : {error}</p></div>
  if (!model || !mpd || !drawn) return <Spinner className="m-8" />

  const h = history.current
  const selTable = mpd.tables.find(x => x.id === sel)
  const tableName = (id: string) => mpd.tables.find(x => x.id === id)?.name ?? '?'

  const checkList = (
    <section aria-label={p.check} className="flex flex-col gap-2">
      <h2 className="font-mono text-2xs font-medium tracking-widest text-fg-muted uppercase">{p.check}</h2>
      {!issues.length ? <p className="flex items-center gap-1.5 text-sm text-success"><Check size={13} /> {p.allGood}</p> : (
        <ul className="flex flex-col gap-1">
          {issues.map((i, n) => (
            <li key={n}>
              <button type="button" onClick={() => setSel(i.table)} className="flex w-full items-start gap-2 rounded-md px-1.5 py-1 text-left text-sm text-fg-secondary hover:bg-hover hover:text-fg">
                <AlertTriangle size={13} className={cn('mt-0.5 shrink-0', i.level === 'error' ? 'text-danger' : 'text-warning')} />
                {fill(p.issues[i.code], { name: i.name })}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )

  const sqlFile = (
    <p className="text-xs text-fg-muted">
      <span className="font-mono">conception/{sib.sql}</span> · {!sqlAt ? p.sqlNone : sqlStale ? <span className="text-warning">{p.sqlStale}</span> : fill(p.sqlAt, { when: formatRelative(sqlAt, lang) })}
    </p>
  )

  return (
    <div className="flex h-full min-h-0 flex-col p-4">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[14px] border border-line bg-surface">
        <header className="flex h-[52px] shrink-0 items-center gap-2 border-b border-line-subtle px-3">
          <Button variant="secondary" size="sm" onClick={() => { void flush(); navigate('/modeling') }}><ArrowLeft size={13} /> {m.title}</Button>
          <h1 className="min-w-0 truncate text-md font-semibold text-fg">{model.name}</h1>
          <ModelTabs projectPath={projectPath} file={file} tab={tab} hasMcd={!!found?.mcd} hasMpd before={() => { void flush() }} />
          <span className="flex-1" />
          <span role="status" className={cn('hidden max-w-[220px] truncate text-xs 2xl:block', saveState === 'failed' ? 'text-danger' : 'text-fg-muted')}>
            {saveState === 'saving' ? e.saving : saveState === 'failed' ? e.saveFailed : e.saved.replace('{file}', `conception/${file}`)}
          </span>
          <IconButton size="sm" title={`${e.undo} (Ctrl+Z)`} onClick={undo} disabled={!h.past.length}><Undo2 size={14} /></IconButton>
          <IconButton size="sm" title={`${e.redo} (Ctrl+Y)`} onClick={redo} disabled={!h.future.length}><Redo2 size={14} /></IconButton>
          <select aria-label={p.engine} value={mpd.engine} onChange={ev => change(x => ({ ...x, engine: ev.target.value as SqlEngine }))}
            className="h-8 rounded-md border border-line bg-canvas px-2 text-sm text-fg outline-none focus:border-accent">
            {SQL_ENGINES.map(x => <option key={x} value={x}>{p.engines[x]}</option>)}
          </select>
          {tab === 'mpd' && <>
            <span className="flex items-center gap-0.5 rounded-lg border border-line px-0.5">
              <IconButton size="sm" title={e.zoomOut} onClick={() => zoom(1 / 1.2)}><Minus size={13} /></IconButton>
              <span className="w-11 text-center font-mono text-xs text-fg-secondary">{Math.round(view.k * 100)} %</span>
              <IconButton size="sm" title={e.zoomIn} onClick={() => zoom(1.2)}><Plus size={13} /></IconButton>
            </span>
            <IconButton size="sm" title={e.fit} onClick={fit}><Maximize2 size={13} /></IconButton>
            <IconButton size="sm" title={p.relayout} onClick={() => { change(x => placeNew(x, new Set())); touched.current = false }}><LayoutTemplate size={13} /></IconButton>
            <Button variant="secondary" size="sm" onClick={() => exportAs('png')} disabled={!all.w}>PNG</Button>
            <Button variant="secondary" size="sm" onClick={() => exportAs('svg')} disabled={!all.w}>SVG</Button>
          </>}
          <Button variant="secondary" size="sm" onClick={() => setSel(null)} title={p.checkHint}>
            {errors ? <AlertTriangle size={13} className="text-warning" /> : <Check size={13} className="text-success" />} {p.check}{issues.length ? ` · ${issues.length}` : ''}
          </Button>
          <Button size="sm" onClick={writeSql}><FileCode2 size={13} /> {fill(p.writeSql, { file: sib.sql })}</Button>
        </header>

        {(stale || !found?.mcd) && found && (
          <div role="status" className={cn('flex shrink-0 items-center gap-2 border-b border-line-subtle px-4 py-2 text-sm', stale ? 'bg-warning-soft text-fg' : 'text-fg-muted')}>
            {stale ? <><AlertTriangle size={14} className="text-warning" /> {p.stale}
              <Button size="sm" variant="secondary" onClick={update}><RefreshCw size={13} /> {p.update}</Button></> : p.noMcd}
          </div>
        )}

        {tab === 'sql' ? (
          <div className="flex min-h-0 flex-1">
            <section aria-label={fill(p.sqlTitle, { engine: p.engines[mpd.engine] })} className="flex min-w-0 flex-1 flex-col">
              <pre data-testid="mpd-sql" tabIndex={0} className="min-h-0 flex-1 overflow-auto bg-canvas p-5 font-mono text-[12.5px] leading-relaxed text-fg">{sql}</pre>
            </section>
            <aside aria-label={p.check} className="flex w-[300px] shrink-0 flex-col gap-4 overflow-y-auto border-l border-line-subtle p-4">
              <div className="flex flex-col gap-2">
                <h2 className="font-mono text-2xs font-medium tracking-widest text-fg-muted uppercase">{fill(p.sqlTitle, { engine: p.engines[mpd.engine] })}</h2>
                {sqlFile}
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={copySql}><Copy size={13} /> {p.copy}</Button>
                </div>
              </div>
              {checkList}
            </aside>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1">
            <div ref={viewport} data-testid="mpd-canvas"
              className="relative min-w-0 flex-1 cursor-grab touch-none overflow-hidden bg-canvas select-none active:cursor-grabbing"
              style={{ backgroundImage: 'radial-gradient(var(--color-line-subtle) 1px, transparent 1px)', backgroundSize: `${20 * view.k}px ${20 * view.k}px`, backgroundPosition: `${view.x}px ${view.y}px` }}
              onPointerDown={ev => down(ev)} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onDragStart={ev => ev.preventDefault()}>
              <div className="absolute top-0 left-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
                <svg className="pointer-events-none absolute top-0 left-0 overflow-visible" width="1" height="1" aria-hidden>
                  {drawn.diagram.links.map((l, i) => {
                    const a = boxes.get(l.from.schema), b = boxes.get(l.to.schema)
                    const ta = drawn.diagram.tables.find(x => x.schema === l.from.schema), tb = drawn.diagram.tables.find(x => x.schema === l.to.schema)
                    if (!a || !b || !ta || !tb) return null
                    const path = linkPath(a, ta, b, tb, l)
                    const lit = sel !== null && (sel === l.from.schema || sel === l.to.schema)
                    const color = lit ? 'var(--color-accent)' : 'var(--color-fg-muted)'
                    return (
                      <g key={i} opacity={sel && !lit ? 0.35 : 0.9}>
                        <path d={path.d} fill="none" stroke={color} strokeWidth={lit ? 2 : 1.4} />
                        <path d={arrowHead(path.end, path.toRight)} fill={color} />
                      </g>
                    )
                  })}
                </svg>
                {mpd.tables.map(tb => {
                  const b = boxes.get(tb.id)!
                  const on = sel === tb.id
                  return (
                    <div key={tb.id} data-table={tb.name}
                      className={cn('absolute overflow-hidden rounded-[10px] border bg-surface shadow-sm', on ? 'border-accent shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-accent)_25%,transparent)]' : 'border-line')}
                      style={{ left: b.x, top: b.y, width: b.w, height: b.h }} onPointerDown={ev => down(ev, tb.id)}>
                      <div className="flex cursor-move items-center gap-2 border-b border-line bg-elevated px-3" style={{ height: HEADER }}>
                        <span className="truncate font-mono text-[13px] font-semibold text-fg">{tb.name || '—'}</span>
                      </div>
                      {tb.columns.map(c => (
                        <div key={c.id} className="flex items-center gap-1.5 px-3 font-mono text-[11.5px]" style={{ height: ROW }}>
                          {c.pk ? <KeyRound size={10} className="shrink-0 text-warning" /> : <span className="w-[10px] shrink-0" />}
                          <span className={cn('truncate', c.ref ? 'text-accent' : c.pk ? 'text-fg' : 'text-fg-secondary')}>{c.name}</span>
                          <span className="ml-auto shrink-0 pl-2 text-[11px] text-fg-muted">{sqlType(c, mpd.engine)}{c.nullable && !c.pk ? '' : ' !'}</span>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>

              {boxes.size > 0 && (
                <svg width={MINI.w} height={MINI.h} role="img" aria-label={e.minimap}
                  className="absolute right-3 bottom-3 cursor-pointer rounded-lg border border-line bg-surface/90"
                  onPointerDown={ev => {
                    ev.stopPropagation()
                    const r = ev.currentTarget.getBoundingClientRect()
                    const wx = world.x + (ev.clientX - r.left - 6) / mini, wy = world.y + (ev.clientY - r.top - 6) / mini
                    touched.current = true
                    setView(v => ({ ...v, x: size.w / 2 - wx * v.k, y: size.h / 2 - wy * v.k }))
                  }}>
                  {[...boxes].map(([id, b]) => {
                    const pt = toMini(b)
                    return <rect key={id} x={pt.x} y={pt.y} width={Math.max(2, b.w * mini)} height={Math.max(2, b.h * mini)} rx={1.5} fill={sel === id ? 'var(--color-accent)' : 'var(--color-fg-muted)'} opacity={0.6} />
                  })}
                  {(() => { const pt = toMini(seen); return <rect x={pt.x} y={pt.y} width={seen.w * mini} height={seen.h * mini} fill="none" stroke="var(--color-accent)" strokeWidth={1.5} /> })()}
                </svg>
              )}
            </div>

            <aside aria-label={selTable ? p.table : p.check} className="flex w-[340px] shrink-0 flex-col gap-4 overflow-y-auto border-l border-line-subtle p-4">
              {selTable ? (
                <TablePanel table={selTable} engine={mpd.engine} tableName={tableName} canReset={!!mcd && !stale}
                  onTable={(fn, key) => editTable(selTable.id, fn, key)}
                  onColumn={(cid, patch, key) => editColumn(selTable.id, cid, patch, key)}
                  onReset={cid => resetColumn(selTable.id, cid)} />
              ) : <>
                {checkList}
                <section aria-label={fill(p.sqlTitle, { engine: p.engines[mpd.engine] })} className="flex min-h-0 flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <h2 className="flex-1 font-mono text-2xs font-medium tracking-widest text-fg-muted uppercase">{fill(p.sqlTitle, { engine: p.engines[mpd.engine] })}</h2>
                    <Button size="sm" variant="ghost" onClick={copySql}><Copy size={13} /> {p.copy}</Button>
                  </div>
                  {sqlFile}
                  <pre tabIndex={0} className="max-h-[420px] overflow-auto rounded-lg border border-line-subtle bg-canvas p-3 font-mono text-[11.5px] leading-relaxed text-fg">{sql}</pre>
                </section>
                <p className="mt-auto text-xs leading-snug text-fg-muted">{p.nothing}</p>
              </>}
            </aside>
          </div>
        )}
      </div>
    </div>
  )
}

/** The table chosen: its name, its columns (type, length, empty, unique), its indexes */
function TablePanel({ table, engine, tableName, canReset, onTable, onColumn, onReset }: {
  table: MpdTable
  engine: SqlEngine
  tableName: (id: string) => string
  canReset: boolean
  onTable: (fn: (x: MpdTable) => MpdTable, key?: string | null) => void
  onColumn: (cid: string, patch: Partial<MpdColumn>, key?: string | null) => void
  onReset: (cid: string) => void
}) {
  const { t } = useI18n()
  const p = t.modeling.mpd
  const input = 'h-7 min-w-0 rounded-md border border-line bg-canvas px-2 font-mono text-xs text-fg outline-none focus:border-accent'
  const addIndex = () => {
    const col = table.columns.find(c => !c.pk && !c.ref) ?? table.columns[0]
    if (!col) return
    onTable(x => ({ ...x, indexes: [...x.indexes, { id: uid('i'), name: `idx_${x.name}_${col.name}`.toLowerCase(), columns: [col.id] }] }))
  }
  const setIndex = (id: string, patch: Partial<MpdTable['indexes'][number]>, key?: string) =>
    onTable(x => ({ ...x, indexes: x.indexes.map(i => (i.id === id ? { ...i, ...patch } : i)) }), key)

  return <>
    <label className="flex flex-col gap-1 text-sm text-fg-secondary">
      {p.tableName}
      <input value={table.name} onChange={ev => onTable(x => ({ ...x, name: ev.target.value.slice(0, 64), edited: true }), `t-${table.id}`)}
        className="h-8 rounded-md border border-line bg-canvas px-2 font-mono text-sm text-fg outline-none focus:border-accent" />
    </label>

    <section aria-label={p.columns} className="flex flex-col gap-2">
      <h2 className="font-mono text-2xs font-medium tracking-widest text-fg-muted uppercase">{p.columns}</h2>
      <ul className="flex flex-col gap-1.5">
        {table.columns.map(c => (
          <li key={c.id} data-column={c.name} className="flex flex-col gap-1.5 rounded-lg border border-line-subtle p-2">
            <div className="flex items-center gap-1.5">
              {c.pk ? <KeyRound size={12} className="shrink-0 text-warning" aria-label={p.pk} /> : null}
              <input aria-label={p.colName} value={c.name} onChange={ev => onColumn(c.id, { name: ev.target.value.slice(0, 64) }, `n-${c.id}`)} className={cn(input, 'flex-1')} />
              {c.edited && canReset && <IconButton size="sm" title={p.reset} onClick={() => onReset(c.id)}><RotateCcw size={12} /></IconButton>}
            </div>
            <div className="flex items-center gap-1.5">
              <select aria-label={fill(p.colType, { name: c.name })} value={c.type} onChange={ev => onColumn(c.id, retype(c, ev.target.value as MpdType))} className={cn(input, 'w-[128px] font-sans')}>
                {MPD_TYPES.map(x => <option key={x} value={x}>{p.types[x]}</option>)}
              </select>
              {SIZED.includes(c.type) && (
                <input type="number" min={1} aria-label={fill(p.length, { name: c.name })} value={c.length ?? ''} className={cn(input, 'w-16')}
                  onChange={ev => onColumn(c.id, { length: Number(ev.target.value) || undefined }, `l-${c.id}`)} />
              )}
              {c.type === 'decimal' && (
                <input type="number" min={0} aria-label={fill(p.scale, { name: c.name })} value={c.scale ?? 0} className={cn(input, 'w-12')}
                  onChange={ev => onColumn(c.id, { scale: Math.max(0, Number(ev.target.value) || 0) }, `s-${c.id}`)} />
              )}
              <span className="ml-auto truncate font-mono text-[11px] text-fg-muted">{sqlType(c, engine)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-secondary">
              {!c.pk && <label className="flex items-center gap-1"><input type="checkbox" aria-label={fill(p.nullableOf, { name: c.name })} checked={!!c.nullable} onChange={ev => onColumn(c.id, { nullable: ev.target.checked })} className="accent-[var(--color-accent)]" /> {p.nullable}</label>}
              {!c.pk && <label className="flex items-center gap-1"><input type="checkbox" aria-label={fill(p.uniqueOf, { name: c.name })} checked={!!c.unique} onChange={ev => onColumn(c.id, { unique: ev.target.checked })} className="accent-[var(--color-accent)]" /> {p.unique}</label>}
              {c.ref && <span className="font-mono text-accent">{fill(p.fkTo, { table: tableName(c.ref.table) })}</span>}
              {c.auto && <span title={p.autoHint} className="rounded bg-elevated px-1 font-mono">{p.auto}</span>}
              {c.edited && <span title={p.editedHint} className="ml-auto text-fg-muted">✎</span>}
            </div>
          </li>
        ))}
      </ul>
    </section>

    <section aria-label={p.indexes} className="flex flex-col gap-2">
      <div className="flex items-center">
        <h2 className="flex-1 font-mono text-2xs font-medium tracking-widest text-fg-muted uppercase">{p.indexes}</h2>
        <Button size="sm" variant="ghost" onClick={addIndex}><Plus size={13} /> {p.addIndex}</Button>
      </div>
      {!table.indexes.length ? <p className="text-xs text-fg-muted">{p.noIndex}</p> : (
        <ul className="flex flex-col gap-1.5">
          {table.indexes.map(i => (
            <li key={i.id} className="flex flex-col gap-1.5 rounded-lg border border-line-subtle p-2">
              <div className="flex items-center gap-1.5">
                <input aria-label={p.indexName} value={i.name} onChange={ev => setIndex(i.id, { name: ev.target.value.slice(0, 64) }, `i-${i.id}`)} className={cn(input, 'flex-1')} />
                <IconButton size="sm" tone="danger" title={p.removeIndex} onClick={() => onTable(x => ({ ...x, indexes: x.indexes.filter(y => y.id !== i.id) }))}><Trash2 size={12} /></IconButton>
              </div>
              <div className="flex items-center gap-2">
                <select aria-label={fill(p.indexColumns, { name: i.name })} value={i.columns[0]} onChange={ev => setIndex(i.id, { columns: [ev.target.value] })} className={cn(input, 'flex-1')}>
                  {table.columns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <label className="flex items-center gap-1 text-xs text-fg-secondary"><input type="checkbox" checked={!!i.unique} onChange={ev => setIndex(i.id, { unique: ev.target.checked })} className="accent-[var(--color-accent)]" /> {p.unique}</label>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  </>
}
