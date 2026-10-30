import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeftRight, ArrowLeft, Box as BoxIcon, Circle, Cloud, Component, Database, Diamond, Hexagon, List, ListChecks, ListOrdered, Maximize2, Minus, Monitor,
  MoveRight, Play, Plus, RectangleHorizontal, Redo2, Server, Square, SquareDashed, StickyNote, Trash2, Undo2, User, X
} from 'lucide-react'
import type { DiagramEdgeType, DiagramKind, DiagramModel, DiagramNode, DiagramNodeType, ModelFile, NoteTask } from '@shared/types'
import { noteBox, uid, type Box, type Point } from '@shared/lib/mcd'
import { caseLinks, diagramBounds, diagramShapes, diagramSvg, EDGE_TYPES, edgeLine, nextMessageY, NODE_TYPES, nodeBox } from '@shared/lib/uml'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { errorText } from '@renderer/lib/errors'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import IconButton from '@renderer/components/ui/IconButton'
import Spinner from '@renderer/components/ui/Spinner'
import { diagramColors, LIVE_DIAGRAM, saveDrawing } from './colors'
import { fill, KIND_TONE } from './model'

type Sel = { kind: 'node' | 'edge' | 'note'; id: string } | null
const SAVE_DELAY = 500

const ICONS: Record<DiagramNodeType, ReactNode> = {
  actor: <User size={15} />, case: <Circle size={15} />, system: <SquareDashed size={15} />, class: <BoxIcon size={15} />, interface: <Component size={15} />, enum: <List size={15} />,
  participant: <RectangleHorizontal size={15} />, start: <Play size={15} />, end: <Square size={15} />, step: <RectangleHorizontal size={15} />, decision: <Diamond size={15} />,
  io: <ArrowLeftRight size={15} />, service: <Server size={15} />, database: <Database size={15} />, queue: <ListOrdered size={15} />, client: <Monitor size={15} />,
  gateway: <Hexagon size={15} />, external: <Cloud size={15} />
}

const isTyping = (t: EventTarget | null) => t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement
const inside = (b: Box, s: Box) => b.x >= s.x && b.y >= s.y && b.x + b.w <= s.x + s.w && b.y + b.h <= s.y + s.h

/**
 * v3.9 lot 5: the diagrams — use cases, classes, sequence, flowchart,
 * architecture. The MCD's canvas with a palette per kind; drawn by the same
 * function as the thumbnails and the export, saved in conception/ as it changes.
 */
