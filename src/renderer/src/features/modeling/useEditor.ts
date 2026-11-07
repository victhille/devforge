import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MutableRefObject, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import type { ModelFile } from '@shared/types'
import { bounds, type Box, type Point } from '@shared/lib/mcd'
import { align, distribute, pasteShift, type AlignHow, type Axis } from '@shared/lib/arrange'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { errorText } from '@renderer/lib/errors'
import { announce, boxOf, isTyping, leaveFields, touches, type CanvasTool } from './canvasTools'

/**
 * v4.2 lot 1: what the three editors (MCD, diagrams, MPD) share, written once:
 * the model file (loaded, saved as it changes, its history), the view (size,
 * fit, zoom), picking (a zone, Shift+click, the hand) and the keyboard.
 */

const SAVE_DELAY = 500
export type SaveState = 'saved' | 'saving' | 'failed'
export type View = { x: number; y: number; k: number }

// ── The model file ───────────────────────────────────────────────────────────

/**
 * The part of a model file an editor works on (`read` takes it out, `write`
 * puts it back): saved a moment after each change, and when the page is left.
 * Each change is a step of the history (typing in one field makes one step).
 */
export function useModelDoc<T>(projectPath: string, file: string, read: (f: ModelFile) => T | null, write: (f: ModelFile, doc: T) => ModelFile, onSchedule?: () => void) {
  const { t } = useI18n()
  const saveFailed = t.modeling.editor.saveFailed
  const toast = useToast()
  const [model, setModel] = useState<ModelFile | null>(null)
  const [doc, setDoc] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const history = useRef<{ past: T[]; future: T[]; mergeKey: string | null; at: number }>({ past: [], future: [], mergeKey: null, at: 0 })
  const [, setHistoryTick] = useState(0)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<T | null>(null)
  const io = useRef({ read, write, onSchedule })
  io.current = { read, write, onSchedule }

  useEffect(() => {
    window.devforge.modeling.read(projectPath, file)
      .then(f => { setModel(f); setDoc(io.current.read(f)) })
      .catch(err => setError(errorText(err)))
  }, [projectPath, file])

  const flush = useCallback(async () => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
    const next = pending.current
    if (!next || !model) return
    pending.current = null
    setSaveState('saving')
    try { await window.devforge.modeling.save(projectPath, file, io.current.write(model, next)); setSaveState('saved') }
    catch (err) { setSaveState('failed'); toast.show({ tone: 'error', title: saveFailed, description: errorText(err) }) }
  }, [model, projectPath, file, toast, saveFailed])
  const flushRef = useRef(flush)
  flushRef.current = flush
  // Leaving the page saves what is left
  useEffect(() => () => { void flushRef.current() }, [])

  const schedule = (next: T) => {
    pending.current = next
    setSaveState('saving')
    io.current.onSchedule?.()
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { void flushRef.current() }, SAVE_DELAY)
  }

  /** A change: kept in the history (`mergeKey`: the same field typed in goes in one step; `before`: the state a drag started from), then saved */
  const change = (fn: (x: T) => T, mergeKey: string | null = null, before?: T) => {
    setDoc(cur => {
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
    if (!h.past.length || !doc) return
    h.future = [doc, ...h.future]
    const prev = h.past[h.past.length - 1]
    h.past = h.past.slice(0, -1)
    h.mergeKey = null
    setDoc(prev); schedule(prev); setHistoryTick(x => x + 1)
  }
  const redo = () => {
    const h = history.current
    if (!h.future.length || !doc) return
    h.past = [...h.past, doc]
    const next = h.future[0]
    h.future = h.future.slice(1)
    h.mergeKey = null
    setDoc(next); schedule(next); setHistoryTick(x => x + 1)
  }

  return {
    model, doc, setDoc, error, saveState, flush, change, undo, redo,
    canUndo: history.current.past.length > 0, canRedo: history.current.future.length > 0
  }
}

// ── The view ─────────────────────────────────────────────────────────────────

export type CanvasView = ReturnType<typeof useCanvasView>

/**
 * The canvas' size, its view (moved, zoomed) and the way between screen and
 * canvas. Fitted to `all` on opening, and again while the page settles (its
 * width comes last), until the view is moved by hand; `refit` fits it again.
 * `open`: the model is there; `remount`: the canvas came back (a tab).
 */
export function useCanvasView({ open, remount = '', all, start = { x: 60, y: 60, k: 1 }, minZoom = 0.2, refit = 0 }: {
  open: boolean; remount?: string; all: Box; start?: View; minZoom?: number; refit?: number
}) {
  const [view, setView] = useState<View>(start)
  const [size, setSize] = useState({ w: 800, h: 600 })
  const viewport = useRef<HTMLDivElement>(null)
  /** The view was moved by hand: no more fitting on its own */
  const touched = useRef(false)

  useLayoutEffect(() => {
    const el = viewport.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [open, remount])

  const fit = () => {
    if (!all.w) { setView(start); return }
    const k = Math.min(1, (size.w - 80) / all.w, (size.h - 80) / all.h)
    setView({ k, x: (size.w - all.w * k) / 2 - all.x * k, y: (size.h - all.h * k) / 2 - all.y * k })
  }
  useEffect(() => { if (!touched.current && open && size.w > 100) fit() }, [open, size.w, size.h, refit]) // eslint-disable-line react-hooks/exhaustive-deps

  const zoom = (factor: number, cx = size.w / 2, cy = size.h / 2) => {
    touched.current = true
    setView(v => {
      const k = Math.min(2, Math.max(minZoom, v.k * factor))
      return { k, x: cx - (cx - v.x) * (k / v.k), y: cy - (cy - v.y) * (k / v.k) }
    })
  }
  // The wheel zooms the canvas only (a native listener: React's is passive)
  const zoomAt = useRef<(ev: WheelEvent) => void>(() => {})
  zoomAt.current = ev => { const r = viewport.current!.getBoundingClientRect(); zoom(Math.exp(-ev.deltaY * 0.0015), ev.clientX - r.left, ev.clientY - r.top) }
  useEffect(() => {
    const el = viewport.current
    if (!el) return
    const onWheel = (ev: WheelEvent) => { ev.preventDefault(); zoomAt.current(ev) }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [open, remount])

  /** A point of the screen, in the canvas' units */
  const toWorld = (clientX: number, clientY: number): Point => {
    const r = viewport.current!.getBoundingClientRect()
    return { x: Math.round((clientX - r.left - view.x) / view.k), y: Math.round((clientY - r.top - view.y) / view.k) }
  }
  /** The middle of the screen, in the canvas' units */
  const middle = (): Point => ({ x: (size.w / 2 - view.x) / view.k, y: (size.h / 2 - view.y) / view.k })
  /** The view moved so that this point of the canvas is in the middle */
  const centerOn = (p: Point) => {
    touched.current = true
    setView(v => ({ ...v, x: size.w / 2 - p.x * v.k, y: size.h / 2 - p.y * v.k }))
  }
  /** The part of the canvas on screen, in its units */
  const seen = (): Box => ({ x: -view.x / view.k, y: -view.y / view.k, w: size.w / view.k, h: size.h / view.k })

  return { viewport: viewport as RefObject<HTMLDivElement>, view, setView, size, touched: touched as MutableRefObject<boolean>, fit, zoom, toWorld, middle, centerOn, seen }
}

// ── Picking ──────────────────────────────────────────────────────────────────

type Gesture = { kind: 'pan' | 'zone'; sx: number; sy: number; ox: number; oy: number; moved: boolean; keep: string[] }

/**
 * The parts picked together (a zone, Shift+click), moved and removed as one.
 * On the background, the hand (or the wheel button anywhere) moves the view
 * and the selection cursor draws a zone, which picks what it touches as it
 * grows. `parts`: what a zone can pick; `onPick`: the editor's own selection.
 */
export function useCanvasPick(canvas: CanvasView, { tool, parts, onPick }: { tool: CanvasTool; parts: Map<string, Box>; onPick: (ids: string[]) => void }) {
  const [multi, setMulti] = useState<string[]>([])
  const [zone, setZone] = useState<Box | null>(null)
  const gesture = useRef<Gesture | null>(null)

  const pick = (ids: string[]) => { setMulti(ids); onPick(ids) }
  /** Shift+click: in or out of the selection */
  const toggle = (id: string) => pick(multi.includes(id) ? multi.filter(i => i !== id) : [...multi, id])
  /** One of a selection of several: moving it moves them all */
  const inGroup = (id: string) => multi.length > 1 && multi.includes(id)
  const selectAll = () => pick([...parts.keys()])

  /**
   * The start of any press on the canvas: the pointer kept, the field being
   * typed in left (Delete then removes the part, not a letter). False for a
   * button that does nothing.
   */
  const press = (ev: ReactPointerEvent) => {
    if (ev.button !== 0 && ev.button !== 1) return false
    ev.preventDefault()
    ev.stopPropagation()
    ;(ev.currentTarget as Element).setPointerCapture(ev.pointerId)
    leaveFields()
    return true
  }
  /** The view moved, or a zone started: true when the press is taken that way (`onPart`: it is on a part) */
  const background = (ev: ReactPointerEvent, onPart: boolean) => {
    const at = { sx: ev.clientX, sy: ev.clientY, moved: false }
    if (ev.button === 1 || (!onPart && tool === 'hand')) { gesture.current = { kind: 'pan', ...at, ox: canvas.view.x, oy: canvas.view.y, keep: [] }; return true }
    if (onPart) return false
    const r = canvas.viewport.current!.getBoundingClientRect()
    gesture.current = { kind: 'zone', ...at, ox: ev.clientX - r.left, oy: ev.clientY - r.top, keep: ev.shiftKey ? multi : [] }
    return true
  }
  /** The pointer moves: true when it is the view or a zone */
  const move = (ev: ReactPointerEvent) => {
    const g = gesture.current
    if (!g) return false
    const dx = ev.clientX - g.sx, dy = ev.clientY - g.sy
    if (Math.abs(dx) + Math.abs(dy) > 3) g.moved = true
    if (g.kind === 'pan') {
      if (g.moved) canvas.touched.current = true
      canvas.setView(v => ({ ...v, x: g.ox + dx, y: g.oy + dy }))
      return true
    }
    if (!g.moved) return true
    const z = boxOf({ x: g.ox, y: g.oy }, { x: g.ox + dx, y: g.oy + dy })
    setZone(z)
    // What the zone touches, in the canvas' own units
    const { view } = canvas
    const w = { x: (z.x - view.x) / view.k, y: (z.y - view.y) / view.k, w: z.w / view.k, h: z.h / view.k }
    pick([...new Set([...g.keep, ...[...parts].filter(([, b]) => touches(b, w)).map(([id]) => id)])])
    return true
  }
  /** The pointer let go: true when it was the view or a zone. A click on the background picks nothing any more (Shift keeps what was) */
  const end = () => {
    const g = gesture.current
    if (!g) return false
    gesture.current = null
    if (g.kind === 'zone') { setZone(null); if (!g.moved) pick(g.keep) }
    return true
  }

  return { multi, setMulti, zone, pick, toggle, inGroup, selectAll, press, background, move, end }
}

/** The parts of `ids` moved by (dx, dy) from where they were when the drag started (`rowOnly`: they keep their height) */
export function shifted<T extends { id: string; x: number; y: number }>(list: T[], start: T[], ids: ReadonlySet<string>, dx: number, dy: number, rowOnly = false): T[] {
  return list.map(n => {
    if (!ids.has(n.id)) return n
    const o = start.find(x => x.id === n.id)
    return o ? { ...n, x: Math.round(o.x + dx), y: rowOnly ? o.y : Math.round(o.y + dy) } : n
  })
}

/**
 * v4.2: the parts picked lined up or spread out (`parts`: their boxes;
 * `place`: gives them their new places, one step of the history).
 */
export function arranging(parts: Map<string, Box>, ids: string[], place: (to: Map<string, Point>) => void) {
  const picked = () => new Map(ids.filter(id => parts.has(id)).map(id => [id, parts.get(id)!]))
  const apply = (to: Map<string, Point>) => { if (to.size) place(to) }
  return {
    align: (how: AlignHow) => apply(align(picked(), how)),
    spread: (axis: Axis) => apply(distribute(picked(), axis))
  }
}

// ── Copy, paste, duplicate (v4.2 lot 2) ──────────────────────────────────────

/** What was copied, kept while the app is open: pasted in the same model, or in another of its kind */
let clipboard: { kind: string; data: unknown; box: Box; times: number; count: number } | null = null

/**
 * Copy the parts picked, paste them (a step aside each time, or in the middle
 * of the screen when where they came from is not on it), duplicate them.
 * `copy` takes the parts of `ids` with what links them; `paste` adds a copy
 * moved by `by`, and picks it.
 */
export function useClipboard<C>(canvas: CanvasView, { kind, selected, boxes, copy, paste }: {
  /** A model of another kind never gets the copy (a diagram: of another kind of diagram) */
  kind: string
  selected: string[]
  boxes: Map<string, Box>
  copy: (ids: string[]) => C
  paste: (data: C, by: Point) => void
}) {
  const { t } = useI18n()
  const said = t.modeling.editor.selection
  const take = () => {
    const ids = selected.filter(id => boxes.has(id))
    if (!ids.length) return null
    return { data: copy(ids), box: bounds(ids.map(id => boxes.get(id)!)), count: ids.length }
  }
  return {
    /** False when nothing is picked */
    copy: () => {
      const c = take()
      if (!c) return false
      clipboard = { kind, ...c, times: 0 }
      return true
    },
    /** False when nothing of this kind was copied */
    paste: () => {
      if (!clipboard || clipboard.kind !== kind) return false
      clipboard.times++
      paste(clipboard.data as C, pasteShift(clipboard.box, canvas.seen(), clipboard.times))
      // Told to screen readers: the new parts are picked, nothing else shows it
      announce(said.pasted.replace('{n}', String(clipboard.count)))
      return true
    },
    duplicate: () => {
      const c = take()
      if (!c) return false
      paste(c.data, { x: 24, y: 24 })
      announce(said.duplicated.replace('{n}', String(c.count)))
      return true
    }
  }
}

// ── The keyboard ─────────────────────────────────────────────────────────────

/**
 * Ctrl+Z / Ctrl+Y (Ctrl+Shift+Z), Ctrl+A, Delete on what is picked, Escape;
 * Ctrl+C, Ctrl+X, Ctrl+V, Ctrl+D (v4.2). Never while typing, and Ctrl+C
 * leaves a text picked on the page to the system.
 */
export function useEditorKeys(on: {
  undo: () => void; redo: () => void; selectAll: () => void; canRemove: boolean; remove: () => void; escape: () => void
  copy?: () => boolean; paste?: () => boolean; duplicate?: () => boolean
}) {
  const latest = useRef(on)
  latest.current = on
  // What a removal by the keyboard says to screen readers (the panel's button says the same)
  const { t } = useI18n()
  const said = useRef(t.modeling.editor.selection)
  said.current = t.modeling.editor.selection
  useEffect(() => {
    const listener = (ev: KeyboardEvent) => {
      if (isTyping(ev.target)) return
      const k = latest.current
      const mod = ev.ctrlKey || ev.metaKey, key = ev.key.toLowerCase()
      const textPicked = !!document.getSelection()?.toString()
      if (mod && key === 'z') { ev.preventDefault(); if (ev.shiftKey) k.redo(); else k.undo() }
      else if (mod && key === 'y') { ev.preventDefault(); k.redo() }
      else if (mod && key === 'a') { ev.preventDefault(); k.selectAll() }
      else if (mod && key === 'c') { if (!textPicked && k.copy?.()) ev.preventDefault() }
      else if (mod && key === 'x') { if (!textPicked && k.copy?.()) { ev.preventDefault(); k.remove(); announce(said.current.cut) } }
      else if (mod && key === 'v') { if (k.paste?.()) ev.preventDefault() }
      else if (mod && key === 'd') { ev.preventDefault(); k.duplicate?.() }
      else if ((ev.key === 'Delete' || ev.key === 'Backspace') && k.canRemove) { ev.preventDefault(); k.remove(); announce(said.current.removed) }
      else if (ev.key === 'Escape') k.escape()
    }
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])
}
