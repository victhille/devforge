import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'fs'
import { dirname, join, relative, resolve, sep } from 'path'
import { app } from 'electron'
import type { AuditSeverity, AuditSummary, PackageInfo, PackageManagerKind, PackageManifest, PackageUpdate } from '@shared/types'
import { isPackageName } from '@shared/lib/packages'
import { runCapture } from '../../lib/exec'
import { assertSafeDir } from '../../lib/safe'
import { commandRunner } from '../system/commandRunner'

/**
 * A project's npm packages (v3.3 lot 2): what each package.json declares,
 * what is installed, what is published, the known vulnerabilities, and the
 * update, saved first and put back if it fails. Nothing updates by itself.
 */

const SKIP = new Set(['node_modules', '.git', 'vendor', 'dist', 'out', 'build', '.next', '.nuxt', 'coverage', '.turbo'])
const LOCKFILES = ['package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock']

/** Folders holding a package.json, the project's root first, 3 levels deep at most */
export function findManifestDirs(root: string, file = 'package.json', depth = 3): string[] {
  const found: string[] = []
  const walk = (dir: string, level: number) => {
    if (existsSync(join(dir, file))) found.push(dir)
    if (level >= depth) return
    let entries: string[]
    try { entries = readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory() && !SKIP.has(e.name) && !e.name.startsWith('.')).map(e => e.name) } catch { return }
    for (const e of entries.sort()) walk(join(dir, e), level + 1)
  }
  walk(root, 0)
  return found
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function readJson(path: string): Record<string, any> | null {
  try { return JSON.parse(readFileSync(path, 'utf-8')) } catch { return null }
}

/** The lockfile next to the manifest, or the nearest one up to the project's root (workspaces) */
export function managerOf(dir: string, root: string): PackageManagerKind {
  for (let d = dir; ; d = dirname(d)) {
    if (existsSync(join(d, 'pnpm-lock.yaml'))) return 'pnpm'
    if (existsSync(join(d, 'yarn.lock'))) return 'yarn'
    if (existsSync(join(d, 'package-lock.json'))) return 'npm'
    const declared = String(readJson(join(d, 'package.json'))?.packageManager ?? '')
    if (/^(pnpm|yarn|npm)@/.test(declared)) return declared.split('@')[0] as PackageManagerKind
    if (resolve(d) === resolve(root) || dirname(d) === d) return 'npm'
  }
}

/** Installed version: node_modules next to the manifest, then up to the project's root (hoisted workspaces) */
function installedVersion(dir: string, root: string, name: string): string | null {
  for (let d = dir; ; d = dirname(d)) {
    const v = readJson(join(d, 'node_modules', ...name.split('/'), 'package.json'))?.version
    if (typeof v === 'string') return v
    if (resolve(d) === resolve(root) || dirname(d) === d) return null
  }
}

export function readManifest(root: string, dir: string): PackageManifest | null {
  const pkg = readJson(join(dir, 'package.json'))
  if (!pkg) return null
  const packages: PackageInfo[] = []
  for (const [field, dev] of [['dependencies', false], ['devDependencies', true]] as const) {
    for (const [name, wanted] of Object.entries((pkg[field] ?? {}) as Record<string, unknown>)) {
      if (typeof wanted !== 'string' || !isPackageName(name)) continue
      packages.push({ name, wanted, installed: installedVersion(dir, root, name), dev })
    }
  }
  packages.sort((a, b) => Number(a.dev) - Number(b.dev) || a.name.localeCompare(b.name))
  return { dir: relative(root, dir).split(sep).join('/'), file: 'package.json', name: typeof pkg.name === 'string' ? pkg.name : null, manager: managerOf(dir, root), packages }
}

export function listManifests(root: string): PackageManifest[] {
  return findManifestDirs(root).map(d => readManifest(root, d)).filter((m): m is PackageManifest => !!m)
}

/** A manifest folder given by the window: inside the project, holding that manifest, and safe for a shell */
export function manifestDir(root: string, dir: string, file: 'package.json' | 'composer.json' = 'package.json'): string {
  const full = resolve(root, dir || '.')
  const rel = relative(resolve(root), full)
  if (rel.startsWith('..') || resolve(rel) === rel) throw new Error('Invalid folder')
  if (!existsSync(join(full, file))) throw new Error(`No ${file} here`)
  return assertSafeDir(full)
}

// ─── Latest versions ──────────────────────────────────────────────────────────

/** End-to-end tests: DEVFORGE_TEST_PACKAGES names a JSON file of { latest, audit, update } */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function testData(): Record<string, any> | null {
  const file = process.env.DEVFORGE_TEST_PACKAGES
  if (!file || app.isPackaged) return null
  return readJson(file)
}