export default function DiagramEditor({ projectPath, file, kind }: { projectPath: string; file: string; kind: DiagramKind }) {
  const { t } = useI18n()
  const m = t.modeling
  const e = m.editor
  const g = m.diagram
  const toast = useToast()
  const navigate = useNavigate()
  const [model, setModel] = useState<ModelFile | null>(null)
  const [dg, setDg] = useState<DiagramModel | null>(null)
  const [error, setError] = useState('')
  const [sel, setSel] = useState<Sel>(null)
  const [tool, setTool] = useState<DiagramEdgeType | null>(null)
  const [linkFrom, setLinkFrom] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'failed'>('saved')
  const [view, setView] = useState({ x: 60, y: 60, k: 1 })
  const [size, setSize] = useState({ w: 800, h: 600 })
  const viewport = useRef<HTMLDivElement>(null)
  const history = useRef<{ past: DiagramModel[]; future: DiagramModel[]; mergeKey: string | null; at: number }>({ past: [], future: [], mergeKey: null, at: 0 })
  const [, setHistoryTick] = useState(0)
  const drag = useRef<{ kind: 'pan' | 'move' | 'message' | 'resize'; id?: string; carried?: string[]; sx: number; sy: number; ox: number; oy: number; moved: boolean; before?: DiagramModel; start?: DiagramModel } | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<DiagramModel | null>(null)
  const touched = useRef(false)

  // ── Load and save (as the MCD editor) ──────────────────────────────────────
  useEffect(() => {
    window.devforge.modeling.read(projectPath, file)
      .then(f => { setModel(f); setDg(f.diagram ?? { nodes: [], edges: [], notes: [] }) })
      .catch(err => setError(errorText(err)))
  }, [projectPath, file])

  const flush = useCallback(async () => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
    const next = pending.current
    if (!next || !model) return
    pending.current = null
    setSaveState('saving')
    try { await window.devforge.modeling.save(projectPath, file, { ...model, diagram: next }); setSaveState('saved') }
    catch (err) { setSaveState('failed'); toast.show({ tone: 'error', title: e.saveFailed, description: errorText(err) }) }
  }, [model, projectPath, file, toast, e.saveFailed])
  const flushRef = useRef(flush)
  flushRef.current = flush
  useEffect(() => () => { void flushRef.current() }, [])

  const schedule = (next: DiagramModel) => {
    pending.current = next
    setSaveState('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { void flushRef.current() }, SAVE_DELAY)
  }
  const change = (fn: (x: DiagramModel) => DiagramModel, mergeKey: string | null = null, before?: DiagramModel) => {
    setDg(cur => {
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
    if (!h.past.length || !dg) return
    h.future = [dg, ...h.future]
    const prev = h.past[h.past.length - 1]
    h.past = h.past.slice(0, -1)
    h.mergeKey = null
    setDg(prev); schedule(prev); setHistoryTick(x => x + 1)
  }
  const redo = () => {
    const h = history.current
    if (!h.future.length || !dg) return
    h.past = [...h.past, dg]
    const next = h.future[0]
    h.future = h.future.slice(1)
    h.mergeKey = null
    setDg(next); schedule(next); setHistoryTick(x => x + 1)
  }
  const editNode = (id: string, patch: Partial<DiagramNode>, key: string | null = null) => change(x => ({ ...x, nodes: x.nodes.map(n => (n.id === id ? { ...n, ...patch } : n)) }), key)

  // ── Geometry ───────────────────────────────────────────────────────────────
  const shapes = useMemo(() => (dg ? diagramShapes(kind, dg, LIVE_DIAGRAM) : ''), [dg, kind])
  const all = useMemo(() => (dg ? diagramBounds(kind, dg) : { x: 0, y: 0, w: 0, h: 0 }), [dg, kind])

  useLayoutEffect(() => {
    const el = viewport.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [dg !== null]) // eslint-disable-line react-hooks/exhaustive-deps

  const fit = () => {
    if (!all.w) { setView({ x: 60, y: 60, k: 1 }); return }
    const k = Math.min(1, (size.w - 80) / all.w, (size.h - 80) / all.h)
    setView({ k, x: (size.w - all.w * k) / 2 - all.x * k, y: (size.h - all.h * k) / 2 - all.y * k })
  }
  useEffect(() => { if (!touched.current && dg && size.w > 100) fit() }, [dg !== null, size.w, size.h]) // eslint-disable-line react-hooks/exhaustive-deps

  const zoom = (factor: number, cx = size.w / 2, cy = size.h / 2) => { touched.current = true; setView(v => {
    const k = Math.min(2, Math.max(0.2, v.k * factor))
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
  }, [dg !== null]) // eslint-disable-line react-hooks/exhaustive-deps

  /** A free spot near the middle of the screen; a sequence's participants go in a row */
  const spot = (type: DiagramNodeType): Point => {
    if (!dg) return { x: 0, y: 0 }
    if (kind === 'sequence') {
      const right = Math.max(-40, ...dg.nodes.map(n => { const b = nodeBox(n); return b.x + b.w }))
      return { x: right + 50, y: dg.nodes[0]?.y ?? 0 }
    }
    const probe = nodeBox({ id: '', type, name: g.defaults[type], x: 0, y: 0 })
    const c = { x: Math.round((size.w / 2 - view.x) / view.k - probe.w / 2), y: Math.round((size.h / 2 - view.y) / view.k - probe.h / 2) }
    const boxes = [...dg.nodes.filter(n => n.type !== 'system').map(nodeBox), ...dg.notes.map(noteBox)]
    const free = (p: Point) => !boxes.some(b => p.x < b.x + b.w + 40 && p.x + probe.w + 40 > b.x && p.y < b.y + b.h + 40 && p.y + probe.h + 40 > b.y)
    for (let ring = 0; ring < 12; ring++) {
      for (let i = 0; i < Math.max(1, ring * 8); i++) {
        const a = (i / Math.max(1, ring * 8)) * 2 * Math.PI
        const p = { x: Math.round(c.x + Math.cos(a) * ring * 120), y: Math.round(c.y + Math.sin(a) * ring * 90) }
        if (free(p)) return p
      }
    }
    return c
  }

  const addNode = (type: DiagramNodeType) => {
    const id = uid('n')
    const p = spot(type)
    const node: DiagramNode = {
      id, type, name: g.defaults[type], x: p.x, y: p.y,
      ...(type === 'system' ? { w: 420, h: 340, x: p.x - 140, y: p.y - 120 } : {}),
      ...(type === 'class' || type === 'interface' ? { attributes: [], methods: [] } : {}),
      ...(type === 'enum' ? { attributes: [] } : {})
    }
    // A system goes behind what is already there
    change(x => ({ ...x, nodes: type === 'system' ? [node, ...x.nodes] : [...x.nodes, node] }))
    setSel({ kind: 'node', id }); setTool(null)
  }
  const addNote = () => {
    const id = uid('t')
    const p = spot('step')
    change(x => ({ ...x, notes: [...x.notes, { id, x: p.x, y: p.y, text: e.noteText }] }))
    setSel({ kind: 'note', id }); setTool(null)
  }
  const pickForLink = (id: string) => {
    if (!tool || !dg) return
    if (!linkFrom) { setLinkFrom(id); return }
    const eid = uid('l')
    const type = tool
    change(x => ({ ...x, edges: [...x.edges, { id: eid, type, from: linkFrom, to: id, ...(kind === 'sequence' ? { y: nextMessageY(x) } : {}) }] }))
    setLinkFrom(null); setTool(null); setSel({ kind: 'edge', id: eid })
  }
  const removeSel = () => {
    if (!sel) return
    const id = sel.id
    change(x => ({
      nodes: x.nodes.filter(n => n.id !== id),
      edges: x.edges.filter(l => l.id !== id && l.from !== id && l.to !== id),
      notes: x.notes.filter(n => n.id !== id)
    }))
    setSel(null)
  }

  const keys = useRef<(ev: KeyboardEvent) => void>(() => {})
  keys.current = ev => {
    if (isTyping(ev.target)) return
    const mod = ev.ctrlKey || ev.metaKey
    if (mod && ev.key.toLowerCase() === 'z') { ev.preventDefault(); if (ev.shiftKey) redo(); else undo() }
    else if (mod && ev.key.toLowerCase() === 'y') { ev.preventDefault(); redo() }
    else if ((ev.key === 'Delete' || ev.key === 'Backspace') && sel) { ev.preventDefault(); removeSel() }
    else if (ev.key === 'Escape') { setTool(null); setLinkFrom(null) }
  }
  useEffect(() => {
    const on = (ev: KeyboardEvent) => keys.current(ev)
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [])

  // ── Pointer: pan, move a part (a system carries what is inside it), a message's height, a system's size ──
  const down = (ev: ReactPointerEvent, target?: Sel, mode: 'move' | 'message' | 'resize' = 'move') => {
    if (ev.button !== 0 || !dg) return
    ev.preventDefault()
    ev.stopPropagation()
    if (target?.kind === 'node' && tool) { pickForLink(target.id); return }
    ;(ev.currentTarget as Element).setPointerCapture(ev.pointerId)
    setSel(target ?? null)
    const node = target?.kind === 'node' ? dg.nodes.find(n => n.id === target.id) : undefined
    const note = target?.kind === 'note' ? dg.notes.find(n => n.id === target.id) : undefined
    const edge = target?.kind === 'edge' ? dg.edges.find(l => l.id === target.id) : undefined
    let carried: string[] | undefined
    if (node?.type === 'system' && mode === 'move') {
      const s = nodeBox(node)
      carried = [...dg.nodes.filter(n => n.id !== node.id && inside(nodeBox(n), s)).map(n => n.id), ...dg.notes.filter(n => inside(noteBox(n), s)).map(n => n.id)]
    }
    const origin = mode === 'resize' && node ? { x: node.w ?? 420, y: node.h ?? 340 } : mode === 'message' && edge ? { x: 0, y: edge.y ?? 0 } : node ?? note ?? view
    drag.current = { kind: target ? mode : 'pan', id: target?.id, carried, sx: ev.clientX, sy: ev.clientY, ox: origin.x, oy: origin.y, moved: false, before: dg, start: dg }
  }
  const move = (ev: ReactPointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = ev.clientX - d.sx, dy = ev.clientY - d.sy
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true
    if (d.kind === 'pan') { if (d.moved) touched.current = true; setView(v => ({ ...v, x: d.ox + dx, y: d.oy + dy })); return }
    if (!d.moved || !d.start) return
    const kx = dx / view.k, ky = dy / view.k
    const start = d.start
    if (d.kind === 'message') { setDg(cur => cur && ({ ...cur, edges: cur.edges.map(l => (l.id === d.id ? { ...l, y: Math.round(d.oy + ky) } : l)) })); return }
    if (d.kind === 'resize') { setDg(cur => cur && ({ ...cur, nodes: cur.nodes.map(n => (n.id === d.id ? { ...n, w: Math.max(160, Math.round(d.ox + kx)), h: Math.max(120, Math.round(d.oy + ky)) } : n)) })); return }
    const moved = new Set([d.id, ...(d.carried ?? [])])
    const shift = <T extends { id: string; x: number; y: number }>(list: T[], from: T[]) => list.map(n => {
      if (!moved.has(n.id)) return n
      const o = from.find(x => x.id === n.id)!
      // A sequence's participants stay in their row
      return { ...n, x: Math.round(o.x + kx), y: kind === 'sequence' && 'type' in n ? o.y : Math.round(o.y + ky) }
    })
    setDg(cur => cur && ({ ...cur, nodes: shift(cur.nodes, start.nodes), notes: shift(cur.notes, start.notes) }))
  }
  const up = () => {
    const d = drag.current
    drag.current = null
    if (d && d.kind !== 'pan' && d.moved) change(x => x, null, d.before)
  }

  async function exportAs(ext: 'png' | 'svg') {
    if (!dg) return
    try {
      const path = await saveDrawing(diagramSvg(kind, dg, diagramColors()), file.replace(/\.json$/, ''), ext)
      if (path) toast.show({ tone: 'success', title: e.exported, description: path })
    } catch (err) { toast.show({ tone: 'error', title: e.exportFailed, description: errorText(err) }) }
  }

  /** One task per use case in the project's Notes, those already there left alone */
  async function makeTasks() {
    if (!dg) return
    try {
      const project = (await window.devforge.getProjects()).find(p => p.path === projectPath)
      if (!project) { toast.show({ tone: 'error', title: g.tasksFailed, description: g.noProject }); return }
      const notes = await window.devforge.notes.get(project.id)
      const have = new Set(notes.tasks.map(x => x.text))
      const now = new Date().toISOString()
      const fresh: NoteTask[] = dg.nodes.filter(n => n.type === 'case').map(n => {
        const actors = caseLinks(dg, n.id).actors
        return fill(g.taskText, { name: n.name, actors: actors.length ? ` (${actors.join(', ')})` : '' })
      }).filter(text => !have.has(text)).map(text => ({ id: uid('k'), text, done: false, createdAt: now }))
      if (!fresh.length) { toast.show({ tone: 'info', title: g.tasksNone }); return }
      await window.devforge.notes.save(project.id, { ...notes, tasks: [...notes.tasks, ...fresh] })
      toast.show({ tone: 'success', title: fill(g.tasksDone, { n: fresh.length }) })
    } catch (err) { toast.show({ tone: 'error', title: g.tasksFailed, description: errorText(err) }) }
  }

  if (error) return <div className="p-8"><p className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{m.loadFailed} : {error}</p></div>
  if (!model || !dg) return <Spinner className="m-8" />

  const h = history.current
  const nameOf = (id: string) => dg.nodes.find(n => n.id === id)?.name ?? ''
  const selNode = sel?.kind === 'node' ? dg.nodes.find(n => n.id === sel.id) : undefined
  const selEdge = sel?.kind === 'edge' ? dg.edges.find(l => l.id === sel.id) : undefined
  const selNote = sel?.kind === 'note' ? dg.notes.find(n => n.id === sel.id) : undefined
  const cases = dg.nodes.filter(n => n.type === 'case').length
  const ring = 'shadow-[0_0_0_2px_var(--color-accent)]'

  return (
    <div className="flex h-full min-h-0 flex-col p-4">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[14px] border border-line bg-surface">
        <header className="flex h-[52px] shrink-0 items-center gap-2 border-b border-line-subtle px-3">
          <Button variant="secondary" size="sm" onClick={() => { void flush(); navigate('/modeling') }}><ArrowLeft size={13} /> {m.title}</Button>
          <h1 className="min-w-0 truncate text-md font-semibold text-fg">{model.name}</h1>
          <span className={cn('shrink-0 rounded-[5px] px-1.5 py-0.5 font-mono text-[11px] font-semibold', KIND_TONE[kind])}>{m.kindName[kind]}</span>
          <span className="flex-1" />
          <span role="status" className={cn('hidden max-w-[260px] truncate text-xs xl:block', saveState === 'failed' ? 'text-danger' : 'text-fg-muted')}>
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
          <Button variant="secondary" size="sm" onClick={() => exportAs('png')} disabled={!all.w}>PNG</Button>
          <Button variant="secondary" size="sm" onClick={() => exportAs('svg')} disabled={!all.w}>SVG</Button>
          {kind === 'usecase' && <Button size="sm" onClick={makeTasks} disabled={!cases} title={cases ? g.tasksHint : g.tasksEmpty}><ListChecks size={13} /> {g.tasks}</Button>}
        </header>

        <div className="flex min-h-0 flex-1">
          <aside aria-label={e.palette} className="flex w-[180px] shrink-0 flex-col gap-2 overflow-y-auto border-r border-line-subtle p-3">
            <p className="font-mono text-2xs font-medium tracking-widest text-fg-muted uppercase">{e.palette}</p>
            {NODE_TYPES[kind].map(type => <PaletteButton key={type} onClick={() => addNode(type)} label={g.nodes[type]} icon={ICONS[type]} />)}
            <PaletteButton onClick={addNote} label={e.addNote} icon={<StickyNote size={15} className="text-[var(--syntax-attr)]" />} />
            <p className="mt-2 font-mono text-2xs font-medium tracking-widest text-fg-muted uppercase">{g.edgesTitle}</p>
            {EDGE_TYPES[kind].map(type => (
              <PaletteButton key={type} pressed={tool === type} onClick={() => { setTool(v => (v === type ? null : type)); setLinkFrom(null) }}
                label={type === 'include' || type === 'extend' ? `«${g.edges[type]}»` : g.edges[type]} icon={<MoveRight size={15} />} />
            ))}
            {tool && <p role="status" className="rounded-lg bg-accent-soft p-2 text-xs text-fg">{linkFrom ? fill(g.linkSecond, { type: g.edges[tool], name: nameOf(linkFrom) }) : fill(g.linkFirst, { type: g.edges[tool] })}</p>}
            <p className="mt-auto pt-2 text-xs leading-snug text-fg-muted">{g.paletteHint}</p>
          </aside>

          <div ref={viewport} data-testid="diagram-canvas"
            className={cn('relative min-w-0 flex-1 touch-none overflow-hidden bg-canvas select-none', tool ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing')}
            style={{ backgroundImage: 'radial-gradient(var(--color-line-subtle) 1px, transparent 1px)', backgroundSize: `${20 * view.k}px ${20 * view.k}px`, backgroundPosition: `${view.x}px ${view.y}px` }}
            onPointerDown={ev => down(ev)} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onDragStart={ev => ev.preventDefault()}>
            {!all.w && <p className="pointer-events-none absolute inset-x-0 top-1/3 mx-auto max-w-sm text-center text-sm text-fg-secondary">{g.empty[kind]}</p>}
            <div className="absolute top-0 left-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
              <svg className="pointer-events-none absolute top-0 left-0 overflow-visible font-sans" width="1" height="1" aria-hidden dangerouslySetInnerHTML={{ __html: shapes }} />
              {/* What the pointer takes: each part's box (a system's title bar and its corner), each link's dot */}
              {dg.nodes.map(n => {
                const b = nodeBox(n)
                const on = sel?.id === n.id || linkFrom === n.id
                if (n.type === 'system') return (
                  <div key={n.id}>
                    <div data-node={n.name} onPointerDown={ev => down(ev, { kind: 'node', id: n.id })}
                      className={cn('absolute cursor-move rounded-t-[10px]', on && ring)} style={{ left: b.x, top: b.y, width: b.w, height: 34 }} />
                    {on && <div title={`${g.width} × ${g.height}`} onPointerDown={ev => down(ev, { kind: 'node', id: n.id }, 'resize')}
                      className="absolute h-3.5 w-3.5 cursor-nwse-resize rounded-sm border-2 border-accent bg-surface" style={{ left: b.x + b.w - 7, top: b.y + b.h - 7 }} />}
                  </div>
                )
                return (
                  <div key={n.id} data-node={n.name} onPointerDown={ev => down(ev, { kind: 'node', id: n.id })}
                    className={cn('absolute cursor-move rounded-md', on && ring, n.type === 'case' && 'rounded-[50%]')} style={{ left: b.x, top: b.y, width: b.w, height: b.h }} />
                )
              })}
              {dg.notes.map(n => {
                const b = noteBox(n)
                return <div key={n.id} onPointerDown={ev => down(ev, { kind: 'note', id: n.id })} className={cn('absolute cursor-move rounded-md', sel?.id === n.id && ring)} style={{ left: b.x, top: b.y, width: b.w, height: b.h }} />
              })}
              {dg.edges.map(l => {
                const line = edgeLine(kind, dg, l)
                if (!line) return null
                const on = sel?.id === l.id
                return (
                  <button key={l.id} type="button" aria-label={`${g.edges[l.type]} : ${nameOf(l.from)} → ${nameOf(l.to)}`} data-edge={`${nameOf(l.from)}>${nameOf(l.to)}`}
                    onPointerDown={ev => down(ev, { kind: 'edge', id: l.id }, kind === 'sequence' ? 'message' : 'move')}
                    className={cn('absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface',
                      on ? 'bg-accent' : 'bg-fg-muted opacity-60 hover:opacity-100', kind === 'sequence' && 'cursor-ns-resize')}
                    style={{ left: line.handle.x, top: line.handle.y }} />
                )
              })}
            </div>
          </div>

          <aside aria-label={g.panel} className="flex w-[280px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-line-subtle p-4">
            {selNode ? (
              <NodePanel node={selNode} kind={kind} dg={dg} onEdit={(patch, key) => editNode(selNode.id, patch, key)} onRemove={removeSel} />
            ) : selEdge ? <>
              <PanelTitle>{g.edges[selEdge.type]}</PanelTitle>
              <p className="text-sm text-fg-secondary">{fill(g.from, { name: nameOf(selEdge.from), to: nameOf(selEdge.to) })}</p>
              <label className="flex flex-col gap-1 text-sm text-fg-secondary">
                {g.edgeType}
                <select value={selEdge.type} onChange={ev => change(x => ({ ...x, edges: x.edges.map(l => (l.id === selEdge.id ? { ...l, type: ev.target.value as DiagramEdgeType } : l)) }))}
                  className="h-8 rounded-md border border-line bg-canvas px-2 text-sm text-fg outline-none focus:border-accent">
                  {EDGE_TYPES[kind].map(type => <option key={type} value={type}>{g.edges[type]}</option>)}
                </select>
              </label>
              {selEdge.type !== 'include' && selEdge.type !== 'extend' && (
                <label className="flex flex-col gap-1 text-sm text-fg-secondary">
                  {g.label}
                  <input value={selEdge.label ?? ''} onChange={ev => change(x => ({ ...x, edges: x.edges.map(l => (l.id === selEdge.id ? { ...l, label: ev.target.value.slice(0, 120) || undefined } : l)) }), `l-${selEdge.id}`)}
                    className="h-8 rounded-md border border-line bg-canvas px-2 text-sm text-fg outline-none focus:border-accent" />
                </label>
              )}
              {kind === 'sequence' && <p className="text-xs text-fg-muted">{g.messageHint}</p>}
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => change(x => ({ ...x, edges: x.edges.map(l => (l.id === selEdge.id ? { ...l, from: l.to, to: l.from } : l)) }))}><ArrowLeftRight size={13} /> {g.swap}</Button>
                <Button size="sm" variant="danger" onClick={removeSel}><Trash2 size={13} /> {g.remove}</Button>
              </div>
            </> : selNote ? <>
              <PanelTitle>{e.note}</PanelTitle>
              <textarea aria-label={e.note} value={selNote.text} rows={6} onChange={ev => change(x => ({ ...x, notes: x.notes.map(n => (n.id === selNote.id ? { ...n, text: ev.target.value.slice(0, 2000) } : n)) }), `t-${selNote.id}`)}
                className="rounded-md border border-line bg-canvas p-2 text-sm text-fg outline-none focus:border-accent" />
              <Button size="sm" variant="danger" onClick={removeSel} className="self-start"><Trash2 size={13} /> {g.remove}</Button>
            </> : (
              <p className="text-sm text-fg-muted">{g.nothing}</p>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}

/** The part chosen: its name, and what its kind has (a class's members, a use case's scenario, a system's size) */
function NodePanel({ node, kind, dg, onEdit, onRemove }: { node: DiagramNode; kind: DiagramKind; dg: DiagramModel; onEdit: (patch: Partial<DiagramNode>, key?: string | null) => void; onRemove: () => void }) {
  const { t } = useI18n()
  const g = t.modeling.diagram
  const input = 'rounded-md border border-line bg-canvas px-2 text-sm text-fg outline-none focus:border-accent'
  const lines = (v: string) => v.split('\n').slice(0, 200).map(x => x.slice(0, 200))
  const links = node.type === 'case' ? caseLinks(dg, node.id) : null
  const steps = node.steps ?? []
  return <>
    <PanelTitle>{g.nodes[node.type]}</PanelTitle>
    <label className="flex flex-col gap-1 text-sm text-fg-secondary">
      {g.name}
      <input value={node.name} onChange={ev => onEdit({ name: ev.target.value.slice(0, 120) }, `n-${node.id}`)} className={cn(input, 'h-8')} />
    </label>
    {links && (
      <p className="text-sm text-fg-secondary">
        {[links.actors.length ? fill(g.caseActors, { names: links.actors.join(', ') }) : g.noActor,
          links.includes.length ? fill(g.caseIncludes, { names: links.includes.join(', ') }) : '',
          links.extendedBy.length ? fill(g.caseExtended, { names: links.extendedBy.join(', ') }) : ''].filter(Boolean).join(' · ')}
      </p>
    )}
    {(node.type === 'class' || node.type === 'interface' || node.type === 'enum') && (
      <label className="flex flex-col gap-1 text-sm text-fg-secondary">
        {node.type === 'enum' ? g.values : g.attributes}
        <textarea rows={5} value={(node.attributes ?? []).join('\n')} onChange={ev => onEdit({ attributes: lines(ev.target.value) }, `a-${node.id}`)}
          placeholder={node.type === 'enum' ? 'PANIER\nPAYEE' : '- id : int\n- email : string'} className={cn(input, 'py-1.5 font-mono text-xs')} />
      </label>
    )}
    {(node.type === 'class' || node.type === 'interface') && (
      <label className="flex flex-col gap-1 text-sm text-fg-secondary">
        {g.methods}
        <textarea rows={4} value={(node.methods ?? []).join('\n')} onChange={ev => onEdit({ methods: lines(ev.target.value) }, `m-${node.id}`)}
          placeholder="+ total() : float" className={cn(input, 'py-1.5 font-mono text-xs')} />
      </label>
    )}
    {node.type === 'system' && (
      <div className="flex gap-2">
        {(['w', 'h'] as const).map(k => (
          <label key={k} className="flex flex-1 flex-col gap-1 text-sm text-fg-secondary">
            {k === 'w' ? g.width : g.height}
            <input type="number" min={k === 'w' ? 160 : 120} value={node[k] ?? (k === 'w' ? 420 : 340)} onChange={ev => onEdit({ [k]: Math.max(k === 'w' ? 160 : 120, Number(ev.target.value) || 0) }, `${k}-${node.id}`)} className={cn(input, 'h-8')} />
          </label>
        ))}
      </div>
    )}
    {node.type === 'case' && kind === 'usecase' && (
      <section aria-label={g.scenario} className="flex flex-col gap-1.5">
        <PanelTitle>{g.scenario}</PanelTitle>
        <ol className="flex flex-col gap-1">
          {steps.map((s, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-[11px] font-semibold text-accent">{i + 1}</span>
              <input aria-label={fill(g.stepLabel, { n: i + 1 })} value={s} onChange={ev => onEdit({ steps: steps.map((x, j) => (j === i ? ev.target.value.slice(0, 200) : x)) }, `s-${node.id}-${i}`)} className={cn(input, 'h-7 min-w-0 flex-1 text-xs')} />
              <IconButton size="sm" title={fill(g.removeStep, { n: i + 1 })} onClick={() => onEdit({ steps: steps.filter((_, j) => j !== i) })}><X size={12} /></IconButton>
            </li>
          ))}
        </ol>
        <Button size="sm" variant="ghost" className="self-start" onClick={() => onEdit({ steps: [...steps, ''] })}><Plus size={13} /> {g.addStep}</Button>
      </section>
    )}
    <Button size="sm" variant="danger" onClick={onRemove} className="mt-1 self-start"><Trash2 size={13} /> {g.remove}</Button>
  </>
}

function PaletteButton({ label, icon, onClick, pressed }: { label: string; icon: ReactNode; onClick: () => void; pressed?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={pressed}
      className={cn('flex h-9 shrink-0 items-center gap-2.5 rounded-lg border px-2.5 text-[12.5px] font-medium transition-colors',
        pressed ? 'border-accent bg-accent-soft text-fg' : 'border-line bg-elevated text-fg-secondary hover:border-fg-disabled hover:text-fg')}>
      <span className="text-fg-secondary">{icon}</span>{label}
    </button>
  )
}

const PanelTitle = ({ children }: { children: ReactNode }) => <p className="font-mono text-2xs font-medium tracking-widest text-fg-muted uppercase">{children}</p>
