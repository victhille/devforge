import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { AuditSummary, PackageManagerKind, PackageManifest, PackageUpdate } from '@shared/types'
import {
  backupFiles, otherUpdateSteps, parseBundleAudit, parseCargoAudit, parseGovulncheck, parsePipAudit, reinstallCommand, rewriteVersion,
  UPDATABLE, type UpdateContext
} from '@shared/lib/manifestUpdates'
import { quote, runCapture } from '../../lib/exec'
import { findExecutable } from '../../lib/safe'
import { backup, restoreBackup, runLogged, testData, type PackagesBackup } from './npmPackages'
import { otherLatest, registryOf } from './otherPackages'

/**
 * v3.6 lot 1: updating and auditing Python, Rust, Go, Ruby and Dart packages,
 * as npm and Composer are: the files saved first, put back if a step fails.
 * Python always goes through the project's virtual environment.
 */

/** The virtual environment's Python, relative to the folder (commands run there) */
export function venvPython(dir: string): string | null {
  for (const venv of ['.venv', 'venv', 'env']) {
    const win = join(venv, 'Scripts', 'python.exe')
    if (existsSync(join(dir, win))) return win
    const posix = join(venv, 'bin', 'python')
    if (existsSync(join(dir, posix))) return posix
  }
  return null
}

/** The environment's site-packages, relative to the folder (Windows layout, then lib/pythonX.Y) */
function sitePackages(dir: string, python: string): string | null {
  const venv = python.split(/[\\/]/)[0]
  const win = join(venv, 'Lib', 'site-packages')
  if (existsSync(join(dir, win))) return win
  try {
    const py = readdirSync(join(dir, venv, 'lib')).find(n => n.startsWith('python'))
    return py ? join(venv, 'lib', py, 'site-packages') : null
  } catch { return null }
}

const isFlutter =(dir: string) => { try { return /^\s+sdk:\s*flutter/m.test(readFileSync(join(dir, 'pubspec.yaml'), 'utf-8')) } catch { return false } }

/** The program each manager needs, and how to get it */
const TOOL: Partial<Record<PackageManagerKind, { exe: string; install: string }>> = {
  poetry: { exe: 'poetry', install: 'pipx install poetry' },
  uv: { exe: 'uv', install: 'winget install astral-sh.uv' },
  pipenv: { exe: 'pipenv', install: 'pip install --user pipenv' },
  cargo: { exe: 'cargo', install: 'winget install Rustlang.Rustup' },
  go: { exe: 'go', install: 'winget install GoLang.Go' },
  bundler: { exe: 'bundle', install: 'gem install bundler' },
  pub: { exe: 'dart', install: 'winget install Google.DartSDK' }
}

const found = new Map<string, { at: number; path: string | null }>()
/** `where`, remembered a minute (the tab asks for every card) */
async function has(exe: string): Promise<boolean> {
  const c = found.get(exe)
  if (c && Date.now() - c.at < 60_000) return !!c.path
  const path = await findExecutable(exe)
  found.set(exe, { at: Date.now(), path })
  return !!path
}

/** What stops an update here: no virtual environment, or the tool not on this PC */
export async function missingTool(manager: PackageManagerKind, dir: string): Promise<PackageManifest['missingTool']> {
  const test = testData()?.missingTool as string | undefined
  if (test) return { name: test, install: `install ${test}` }
  if (manager === 'pip') return venvPython(dir) ? undefined : { name: '.venv', install: 'python -m venv .venv' }
  const tool = manager === 'pub' && isFlutter(dir) ? { exe: 'flutter', install: 'https://docs.flutter.dev/get-started/install/windows' } : TOOL[manager]
  if (!tool) return undefined
  return (await has(tool.exe)) ? undefined : { name: tool.exe, install: tool.install }
}

/** A command for the shell of the command runner: every part quoted (">=" stays an argument) */
const line = (args: string[]) => args.map(quote).join(' ')