const latestCache = new Map<string, { at: number; version: string | null }>()
const LATEST_TTL = 10 * 60_000

/** The registry of the folder's .npmrc, the public one otherwise */
function registryOf(dir: string): string {
  for (let d = dir; ; d = dirname(d)) {
    try {
      const m = readFileSync(join(d, '.npmrc'), 'utf-8').match(/^\s*registry\s*=\s*(https?:\/\/\S+)/m)
      if (m) return m[1].replace(/\/?$/, '/')
    } catch { /* none here */ }
    if (dirname(d) === d) return 'https://registry.npmjs.org/'
  }
}

async function fetchLatest(registry: string, name: string): Promise<string | null> {
  try {
    const res = await fetch(`${registry}${name.replace('/', '%2f')}`, {
      headers: { accept: 'application/vnd.npm.install-v1+json' }, signal: AbortSignal.timeout(10_000)
    })
    if (!res.ok) return null
    const v = ((await res.json()) as { 'dist-tags'?: { latest?: string } })['dist-tags']?.latest
    return typeof v === 'string' ? v : null
  } catch { return null }
}

export async function latestVersions(dir: string, names: string[]): Promise<Record<string, string | null>> {
  const test = testData()?.latest as Record<string, string> | undefined
  const wanted = [...new Set(names.filter(n => isPackageName(n)))]
  if (test) return Object.fromEntries(wanted.map(n => [n, test[n] ?? null]))
  const registry = registryOf(dir)
  const out: Record<string, string | null> = {}
  const todo = wanted.filter(n => {
    const c = latestCache.get(registry + n)
    if (c && Date.now() - c.at < LATEST_TTL) { out[n] = c.version; return false }
    return true
  })
  // 8 at a time: quick, without hammering the registry
  for (let i = 0; i < todo.length; i += 8) {
    await Promise.all(todo.slice(i, i + 8).map(async n => {
      const v = await fetchLatest(registry, n)
      latestCache.set(registry + n, { at: Date.now(), version: v })
      out[n] = v
    }))
  }
  return out
}

// ─── Audit ────────────────────────────────────────────────────────────────────

const SEVERITIES: AuditSeverity[] = ['info', 'low', 'moderate', 'high', 'critical']
const worse = (a: AuditSeverity | undefined, b: AuditSeverity) => !a || SEVERITIES.indexOf(b) > SEVERITIES.indexOf(a) ? b : a
const emptySummary = (): AuditSummary => ({ total: 0, bySeverity: { info: 0, low: 0, moderate: 0, high: 0, critical: 0 }, packages: {} })
const isSeverity = (s: unknown): s is AuditSeverity => SEVERITIES.includes(s as AuditSeverity)

/** npm 7+ (`vulnerabilities`) and pnpm (`advisories`) JSON reports */
export function parseAudit(json: string): AuditSummary | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let r: any
  try { r = JSON.parse(json) } catch { return null }
  const meta = r?.metadata?.vulnerabilities
  if (!meta || typeof meta !== 'object') return null
  const s = emptySummary()
  for (const k of SEVERITIES) s.bySeverity[k] = Number(meta[k] ?? 0)
  s.total = SEVERITIES.reduce((n, k) => n + s.bySeverity[k], 0)
  for (const [name, v] of Object.entries(r.vulnerabilities ?? {}) as [string, { severity?: unknown }][]) {
    if (isSeverity(v.severity)) s.packages[name] = worse(s.packages[name], v.severity)
  }
  for (const v of Object.values(r.advisories ?? {}) as { module_name?: string; severity?: unknown }[]) {
    if (v.module_name && isSeverity(v.severity)) s.packages[v.module_name] = worse(s.packages[v.module_name], v.severity)
  }
  return s
}

/** yarn 1: one JSON object per line, the summary in "auditSummary" */
export function parseYarnAudit(ndjson: string): AuditSummary | null {
  const s = emptySummary()
  let seen = false
  for (const line of ndjson.split('\n')) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let o: any
    try { o = JSON.parse(line) } catch { continue }
    if (o.type === 'auditAdvisory') {
      const a = o.data?.advisory
      if (a?.module_name && isSeverity(a.severity)) s.packages[a.module_name] = worse(s.packages[a.module_name], a.severity)
    } else if (o.type === 'auditSummary') {
      seen = true
      for (const k of SEVERITIES) s.bySeverity[k] = Number(o.data?.vulnerabilities?.[k] ?? 0)
      s.total = SEVERITIES.reduce((n, k) => n + s.bySeverity[k], 0)
    }
  }
  return seen ? s : null
}

