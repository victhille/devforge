import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import {
  ArrowLeftRight, Box as BoxIcon, Circle, Cloud, Component, Database, Diamond, Hexagon, List, ListChecks, ListOrdered, Maximize2, Monitor,
  MoveRight, Play, Plus, RectangleHorizontal, Server, Square, SquareDashed, StickyNote, Trash2, User, X
} from 'lucide-react'
import type { DiagramEdgeType, DiagramKind, DiagramModel, DiagramNode, DiagramNodeType, NoteTask } from '@shared/types'
import { noteBox, uid, type Box, type Point } from '@shared/lib/mcd'
import { caseLinks, diagramBounds, diagramShapes, diagramSvg, EDGE_TYPES, edgeLine, lifelineEnd, NODE_TYPES, nodeBox } from '@shared/lib/uml'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { errorText } from '@renderer/lib/errors'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import IconButton from '@renderer/components/ui/IconButton'
import Spinner from '@renderer/components/ui/Spinner'
import { diagramColors, LIVE_DIAGRAM, saveDrawing } from './colors'
import { fill, KIND_TONE } from './model'
import { dropZone, Handles, partAt, TARGET_RING, Wire } from './connect'
import ModelCrumbs from './ModelCrumbs'
import { BarItem, BarSeparator, CanvasBar, gridStyle, SaveStatus, SelectionPanel, toolCursor, UndoRedo, useCanvasTool, ZoneRect, ZoomButtons } from './canvasTools'
import { arranging, shifted, useCanvasPick, useCanvasView, useClipboard, useEditorKeys, useModelDoc } from './useEditor'
import { useProjectList } from '@renderer/hooks/useLiveData'
import { placed } from '@shared/lib/arrange'
import { copyDiagram, pasteDiagram } from '@shared/lib/clip'
import ErrorState from '@renderer/components/ui/ErrorState'

type Sel = { kind: 'node' | 'edge' | 'note'; id: string } | null
/** A line pulled from a part's point: where it starts, where the pointer is, the part it would link */
type Pull = { from: string; a: Point; b: Point; target: string | null }
const NOTE = 'note'

/** A line let go on empty space makes this part there, linked (none: nothing is made) */
const FOLLOW: Partial<Record<DiagramNodeType, DiagramNodeType>> = {
  actor: 'case', case: 'case', class: 'class', interface: 'class', enum: 'class',
  start: 'step', step: 'step', decision: 'step', io: 'step',
  client: 'gateway', gateway: 'service', service: 'service', database: 'service', queue: 'service', external: 'service'
}