export async function otherUpdate(dir: string, m: Pick<PackageManifest, 'manager' | 'file' | 'packages'>, updates: PackageUpdate[], onLog: (line: string) => void):
  Promise<{ ok: boolean; restored: boolean; backup?: PackagesBackup }> {
  if (!UPDATABLE.includes(m.manager)) throw new Error(`DevForge does not update the packages of ${m.file}`)
  const fake = testData()?.update as string | undefined
  if (!fake) {
    const missing = await missingTool(m.manager, dir)
    if (missing) throw new Error(`TOOL_MISSING:${missing.name}`)
  }
  const registry = registryOf(m.file)
  const latest = updates.some(u => u.target === 'latest') && registry ? await otherLatest(registry, updates.map(u => u.name)) : {}
  const ctx: UpdateContext = {
    python: venvPython(dir) ?? undefined, flutter: isFlutter(dir),
    wanted: Object.fromEntries(m.packages.map(p => [p.name, p.wanted]))
  }
  const steps = fake ? [{ run: fake.split(' ') }] : otherUpdateSteps(m.manager, m.file, updates, latest, ctx)
  if (!steps.length) return { ok: true, restored: false }

  const saved = backup(dir, backupFiles(m.manager, m.file))
  const undo = () => {
    restoreBackup(dir, saved)
    onLog(`↺ ${saved.files.join(', ')} put back as they were`)
    // pip changed the environment already: the old versions back in it
    if (m.manager === 'pip') onLog(`  (the virtual environment keeps the new versions: ${line([ctx.python ?? 'python', '-m', 'pip', 'install', '-r', m.file])} brings the old ones back)`)
  }
  for (const step of steps) {
    if ('rewrite' in step) {
      const path = join(dir, m.file)
      const before = readFileSync(path, 'utf-8')
      const after = rewriteVersion(m.manager, before, step.rewrite.name, step.rewrite.version)
      if (after !== before) { writeFileSync(path, after); onLog(`✎ ${m.file}: ${step.rewrite.name} → ${step.rewrite.version}`) }
      continue
    }
    if (!(await runLogged(fake ?? line(step.run), dir, onLog))) { undo(); return { ok: false, restored: true } }
  }
  return { ok: true, restored: false, backup: saved }
}

/** The command that reinstalls from the files put back (Forgy's undo) */
export function otherReinstall(dir: string, manager: PackageManagerKind, file: string): string | null {
  const args = reinstallCommand(manager, file, venvPython(dir) ?? undefined)
  return args ? line(args) : null
}

// ─── Audits ───────────────────────────────────────────────────────────────────

const AUDIT_TOOL = {
  cargo: { exe: 'cargo-audit', install: 'cargo install cargo-audit' },
  go: { exe: 'govulncheck', install: 'go install golang.org/x/vuln/cmd/govulncheck@latest' },
  bundler: { exe: 'bundle-audit', install: 'gem install bundler-audit' }
} as const

const withMissing = (name: string, install: string): AuditSummary =>
  ({ total: 0, bySeverity: { unknown: 0, info: 0, low: 0, moderate: 0, high: 0, critical: 0 }, packages: {}, missingTool: { name, install } })

/**
 * pip-audit (in the virtual environment, else on the PATH), cargo audit,
 * govulncheck, bundle-audit. null: no audit for this manager (pub) or no
 * report; `missingTool`: the audit tool is not installed.
 */
export async function otherAudit(dir: string, manager: PackageManagerKind, file: string): Promise<AuditSummary | null> {
  const test = testData()?.audit
  if (test !== undefined) return test as AuditSummary | null
  const opts = { cwd: dir, timeout: 180_000 }
  if (['pip', 'poetry', 'uv', 'pipenv'].includes(manager)) {
    const py = venvPython(dir)
    const site = py ? sitePackages(dir, py) : null
    // The project's own pip-audit first, then one on the PATH
    const exe = py && site && existsSync(join(dir, site, 'pip_audit')) ? [py, '-m', 'pip_audit'] : (await has('pip-audit')) ? ['pip-audit'] : null
    if (!exe) return withMissing('pip-audit', py ? line([py, '-m', 'pip', 'install', 'pip-audit']) : 'pip install pip-audit')
    // A requirements file is audited as written; otherwise what the environment holds
    const target = manager === 'pip' && file.endsWith('.txt') ? ['-r', file] : site ? ['--path', site] : []
    if (!target.length) return null
    const r = await runCapture(line([...exe, ...target, '-f', 'json', '--progress-spinner', 'off']), opts)
    return parsePipAudit(r.stdout)
  }
  const tool = AUDIT_TOOL[manager as keyof typeof AUDIT_TOOL]
  if (!tool) return null
  if (!(await has(tool.exe))) return withMissing(tool.exe, tool.install)
  // They exit non-zero when they find something: the report is on stdout either way
  if (manager === 'cargo') return parseCargoAudit((await runCapture('cargo audit --json', opts)).stdout)
  if (manager === 'go') return parseGovulncheck((await runCapture('govulncheck -json ./...', opts)).stdout)
  return parseBundleAudit((await runCapture('bundle-audit check --update --format json', opts)).stdout)
}