export const isYarnBerry = (dir: string, root: string) => {
  for (let d = dir; ; d = dirname(d)) {
    if (existsSync(join(d, '.yarnrc.yml'))) return true
    if (/^yarn@[2-9]/.test(String(readJson(join(d, 'package.json'))?.packageManager ?? ''))) return true
    if (resolve(d) === resolve(root) || dirname(d) === d) return false
  }
}

export async function audit(root: string, dir: string, manager: PackageManagerKind): Promise<AuditSummary | null> {
  const test = testData()?.audit
  if (test !== undefined) return test as AuditSummary | null
  if (manager === 'yarn') {
    if (isYarnBerry(dir, root)) return null
    const r = await runCapture('yarn audit --json', { cwd: dir, timeout: 120_000 })
    return parseYarnAudit(r.stdout)
  }
  // Exits non-zero when it finds something: the report is on stdout either way
  const r = await runCapture(`${manager} audit --json`, { cwd: dir, timeout: 120_000 })
  return parseAudit(r.stdout)
}

// ─── Update ───────────────────────────────────────────────────────────────────

/** The commands of an update, per manager; names checked, nothing else from outside */
/** Reinstalls from the manifest and lockfile (after putting saved ones back) */
export const installCommand = (manager: PackageManagerKind): string =>
  manager === 'pnpm' ? 'pnpm install' : manager === 'yarn' ? 'yarn install' : 'npm install'

export function updateCommands(manager: PackageManagerKind, updates: PackageUpdate[], berry = false): string[] {
  const ok = updates.filter(u => isPackageName(u.name))
  const names = (list: PackageUpdate[]) => list.map(u => u.name).join(' ')
  const compatible = ok.filter(u => u.target === 'compatible')
  const latest = (dev: boolean) => ok.filter(u => u.target === 'latest' && u.dev === dev).map(u => `${u.name}@latest`).join(' ')
  const cmds: string[] = []
  if (compatible.length) {
    cmds.push(manager === 'pnpm' ? `pnpm update ${names(compatible)}`
      : manager === 'yarn' ? (berry ? `yarn up -R ${names(compatible)}` : `yarn upgrade ${names(compatible)}`)
      : `npm update ${names(compatible)}`)
  }
  for (const dev of [false, true]) {
    const list = latest(dev)
    if (!list) continue
    cmds.push(manager === 'pnpm' ? `pnpm add ${list}${dev ? ' -D' : ''}`
      : manager === 'yarn' ? (berry ? `yarn up ${list}` : `yarn add ${list}${dev ? ' --dev' : ''}`)
      : `npm install ${list}${dev ? ' --save-dev' : ''}`)
  }
  return cmds
}

/** What an update saved before running: where, and which files */
export interface PackagesBackup { store: string; files: string[] }

/** Copies the manifest and the lockfiles beside it */
export function backup(dir: string, names = ['package.json', ...LOCKFILES]): PackagesBackup {
  const store = join(app.getPath('userData'), 'backups', 'packages', new Date().toISOString().replace(/[:.]/g, '-'))
  mkdirSync(store, { recursive: true })
  const files = names.filter(f => existsSync(join(dir, f)))
  for (const f of files) copyFileSync(join(dir, f), join(store, f))
  return { store, files }
}

/** Puts the saved files back in the manifest's folder */
export function restoreBackup(dir: string, saved: PackagesBackup): void {
  for (const f of saved.files) {
    if (!/^[\w.-]+$/.test(f)) continue
    copyFileSync(join(saved.store, f), join(dir, f))
  }
}

export function runLogged(command: string, cwd: string, onLog: (line: string) => void): Promise<boolean> {
  return new Promise(res => {
    const [exe, ...args] = command.split(' ')
    commandRunner.run({
      executable: exe, args, cwd,
      onLog: l => onLog(l.text),
      onResult: r => res(r.status === 'success')
    })
  })
}

export async function update(root: string, dir: string, manager: PackageManagerKind, updates: PackageUpdate[], onLog: (line: string) => void): Promise<{ ok: boolean; restored: boolean; backup?: PackagesBackup }> {
  const fake = testData()?.update as string | undefined
  const cmds = fake ? [fake] : updateCommands(manager, updates, manager === 'yarn' && isYarnBerry(dir, root))
  if (!cmds.length) return { ok: true, restored: false }
  const saved = backup(dir)
  for (const cmd of cmds) {
    if (!(await runLogged(cmd, dir, onLog))) {
      restoreBackup(dir, saved)
      onLog('↺ package.json and lockfile put back as they were')
      return { ok: false, restored: true }
    }
  }
  return { ok: true, restored: false, backup: saved }
}