const ICONS: Record<DiagramNodeType, ReactNode> = {
  actor: <User size={15} />, case: <Circle size={15} />, system: <SquareDashed size={15} />, class: <BoxIcon size={15} />, interface: <Component size={15} />, enum: <List size={15} />,
  participant: <RectangleHorizontal size={15} />, start: <Play size={15} />, end: <Square size={15} />, step: <RectangleHorizontal size={15} />, decision: <Diamond size={15} />,
  io: <ArrowLeftRight size={15} />, service: <Server size={15} />, database: <Database size={15} />, queue: <ListOrdered size={15} />, client: <Monitor size={15} />,
  gateway: <Hexagon size={15} />, external: <Cloud size={15} />
}

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
  const { model, doc: dg, setDoc: setDg, error, saveState, flush, change, undo, redo, canUndo, canRedo } = useModelDoc<DiagramModel>(projectPath, file,
    f => f.diagram ?? { nodes: [], edges: [], notes: [] }, (f, next) => ({ ...f, diagram: next }))
  const [sel, setSel] = useState<Sel>(null)
  const { tool, setTool } = useCanvasTool()
  const [edgeType, setEdgeType] = useState<DiagramEdgeType>(EDGE_TYPES[kind][0])
  const [pull, setPull] = useState<Pull | null>(null)
  /** A part moved (with what it carries), a message's height, a system's size, or a line pulled from a part's point */
  const drag = useRef<{ kind: 'move' | 'message' | 'resize' | 'pull'; id?: string; solo?: string; carried?: string[]; sx: number; sy: number; ox: number; oy: number; moved: boolean; before?: DiagramModel; start?: DiagramModel } | null>(null)

  const editNode = (id: string, patch: Partial<DiagramNode>, key: string | null = null) => change(x => ({ ...x, nodes: x.nodes.map(n => (n.id === id ? { ...n, ...patch } : n)) }), key)

  // ── Geometry ───────────────────────────────────────────────────────────────
  const shapes = useMemo(() => (dg ? diagramShapes(kind, dg, LIVE_DIAGRAM) : ''), [dg, kind])
  const all = useMemo(() => (dg ? diagramBounds(kind, dg) : { x: 0, y: 0, w: 0, h: 0 }), [dg, kind])
  /** What a zone can pick: every part (the systems too) and the notes */
  const parts = useMemo(() => new Map<string, Box>(dg ? [...dg.nodes.map(n => [n.id, nodeBox(n)] as const), ...dg.notes.map(n => [n.id, noteBox(n)] as const)] : []), [dg])
  const canvas = useCanvasView({ open: dg !== null, all })
  const { viewport, view, size, fit, zoom, toWorld } = canvas
  /** v4.1: the parts picked together (a zone, Shift+click), moved and removed as one */
  const picker = useCanvasPick(canvas, { tool, parts, onPick: ids => setSel(ids.length === 1 ? { kind: dg?.notes.some(n => n.id === ids[0]) ? 'note' : 'node', id: ids[0] } : null) })
  const { multi, setMulti, zone, pick } = picker

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

  /** A new part; `at`: its middle there (a sequence's participants stay in their row) */
  const makeNode = (type: DiagramNodeType, at?: Point): DiagramNode => {
    const base: DiagramNode = {
      id: uid('n'), type, name: g.defaults[type], x: 0, y: 0,
      ...(type === 'system' ? { w: 420, h: 340 } : {}),
      ...(type === 'class' || type === 'interface' ? { attributes: [], methods: [] } : {}),
      ...(type === 'enum' ? { attributes: [] } : {})
    }
    if (!at) {
      const p = spot(type)
      return { ...base, x: type === 'system' ? p.x - 140 : p.x, y: type === 'system' ? p.y - 120 : p.y }
    }
    const b = nodeBox(base)
    return { ...base, x: Math.round(at.x - b.w / 2), y: kind === 'sequence' ? (dg?.nodes[0]?.y ?? 0) : Math.round(at.y - b.h / 2) }
  }
  const addNode = (type: DiagramNodeType, at?: Point) => {
    const node = makeNode(type, at)
    // A system goes behind what is already there
    change(x => ({ ...x, nodes: type === 'system' ? [node, ...x.nodes] : [...x.nodes, node] }))
    setSel({ kind: 'node', id: node.id })
  }
  const addNote = (at?: Point) => {
    const id = uid('t')
    const p = at ? { x: at.x - 90, y: at.y - 30 } : spot('step')
    change(x => ({ ...x, notes: [...x.notes, { id, x: p.x, y: p.y, text: e.noteText }] }))
    setSel({ kind: 'note', id })
  }
  /** A palette part let go on the canvas */
  const dropped = (type: string, cx: number, cy: number) => {
    const p = toWorld(cx, cy)
    if (type === NOTE) addNote(p)
    else if ((NODE_TYPES[kind] as string[]).includes(type)) addNode(type as DiagramNodeType, p)
  }

  /** What a pulled line can be let go on: the parts (a sequence's whole lifelines), not the systems */
  const linkable = useMemo(() => {
    if (!dg) return []
    const end = kind === 'sequence' ? lifelineEnd(dg) : 0
    return dg.nodes.filter(n => n.type !== 'system').map(n => {
      const b = nodeBox(n)
      return { id: n.id, box: kind === 'sequence' ? { ...b, h: Math.max(b.h, end - b.y) } : b }
    })
  }, [dg, kind])

  /**
   * A line let go: on a part, a link of the chosen type (a message at the
   * height it was let go); on empty space, a new part there, linked.
   */
  const connect = (from: string, to: string | null, at: Point) => {
    if (!dg) return
    const source = dg.nodes.find(n => n.id === from)
    if (!source) return
    if (kind === 'sequence') {
      if (!to) return
      const b = nodeBox(source)
      const top = Math.max(...dg.nodes.filter(n => n.type === 'participant' || n.type === 'actor').map(n => n.y + nodeBox(n).h))
      // A message to itself only when let go below the head, on its own lifeline
      if (to === from && at.y < b.y + b.h) return
      const eid = uid('l')
      change(x => ({ ...x, edges: [...x.edges, { id: eid, type: edgeType, from, to, y: Math.max(top + 24, at.y) }] }))
      setSel({ kind: 'edge', id: eid })
      return
    }
    if (to) {
      const eid = uid('l')
      change(x => ({ ...x, edges: [...x.edges, { id: eid, type: edgeType, from, to }] }))
      setSel({ kind: 'edge', id: eid })
      return
    }
    const next = FOLLOW[source.type]
    const b = nodeBox(source)
    if (!next || (at.x > b.x - 40 && at.x < b.x + b.w + 40 && at.y > b.y - 40 && at.y < b.y + b.h + 40)) return
    const node = makeNode(next, at)
    const eid = uid('l')
    change(x => ({ ...x, nodes: [...x.nodes, node], edges: [...x.edges, { id: eid, type: edgeType, from, to: node.id }] }))
    setSel({ kind: 'node', id: node.id })
  }
  const removeSel = () => {
    const ids = new Set(multi.length > 1 ? multi : sel ? [sel.id] : [])
    if (!ids.size) return
    change(x => ({
      nodes: x.nodes.filter(n => !ids.has(n.id)),
      edges: x.edges.filter(l => !ids.has(l.id) && !ids.has(l.from) && !ids.has(l.to)),
      notes: x.notes.filter(n => !ids.has(n.id))
    }))
    setSel(null)
    setMulti([])
  }
  // ── v4.2 lot 2: copy, paste, duplicate; line up, spread out (a sequence's participants stay in their row) ──
  const rowOnly = kind === 'sequence'
  const clip = useClipboard<DiagramModel>(canvas, {
    kind: `diagram:${kind}`, selected: multi.length ? multi : sel && sel.kind !== 'edge' ? [sel.id] : [], boxes: parts,
    copy: ids => copyDiagram(dg!, ids),
    paste: (data, by) => { if (!dg) return; const r = pasteDiagram(dg, data, by, rowOnly); change(() => r.diagram); pick(r.ids) }
  })
  const arrange = arranging(parts, multi, to => change(x => ({ ...x, nodes: placed(x.nodes, to, rowOnly), notes: placed(x.notes, to) })))

  useEditorKeys({
    undo, redo, selectAll: picker.selectAll, canRemove: !!sel || multi.length > 0, remove: removeSel,
    escape: () => { if (drag.current?.kind === 'pull') drag.current = null; setPull(null); pick([]) },
    copy: clip.copy, paste: clip.paste, duplicate: clip.duplicate
  })

  // ── Pointer: the view or a zone (shared), move a part (a system carries what is inside it), a message's height, a system's size ──
  const down = (ev: ReactPointerEvent, target?: Sel, mode: 'move' | 'message' | 'resize' = 'move') => {
    if (!dg || !picker.press(ev) || picker.background(ev, !!target) || !target) return
    if (ev.shiftKey && target.kind !== 'edge') { picker.toggle(target.id); return }
    // A part of the selection moves the whole selection
    const group = mode === 'move' && picker.inGroup(target.id) ? multi.filter(i => i !== target.id) : []
    if (!group.length) { setSel(target); setMulti(target.kind === 'edge' ? [] : [target.id]) }
    const node = target.kind === 'node' ? dg.nodes.find(n => n.id === target.id) : undefined
    const note = target.kind === 'note' ? dg.notes.find(n => n.id === target.id) : undefined
    const edge = target.kind === 'edge' ? dg.edges.find(l => l.id === target.id) : undefined
    let carried: string[] | undefined
    // A system carries what is inside it (each system of the selection too)
    if (mode === 'move') {
      const systems = dg.nodes.filter(n => n.type === 'system' && (n.id === node?.id || group.includes(n.id)))
      const within = systems.flatMap(sys => { const sb = nodeBox(sys); return [...dg.nodes.filter(n => n.id !== sys.id && inside(nodeBox(n), sb)).map(n => n.id), ...dg.notes.filter(n => inside(noteBox(n), sb)).map(n => n.id)] })
      carried = [...new Set([...group, ...within])].filter(id => id !== target.id)
    }
    const origin = mode === 'resize' && node ? { x: node.w ?? 420, y: node.h ?? 340 } : mode === 'message' && edge ? { x: 0, y: edge.y ?? 0 } : node ?? note ?? view
    drag.current = { kind: mode, id: target.id, solo: group.length ? target.id : undefined, carried, sx: ev.clientX, sy: ev.clientY, ox: origin.x, oy: origin.y, moved: false, before: dg, start: dg }
  }
  const startPull = (ev: ReactPointerEvent, id: string, from: Point) => {
    ev.preventDefault()
    ev.stopPropagation()
    ;(ev.currentTarget as Element).setPointerCapture(ev.pointerId)
    setSel({ kind: 'node', id })
    drag.current = { kind: 'pull', id, sx: ev.clientX, sy: ev.clientY, ox: 0, oy: 0, moved: false }
    setPull({ from: id, a: from, b: from, target: null })
  }
  const move = (ev: ReactPointerEvent) => {
    if (picker.move(ev)) return
    const d = drag.current
    if (!d) return
    const dx = ev.clientX - d.sx, dy = ev.clientY - d.sy
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true
    if (d.kind === 'pull') {
      const p = toWorld(ev.clientX, ev.clientY)
      setPull(cur => cur && ({ ...cur, b: p, target: partAt(p, linkable, kind === 'sequence' ? undefined : cur.from)?.id ?? null }))
      return
    }
    if (!d.moved || !d.start) return
    const kx = dx / view.k, ky = dy / view.k
    const start = d.start
    if (d.kind === 'message') { setDg(cur => cur && ({ ...cur, edges: cur.edges.map(l => (l.id === d.id ? { ...l, y: Math.round(d.oy + ky) } : l)) })); return }
    if (d.kind === 'resize') { setDg(cur => cur && ({ ...cur, nodes: cur.nodes.map(n => (n.id === d.id ? { ...n, w: Math.max(160, Math.round(d.ox + kx)), h: Math.max(120, Math.round(d.oy + ky)) } : n)) })); return }
    const moved = new Set([d.id ?? '', ...(d.carried ?? [])])
    // A sequence's participants stay in their row
    setDg(cur => cur && ({ ...cur, nodes: shifted(cur.nodes, start.nodes, moved, kx, ky, kind === 'sequence'), notes: shifted(cur.notes, start.notes, moved, kx, ky) }))
  }
  const up = (ev: ReactPointerEvent) => {
    if (picker.end()) return
    const d = drag.current
    drag.current = null
    if (d?.kind === 'pull') {
      if (pull) { setPull(null); if (d.moved && ev.type === 'pointerup') connect(pull.from, pull.target, toWorld(ev.clientX, ev.clientY)) }
      return
    }
    if (d?.moved) change(x => x, null, d.before)
    // A click on one of the selection, not a drag: that one alone
    else if (d?.solo) pick([d.solo])
  }

  async function exportAs(ext: 'png' | 'svg') {
    if (!dg) return
    try {
      const path = await saveDrawing(diagramSvg(kind, dg, diagramColors()), file.replace(/\.json$/, ''), ext)
      if (path) toast.show({ tone: 'success', title: e.exported, description: path })
    } catch (err) { toast.show({ tone: 'error', title: e.exportFailed, description: errorText(err) }) }
  }

  const projectList = useProjectList().data
  /** One task per use case in the project's Notes, those already there left alone */
  async function makeTasks() {
    if (!dg) return
    try {
      const project = (projectList ?? await window.devforge.getProjects()).find(p => p.path === projectPath)
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

  if (error) return <div className="p-8"><ErrorState title={m.loadFailed} error={error} /></div>
  if (!model || !dg) return <Spinner className="m-8" />

  const nameOf = (id: string) => dg.nodes.find(n => n.id === id)?.name ?? ''
  const selNode = sel?.kind === 'node' ? dg.nodes.find(n => n.id === sel.id) : undefined
  const selEdge = sel?.kind === 'edge' ? dg.edges.find(l => l.id === sel.id) : undefined
  const selNote = sel?.kind === 'note' ? dg.notes.find(n => n.id === sel.id) : undefined
  const cases = dg.nodes.filter(n => n.type === 'case').length
  const ring = 'shadow-[0_0_0_2px_var(--color-accent)]'
  /** In a sequence the pulled line ends on the lifeline it points at, at the pointer's height */
  const wireEnd = (p: Pull): Point => {
    const t = kind === 'sequence' && p.target ? linkable.find(x => x.id === p.target) : undefined
    return t ? { x: t.box.x + t.box.w / 2, y: p.b.y } : p.b
  }

  return (
    <div className="flex h-full min-h-0 flex-col p-4">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-line bg-surface">
        <header className="flex h-[52px] shrink-0 items-center gap-2 border-b border-line-subtle px-3">
          <ModelCrumbs name={model.name} before={() => { void flush() }} />
          <span className={cn('shrink-0 rounded-[5px] px-1.5 py-0.5 font-mono text-xs font-semibold', KIND_TONE[kind])}>{m.kindName[kind]}</span>
          <span className="flex-1" />
          <SaveStatus state={saveState} file={file} className="hidden max-w-[260px] truncate text-xs xl:block" />
          <UndoRedo undo={undo} redo={redo} canUndo={canUndo} canRedo={canRedo} />
          <ZoomButtons k={view.k} zoom={zoom} />
          <Button variant="secondary" size="sm" onClick={fit}><Maximize2 size={13} /> {e.fit}</Button>
          <Button variant="secondary" size="sm" onClick={() => exportAs('png')} disabled={!all.w}>PNG</Button>
          <Button variant="secondary" size="sm" onClick={() => exportAs('svg')} disabled={!all.w}>SVG</Button>
          {kind === 'usecase' && <Button size="sm" onClick={makeTasks} disabled={!cases} title={cases ? g.tasksHint : g.tasksEmpty}><ListChecks size={13} /> {g.tasks}</Button>}
        </header>

        <div className="flex min-h-0 flex-1">
          <div ref={viewport} data-testid="diagram-canvas" data-canvas tabIndex={-1} role="group" aria-label={e.canvas}
            className={cn('relative min-w-0 flex-1 touch-none overflow-hidden bg-canvas outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-inset select-none', pull ? 'cursor-crosshair' : toolCursor(tool))}
            style={gridStyle(view)}
            onPointerDown={ev => down(ev)} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onDragStart={ev => ev.preventDefault()} {...dropZone(dropped)}>
            {!all.w && <p className="pointer-events-none absolute inset-x-0 top-1/3 mx-auto max-w-sm text-center text-sm text-fg-secondary">{g.empty[kind]}</p>}
            <div className="absolute top-0 left-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
              <svg className="pointer-events-none absolute top-0 left-0 overflow-visible font-sans" width="1" height="1" aria-hidden dangerouslySetInnerHTML={{ __html: shapes }} />
              {/* What the pointer takes: each part's box (a system's title bar and its corner), each link's dot */}
              {dg.nodes.map(n => {
                const b = nodeBox(n)
                const on = sel?.id === n.id || multi.includes(n.id)
                if (n.type === 'system') return (
                  <div key={n.id}>
                    <div data-node={n.name} onPointerDown={ev => down(ev, { kind: 'node', id: n.id })}
                      className={cn('absolute cursor-move rounded-t-[10px]', on && ring)} style={{ left: b.x, top: b.y, width: b.w, height: 34 }} />
                    {on && <div title={`${g.width} × ${g.height}`} onPointerDown={ev => down(ev, { kind: 'node', id: n.id }, 'resize')}
                      className="absolute h-3.5 w-3.5 cursor-nwse-resize rounded-sm border-2 border-accent bg-surface" style={{ left: b.x + b.w - 7, top: b.y + b.h - 7 }} />}
                  </div>
                )
                return (
                  <div key={n.id} className="group contents">
                    <div data-node={n.name} data-picked={on || undefined} onPointerDown={ev => down(ev, { kind: 'node', id: n.id })}
                      className={cn('absolute cursor-move rounded-md', on && ring, n.type === 'case' && 'rounded-[50%]', pull?.target === n.id && TARGET_RING)} style={{ left: b.x, top: b.y, width: b.w, height: b.h }} />
                    {(!pull || pull.from === n.id) && (
                      <Handles box={b} k={view.k} name={n.name} shown={pull?.from === n.id} sides={kind === 'sequence' ? ['left', 'right'] : undefined}
                        onPull={(ev, p) => startPull(ev, n.id, p)} />
                    )}
                  </div>
                )
              })}
              {dg.notes.map(n => {
                const b = noteBox(n)
                return <div key={n.id} onPointerDown={ev => down(ev, { kind: 'note', id: n.id })} className={cn('absolute cursor-move rounded-md', (sel?.id === n.id || multi.includes(n.id)) && ring)} style={{ left: b.x, top: b.y, width: b.w, height: b.h }} />
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
              {pull && <Wire from={pull.a} to={wireEnd(pull)} ok={!!pull.target} />}
            </div>
            <ZoneRect box={zone} />

            {/* v4.1: the cursors and the parts, in a bar at the bottom */}
            <CanvasBar tool={tool} onTool={setTool}>
              {NODE_TYPES[kind].map(type => <BarItem key={type} onClick={() => addNode(type)} drag={type} label={g.nodes[type]} icon={ICONS[type]} />)}
              <BarItem onClick={() => addNote()} drag={NOTE} label={e.addNote} icon={<StickyNote size={15} className="text-[var(--diagram-yellow)]" />} />
              {EDGE_TYPES[kind].length > 1 && <>
                <BarSeparator />
                <div role="radiogroup" aria-label={g.edgesTitle} title={g.edgesTitle} className="flex shrink-0 items-center gap-0.5">
                  {EDGE_TYPES[kind].map(type => (
                    <BarItem key={type} radio pressed={edgeType === type} onClick={() => setEdgeType(type)}
                      label={type === 'include' || type === 'extend' ? `«${g.edges[type]}»` : g.edges[type]} icon={<MoveRight size={14} />} />
                  ))}
                </div>
              </>}
            </CanvasBar>
          </div>

          <aside aria-label={g.panel} className="flex w-[280px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-line-subtle p-4">
            {multi.length > 1 ? <SelectionPanel count={multi.length} rowOnly={rowOnly} onAlign={arrange.align} onSpread={arrange.spread} onDuplicate={clip.duplicate} onRemove={removeSel} /> : selNode ? (
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
            </> : <>
              <p className="text-sm text-fg-muted">{g.nothing}</p>
              <p className="rounded-lg bg-accent-soft p-2 text-xs leading-snug text-fg">{kind === 'sequence' ? g.sequenceHint : g.linkHint}</p>
              <p className="text-xs leading-snug text-fg-muted">{g.paletteHint}</p>
            </>}
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
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-xs font-semibold text-accent">{i + 1}</span>
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


const PanelTitle = ({ children }: { children: ReactNode }) => <p className="font-mono text-2xs font-medium tracking-widest text-fg-muted uppercase">{children}</p>
