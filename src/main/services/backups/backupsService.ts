import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync } from 'fs'
import { join } from 'path'
import { app, Notification } from 'electron'
import type { BackupCandidates, BackupPlan, BackupRun, BackupState, DbEngine } from '@shared/types'
import { writeJsonFile } from '../../lib/jsonFile'
import { log } from '../../lib/log'
import { runOn, sessionFor } from '../monitor/vpsWatch'
import { sshService } from '../ssh/sshService'
import { shQuote } from '../ssh/sshClient'
import { loadSshConnections } from '../ssh/sshStorage'
import { testOutput } from '../vps/testOutputs'
import { BACKUP_DIR, CRON_TAG, SAFE_FILE, installScript, isTarget, restoreScript, safeName, uninstallScript } from './backupScripts'

/**
 * Nightly backups made by the server itself (cron + backup.sh), followed from
 * DevForge, and a copy of the newest one on this PC while DevForge runs.
 */

const SEP = '@@DF@@'
const NAME_RE = /^[\w.-]{1,128}$/
/** A backup older than this is flagged */
export const STALE_HOURS = 36

interface Store { plans: BackupPlan[]; copies: { connectionId: string; day: string; at: string; error: string | null }[] }
const storePath = () => join(app.getPath('userData'), 'backups.json')
function readStore(): Store {
  try { const s = JSON.parse(readFileSync(storePath(), 'utf-8')) as Partial<Store>; return { plans: s.plans ?? [], copies: s.copies ?? [] } } catch { return { plans: [], copies: [] } }
}
const writeStore = (s: Store) => writeJsonFile(storePath(), s)

const engineOf = (image: string): DbEngine | null => (/postgres|postgis|timescale/i.test(image) ? 'postgres' : /mariadb|mysql/i.test(image) ? 'mariadb' : null)

// ─── What can be backed up ────────────────────────────────────────────────────

/** System paths a container may mount that are no data of its own */
const SYSTEM = /^\/(proc|sys|dev|run|var\/run|lib\/modules|etc|usr|boot|tmp)(\/|$)/

/**
 * `docker inspect` lines "/name|image|type:source;…" plus the folders that
 * exist as directories (a mounted file cannot be archived alone) → what can
 * be backed up.
 */
export function parseCandidates(inspect: string, dirs: Set<string>): BackupCandidates {
  const databases: BackupCandidates['databases'] = []
  const volumes = new Map<string, { kind: 'volume' | 'folder'; usedBy: string[]; databaseData: boolean }>()
  for (const line of inspect.split('\n')) {
    const [rawName = '', image = '', mounts = ''] = line.trim().split('|')
    const container = rawName.replace(/^\//, '')
    if (!container) continue
    const engine = engineOf(image)
    if (engine) databases.push({ container, engine, image })
    for (const m of mounts.split(';')) {
      const i = m.indexOf(':')
      const type = m.slice(0, i), source = m.slice(i + 1)
      if (!source) continue
      // Anonymous volumes (64 hex), system paths, mounted files, sockets are left out
      if (type === 'volume' ? /^[0-9a-f]{64}$/.test(source) : type !== 'bind' || SYSTEM.test(source) || !dirs.has(source)) continue
      if (!isTarget(source)) continue
      const v = volumes.get(source) ?? { kind: type === 'volume' ? 'volume' as const : 'folder' as const, usedBy: [], databaseData: false }
      v.usedBy.push(container)
      if (engine) v.databaseData = true
      volumes.set(source, v)
    }
  }
  return {
    databases: databases.sort((a, b) => a.container.localeCompare(b.container)),
    volumes: [...volumes].map(([name, v]) => ({ name, ...v })).sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name))
  }
}

export const CANDIDATES_SCRIPT = [
  "docker inspect --format '{{.Name}}|{{.Config.Image}}|{{range .Mounts}}{{.Type}}:{{if eq .Type \"volume\"}}{{.Name}}{{else}}{{.Source}}{{end}};{{end}}' $(docker ps -q) 2>/dev/null",
  `echo '${SEP}'`,
  // Which bind sources are folders
  "docker inspect --format '{{range .Mounts}}{{if eq .Type \"bind\"}}{{.Source}}{{\"\\n\"}}{{end}}{{end}}' $(docker ps -q) 2>/dev/null | sort -u | while read -r p; do [ -d \"$p\" ] && echo \"$p\"; done; true"
].join('; ')

export async function candidates(connectionId: string): Promise<BackupCandidates> {
  const [inspect = '', dirs = ''] = (testOutput('backupCandidates') ?? await runOn(connectionId, CANDIDATES_SCRIPT, 30_000)).split(SEP)
  return parseCandidates(inspect, new Set(dirs.split('\n').map(x => x.trim()).filter(Boolean)))
}

// ─── State ────────────────────────────────────────────────────────────────────

