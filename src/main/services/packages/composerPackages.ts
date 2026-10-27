import { existsSync, readFileSync } from 'fs'
import { join, relative, sep } from 'path'
import type { AuditSeverity, AuditSummary, PackageInfo, PackageManifest, PackageUpdate } from '@shared/types'
import { isPackageName } from '@shared/lib/packages'
import { SAIL_SERVICE, isSailCompose } from '@shared/lib/laravelCommands'
import { runCapture } from '../../lib/exec'
import { backup, findManifestDirs, readJson, restoreBackup, runLogged, testData, type PackagesBackup } from './npmPackages'

/**
 * A project's Composer packages (v3.3 lot 3): the same tab as npm, read from
 * composer.json and vendor/composer/installed.json, Packagist for the latest
 * versions, `composer audit`, and the update in Sail's container when the
 * project runs on Sail.
 */

/** Platform requirements are not packages: php, ext-*, lib-*, composer itself */
const PLATFORM = /^(php(-64bit|-ipv6|-zts|-debug)?|hhvm|composer(-plugin-api|-runtime-api)?|ext-.+|lib-.+)$/i

/** Name → installed version, from Composer's own record ("v1.2.3" read as "1.2.3") */
function installedVersions(dir: string): Record<string, string> {
  const raw = readJson(join(dir, 'vendor', 'composer', 'installed.json'))
  const list = (Array.isArray(raw) ? raw : raw?.packages ?? []) as { name?: string; version?: string }[]
  return Object.fromEntries(list.filter(p => p.name && p.version).map(p => [p.name!, p.version!.replace(/^v/i, '')]))
}

export function readComposerManifest(root: string, dir: string): PackageManifest | null {
  const c = readJson(join(dir, 'composer.json'))
  if (!c) return null
  const installed = installedVersions(dir)
  const packages: PackageInfo[] = []
  for (const [field, dev] of [['require', false], ['require-dev', true]] as const) {
    for (const [name, wanted] of Object.entries((c[field] ?? {}) as Record<string, unknown>)) {
      if (typeof wanted !== 'string' || PLATFORM.test(name) || !isPackageName(name, true)) continue
      packages.push({ name, wanted, installed: installed[name] ?? null, dev })
    }
  }
  packages.sort((a, b) => Number(a.dev) - Number(b.dev) || a.name.localeCompare(b.name))
  return { dir: relative(root, dir).split(sep).join('/'), file: 'composer.json', name: typeof c.name === 'string' ? c.name : null, manager: 'composer', packages }
}

export const listComposerManifests = (root: string): PackageManifest[] =>
  findManifestDirs(root, 'composer.json').map(d => readComposerManifest(root, d)).filter((m): m is PackageManifest => !!m)

// ─── Latest versions (Packagist) ──────────────────────────────────────────────

const latestCache = new Map<string, { at: number; version: string | null }>()
const LATEST_TTL = 10 * 60_000

/** The newest stable version Packagist lists ("v2.1.0" read as "2.1.0") */
export function newestStable(versions: { version?: string }[]): string | null {
  for (const v of versions) {
    const s = String(v.version ?? '').replace(/^v/i, '')
    if (/^\d+(\.\d+){0,3}$/.test(s)) return s
  }
  return null
}

