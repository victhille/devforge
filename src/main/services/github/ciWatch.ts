import { readFileSync } from 'fs'
import { join } from 'path'
import { app, Notification, type BrowserWindow } from 'electron'
import type { CiStates } from '@shared/types'
import { ciChanges, latestByWorkflow, type CiOutcome } from '@shared/lib/ciAlerts'
import { writeJsonFile } from '../../lib/jsonFile'
import { present } from '../../lib/present'
import { loadProjects } from '../projects/projectStorage'
import { loadSettings } from '../settings/settingsService'
import { latestRuns } from './githubService'

/**
 * v3.8 lot 2: the GitHub CI of the user's projects, watched while the app is
 * open: every 5 minutes, the last finished run of each workflow. One that
 * breaks (green, now red) rings a Windows notification; back to green rings
 * once more. Favourite projects only by default, nothing without a token.
 */

const EVERY = 5 * 60_000
const FIRST = 20_000
const PARALLEL = 4

/** project id → workflow → its last outcome, kept across restarts (no ringing again) */
type Seen = Record<string, Record<string, CiOutcome>>
const file = () => join(app.getPath('userData'), 'ci-watch.json')
function readSeen(): Seen { try { return JSON.parse(readFileSync(file(), 'utf-8')) as Seen } catch { return {} } }

let states: CiStates = {}
let timer: ReturnType<typeof setInterval> | null = null
let busy = false

export const ciStates = (): CiStates => states

function notify(win: BrowserWindow, title: string, body: string, projectId: string): void {
  if (!Notification.isSupported()) return
  const n = new Notification({ title, body })
  // A click opens the project's GitHub tab
  n.on('click', () => {
    if (win.isDestroyed()) return
    present(win)
    win.webContents.send('launcher:to-main', { kind: 'navigate', path: `/project/${projectId}?tab=github` })
  })
  n.show()
}

export async function checkCi(win: BrowserWindow, onStates: (s: CiStates) => void): Promise<CiStates> {
  const mode = loadSettings().ciAlerts ?? 'favorites'
  if (mode === 'off' || busy) return states
  busy = true
  try {
    const seen = readSeen()
    const projects = loadProjects().filter(p => mode === 'all' || p.favorite)
    const next: CiStates = {}
    for (let i = 0; i < projects.length; i += PARALLEL) {
      await Promise.all(projects.slice(i, i + PARALLEL).map(async p => {
        const runs = await latestRuns(p.path).catch(() => null)
        if (!runs) return
        const latest = latestByWorkflow(runs)
        const now = Object.fromEntries(Object.entries(latest).map(([wf, v]) => [wf, v.outcome]))
        const { failed, fixed } = ciChanges(seen[p.id], now)
        for (const wf of failed) notify(win, `✗ ${p.name} · ${wf}`, `GitHub Actions a échoué sur ${latest[wf].branch}`, p.id)
        for (const wf of fixed) notify(win, `✓ ${p.name} · ${wf}`, `De nouveau au vert sur ${latest[wf].branch}`, p.id)
        seen[p.id] = { ...seen[p.id], ...now }
        const failing = Object.entries(latest).filter(([, v]) => v.outcome === 'failure').map(([wf]) => wf)
        next[p.id] = { failing }
      }))
    }
    writeJsonFile(file(), seen, false)
    states = next
    onStates(states)
    return states
  } finally { busy = false }
}

export function startCiWatch(win: BrowserWindow, onStates: (s: CiStates) => void): void {
  const every = !app.isPackaged && Number(process.env.DEVFORGE_TEST_CI_EVERY) > 0 ? Number(process.env.DEVFORGE_TEST_CI_EVERY) : EVERY
  setTimeout(() => { void checkCi(win, onStates) }, Math.min(FIRST, every))
  timer ??= setInterval(() => { void checkCi(win, onStates) }, every)
}

export function stopCiWatch(): void {
  if (timer) clearInterval(timer)
  timer = null
}