export function parseState(out: string, plan: BackupPlan | null, copy: Store['copies'][number] | undefined): BackupState {
  const [statusS = '', cronS = '', filesS = ''] = out.split(SEP).map(x => x.trim())
  let last: BackupRun | null = null
  try { if (statusS) last = JSON.parse(statusS) as BackupRun } catch { /* not yet written, or cut */ }
  const files = filesS.split('\n').map(l => {
    const [path = '', size = '0'] = l.trim().split('|')
    const m = /^(daily|weekly)\/(\d{4}-\d{2}-\d{2})\//.exec(path)
    return m && SAFE_FILE.test(path) ? { path, kind: m[1] as 'daily' | 'weekly', day: m[2]!, size: Number(size) } : null
  }).filter((f): f is NonNullable<typeof f> => !!f).sort((a, b) => b.day.localeCompare(a.day) || a.kind.localeCompare(b.kind) || a.path.localeCompare(b.path))
  return {
    plan, scheduled: Number(cronS) > 0, last, files,
    local: { day: copy?.day ?? null, at: copy?.at ?? null, error: copy?.error ?? null }
  }
}

export async function state(connectionId: string): Promise<BackupState> {
  const s = readStore()
  const out = testOutput('backupState') ?? await runOn(connectionId, [
    `cat ${BACKUP_DIR}/status.json 2>/dev/null || true`,
    `crontab -l 2>/dev/null | grep -c '${CRON_TAG}' || true`,
    `cd ${BACKUP_DIR} 2>/dev/null && find daily weekly -type f -name '*.gz' -printf '%p|%s\\n' 2>/dev/null || true`
  ].join(`; echo '${SEP}'; `), 30_000)
  return parseState(out, s.plans.find(p => p.connectionId === connectionId) ?? null, s.copies.find(c => c.connectionId === connectionId))
}

// ─── Install, run, restore ────────────────────────────────────────────────────

async function stream(connectionId: string, script: string, onLog: (text: string) => void): Promise<boolean> {
  const sid = await sessionFor(connectionId)
  let all = ''
  const code = await sshService.execStream(sid, `bash -lc ${shQuote(script)} 2>&1; echo "${SEP}$?"`, text => {
    all += text
    const clean = text.replace(new RegExp(`${SEP}\\d*\\s*$`), '')
    if (clean) onLog(clean)
  }, 60 * 60_000)
  const m = new RegExp(`${SEP}(\\d+)\\s*$`).exec(all)
  return (m ? Number(m[1]) : code) === 0
}

export function validatePlan(p: Omit<BackupPlan, 'savedAt'>): Omit<BackupPlan, 'savedAt'> {
  if (!/^\d{1,2}:\d{2}$/.test(p.time) || Number(p.time.split(':')[0]) > 23 || Number(p.time.split(':')[1]) > 59) throw new Error('Invalid time')
  const keep = (n: unknown, max: number) => { const v = Math.round(Number(n)); if (!(v >= 1 && v <= max)) throw new Error('Invalid retention'); return v }
  const databases = (p.databases ?? []).filter(d => NAME_RE.test(d.container) && (d.engine === 'postgres' || d.engine === 'mariadb'))
  const volumes = (p.volumes ?? []).filter(isTarget)
  if (!databases.length && !volumes.length) throw new Error('NOTHING_TO_BACKUP')
  return { connectionId: p.connectionId, databases, volumes, time: p.time, keepDaily: keep(p.keepDaily, 60), keepWeekly: keep(p.keepWeekly, 52), localDir: (p.localDir ?? '').trim() }
}

export async function save(raw: Omit<BackupPlan, 'savedAt'>, onLog: (t: string) => void): Promise<{ ok: boolean }> {
  const p = validatePlan(raw)
  const ok = await stream(p.connectionId, installScript(p, p.time), onLog)
  if (ok) {
    const s = readStore()
    s.plans = [...s.plans.filter(x => x.connectionId !== p.connectionId), { ...p, savedAt: new Date().toISOString() }]
    writeStore(s)
    log('info', 'backups', `Nightly backup set on ${p.connectionId} at ${p.time}`)
  }
  return { ok }
}

export async function disable(connectionId: string, onLog: (t: string) => void): Promise<{ ok: boolean }> {
  const ok = await stream(connectionId, uninstallScript(), onLog)
  if (ok) {
    const s = readStore()
    s.plans = s.plans.filter(x => x.connectionId !== connectionId)
    writeStore(s)
  }
  return { ok }
}

export async function runNow(connectionId: string, onLog: (t: string) => void): Promise<{ ok: boolean }> {
  log('info', 'backups', `Backup now on ${connectionId}`)
  return { ok: await stream(connectionId, `bash ${BACKUP_DIR}/backup.sh`, onLog) }
}

