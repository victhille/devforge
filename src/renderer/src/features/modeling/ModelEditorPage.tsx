import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Check, Maximize2, Minus, Plus, Redo2, Spline, StickyNote, Trash2, Undo2, X } from 'lucide-react'
import type { Cardinality, McdAttribute, McdModel, McdType, ModelFile } from '@shared/types'
import {
  associationBox, bounds, CARDINALITIES, checkMcd, entityBox, HEADER, legLine, MCD_TYPES, mcdSvg, nextCard, noteBox, ROW, uid, type Box, type Point
} from '@shared/lib/mcd'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { errorText } from '@renderer/lib/errors'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import IconButton from '@renderer/components/ui/IconButton'
import Spinner from '@renderer/components/ui/Spinner'
import { mcdColors } from './colors'
import ModelTabs from './ModelTabs'
import { useSiblings, type ModelTab } from './model'
import MldView from './MldView'
import MpdView from './MpdView'
import DiagramEditor from './DiagramEditor'
import { isDiagramKind } from '@shared/lib/uml'

type Sel = { kind: 'entity' | 'association' | 'link' | 'note'; id: string } | null
type Tool = 'select' | 'link'
const MINI = { w: 180, h: 110 }
const SAVE_DELAY = 500

const isTyping = (t: EventTarget | null) => t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement

/** A model's page: its MCD, MLD, MPD or SQL, picked by the tab (an MPD opens on itself) */
export default function ModelEditorPage() {
  const [params] = useSearchParams()
  const projectPath = params.get('project') ?? ''
  const file = params.get('file') ?? ''
  const kind = file.split('.').slice(-2)[0]
  if (isDiagramKind(kind)) return <DiagramEditor key={file} projectPath={projectPath} file={file} kind={kind} />
  const tab = (params.get('tab') ?? (file.endsWith('.mpd.json') ? 'mpd' : 'mcd')) as ModelTab
  if (tab === 'mld') return <MldView key={file} projectPath={projectPath} file={file} />
  if (tab === 'mpd' || tab === 'sql') return <MpdView key={file} projectPath={projectPath} file={file} tab={tab} />
  return <McdEditor key={file} projectPath={projectPath} file={file} />
}

/**
 * v3.9 lot 2: the MCD editor. Entities, associations, the legs between them and
 * their cardinalities, notes; the same canvas as the schema (pan, zoom, fit,
 * minimap). Saved in the project's conception/ folder as it changes.
 */
