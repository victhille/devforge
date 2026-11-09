import { useCallback, useSyncExternalStore } from 'react'
import type { DataTopic } from '@shared/types'

/**
 * v4.2: data the pages read often (the projects, the connections, a project's
 * models), kept in memory once read. A page coming back shows it at once and
 * asks again in the background; two pages asking at the same moment make one
 * request; and when the main process says it changed (a page, Forgy, an
 * import), every page showing it reads it again.
 */

type Snapshot = { data: unknown; error: unknown; loaded: boolean }
interface Entry {
  load: () => Promise<unknown>
  topics: DataTopic[]
  scope?: string
  /** Shown again after this long: read again (a slow scan keeps longer) */
  freshMs: number
  snap: Snapshot
  /** When it was last read; 0: to read again */
  at: number
  /** How many times it was changed here (setLive): an answer asked before the last change is older, and is not shown */
  changes: number
  /** Told changed while a read was on its way: read again when it ends */
  again?: boolean
  pending?: Promise<void>
  listeners: Set<() => void>
}

/** Read again on its own when shown after this long (unless the entry says otherwise) */
const FRESH_MS = 10_000
const EMPTY: Snapshot = { data: undefined, error: undefined, loaded: false }
const entries = new Map<string, Entry>()

/** The same folder, however its path is written */
export const samePath = (a: string, b: string) => {
  const norm = (p: string) => p.replace(/[\\/]+/g, '/').replace(/\/$/, '').toLowerCase()
  return norm(a) === norm(b)
}

const tell = (e: Entry) => e.listeners.forEach(l => l())

function fetchEntry(e: Entry): Promise<void> {
  if (e.pending) return e.pending
  const asked = e.changes
  e.pending = e.load()
    .then(data => {
      // Changed here while it was on its way: what was written then comes with the next read
      if (e.changes !== asked) { e.at = 0; return }
      e.snap = { data, error: undefined, loaded: true }
      e.at = Date.now()
    }, error => { e.snap = { ...e.snap, error, loaded: true }; e.at = Date.now() })
    .finally(() => {
      e.pending = undefined
      tell(e)
      if (e.again) { e.again = false; e.at = 0; if (e.listeners.size) void fetchEntry(e) }
    })
  return e.pending
}

/** Told changed (by the main process, or refreshLive): read again now when shown, after the read on its way if there is one */
function stale(e: Entry): void {
  e.at = 0
  if (e.pending) e.again = true
  else if (e.listeners.size) void fetchEntry(e)
}

// One listener for the whole window, set the first time some data is kept
let listening = false
function listen(): void {
  if (listening || typeof window === 'undefined' || !window.devforge?.onDataChanged) return
  listening = true
  window.devforge.onDataChanged(({ topic, scope }) => {
    for (const e of entries.values()) {
      if (!e.topics.includes(topic) || (scope && e.scope && !samePath(scope, e.scope))) continue
      // Shown somewhere: read again now; else on its next showing
      stale(e)
    }
  })
}

/** What an entry follows: the topics the main process tells (one or several), whose data, how long it stays fresh */
export interface LiveWatch { topic?: DataTopic | DataTopic[]; scope?: string; freshMs?: number }

function entryFor(key: string, load: () => Promise<unknown>, watch?: LiveWatch): Entry {
  let e = entries.get(key)
  if (!e) {
    const topics = watch?.topic === undefined ? [] : Array.isArray(watch.topic) ? watch.topic : [watch.topic]
    e = { load, snap: EMPTY, at: 0, changes: 0, listeners: new Set(), topics, scope: watch?.scope, freshMs: watch?.freshMs ?? FRESH_MS }
    entries.set(key, e)
    listen()
  }
  // The page's latest way of reading it
  e.load = load
  return e
}

/**
 * Shown somewhere: `cb` hears each new value; read now when never read or
 * no longer fresh. Gives back what stops it.
 */
export function watchLive(key: string, load: () => Promise<unknown>, cb: () => void, watch?: LiveWatch): () => void {
  const entry = entryFor(key, load, watch)
  entry.listeners.add(cb)
  if (!entry.at || Date.now() - entry.at > entry.freshMs) void fetchEntry(entry)
  return () => { entry.listeners.delete(cb) }
}

/** What is kept under `key` now */
export const liveSnapshot = (key: string): Snapshot => entries.get(key)?.snap ?? EMPTY

/** Read `key` again now (the same request when one is already on its way) */
export const reloadLive = (key: string): Promise<void> => {
  const e = entries.get(key)
  return e ? fetchEntry(e) : Promise.resolve()
}

/**
 * The data under `key` (null: none yet), read with `load`, kept between
 * pages and read again when `watch`'s topic changes in the main process.
 */
export function useLive<T>(key: string | null, load: () => Promise<T>, watch?: LiveWatch) {
  // The page's latest way of reading it
  if (key) entryFor(key, load, watch)
  const subscribe = useCallback((cb: () => void) => (key ? watchLive(key, load, cb, watch) : () => {}), [key]) // eslint-disable-line react-hooks/exhaustive-deps
  // The same snapshot on a server render (the menu's tests render the sidebar to a string)
  const read = () => (key ? liveSnapshot(key) : EMPTY)
  const snap = useSyncExternalStore(subscribe, read, read)
  const reload = useCallback(() => (key ? reloadLive(key) : Promise.resolve()), [key])
  return { data: snap.data as T | undefined, error: snap.error, loaded: snap.loaded, reload }
}

/** A change made here shown at once (it is read again when the main process confirms it) */
export function setLive<T>(key: string, change: (data: T | undefined) => T): void {
  const e = entries.get(key)
  if (!e) return
  e.snap = { ...e.snap, data: change(e.snap.data as T | undefined), loaded: true }
  e.changes++
  tell(e)
}

/** Read again everything under a topic, wherever it shows (a change the main process does not announce) */
export function refreshLive(topic: DataTopic): void {
  for (const e of entries.values()) if (e.topics.includes(topic)) stale(e)
}