async function fetchLatest(name: string): Promise<string | null> {
  try {
    const res = await fetch(`https://repo.packagist.org/p2/${name}.json`, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return null
    const data = (await res.json()) as { packages?: Record<string, { version?: string }[]> }
    return newestStable(data.packages?.[name] ?? [])
  } catch { return null }
}

export async function composerLatest(names: string[]): Promise<Record<string, string | null>> {
  const test = testData()?.latest as Record<string, string> | undefined
  const wanted = [...new Set(names.filter(n => isPackageName(n, true)))]
  if (test) return Object.fromEntries(wanted.map(n => [n, test[n] ?? null]))
  const out: Record<string, string | null> = {}
  const todo = wanted.filter(n => {
    const c = latestCache.get(n)
    if (c && Date.now() - c.at < LATEST_TTL) { out[n] = c.version; return false }
    return true
  })
  for (let i = 0; i < todo.length; i += 8) {
    await Promise.all(todo.slice(i, i + 8).map(async n => {
      const v = await fetchLatest(n)
      latestCache.set(n, { at: Date.now(), version: v })
      out[n] = v
    }))
  }
  return out
}

// ─── Commands: on this PC, or in Sail's container ─────────────────────────────

const read = (path: string) => { try { return readFileSync(path, 'utf-8') } catch { return '' } }
export const isSail = (dir: string) => isSailCompose(read(join(dir, 'compose.yaml')) || read(join(dir, 'docker-compose.yml')))
export const composer = (dir: string, args: string) => isSail(dir) ? `docker compose exec -T -u sail ${SAIL_SERVICE} composer ${args}` : `composer ${args}`

/** Composer on this PC (a Sail project brings its own) */
export async function composerAvailable(dir: string): Promise<boolean> {
  if (testData()?.composerMissing) return false
  if (isSail(dir)) return true
  return (await runCapture('composer --version', { cwd: dir, timeout: 20_000 })).ok
}

// ─── Audit ────────────────────────────────────────────────────────────────────

const SEVERITIES: AuditSeverity[] = ['info', 'low', 'moderate', 'high', 'critical']

/** `composer audit --format=json`: advisories per package; a missing severity counts as moderate */
export function parseComposerAudit(json: string): AuditSummary | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let r: any
  try { r = JSON.parse(json) } catch { return null }
  if (!r || typeof r !== 'object' || !('advisories' in r)) return null
  const s: AuditSummary = { total: 0, bySeverity: { info: 0, low: 0, moderate: 0, high: 0, critical: 0 }, packages: {} }
  // An empty result comes as [] instead of {}
  for (const [name, list] of Object.entries((Array.isArray(r.advisories) ? {} : r.advisories) as Record<string, { severity?: string | null }[]>)) {
    for (const a of Object.values(list ?? {})) {
      const sev: AuditSeverity = SEVERITIES.includes(a?.severity as AuditSeverity) ? a.severity as AuditSeverity : 'moderate'
      s.bySeverity[sev]++
      s.total++
      const prev = s.packages[name]
      if (!prev || SEVERITIES.indexOf(sev) > SEVERITIES.indexOf(prev)) s.packages[name] = sev
    }
  }
  return s
}

export async function composerAudit(dir: string): Promise<AuditSummary | null> {
  const test = testData()?.audit
  if (test !== undefined) return test as AuditSummary | null
  if (!existsSync(join(dir, 'composer.lock'))) return null
  // Exits non-zero when it finds something: the report is on stdout either way
  const r = await runCapture(composer(dir, 'audit --format=json --no-interaction'), { cwd: dir, timeout: 120_000 })
  return parseComposerAudit(r.stdout)
}

// ─── Update ───────────────────────────────────────────────────────────────────

/**
 * Within the constraint: `composer update <names> --with-dependencies`.
 * To the latest: `composer require <name>:^<latest>` (dev ones apart), which
 * rewrites the constraint.
 */
export function composerCommands(updates: PackageUpdate[], latest: Record<string, string | null>, sail = false): string[] {
  const ok = updates.filter(u => isPackageName(u.name, true))
  const run = (args: string) => sail ? `docker compose exec -T -u sail ${SAIL_SERVICE} composer ${args}` : `composer ${args}`
  const cmds: string[] = []
  const compatible = ok.filter(u => u.target === 'compatible').map(u => u.name)
  if (compatible.length) cmds.push(run(`update ${compatible.join(' ')} --with-dependencies --no-interaction`))
  for (const dev of [false, true]) {
    const list = ok.filter(u => u.target === 'latest' && u.dev === dev && /^\d+(\.\d+)*$/.test(latest[u.name] ?? ''))
      .map(u => `${u.name}:^${latest[u.name]}`)
    if (list.length) cmds.push(run(`require ${list.join(' ')}${dev ? ' --dev' : ''} --no-interaction`))
  }
  return cmds
}

export async function composerUpdate(dir: string, updates: PackageUpdate[], onLog: (line: string) => void): Promise<{ ok: boolean; restored: boolean; backup?: PackagesBackup }> {
  const fake = testData()?.update as string | undefined
  if (!fake && !(await composerAvailable(dir))) throw new Error('COMPOSER_MISSING')
  const latest = updates.some(u => u.target === 'latest') ? await composerLatest(updates.map(u => u.name)) : {}
  const cmds = fake ? [fake] : composerCommands(updates, latest, isSail(dir))
  if (!cmds.length) return { ok: true, restored: false }
  const saved = backup(dir, ['composer.json', 'composer.lock'])
  for (const cmd of cmds) {
    if (!(await runLogged(cmd, dir, onLog))) {
      restoreBackup(dir, saved)
      onLog('↺ composer.json and composer.lock put back as they were')
      return { ok: false, restored: true }
    }
  }
  return { ok: true, restored: false, backup: saved }
}
