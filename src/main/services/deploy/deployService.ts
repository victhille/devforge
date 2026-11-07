import { existsSync, readFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { randomUUID } from 'crypto'
import { app } from 'electron'
import type { DeployRun, DeployTarget } from '@shared/types'
import { getSshConnectionWithSecret } from '../ssh/sshStorage'
import { sshService } from '../ssh/sshService'
import { gitPush } from '../git/gitRepo'
import { shQuote as shq } from '../ssh/sshClient'
import { writeJsonFile } from '../../lib/jsonFile'

const MAX_LOG = 100_000
const MAX_RUNS = 20

interface Store { targets: DeployTarget[]; runs: DeployRun[] }

function storePath(): string {
  return join(app.getPath('userData'), 'deploy.json')
}

function load(): Store {
  const p = storePath()
  if (!existsSync(p)) return { targets: [], runs: [] }
  try { return { targets: [], runs: [], ...JSON.parse(readFileSync(p, 'utf-8')) } } catch { return { targets: [], runs: [] } }
}

function persist(store: Store): void {
  const p = storePath()
  mkdirSync(dirname(p), { recursive: true })
  writeJsonFile(p, store)
}

export const listTargets = () => load().targets

export function saveTarget(target: DeployTarget): void {
  const store = load()
  const i = store.targets.findIndex(t => t.id === target.id)
  if (i >= 0) store.targets[i] = target; else store.targets.push(target)
  persist(store)
}

export function removeTarget(id: string): void {
  const store = load()
  persist({ targets: store.targets.filter(t => t.id !== id), runs: store.runs.filter(r => r.targetId !== id) })
}

export const history = (targetId: string) =>
  load().runs.filter(r => r.targetId === targetId).sort((a, b) => b.startedAt.localeCompare(a.startedAt))

function saveRun(run: DeployRun): void {
  const store = load()
  const others = store.runs.filter(r => r.id !== run.id)
  const sameTarget = others.filter(r => r.targetId === run.targetId).sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  const keep = new Set(sameTarget.slice(0, MAX_RUNS - 1).map(r => r.id))
  store.runs = [...others.filter(r => r.targetId !== run.targetId || keep.has(r.id)), run]
  persist(store)
}

/**
 * Remote command: login shell (so nvm / pm2 / composer are on PATH),
 * stop at the first failing line, echo each command before running it.
 */
export function buildRemoteCommand(target: DeployTarget): string {
  const lines = target.script.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'))
  const body = ['set -e', `cd ${shq(target.remotePath)}`, ...lines.flatMap(l => [`echo ${shq('$ ' + l)}`, l])].join('\n')
  return `bash -lc ${shq(body)}`
}

type LogCb = (e: { runId: string; text: string }) => void
type StatusCb = (run: DeployRun) => void

let onLog: LogCb = () => {}
let onStatus: StatusCb = () => {}
export function setDeployCallbacks(log: LogCb, status: StatusCb): void { onLog = log; onStatus = status }

export async function runDeploy(targetId: string): Promise<string> {
  const target = load().targets.find(t => t.id === targetId)
  if (!target) throw new Error('Unknown deploy target')

  const run: DeployRun = {
    id: randomUUID(), targetId, status: 'running',
    startedAt: new Date().toISOString(), finishedAt: null, exitCode: null, log: ''
  }
  const write = (text: string) => {
    run.log = (run.log + text).slice(-MAX_LOG)
    onLog({ runId: run.id, text })
  }
  onStatus({ ...run })

  // Runs in the background; the renderer follows through events
  ;(async () => {
    let sessionId: string | null = null
    try {
      if (target.pushFirst && target.projectPath) {
        write(`▸ git push (${target.projectPath})\n`)
        const push = await gitPush(target.projectPath)
        write(push.output + '\n')
        if (!push.ok) throw new Error('git push failed')
      }

      const conn = getSshConnectionWithSecret(target.connectionId)
      if (!conn) throw new Error('SSH connection not found')
      write(`▸ ssh ${conn.username}@${conn.host}\n`)
      sessionId = await sshService.connectForDashboard(conn)

      run.exitCode = await sshService.execStream(sessionId, buildRemoteCommand(target), write)
      run.status = run.exitCode === 0 ? 'success' : 'failed'
      write(`\n▸ exit code ${run.exitCode}\n`)
    } catch (err) {
      run.status = 'failed'
      write(`\n✗ ${err instanceof Error ? err.message : String(err)}\n`)
    } finally {
      if (sessionId) sshService.disconnect(sessionId)
      run.finishedAt = new Date().toISOString()
      saveRun(run)
      onStatus({ ...run })
    }
  })()

  return run.id
}