function McdEditor({ projectPath, file }: { projectPath: string; file: string }) {
  const { t } = useI18n()
  const m = t.modeling
  const e = m.editor
  const toast = useToast()
  const navigate = useNavigate()
  const found = useSiblings(projectPath, file)

  const [model, setModel] = useState<ModelFile | null>(null)
  const [mcd, setMcd] = useState<McdModel | null>(null)
  const [error, setError] = useState('')
  const [sel, setSel] = useState<Sel>(null)
  const [tool, setTool] = useState<Tool>('select')
  const [linkFrom, setLinkFrom] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'failed'>('saved')
  const [view, setView] = useState({ x: 60, y: 60, k: 1 })
  const [size, setSize] = useState({ w: 800, h: 600 })
  const viewport = useRef<HTMLDivElement>(null)
  const history = useRef<{ past: McdModel[]; future: McdModel[]; mergeKey: string | null; at: number }>({ past: [], future: [], mergeKey: null, at: 0 })
  const [, setHistoryTick] = useState(0)
  const drag = useRef<{ kind: 'pan' | 'move'; sel?: Sel; sx: number; sy: number; ox: number; oy: number; moved: boolean; before?: McdModel } | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<McdModel | null>(null)
  /** The view was moved by hand: no more fitting on its own */
  const touched = useRef(false)

  // ── Load and save ──────────────────────────────────────────────────────────
  useEffect(() => {
    window.devforge.modeling.read(projectPath, file)
      .then(f => { setModel(f); setMcd(f.mcd ?? { entities: [], associations: [], links: [], notes: [] }) })
      .catch(err => setError(errorText(err)))
  }, [projectPath, file])

  const flush = useCallback(async () => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
    const next = pending.current
    if (!next || !model) return
    pending.current = null
    setSaveState('saving')
    try { await window.devforge.modeling.save(projectPath, file, { ...model, mcd: next }); setSaveState('saved') }
    catch (err) { setSaveState('failed'); toast.show({ tone: 'error', title: e.saveFailed, description: errorText(err) }) }
  }, [model, projectPath, file, toast, e.saveFailed])
  const flushRef = useRef(flush)
  flushRef.current = flush
  // Leaving the page saves what is left
  useEffect(() => () => { void flushRef.current() }, [])

  const schedule = (next: McdModel) => {
    pending.current = next
    setSaveState('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { void flushRef.current() }, SAVE_DELAY)
  }

  /** A change: kept in the history (typing in one field makes one step), then saved */
  const change = (fn: (m: McdModel) => McdModel, mergeKey: string | null = null, before?: McdModel) => {
    setMcd(cur => {
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
    if (!h.past.length || !mcd) return
    h.future = [mcd, ...h.future]
    const prev = h.past[h.past.length - 1]
    h.past = h.past.slice(0, -1)
    h.mergeKey = null
    setMcd(prev); schedule(prev); setHistoryTick(x => x + 1)
  }
  const redo = () => {
    const h = history.current
    if (!h.future.length || !mcd) return
    h.past = [...h.past, mcd]
    const next = h.future[0]
    h.future = h.future.slice(1)
    h.mergeKey = null
    setMcd(next); schedule(next); setHistoryTick(x => x + 1)
  }

  // ── Geometry ───────────────────────────────────────────────────────────────
  const boxes = useMemo(() => {
    const out = new Map<string, Box>()
    for (const x of mcd?.entities ?? []) out.set(x.id, entityBox(x))
    for (const x of mcd?.associations ?? []) out.set(x.id, associationBox(x))
    for (const x of mcd?.notes ?? []) out.set(x.id, noteBox(x))
    return out
  }, [mcd])
  const all = bounds([...boxes.values()])

  useLayoutEffect(() => {
    const el = viewport.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [mcd !== null]) // eslint-disable-line react-hooks/exhaustive-deps

  const fit = () => {
    if (!all.w) { setView({ x: 60, y: 60, k: 1 }); return }
    const k = Math.min(1, (size.w - 80) / all.w, (size.h - 80) / all.h)
    setView({ k, x: (size.w - all.w * k) / 2 - all.x * k, y: (size.h - all.h * k) / 2 - all.y * k })
  }
  // Fitted on opening, and again while the page settles (its width comes last), until the view is moved by hand
  useEffect(() => { if (!touched.current && mcd && size.w > 100) fit() }, [mcd !== null, size.w, size.h]) // eslint-disable-line react-hooks/exhaustive-deps

  const zoom = (factor: number, cx = size.w / 2, cy = size.h / 2) => { touched.current = true; setView(v => {
    const k = Math.min(2, Math.max(0.2, v.k * factor))
    return { k, x: cx - (cx - v.x) * (k / v.k), y: cy - (cy - v.y) * (k / v.k) }
  }) }
  // The wheel zooms the canvas only (a native listener: React's is passive)
  const zoomAt = useRef<(ev: WheelEvent) => void>(() => {})
  zoomAt.current = ev => { const r = viewport.current!.getBoundingClientRect(); zoom(Math.exp(-ev.deltaY * 0.0015), ev.clientX - r.left, ev.clientY - r.top) }
  useEffect(() => {
    const el = viewport.current
    if (!el) return
    const onWheel = (ev: WheelEvent) => { ev.preventDefault(); zoomAt.current(ev) }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [mcd !== null]) // eslint-disable-line react-hooks/exhaustive-deps

  const toWorld = (clientX: number, clientY: number): Point => {
    const r = viewport.current!.getBoundingClientRect()
    return { x: Math.round((clientX - r.left - view.x) / view.k), y: Math.round((clientY - r.top - view.y) / view.k) }
  }
  /** A free spot near the middle of the screen, for a new part: rings around it, until nothing is in the way */
  const spot = (w = 170, h = 90): Point => {
    const c = { x: Math.round((size.w / 2 - view.x) / view.k - w / 2), y: Math.round((size.h / 2 - view.y) / view.k - h / 2) }
    const free = (p: Point) => ![...boxes.values()].some(b => p.x < b.x + b.w + 40 && p.x + w + 40 > b.x && p.y < b.y + b.h + 40 && p.y + h + 40 > b.y)
    for (let ring = 0; ring < 12; ring++) {
      for (let i = 0; i < Math.max(1, ring * 8); i++) {
        const a = (i / Math.max(1, ring * 8)) * 2 * Math.PI
        const p = { x: Math.round(c.x + Math.cos(a) * ring * 120), y: Math.round(c.y + Math.sin(a) * ring * 90) }
        if (free(p)) return p
      }
    }
    return c
  }

  // ── Adding, linking, removing ──────────────────────────────────────────────
  const addEntity = (at?: Point) => {
    const id = uid('e')
    const p = at ?? spot()
    const n = (mcd?.entities.length ?? 0) + 1
    change(x => ({ ...x, entities: [...x.entities, { id, name: `${e.entityName}_${n}`.toUpperCase(), x: p.x, y: p.y, attributes: [{ id: uid('a'), name: `id_${e.entityName.toLowerCase()}_${n}`, type: 'int', identifier: true }] }] }))
    setSel({ kind: 'entity', id }); setTool('select')
  }
  const addAssociation = () => {
    const id = uid('s')
    const p = spot()
    change(x => ({ ...x, associations: [...x.associations, { id, name: e.associationName.toUpperCase(), x: p.x, y: p.y, attributes: [] }] }))
    setSel({ kind: 'association', id }); setTool('select')
  }
  const addNote = () => {
    const id = uid('t')
    const p = spot()
    change(x => ({ ...x, notes: [...x.notes, { id, x: p.x, y: p.y, text: e.noteText }] }))
    setSel({ kind: 'note', id }); setTool('select')
  }
  /** Link mode: an entity then an association (or the other way round) */
  const pickForLink = (id: string, kind: 'entity' | 'association') => {
    if (!linkFrom) { setLinkFrom(id); return }
    const fromIsEntity = mcd?.entities.some(x => x.id === linkFrom)
    if ((kind === 'entity') === fromIsEntity) { setLinkFrom(id); return }
    const entity = kind === 'entity' ? id : linkFrom, association = kind === 'association' ? id : linkFrom
    const lid = uid('l')
    change(x => ({ ...x, links: [...x.links, { id: lid, entity, association, card: '0,n' }] }))
    setLinkFrom(null); setTool('select'); setSel({ kind: 'link', id: lid })
  }
  const removeSel = () => {
    if (!sel) return
    const id = sel.id
    change(x => ({
      entities: x.entities.filter(n => n.id !== id),
      associations: x.associations.filter(n => n.id !== id),
      notes: x.notes.filter(n => n.id !== id),
      links: x.links.filter(l => l.id !== id && l.entity !== id && l.association !== id)
    }))
    setSel(null)
  }

  // Keyboard: delete, undo / redo, Escape leaves the link mode
  const keys = useRef<(ev: KeyboardEvent) => void>(() => {})
  keys.current = ev => {
    if (isTyping(ev.target)) return
    const mod = ev.ctrlKey || ev.metaKey
    if (mod && ev.key.toLowerCase() === 'z') { ev.preventDefault(); if (ev.shiftKey) redo(); else undo() }
    else if (mod && ev.key.toLowerCase() === 'y') { ev.preventDefault(); redo() }
    else if ((ev.key === 'Delete' || ev.key === 'Backspace') && sel) { ev.preventDefault(); removeSel() }
    else if (ev.key === 'Escape') { setTool('select'); setLinkFrom(null) }
  }
  useEffect(() => {
    const on = (ev: KeyboardEvent) => keys.current(ev)
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [])

  // ── Pointer: pan the background, move a part ───────────────────────────────
  const down = (ev: ReactPointerEvent, target?: Sel) => {
    if (ev.button !== 0) return
    ev.preventDefault()
    ev.stopPropagation()
    if (target && tool === 'link' && (target.kind === 'entity' || target.kind === 'association')) { pickForLink(target.id, target.kind); return }
    ;(ev.currentTarget as Element).setPointerCapture(ev.pointerId)
    if (target) setSel(target)
    else if (tool === 'select') setSel(null)
    const b = target ? boxes.get(target.id) : null
    drag.current = { kind: target ? 'move' : 'pan', sel: target ?? null, sx: ev.clientX, sy: ev.clientY, ox: b ? b.x : view.x, oy: b ? b.y : view.y, moved: false, before: mcd ?? undefined }
  }
  const move = (ev: ReactPointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = ev.clientX - d.sx, dy = ev.clientY - d.sy
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true
    if (d.kind === 'pan') { if (d.moved) touched.current = true; setView(v => ({ ...v, x: d.ox + dx, y: d.oy + dy })); return }
    if (!d.moved || !d.sel) return
    const id = d.sel.id, x = Math.round(d.ox + dx / view.k), y = Math.round(d.oy + dy / view.k)
    // Moving shows at once; the history gets one step when the part is dropped
    setMcd(cur => cur && ({
      ...cur,
      entities: cur.entities.map(n => (n.id === id ? { ...n, x, y } : n)),
      associations: cur.associations.map(n => (n.id === id ? { ...n, x, y } : n)),
      notes: cur.notes.map(n => (n.id === id ? { ...n, x, y } : n))
    }))
  }
  const up = () => {
    const d = drag.current
    drag.current = null
    if (d?.kind === 'move' && d.moved) change(x => x, null, d.before)
  }

  async function exportAs(ext: 'png' | 'svg') {
    if (!mcd || !model) return
    const svg = mcdSvg(mcd, mcdColors())
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
      const path = await window.devforge.db.saveImage(file.replace(/\.json$/, ''), content, ext)
      if (path) toast.show({ tone: 'success', title: e.exported, description: path })
    } catch (err) { toast.show({ tone: 'error', title: e.exportFailed, description: errorText(err) }) }
  }

  const issues = useMemo(() => (mcd ? checkMcd(mcd) : []), [mcd])
  const errors = issues.filter(i => i.level === 'error').length

  // The minimap: everything and the part on screen
  const seen = { x: -view.x / view.k, y: -view.y / view.k, w: size.w / view.k, h: size.h / view.k }
  const world = bounds([all.w ? all : seen, seen])
  const mini = world.w ? Math.min((MINI.w - 12) / world.w, (MINI.h - 12) / world.h) : 1
  const toMini = (p: Point) => ({ x: 6 + (p.x - world.x) * mini, y: 6 + (p.y - world.y) * mini })

  if (error) return <div className="p-8"><p className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{m.loadFailed} : {error}</p></div>
  if (!model || !mcd) return <Spinner className="m-8" />

  const selEntity = sel?.kind === 'entity' ? mcd.entities.find(x => x.id === sel.id) : undefined
  const selAssociation = sel?.kind === 'association' ? mcd.associations.find(x => x.id === sel.id) : undefined
  const selLink = sel?.kind === 'link' ? mcd.links.find(x => x.id === sel.id) : undefined
  const selNote = sel?.kind === 'note' ? mcd.notes.find(x => x.id === sel.id) : undefined
  const nameOf = (id: string) => mcd.entities.find(x => x.id === id)?.name ?? mcd.associations.find(x => x.id === id)?.name ?? ''
  const h = history.current

  return (
    <div className="flex h-full min-h-0 flex-col p-4">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[14px] border border-line bg-surface">
        {/* Toolbar */}
        <header className="flex h-[52px] shrink-0 items-center gap-2 border-b border-line-subtle px-3">
          <Button variant="secondary" size="sm" onClick={() => { void flush(); navigate('/modeling') }}><ArrowLeft size={13} /> {m.title}</Button>
          <h1 className="min-w-0 truncate text-md font-semibold text-fg">{model.name}</h1>
          <ModelTabs projectPath={projectPath} file={file} tab="mcd" hasMcd hasMpd={!!found?.mpd} before={() => { void flush() }} />
          <span className="flex-1" />
          <span role="status" className={cn('hidden truncate text-xs md:block', saveState === 'failed' ? 'text-danger' : 'text-fg-muted')}>
            {saveState === 'saving' ? e.saving : saveState === 'failed' ? e.saveFailed : e.saved.replace('{file}', `conception/${file}`)}
          </span>
          <IconButton size="sm" title={`${e.undo} (Ctrl+Z)`} onClick={undo} disabled={!h.past.length}><Undo2 size={14} /></IconButton>
          <IconButton size="sm" title={`${e.redo} (Ctrl+Y)`} onClick={redo} disabled={!h.future.length}><Redo2 size={14} /></IconButton>
          <span className="flex items-center gap-0.5 rounded-lg border border-line px-0.5">
            <IconButton size="sm" title={e.zoomOut} onClick={() => zoom(1 / 1.2)}><Minus size={13} /></IconButton>
            <span className="w-11 text-center font-mono text-xs text-fg-secondary">{Math.round(view.k * 100)} %</span>
            <IconButton size="sm" title={e.zoomIn} onClick={() => zoom(1.2)}><Plus size={13} /></IconButton>
          </span>
          <Button variant="secondary" size="sm" onClick={fit}><Maximize2 size={13} /> {e.fit}</Button>
          <Button variant="secondary" size="sm" onClick={() => setSel(null)} title={e.checkHint}>
            {errors ? <AlertTriangle size={13} className="text-warning" /> : <Check size={13} className="text-success" />} {e.check}{issues.length ? ` · ${issues.length}` : ''}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => exportAs('png')} disabled={!all.w}>PNG</Button>
          <Button variant="secondary" size="sm" onClick={() => exportAs('svg')} disabled={!all.w}>SVG</Button>
        </header>

        <div className="flex min-h-0 flex-1">
          {/* Palette */}
          <aside aria-label={e.palette} className="flex w-[180px] shrink-0 flex-col gap-2 border-r border-line-subtle p-3">
            <p className="font-mono text-2xs font-medium tracking-widest text-fg-muted uppercase">{e.palette}</p>
            <PaletteButton onClick={() => addEntity()} label={e.addEntity} icon={<svg width="18" height="14" aria-hidden><rect x="1" y="1" width="16" height="12" rx="2" fill="none" stroke="var(--syntax-keyword)" strokeWidth="1.5" /><path d="M1 5h16" stroke="var(--syntax-keyword)" strokeWidth="1.5" /></svg>} />
            <PaletteButton onClick={addAssociation} label={e.addAssociation} icon={<svg width="18" height="14" aria-hidden><ellipse cx="9" cy="7" rx="8" ry="5.5" fill="none" stroke="var(--syntax-keyword)" strokeWidth="1.5" /></svg>} />
            <PaletteButton onClick={() => { setTool(v => (v === 'link' ? 'select' : 'link')); setLinkFrom(null) }} label={e.addLink} pressed={tool === 'link'} icon={<Spline size={15} className="text-fg-secondary" />} />
            <PaletteButton onClick={addNote} label={e.addNote} icon={<StickyNote size={15} className="text-[var(--syntax-attr)]" />} />
            {tool === 'link' && <p role="status" className="rounded-lg bg-accent-soft p-2 text-xs text-fg">{linkFrom ? e.linkSecond.replace('{name}', nameOf(linkFrom)) : e.linkFirst}</p>}
            {mcd.entities.length > 0 && <p className="mt-2 font-mono text-2xs font-medium tracking-widest text-fg-muted uppercase">{e.entities}</p>}
            <ul className="flex min-h-0 flex-col gap-0.5 overflow-y-auto">
              {mcd.entities.map(x => (
                <li key={x.id}>
                  <button type="button" onClick={() => { setSel({ kind: 'entity', id: x.id }); const b = boxes.get(x.id)!; setView(v => ({ ...v, x: size.w / 2 - (b.x + b.w / 2) * v.k, y: size.h / 2 - (b.y + b.h / 2) * v.k })) }}
                    className={cn('w-full truncate rounded px-1.5 py-0.5 text-left font-mono text-xs', sel?.id === x.id ? 'bg-active text-fg' : 'text-fg-secondary hover:bg-hover hover:text-fg')}>{x.name || '—'}</button>
                </li>
              ))}
            </ul>
            <p className="mt-auto text-xs leading-snug text-fg-muted">{e.paletteHint}</p>
          </aside>

          {/* Canvas */}
          <div ref={viewport} data-testid="mcd-canvas"
            className={cn('relative min-w-0 flex-1 touch-none overflow-hidden bg-canvas select-none', tool === 'link' ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing')}
            style={{ backgroundImage: 'radial-gradient(var(--color-line-subtle) 1px, transparent 1px)', backgroundSize: `${20 * view.k}px ${20 * view.k}px`, backgroundPosition: `${view.x}px ${view.y}px` }}
            onPointerDown={ev => down(ev)} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onDragStart={ev => ev.preventDefault()}
            onDoubleClick={ev => { if (ev.target === ev.currentTarget) addEntity(toWorld(ev.clientX, ev.clientY)) }}>
            {!all.w && <p className="pointer-events-none absolute inset-x-0 top-1/3 mx-auto max-w-sm text-center text-sm text-fg-secondary">{e.empty}</p>}
            <div className="absolute top-0 left-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
              <svg className="pointer-events-none absolute top-0 left-0 overflow-visible" width="1" height="1" aria-hidden>
                {mcd.links.map(l => {
                  const a = boxes.get(l.entity), b = boxes.get(l.association)
                  if (!a || !b) return null
                  const p = legLine(a, b)
                  const on = sel?.id === l.id || sel?.id === l.entity || sel?.id === l.association
                  return <line key={l.id} x1={p.from.x} y1={p.from.y} x2={p.to.x} y2={p.to.y} stroke={on ? 'var(--color-accent)' : 'var(--color-fg-muted)'} strokeWidth={on ? 2 : 1.5} />
                })}
              </svg>
              {mcd.entities.map(x => {
                const b = boxes.get(x.id)!
                const on = sel?.id === x.id || linkFrom === x.id
                return (
                  <div key={x.id} data-entity={x.name} onPointerDown={ev => down(ev, { kind: 'entity', id: x.id })}
                    className={cn('absolute cursor-move overflow-hidden rounded-md border-[1.5px] bg-surface font-mono', on ? 'border-accent shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-accent)_25%,transparent)]' : 'border-[var(--syntax-keyword)]')}
                    style={{ left: b.x, top: b.y, width: b.w, height: b.h }}>
                    <div className={cn('flex items-center justify-center border-b-[1.5px] px-2 text-[13px] font-bold tracking-wide text-fg', on ? 'border-accent' : 'border-[var(--syntax-keyword)]')} style={{ height: HEADER }}>{x.name.toUpperCase() || '—'}</div>
                    <div className="pt-1">
                      {x.attributes.map(a => (
                        <div key={a.id} className={cn('truncate px-3 text-[12px] text-fg', a.identifier && 'underline')} style={{ height: ROW, lineHeight: `${ROW}px` }}>{a.name || '—'}</div>
                      ))}
                    </div>
                  </div>
                )
              })}
              {mcd.associations.map(x => {
                const b = boxes.get(x.id)!
                const on = sel?.id === x.id || linkFrom === x.id
                return (
                  <div key={x.id} data-association={x.name} onPointerDown={ev => down(ev, { kind: 'association', id: x.id })}
                    className={cn('absolute flex cursor-move flex-col items-center justify-center rounded-[50%] border-[1.5px] bg-surface font-mono', on ? 'border-accent' : 'border-[var(--syntax-keyword)]')}
                    style={{ left: b.x, top: b.y, width: b.w, height: b.h }}>
                    <span className="text-[12px] font-bold tracking-wide text-fg">{x.name.toUpperCase() || '—'}</span>
                    {x.attributes.map(a => <span key={a.id} className="text-[11px] leading-4 text-fg-secondary">{a.name}</span>)}
                  </div>
                )
              })}
              {mcd.notes.map(x => {
                const b = boxes.get(x.id)!
                return (
                  <div key={x.id} onPointerDown={ev => down(ev, { kind: 'note', id: x.id })}
                    className={cn('absolute cursor-move rounded-md bg-[color-mix(in_srgb,var(--syntax-attr)_16%,transparent)] px-2.5 py-2 text-[12px] leading-[17px] whitespace-pre-wrap text-fg', sel?.id === x.id && 'ring-2 ring-accent')}
                    style={{ left: b.x, top: b.y, width: b.w, minHeight: b.h }}>{x.text}</div>
                )
              })}
              {/* A leg is picked by its cardinality, which a click changes; drawn last, over the boxes */}
              {mcd.links.map(l => {
                const a = boxes.get(l.entity), b = boxes.get(l.association)
                if (!a || !b) return null
                const p = legLine(a, b)
                return (
                  <button key={l.id} type="button" title={e.cardHint} aria-label={e.cardLabel.replace('{entity}', nameOf(l.entity)).replace('{association}', nameOf(l.association)).replace('{card}', l.card)}
                    onPointerDown={ev => { ev.stopPropagation(); setSel({ kind: 'link', id: l.id }) }}
                    onClick={() => change(x => ({ ...x, links: x.links.map(k => (k.id === l.id ? { ...k, card: nextCard(k.card) } : k)) }))}
                    className={cn('absolute -translate-x-1/2 -translate-y-1/2 rounded px-1 font-mono text-[12px] font-semibold text-[var(--syntax-keyword)] hover:bg-hover', sel?.id === l.id && 'bg-active ring-1 ring-accent')}
                    style={{ left: p.label.x, top: p.label.y }}>{l.card}</button>
                )
              })}
            </div>

            {all.w > 0 && (
              <svg width={MINI.w} height={MINI.h} role="img" aria-label={e.minimap}
                className="absolute right-3 bottom-3 cursor-pointer rounded-lg border border-line bg-surface/90"
                onPointerDown={ev => {
                  ev.stopPropagation()
                  const r = ev.currentTarget.getBoundingClientRect()
                  const wx = world.x + (ev.clientX - r.left - 6) / mini, wy = world.y + (ev.clientY - r.top - 6) / mini
                  touched.current = true
                  setView(v => ({ ...v, x: size.w / 2 - wx * v.k, y: size.h / 2 - wy * v.k }))
                }}>
                {[...boxes].map(([id, b]) => { const p = toMini(b); return <rect key={id} x={p.x} y={p.y} width={Math.max(2, b.w * mini)} height={Math.max(2, b.h * mini)} rx={1.5} fill={sel?.id === id ? 'var(--color-accent)' : 'var(--syntax-keyword)'} opacity={0.55} /> })}
                {(() => { const p = toMini(seen); return <rect x={p.x} y={p.y} width={seen.w * mini} height={seen.h * mini} fill="none" stroke="var(--color-accent)" strokeWidth={1.5} /> })()}
              </svg>
            )}
          </div>

          {/* The part chosen, or the check */}
          <aside aria-label={e.panel} className="flex w-[290px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-line-subtle p-3.5 text-sm">
            {(selEntity || selAssociation) && (() => {
              const node = (selEntity ?? selAssociation)!
              const isEntity = !!selEntity
              const key = isEntity ? 'entities' : 'associations'
              const setNode = (fn: (n: typeof node) => typeof node, merge: string | null = null) =>
                change(x => ({ ...x, [key]: (x[key] as typeof node[]).map(n => (n.id === node.id ? fn(n) : n)) }), merge)
              const setAttr = (aid: string, patch: Partial<McdAttribute>, merge: string | null = null) =>
                setNode(n => ({ ...n, attributes: n.attributes.map(a => (a.id === aid ? { ...a, ...patch } : a)) }), merge)
              return (
                <>
                  <PanelTitle>{isEntity ? e.entity : e.association}</PanelTitle>
                  <label className="flex flex-col gap-1 text-xs text-fg-secondary">{e.name}
                    <input value={node.name} onChange={ev => setNode(n => ({ ...n, name: ev.target.value }), `name:${node.id}`)} spellCheck={false}
                      className="h-8 rounded-md border border-line bg-canvas px-2 font-mono text-sm text-fg outline-none focus:border-accent" />
                  </label>
                  <PanelTitle>{isEntity ? e.attributes : e.carried}</PanelTitle>
                  <ul className="flex flex-col gap-1.5" aria-label={isEntity ? e.attributes : e.carried}>
                    {node.attributes.map(a => (
                      <li key={a.id} className="flex flex-col gap-1 rounded-lg border border-line-subtle bg-canvas p-1.5">
                        <div className="flex items-center gap-1.5">
                          {isEntity && (
                            <input type="checkbox" checked={!!a.identifier} title={e.identifier} aria-label={e.identifierOf.replace('{name}', a.name)}
                              onChange={ev => setAttr(a.id, { identifier: ev.target.checked || undefined })} className="accent-[var(--syntax-keyword)]" />
                          )}
                          <input value={a.name} aria-label={e.attrName} onChange={ev => setAttr(a.id, { name: ev.target.value }, `attr:${a.id}`)} spellCheck={false}
                            className={cn('h-7 min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 font-mono text-[12.5px] text-fg outline-none focus:border-accent', a.identifier && 'underline')} />
                          <IconButton size="sm" tone="danger" title={e.removeAttr} onClick={() => setNode(n => ({ ...n, attributes: n.attributes.filter(x => x.id !== a.id) }))}><X size={12} /></IconButton>
                        </div>
                        <div className="flex items-center gap-1.5 pl-[22px]">
                          <select value={a.type} aria-label={e.attrType.replace('{name}', a.name)} onChange={ev => setAttr(a.id, { type: ev.target.value as McdType | '' })}
                            className="h-7 min-w-0 flex-1 rounded border border-line bg-surface px-1 text-xs text-fg-secondary outline-none focus:border-accent">
                            <option value="">{e.noType}</option>
                            {MCD_TYPES.map(ty => <option key={ty} value={ty}>{e.types[ty]}</option>)}
                          </select>
                          {a.type === 'varchar' && (
                            <input type="number" min={1} max={65535} value={a.length ?? 255} aria-label={e.length} onChange={ev => setAttr(a.id, { length: Number(ev.target.value) || undefined }, `len:${a.id}`)}
                              className="h-7 w-16 rounded border border-line bg-surface px-1 font-mono text-xs text-fg outline-none focus:border-accent" />
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <Button variant="secondary" size="sm" className="self-start"
                    onClick={() => setNode(n => ({ ...n, attributes: [...n.attributes, { id: uid('a'), name: `${e.attrDefault}${n.attributes.length + 1}`, type: 'varchar', length: 255 }] }))}>
                    <Plus size={13} /> {e.addAttr}
                  </Button>
                  {isEntity && <p className="text-xs text-fg-muted">{e.identifierHint}</p>}
                  <Button variant="secondary" size="sm" className="self-start text-danger" onClick={removeSel}><Trash2 size={13} /> {e.remove}</Button>
                </>
              )
            })()}

            {selLink && (
              <>
                <PanelTitle>{e.leg}</PanelTitle>
                <p className="font-mono text-sm text-fg">{nameOf(selLink.entity)} — {nameOf(selLink.association)}</p>
                <div role="radiogroup" aria-label={e.cardinality} className="grid grid-cols-4 gap-1.5">
                  {CARDINALITIES.map(c => (
                    <button key={c} type="button" role="radio" aria-checked={selLink.card === c}
                      onClick={() => change(x => ({ ...x, links: x.links.map(l => (l.id === selLink.id ? { ...l, card: c as Cardinality } : l)) }))}
                      className={cn('h-8 rounded-md border font-mono text-sm', selLink.card === c ? 'border-accent bg-accent-soft text-fg' : 'border-line text-fg-secondary hover:text-fg')}>{c}</button>
                  ))}
                </div>
                <p className="text-xs text-fg-muted">{e.cardMeaning[selLink.card].replace('{entity}', nameOf(selLink.entity)).replace('{association}', nameOf(selLink.association))}</p>
                <Button variant="secondary" size="sm" className="self-start text-danger" onClick={removeSel}><Trash2 size={13} /> {e.remove}</Button>
              </>
            )}

            {selNote && (
              <>
                <PanelTitle>{e.note}</PanelTitle>
                <textarea value={selNote.text} rows={5} aria-label={e.note} onChange={ev => change(x => ({ ...x, notes: x.notes.map(n => (n.id === selNote.id ? { ...n, text: ev.target.value } : n)) }), `note:${selNote.id}`)}
                  className="rounded-md border border-line bg-canvas p-2 text-sm text-fg outline-none focus:border-accent" />
                <Button variant="secondary" size="sm" className="self-start text-danger" onClick={removeSel}><Trash2 size={13} /> {e.remove}</Button>
              </>
            )}

            {!sel && (
              <>
                <PanelTitle>{e.check}</PanelTitle>
                {!issues.length ? <p className="flex items-center gap-2 text-success"><Check size={14} /> {e.allGood}</p> : (
                  <ul className="flex flex-col gap-1.5" aria-label={e.check}>
                    {issues.map((i, k) => (
                      <li key={k}>
                        <button type="button" onClick={() => setSel({ kind: mcd.entities.some(x => x.id === i.target) ? 'entity' : 'association', id: i.target })}
                          className="flex w-full items-start gap-2 rounded-md px-1 py-0.5 text-left hover:bg-hover">
                          {i.level === 'error' ? <AlertTriangle size={13} className="mt-0.5 shrink-0 text-warning" /> : <span className="mt-0.5 w-[13px] shrink-0 text-center text-fg-muted">·</span>}
                          <span className="text-fg-secondary">{e.issues[i.code].replace('{name}', i.name)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-xs leading-snug text-fg-muted">{e.help}</p>
              </>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}

function PaletteButton({ label, icon, onClick, pressed }: { label: string; icon: ReactNode; onClick: () => void; pressed?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={pressed}
      className={cn('flex h-9 items-center gap-2.5 rounded-lg border px-2.5 text-[12.5px] font-medium transition-colors',
        pressed ? 'border-accent bg-accent-soft text-fg' : 'border-line bg-elevated text-fg-secondary hover:border-fg-disabled hover:text-fg')}>
      {icon}{label}
    </button>
  )
}

const PanelTitle = ({ children }: { children: ReactNode }) => <p className="font-mono text-2xs font-medium tracking-widest text-fg-muted uppercase">{children}</p>
