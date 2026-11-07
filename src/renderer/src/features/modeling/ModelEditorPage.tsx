import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, Check, Maximize2, Plus, Sparkles, StickyNote, Trash2, X } from 'lucide-react'
import type { Cardinality, McdAttribute, McdModel, McdType } from '@shared/types'
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
import TidyDialog from './TidyDialog'
import ModelCrumbs from './ModelCrumbs'
import { BarItem, CanvasBar, gridStyle, Minimap, SaveStatus, SelectionPanel, toolCursor, UndoRedo, useCanvasTool, ZoneRect, ZoomButtons } from './canvasTools'
import { arranging, shifted, useCanvasPick, useCanvasView, useClipboard, useEditorKeys, useModelDoc } from './useEditor'
import { placed } from '@shared/lib/arrange'
import { copyMcd, pasteMcd } from '@shared/lib/clip'
import { freeSpot } from '@shared/lib/mcdTidy'
import { isDiagramKind } from '@shared/lib/uml'
import { dropZone, Handles, partAt, TARGET_RING, Wire } from './connect'
import ErrorState from '@renderer/components/ui/ErrorState'

type Sel = { kind: 'entity' | 'association' | 'link' | 'note'; id: string } | null
/** A line pulled from a part's point: where it starts, where the pointer is, the part it would link */
type Pull = { from: string; a: Point; b: Point; target: string | null }


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
  const found = useSiblings(projectPath, file)

  const { model, doc: mcd, setDoc: setMcd, error, saveState, flush, change, undo, redo, canUndo, canRedo } = useModelDoc<McdModel>(projectPath, file,
    f => f.mcd ?? { entities: [], associations: [], links: [], notes: [] }, (f, next) => ({ ...f, mcd: next }))
  const [sel, setSel] = useState<Sel>(null)
  const { tool, setTool } = useCanvasTool()
  const [pull, setPull] = useState<Pull | null>(null)
  /** Parts moved (the one pressed, or the selection it is in), or a line pulled from a part's point */
  const drag = useRef<{ kind: 'move' | 'pull'; ids?: string[]; solo?: string; sel?: Sel; sx: number; sy: number; moved: boolean; before?: McdModel } | null>(null)
  /** v4.1: the tidy MCD suggestion, and a refit once it is taken */
  const [tidying, setTidying] = useState(false)
  const [refit, setRefit] = useState(0)

  // ── Geometry ───────────────────────────────────────────────────────────────
  const boxes = useMemo(() => {
    const out = new Map<string, Box>()
    for (const x of mcd?.entities ?? []) out.set(x.id, entityBox(x))
    for (const x of mcd?.associations ?? []) out.set(x.id, associationBox(x))
    for (const x of mcd?.notes ?? []) out.set(x.id, noteBox(x))
    return out
  }, [mcd])
  const all = bounds([...boxes.values()])
  const canvas = useCanvasView({ open: mcd !== null, all, refit })
  const { viewport, view, size, touched, fit, zoom, toWorld } = canvas
  /** v4.1: the parts picked together (a zone, Shift+click), moved and removed as one */
  const picker = useCanvasPick(canvas, { tool, parts: boxes, onPick: ids => setSel(ids.length === 1 ? selOf(ids[0]) : null) })
  const { multi, setMulti, zone, pick } = picker

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
  /** A new entity, its top left corner at `p` (`centered`: its middle there) */
  const newEntity = (x: McdModel, p: Point, centered = false) => {
    const n = x.entities.length + 1
    const ent = { id: uid('e'), name: `${e.entityName}_${n}`.toUpperCase(), x: p.x, y: p.y, attributes: [{ id: uid('a'), name: `id_${e.entityName.toLowerCase()}_${n}`, type: 'int' as const, identifier: true }] }
    if (centered) { const b = entityBox(ent); ent.x = Math.round(p.x - b.w / 2); ent.y = Math.round(p.y - b.h / 2) }
    return ent
  }
  const newAssociation = (p: Point, centered = false) => {
    const asso = { id: uid('s'), name: e.associationName.toUpperCase(), x: p.x, y: p.y, attributes: [] }
    if (centered) { const b = associationBox(asso); asso.x = Math.round(p.x - b.w / 2); asso.y = Math.round(p.y - b.h / 2) }
    return asso
  }
  /** v4.1: an association made between parts goes to the free spot nearest that middle, never on a part (`also`: one being added) */
  const freeAssociation = (middle: Point, also: Box[] = []) => {
    const asso = newAssociation(middle, true)
    const b = associationBox(asso)
    const p = freeSpot([...boxes.values(), ...also], middle, b.w, b.h)
    return { ...asso, x: Math.round(p.x - b.w / 2), y: Math.round(p.y - b.h / 2) }
  }
  const addEntity = (at?: Point, centered = false) => {
    if (!mcd) return
    const ent = newEntity(mcd, at ?? spot(), centered)
    change(x => ({ ...x, entities: [...x.entities, ent] }))
    setSel({ kind: 'entity', id: ent.id })
  }
  const addAssociation = (at?: Point) => {
    const asso = newAssociation(at ?? spot(), !!at)
    change(x => ({ ...x, associations: [...x.associations, asso] }))
    setSel({ kind: 'association', id: asso.id })
  }
  const addNote = (at?: Point) => {
    const id = uid('t')
    const p = at ? { x: at.x - 90, y: at.y - 30 } : spot()
    change(x => ({ ...x, notes: [...x.notes, { id, x: p.x, y: p.y, text: e.noteText }] }))
    setSel({ kind: 'note', id })
  }
  /** A palette part let go on the canvas */
  const dropped = (type: string, cx: number, cy: number) => {
    const p = toWorld(cx, cy)
    if (type === 'entity') addEntity(p, true)
    else if (type === 'association') addAssociation(p)
    else if (type === 'note') addNote(p)
  }

  /**
   * A line let go: an entity and an association get a leg; two entities get
   * an association between them; let go on the background, a new entity is
   * made there, joined the same way.
   */
  const connect = (from: string, to: string | null, at: Point) => {
    if (!mcd) return
    const isEntity = (id: string) => mcd.entities.some(x => x.id === id)
    const leg = (entity: string, association: string) => ({ id: uid('l'), entity, association, card: '0,n' as Cardinality })
    const centerOf = (id: string) => { const b = boxes.get(id)!; return { x: b.x + b.w / 2, y: b.y + b.h / 2 } }
    if (to && isEntity(from) !== isEntity(to)) {
      const l = isEntity(from) ? leg(from, to) : leg(to, from)
      change(x => ({ ...x, links: [...x.links, l] }))
      setSel({ kind: 'link', id: l.id })
      return
    }
    if (to && !isEntity(from)) return
    if (to) {
      const a = centerOf(from), b = centerOf(to)
      // On itself: beside the entity, else between the two
      const mid = from === to ? { x: boxes.get(from)!.x + boxes.get(from)!.w + 100, y: a.y } : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const asso = freeAssociation(mid)
      change(x => ({ ...x, associations: [...x.associations, asso], links: [...x.links, leg(from, asso.id), leg(to, asso.id)] }))
      setSel({ kind: 'association', id: asso.id })
      return
    }
    // The background: only when pulled clear of the part, a mere slip makes nothing
    const b = boxes.get(from)!
    if (at.x > b.x - 40 && at.x < b.x + b.w + 40 && at.y > b.y - 40 && at.y < b.y + b.h + 40) return
    const ent = newEntity(mcd, at, true)
    if (isEntity(from)) {
      const a = centerOf(from)
      const asso = freeAssociation({ x: (a.x + at.x) / 2, y: (a.y + at.y) / 2 }, [entityBox(ent)])
      change(x => ({ ...x, entities: [...x.entities, ent], associations: [...x.associations, asso], links: [...x.links, leg(from, asso.id), leg(ent.id, asso.id)] }))
      setSel({ kind: 'association', id: asso.id })
    } else {
      change(x => ({ ...x, entities: [...x.entities, ent], links: [...x.links, leg(ent.id, from)] }))
      setSel({ kind: 'entity', id: ent.id })
    }
  }
  const removeSel = () => {
    const ids = new Set(multi.length > 1 ? multi : sel ? [sel.id] : [])
    if (!ids.size) return
    change(x => ({
      entities: x.entities.filter(n => !ids.has(n.id)),
      associations: x.associations.filter(n => !ids.has(n.id)),
      notes: x.notes.filter(n => !ids.has(n.id)),
      links: x.links.filter(l => !ids.has(l.id) && !ids.has(l.entity) && !ids.has(l.association))
    }))
    setSel(null)
    setMulti([])
  }
  /** The part an id is, for the side panel */
  const selOf = (id: string): Sel => !mcd ? null : mcd.entities.some(x => x.id === id) ? { kind: 'entity', id } : mcd.associations.some(x => x.id === id) ? { kind: 'association', id } : { kind: 'note', id }

  // ── v4.2 lot 2: copy, paste, duplicate; line up, spread out ─────────────────
  /** The parts picked (a leg alone is not copied) */
  const picked = multi.length ? multi : sel && sel.kind !== 'link' ? [sel.id] : []
  const clip = useClipboard<McdModel>(canvas, {
    kind: 'mcd', selected: picked, boxes,
    copy: ids => copyMcd(mcd!, ids),
    paste: (data, by) => { if (!mcd) return; const r = pasteMcd(mcd, data, by); change(() => r.mcd); pick(r.ids) }
  })
  const arrange = arranging(boxes, multi, to => change(x => ({ ...x, entities: placed(x.entities, to), associations: placed(x.associations, to), notes: placed(x.notes, to) })))

  // Keyboard: undo / redo, everything, delete, Escape drops the line being pulled; copy, paste, duplicate
  useEditorKeys({
    undo, redo, selectAll: picker.selectAll, canRemove: !!sel || multi.length > 0, remove: removeSel,
    escape: () => { if (drag.current?.kind === 'pull') drag.current = null; setPull(null); pick([]) },
    copy: clip.copy, paste: clip.paste, duplicate: clip.duplicate
  })

  // ── Pointer: the view or a zone (shared), move parts, pull a line from a part's point ──
  /** v4.1: on a part, Shift+click adds or takes it out, and a part of a selection moves the whole selection */
  const down = (ev: ReactPointerEvent, target?: Sel) => {
    if (!picker.press(ev) || picker.background(ev, !!target) || !target) return
    if (ev.shiftKey && target.kind !== 'link') { picker.toggle(target.id); return }
    const group = picker.inGroup(target.id)
    if (!group) { setSel(target); setMulti(target.kind === 'link' ? [] : [target.id]) }
    drag.current = { kind: 'move', ids: group ? multi : [target.id], solo: group ? target.id : undefined, sx: ev.clientX, sy: ev.clientY, moved: false, before: mcd ?? undefined }
  }
  const startPull = (ev: ReactPointerEvent, target: Sel & object, from: Point) => {
    ev.preventDefault()
    ev.stopPropagation()
    ;(ev.currentTarget as Element).setPointerCapture(ev.pointerId)
    setSel(target)
    drag.current = { kind: 'pull', sel: target, sx: ev.clientX, sy: ev.clientY, moved: false }
    setPull({ from: target.id, a: from, b: from, target: null })
  }
  /** What a pulled line can be let go on */
  const linkable = useMemo(() => [
    ...(mcd?.entities ?? []).map(x => ({ id: x.id, box: boxes.get(x.id)! })),
    ...(mcd?.associations ?? []).map(x => ({ id: x.id, box: boxes.get(x.id)! }))
  ], [mcd, boxes])
  const move = (ev: ReactPointerEvent) => {
    if (picker.move(ev)) return
    const d = drag.current
    if (!d) return
    const dx = ev.clientX - d.sx, dy = ev.clientY - d.sy
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true
    if (d.kind === 'pull') {
      const p = toWorld(ev.clientX, ev.clientY)
      setPull(cur => cur && ({ ...cur, b: p, target: partAt(p, linkable, cur.from)?.id ?? null }))
      return
    }
    if (!d.moved || !d.before) return
    // Moving shows at once; the history gets one step when the parts are dropped
    const ids = new Set(d.ids), kx = dx / view.k, ky = dy / view.k, from = d.before
    setMcd(cur => cur && ({
      ...cur,
      entities: shifted(cur.entities, from.entities, ids, kx, ky),
      associations: shifted(cur.associations, from.associations, ids, kx, ky),
      notes: shifted(cur.notes, from.notes, ids, kx, ky)
    }))
  }
  const up = (ev: ReactPointerEvent) => {
    if (picker.end()) return
    const d = drag.current
    drag.current = null
    if (d?.kind === 'move' && d.moved) change(x => x, null, d.before)
    // A click on one of the selection, not a drag: that one alone
    if (d?.kind === 'move' && !d.moved && d.solo) pick([d.solo])
    if (d?.kind === 'pull' && pull) {
      setPull(null)
      if (d.moved && ev.type === 'pointerup') connect(pull.from, pull.target, toWorld(ev.clientX, ev.clientY))
    }
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

  if (error) return <div className="p-8"><ErrorState title={m.loadFailed} error={error} /></div>
  if (!model || !mcd) return <Spinner className="m-8" />

  const selEntity = sel?.kind === 'entity' ? mcd.entities.find(x => x.id === sel.id) : undefined
  const selAssociation = sel?.kind === 'association' ? mcd.associations.find(x => x.id === sel.id) : undefined
  const selLink = sel?.kind === 'link' ? mcd.links.find(x => x.id === sel.id) : undefined
  const selNote = sel?.kind === 'note' ? mcd.notes.find(x => x.id === sel.id) : undefined
  const nameOf = (id: string) => mcd.entities.find(x => x.id === id)?.name ?? mcd.associations.find(x => x.id === id)?.name ?? ''

  return (
    <div className="flex h-full min-h-0 flex-col p-4">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-line bg-surface">
        {/* Toolbar */}
        <header className="flex h-[52px] shrink-0 items-center gap-2 border-b border-line-subtle px-3">
          <ModelCrumbs name={model.name} before={() => { void flush() }} />
          <ModelTabs projectPath={projectPath} file={file} tab="mcd" hasMcd hasMpd={!!found?.mpd} before={() => { void flush() }} />
          <span className="flex-1" />
          <SaveStatus state={saveState} file={file} className="hidden min-w-0 truncate text-xs md:block" />
          <UndoRedo undo={undo} redo={redo} canUndo={canUndo} canRedo={canRedo} />
          <ZoomButtons k={view.k} zoom={zoom} />
          <Button variant="secondary" size="sm" onClick={fit}><Maximize2 size={13} /> {e.fit}</Button>
          <Button variant="secondary" size="sm" onClick={() => pick([])} title={e.checkHint}>
            {errors ? <AlertTriangle size={13} className="text-warning" /> : <Check size={13} className="text-success" />} {e.check}{issues.length ? ` · ${issues.length}` : ''}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => exportAs('png')} disabled={!all.w}>PNG</Button>
          <Button variant="secondary" size="sm" onClick={() => exportAs('svg')} disabled={!all.w}>SVG</Button>
        </header>

        <div className="flex min-h-0 flex-1">
          {/* Palette */}
          <aside aria-label={e.entities} className="flex w-[180px] shrink-0 flex-col gap-2 border-r border-line-subtle p-3">
            <p className="rounded-lg bg-accent-soft p-2 text-xs leading-snug text-fg">{e.linkHint}</p>
            {mcd.entities.length > 0 && <p className="mt-2 font-mono text-2xs font-medium tracking-widest text-fg-muted uppercase">{e.entities}</p>}
            <ul className="flex min-h-0 flex-col gap-0.5 overflow-y-auto">
              {mcd.entities.map(x => (
                <li key={x.id}>
                  <button type="button" onClick={() => { pick([x.id]); const b = boxes.get(x.id)!; canvas.centerOn({ x: b.x + b.w / 2, y: b.y + b.h / 2 }) }}
                    className={cn('w-full truncate rounded px-1.5 py-0.5 text-left font-mono text-xs', sel?.id === x.id || multi.includes(x.id) ? 'bg-active text-fg' : 'text-fg-secondary hover:bg-hover hover:text-fg')}>{x.name || '—'}</button>
                </li>
              ))}
            </ul>
            <p className="mt-auto text-xs leading-snug text-fg-muted">{e.paletteHint}</p>
          </aside>

          {/* Canvas */}
          <div ref={viewport} data-testid="mcd-canvas" data-canvas tabIndex={-1} role="group" aria-label={e.canvas}
            className={cn('relative min-w-0 flex-1 touch-none overflow-hidden bg-canvas outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-inset select-none', pull ? 'cursor-crosshair' : toolCursor(tool))}
            style={gridStyle(view)}
            onPointerDown={ev => down(ev)} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onDragStart={ev => ev.preventDefault()} {...dropZone(dropped)}
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
                const on = sel?.id === x.id || multi.includes(x.id)
                return (
                  <div key={x.id} className="group contents">
                    <div data-entity={x.name} data-picked={on || undefined} onPointerDown={ev => down(ev, { kind: 'entity', id: x.id })}
                      className={cn('absolute cursor-move overflow-hidden rounded-md border-[1.5px] bg-surface font-mono', on ? 'border-accent shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-accent)_25%,transparent)]' : 'border-[var(--syntax-keyword)]', pull?.target === x.id && TARGET_RING)}
                      style={{ left: b.x, top: b.y, width: b.w, height: b.h }}>
                      <div className={cn('flex items-center justify-center border-b-[1.5px] px-2 text-base font-bold tracking-wide text-fg', on ? 'border-accent' : 'border-[var(--syntax-keyword)]')} style={{ height: HEADER }}>{x.name.toUpperCase() || '—'}</div>
                      <div className="pt-1">
                        {x.attributes.map(a => (
                          <div key={a.id} className={cn('truncate px-3 text-sm text-fg', a.identifier && 'underline')} style={{ height: ROW, lineHeight: `${ROW}px` }}>{a.name || '—'}</div>
                        ))}
                      </div>
                    </div>
                    {(!pull || pull.from === x.id) && <Handles box={b} k={view.k} name={x.name} shown={pull?.from === x.id} onPull={(ev, p) => startPull(ev, { kind: 'entity', id: x.id }, p)} />}
                  </div>
                )
              })}
              {mcd.associations.map(x => {
                const b = boxes.get(x.id)!
                const on = sel?.id === x.id || multi.includes(x.id)
                return (
                  <div key={x.id} className="group contents">
                    <div data-association={x.name} data-picked={on || undefined} onPointerDown={ev => down(ev, { kind: 'association', id: x.id })}
                      className={cn('absolute flex cursor-move flex-col items-center justify-center rounded-[50%] border-[1.5px] bg-surface font-mono', on ? 'border-accent' : 'border-[var(--syntax-keyword)]', pull?.target === x.id && TARGET_RING)}
                      style={{ left: b.x, top: b.y, width: b.w, height: b.h }}>
                      <span className="text-sm font-bold tracking-wide text-fg">{x.name.toUpperCase() || '—'}</span>
                      {x.attributes.map(a => <span key={a.id} className="text-xs leading-4 text-fg-secondary">{a.name}</span>)}
                    </div>
                    {(!pull || pull.from === x.id) && <Handles box={b} k={view.k} name={x.name} shown={pull?.from === x.id} onPull={(ev, p) => startPull(ev, { kind: 'association', id: x.id }, p)} />}
                  </div>
                )
              })}
              {mcd.notes.map(x => {
                const b = boxes.get(x.id)!
                return (
                  <div key={x.id} onPointerDown={ev => down(ev, { kind: 'note', id: x.id })}
                    className={cn('absolute cursor-move rounded-md bg-[color-mix(in_srgb,var(--syntax-attr)_16%,transparent)] px-2.5 py-2 text-sm leading-[17px] whitespace-pre-wrap text-fg', (sel?.id === x.id || multi.includes(x.id)) && 'ring-2 ring-accent')}
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
                    className={cn('absolute -translate-x-1/2 -translate-y-1/2 rounded px-1 font-mono text-sm font-semibold text-[var(--syntax-keyword)] hover:bg-hover', sel?.id === l.id && 'bg-active ring-1 ring-accent')}
                    style={{ left: p.label.x, top: p.label.y }}>{l.card}</button>
                )
              })}
              {pull && <Wire from={pull.a} to={pull.b} ok={!!pull.target} />}
            </div>
            <ZoneRect box={zone} />

            <CanvasBar tool={tool} onTool={setTool}>
              <BarItem onClick={() => addEntity()} drag="entity" label={e.addEntity} icon={<svg width="18" height="14" aria-hidden><rect x="1" y="1" width="16" height="12" rx="2" fill="none" stroke="var(--syntax-keyword)" strokeWidth="1.5" /><path d="M1 5h16" stroke="var(--syntax-keyword)" strokeWidth="1.5" /></svg>} />
              <BarItem onClick={() => addAssociation()} drag="association" label={e.addAssociation} icon={<svg width="18" height="14" aria-hidden><ellipse cx="9" cy="7" rx="8" ry="5.5" fill="none" stroke="var(--syntax-keyword)" strokeWidth="1.5" /></svg>} />
              <BarItem onClick={() => addNote()} drag="note" label={e.addNote} icon={<StickyNote size={15} className="text-[var(--syntax-attr)]" />} />
            </CanvasBar>

            <Minimap parts={boxes} all={all} view={view} size={size} lit={id => sel?.id === id || multi.includes(id)} tone={{ fill: 'var(--syntax-keyword)', opacity: 0.55 }} onGo={canvas.centerOn} />
          </div>

          {/* The part chosen, or the check */}
          <aside aria-label={e.panel} className="flex w-[290px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-line-subtle p-3.5 text-sm">
            {multi.length > 1 && (
              <SelectionPanel count={multi.length} onAlign={arrange.align} onSpread={arrange.spread} onDuplicate={clip.duplicate} onRemove={removeSel} />
            )}
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
                            className={cn('h-7 min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 font-mono text-sm text-fg outline-none focus:border-accent', a.identifier && 'underline')} />
                          <IconButton size="sm" tone="danger" title={e.removeAttr} onClick={() => setNode(n => ({ ...n, attributes: n.attributes.filter(x => x.id !== a.id) }))}><X size={12} /></IconButton>
                        </div>
                        <div className="flex items-center gap-1.5 pl-5.5">
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

            {!sel && multi.length < 2 && (
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
                {issues.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1.5 border-t border-line-subtle pt-3">
                    <Button size="sm" variant="secondary" className="self-start" onClick={() => setTidying(true)}><Sparkles size={13} /> {e.tidy.button}</Button>
                    <p className="text-xs leading-snug text-fg-muted">{e.tidy.hint}</p>
                  </div>
                )}
                <p className="mt-2 text-xs leading-snug text-fg-muted">{e.help}</p>
              </>
            )}
          </aside>
        </div>
      </div>
      {tidying && mcd && (
        <TidyDialog mcd={mcd} mpd={found?.mpd?.mpd} onKeep={() => setTidying(false)}
          onTake={next => {
            change(() => next)
            setTidying(false)
            setSel(null)
            touched.current = false
            setRefit(x => x + 1)
            toast.show({ tone: 'success', title: e.tidy.taken })
          }} />
      )}
    </div>
  )
}


const PanelTitle = ({ children }: { children: ReactNode }) => <p className="font-mono text-2xs font-medium tracking-widest text-fg-muted uppercase">{children}</p>
