import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { app, Notification } from 'electron'
import type { Monitor, MonitorCheck, MonitorState } from '@shared/types'
import { loadSettings } from '../settings/settingsService'

const MAX_CHECKS = 60
const MIN_INTERVAL = 30
const TIMEOUT_MS = 10_000

interface Persisted { monitors: Monitor[]; states: MonitorState[] }

const states = new Map<string, MonitorState>()
const timers = new Map<string, NodeJS.Timeout>()
let monitors: Monitor[] = []
let onState: (s: MonitorState) => void = () => {}

function storePath(): string {
  return join(app.getPath('userData'), 'monitors.json')
}

function persist(): void {
  const p = storePath()
  mkdirSync(dirname(p), { recursive: true })
  const data: Persisted = { monitors, states: [...states.values()] }
  writeFileSync(p, JSON.stringify(data), 'utf-8')
}

function stateOf(id: string): MonitorState {
  let s = states.get(id)
  if (!s) { s = { id, status: 'unknown', checks: [], since: null }; states.set(id, s) }
  return s
}

function notifTitle(name: string, status: 'up' | 'down'): string {
  const fr = loadSettings().language === 'fr'
  if (status === 'down') return fr ? `🔴 ${name} est hors ligne` : `🔴 ${name} is down`
  return fr ? `🟢 ${name} est de nouveau en ligne` : `🟢 ${name} is back up`
}

/** fetch errors hide the useful part (ECONNREFUSED, ENOTFOUND…) in `cause` */
function describeError(err: unknown): string {
  type E = Error & { code?: string; cause?: unknown; errors?: E[] }
  const e = err as E
  const cause = e.cause as E | undefined
  const inner = cause?.errors?.[0] ?? cause
  return inner?.code ?? (inner?.message || e.message || 'Request failed')
}

async function probe(m: Monitor): Promise<MonitorCheck> {
  const start = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(m.url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'DevForge-Monitor/1.0' }
    })
    let ok = res.status < 400
    let error: string | undefined
    if (ok && m.keyword) {
      const body = await res.text()
      if (!body.includes(m.keyword)) { ok = false; error = `Keyword "${m.keyword}" not found` }
    }
    return { at: new Date().toISOString(), ok, latency: Date.now() - start, statusCode: res.status, error: ok ? undefined : error ?? `HTTP ${res.status}` }
  } catch (err) {
    const message = controller.signal.aborted ? `Timeout after ${TIMEOUT_MS / 1000}s` : describeError(err)
    return { at: new Date().toISOString(), ok: false, latency: null, statusCode: null, error: message }
  } finally {
    clearTimeout(timer)
  }
}

export async function check(id: string): Promise<MonitorState> {
  const m = monitors.find(x => x.id === id)
  if (!m) throw new Error('Unknown monitor')
  const result = await probe(m)
  const s = stateOf(id)
  const next = result.ok ? 'up' : 'down'

  // Notify only on real transitions (not on the very first check)
  if (s.status !== next) {
    if (s.status !== 'unknown' && Notification.isSupported()) {
      new Notification({
        title: notifTitle(m.name, next),
        body: next === 'down' ? `${m.url}\n${result.error ?? ''}` : `${m.url} — ${result.latency} ms`
      }).show()
    }
    s.status = next
    s.since = result.at
  }
  s.checks = [result, ...s.checks].slice(0, MAX_CHECKS)
  onState({ ...s })
  persist()
  return { ...s }
}

function schedule(m: Monitor): void {
  clearInterval(timers.get(m.id))
  timers.delete(m.id)
  if (!m.enabled) return
  const every = Math.max(MIN_INTERVAL, m.intervalSec) * 1000
  timers.set(m.id, setInterval(() => { check(m.id).catch(() => {}) }, every))
  check(m.id).catch(() => {})
}

export function startMonitors(cb: (s: MonitorState) => void): void {
  onState = cb
  const p = storePath()
  if (existsSync(p)) {
    try {
      const data = JSON.parse(readFileSync(p, 'utf-8')) as Persisted
      monitors = data.monitors ?? []
      for (const s of data.states ?? []) states.set(s.id, s)
    } catch { /* start fresh */ }
  }
  monitors.forEach(schedule)
}

export const listMonitors = () => monitors
export const listStates = () => monitors.map(m => ({ ...stateOf(m.id) }))

export function saveMonitor(m: Monitor): void {
  if (!/^https?:\/\//i.test(m.url)) throw new Error('URL must start with http:// or https://')
  const i = monitors.findIndex(x => x.id === m.id)
  if (i >= 0) {
    // URL changed: old history no longer meaningful
    if (monitors[i].url !== m.url) states.delete(m.id)
    monitors[i] = m
  } else {
    monitors.push(m)
  }
  persist()
  schedule(m)
}

export function removeMonitor(id: string): void {
  clearInterval(timers.get(id))
  timers.delete(id)
  monitors = monitors.filter(m => m.id !== id)
  states.delete(id)
  persist()
}

export function stopMonitors(): void {
  for (const t of timers.values()) clearInterval(t)
  timers.clear()
}