/** The target comes from the file name and the saved plan, never from the window */
export async function restore(connectionId: string, path: string, onLog: (t: string) => void): Promise<{ ok: boolean }> {
  if (!SAFE_FILE.test(path)) throw new Error('Invalid backup file')
  const plan = readStore().plans.find(p => p.connectionId === connectionId)
  const m = /\/(db|vol)-([\w.-]+)\.(?:sql|tar)\.gz$/.exec(path)!
  const name = m[2]!
  let script: string
  if (m[1] === 'db') {
    const db = plan?.databases.find(d => d.container === name)
    if (!db) throw new Error('Unknown database')
    script = restoreScript(path, { kind: 'db', engine: db.engine, container: name })
  } else {
    const volume = plan?.volumes.find(v => safeName(v) === name)
    if (!volume) throw new Error('Unknown volume')
    script = restoreScript(path, { kind: 'vol', volume })
  }
  log('info', 'backups', `Restore ${path} on ${connectionId}`)
  return { ok: await stream(connectionId, script, onLog) }
}

// ─── Copy on this PC ──────────────────────────────────────────────────────────

/** A server name as a Windows folder name: no reserved or control characters */
const folderName = (s: string) => [...s].map(ch => (ch.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(ch) ? '-' : ch)).join('').trim() || 'server'

/** The newest successful day not copied yet goes to <localDir>/<server>/<day>/; older days beyond keepDaily go away */
export async function copyLatest(connectionId: string): Promise<{ day: string | null }> {
  const s = readStore()
  const plan = s.plans.find(p => p.connectionId === connectionId)
  if (!plan?.localDir) return { day: null }
  const conn = loadSshConnections().find(c => c.id === connectionId)
  if (!conn) throw new Error('Unknown server')
  const record = (day: string | null, error: string | null) => {
    const st = readStore()
    const prev = st.copies.find(c => c.connectionId === connectionId)
    st.copies = [...st.copies.filter(c => c.connectionId !== connectionId), { connectionId, day: day ?? prev?.day ?? '', at: day ? new Date().toISOString() : prev?.at ?? '', error }]
    writeStore(st)
  }
  try {
    const st = await state(connectionId)
    const day = st.last?.ok ? st.last.day : null
    const root = join(plan.localDir, folderName(conn.name))
    const target = join(root, day ?? '')
    if (!day || (s.copies.find(c => c.connectionId === connectionId)?.day === day && existsSync(target))) return { day: null }
    const files = st.files.filter(f => f.kind === 'daily' && f.day === day)
    const tmp = `${target}.part`
    rmSync(tmp, { recursive: true, force: true })
    mkdirSync(tmp, { recursive: true })
    const sid = await sessionFor(connectionId)
    // SFTP paths are relative to the home folder
    for (const f of files) await sshService.download(sid, `devforge/backups/${f.path}`, join(tmp, f.path.split('/').pop()!))
    rmSync(target, { recursive: true, force: true })
    renameSync(tmp, target)
    for (const old of readdirSync(root).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse().slice(plan.keepDaily)) rmSync(join(root, old), { recursive: true, force: true })
    record(day, null)
    log('info', 'backups', `Backup ${day} of ${connectionId} copied to ${target}`)
    return { day }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    record(null, msg)
    throw err
  }
}

export const localFolder = (connectionId: string): string | null => {
  const plan = readStore().plans.find(p => p.connectionId === connectionId)
  const conn = loadSshConnections().find(c => c.id === connectionId)
  return plan?.localDir && conn ? join(plan.localDir, folderName(conn.name)) : null
}

// ─── While DevForge runs: copy, and warn about a missed or failed night ────────

let timer: ReturnType<typeof setInterval> | null = null
const warned = new Map<string, string>()

async function tick(): Promise<void> {
  for (const plan of readStore().plans) {
    try {
      const st = await state(plan.connectionId)
      const conn = loadSshConnections().find(c => c.id === plan.connectionId)
      const age = st.last ? (Date.now() - new Date(st.last.finishedAt).getTime()) / 3_600_000 : Infinity
      const problem = !st.last ? null : !st.last.ok ? 'failed' : age > STALE_HOURS ? 'stale' : null
      const key = `${problem}:${st.last?.day}`
      if (problem && warned.get(plan.connectionId) !== key && Notification.isSupported()) {
        warned.set(plan.connectionId, key)
        new Notification({
          title: `DevForge · ${conn?.name ?? 'VPS'}`,
          body: problem === 'failed' ? `La sauvegarde du ${st.last!.day} a échoué.` : `Aucune sauvegarde depuis plus de ${STALE_HOURS} h.`
        }).show()
      }
      if (plan.localDir) await copyLatest(plan.connectionId)
    } catch (err) { log('warn', 'backups', `${plan.connectionId}: ${err instanceof Error ? err.message : err}`) }
  }
}

export function startBackupWatch(): void {
  if (timer) return
  setTimeout(() => { tick() }, 90_000)
  timer = setInterval(() => { tick() }, 30 * 60_000)
}

export function stopBackupWatch(): void {
  if (timer) clearInterval(timer)
  timer = null
}
