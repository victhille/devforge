import type { AuditSeverity, AuditSummary, PackageManagerKind, PackageUpdate } from '../types/packages'
import { fitsRange } from './packages'
import { satisfies } from './semver'
import { pyName } from './manifests'

/**
 * v3.6 lot 1: updating and auditing the packages of Python, Rust, Go, Ruby
 * and Dart projects. Pure functions (the main process runs what they write):
 * each language's ranges read as npm ones, the commands of an update, the
 * version rewritten in a file, the audit reports read.
 */

// ─── Ranges ───────────────────────────────────────────────────────────────────

const bump = (v: string, at: 0 | 1) => {
  const p = v.split('.').map(Number)
  return at === 0 ? `${(p[0] || 0) + 1}.0.0` : `${p[0] || 0}.${(p[1] || 0) + 1}.0`
}

/** "~= 1.4" (Python) and "~> 1.4" (Ruby): 1.4 up to 2.0; with three numbers, 1.4.2 up to 1.5 */
const pessimistic = (v: string) => {
  const n = v.split('.').length
  return n <= 1 ? `>=${v}` : `>=${v} <${bump(v, n === 2 ? 0 : 1)}`
}

/** PEP 440 specifiers as npm comparators ("!=" cannot be said: left out) */
export function pythonRange(spec: string): string {
  if (!spec || spec === '*') return '*'
  return spec.split(',').map(s => s.trim()).filter(Boolean).map(s => {
    const m = s.match(/^(===|==|~=|!=|>=|<=|>|<)\s*(.+)$/)
    if (!m) return s
    const [, op, v] = m
    if (op === '!=') return ''
    if (op === '~=') return pessimistic(v)
    if ((op === '==' || op === '===') && v.endsWith('.*')) { const base = v.slice(0, -2); return `>=${base} <${bump(base, base.split('.').length === 1 ? 0 : 1)}` }
    if (op === '==' || op === '===') return `=${v}`
    return `${op}${v}`
  }).filter(Boolean).join(' ') || '*'
}

/** Cargo: a bare "1.2" means "^1.2" */
export const cargoRange = (req: string) =>
  req.split(',').map(s => s.trim()).filter(Boolean).map(s => (/^\d/.test(s) ? `^${s}` : s)).join(' ') || '*'

/** Bundler: "~> 7.1", ">= 6, < 8" */
export const rubyRange = (req: string) =>
  req.split(',').map(s => s.trim()).filter(Boolean).map(s => {
    const m = s.match(/^(~>|>=|<=|>|<|=|!=)?\s*(\S+)$/)
    if (!m) return s
    return m[1] === '~>' ? pessimistic(m[2]) : m[1] === '!=' ? '' : `${m[1] ?? '='}${m[2]}`
  }).filter(Boolean).join(' ') || '*'

/** Whether `version` stays within what the file asks for, for each manager */
export function fitsRangeOf(manager: PackageManagerKind, version: string | null, range: string): boolean {
  if (!version) return false
  switch (manager) {
    case 'pip': case 'poetry': case 'uv': case 'pipenv':
      // Poetry writes npm-like ranges (^1.2); the others PEP 440
      return /^[\^~]\d/.test(range.trim()) ? fitsRange(version, range) : satisfies(version, pythonRange(range)) === true
    case 'cargo': return satisfies(version, cargoRange(range)) === true
    case 'bundler': return satisfies(version, rubyRange(range)) === true
    case 'pub': return range === 'any' || fitsRange(version, range)
    // A module's major version is another module path: @latest stays within it
    case 'go': return true
    default: return fitsRange(version, range)
  }
}

// ─── Updates ──────────────────────────────────────────────────────────────────

/** The managers DevForge updates (NuGet, Maven and Gradle stay read only) */
export const UPDATABLE: PackageManagerKind[] = ['pip', 'poetry', 'uv', 'pipenv', 'cargo', 'go', 'bundler', 'pub']

/** Names as they may reach a command line: no spaces nor shell characters */
const SAFE = /^[A-Za-z0-9][A-Za-z0-9._\-/@]*$/
const SAFE_VERSION = /^\d+(\.\d+)*$/

/** The files an update may change, saved before it runs */
export function backupFiles(manager: PackageManagerKind, file: string): string[] {
  switch (manager) {
    case 'pip': return [file]
    case 'poetry': return ['pyproject.toml', 'poetry.lock']
    case 'uv': return ['pyproject.toml', 'uv.lock']
    case 'pipenv': return ['Pipfile', 'Pipfile.lock']
    case 'cargo': return ['Cargo.toml', 'Cargo.lock']
    case 'go': return ['go.mod', 'go.sum']
    case 'bundler': return ['Gemfile', 'Gemfile.lock']
    case 'pub': return ['pubspec.yaml', 'pubspec.lock']
    default: return []
  }
}

export interface UpdateContext {
  /** The virtual environment's Python, relative to the file's folder (".venv\\Scripts\\python.exe") */
  python?: string
  /** A Flutter project: `flutter pub`, not `dart pub` */
  flutter?: boolean
  /** The wanted ranges, by name (pip: what `pip install -U` keeps to) */
  wanted?: Record<string, string>
}

/** A step: a command (program and its arguments), or a file to rewrite before the next one */
export type UpdateStep =
  | { run: string[] }
  | { rewrite: { name: string; version: string } }

/**
 * The steps of an update. "compatible": the newest version within the file's
 * range; "latest": the latest published one, the file's range rewritten.
 */
export function otherUpdateSteps(manager: PackageManagerKind, file: string, updates: PackageUpdate[], latest: Record<string, string | null>, ctx: UpdateContext = {}): UpdateStep[] {
  const ok = updates.filter(u => SAFE.test(u.name))
  const compatible = ok.filter(u => u.target === 'compatible')
  const toLatest = ok.filter(u => u.target === 'latest' && SAFE_VERSION.test(latest[u.name] ?? ''))
  const names = (list: PackageUpdate[]) => list.map(u => u.name)
  const steps: UpdateStep[] = []
  const run = (...args: string[]) => steps.push({ run: args })

  switch (manager) {
    case 'pip': {
      const py = ctx.python
      if (!py) return []
      // pip keeps to the file's range when it is given; the latest: the file first, then pip
      const spec = (u: PackageUpdate) => {
        const w = ctx.wanted?.[u.name]
        return w && w !== '*' && !w.startsWith('@') ? `${u.name}${w}` : u.name
      }
      for (const u of toLatest) steps.push({ rewrite: { name: u.name, version: latest[u.name]! } })
      const list = [...compatible.map(spec), ...toLatest.map(u => `${u.name}==${latest[u.name]}`)]
      if (list.length) run(py, '-m', 'pip', 'install', '-U', ...list)
      return steps
    }
    case 'poetry':
      if (compatible.length) run('poetry', 'update', ...names(compatible))
      for (const dev of [false, true]) {
        const list = toLatest.filter(u => u.dev === dev).map(u => `${u.name}@^${latest[u.name]}`)
        if (list.length) run('poetry', 'add', ...list, ...(dev ? ['--group', 'dev'] : []))
      }
      return steps
    case 'uv':
      if (compatible.length) run('uv', 'lock', ...names(compatible).flatMap(n => ['--upgrade-package', n]))
      for (const dev of [false, true]) {
        const list = toLatest.filter(u => u.dev === dev).map(u => `${u.name}>=${latest[u.name]}`)
        if (list.length) run('uv', 'add', ...list, ...(dev ? ['--dev'] : []))
      }
      if (steps.length) run('uv', 'sync')
      return steps
    case 'pipenv':
      if (compatible.length) run('pipenv', 'update', ...names(compatible))
      for (const dev of [false, true]) {
        const list = toLatest.filter(u => u.dev === dev).map(u => `${u.name}>=${latest[u.name]}`)
        if (list.length) run('pipenv', 'install', ...list, ...(dev ? ['--dev'] : []))
      }
      return steps
    case 'cargo':
      if (compatible.length) run('cargo', 'update', ...names(compatible).flatMap(n => ['-p', n]))
      for (const dev of [false, true]) {
        const list = toLatest.filter(u => u.dev === dev).map(u => `${u.name}@${latest[u.name]}`)
        if (list.length) run('cargo', 'add', ...list, ...(dev ? ['--dev'] : []))
      }
      return steps
    case 'go': {
      const all = [...compatible, ...toLatest]
      if (all.length) { run('go', 'get', ...all.map(u => `${u.name}@latest`)); run('go', 'mod', 'tidy') }
      return steps
    }
    case 'bundler': {
      // `bundle add` refuses a gem already there: the Gemfile is rewritten, then bundle updates
      for (const u of toLatest) steps.push({ rewrite: { name: u.name, version: latest[u.name]! } })
      const all = [...compatible, ...toLatest]
      if (all.length) run('bundle', 'update', ...names(all))
      return steps
    }
    case 'pub': {
      const tool = ctx.flutter ? 'flutter' : 'dart'
      if (compatible.length) run(tool, 'pub', 'upgrade', ...names(compatible))
      const list = toLatest.map(u => `${u.dev ? 'dev:' : ''}${u.name}:^${latest[u.name]}`)
      if (list.length) run(tool, 'pub', 'add', ...list)
      return steps
    }
    default: return []
  }
}

/** What reinstalls from the files put back (the undo of an update) */
export function reinstallCommand(manager: PackageManagerKind, file: string, python?: string): string[] | null {
  switch (manager) {
    case 'pip': return python ? [python, '-m', 'pip', 'install', '-r', file] : null
    case 'poetry': return ['poetry', 'install']
    case 'uv': return ['uv', 'sync']
    case 'pipenv': return ['pipenv', 'sync', '--dev']
    case 'cargo': return ['cargo', 'fetch']
    case 'go': return ['go', 'mod', 'download']
    case 'bundler': return ['bundle', 'install']
    case 'pub': return null
    default: return null
  }
}

/**
 * The version a file asks for, set to `version`: a requirements line
 * ("Django>=4.2,<5" → "Django>=5.1.2"), a quoted one in pyproject.toml, or a
 * Gemfile's `gem "rails", "~> 7.1"` (→ "~> 8.0"). Anything else is left as it is.
 */
export function rewriteVersion(manager: PackageManagerKind, text: string, name: string, version: string): string {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (manager === 'bundler') {
    const [major, minor = '0'] = version.split('.')
    return text.replace(new RegExp(`^(\\s*gem\\s+["']${esc(name)}["'])((?:\\s*,\\s*["'][^"']*["'])*)`, 'm'), (_all, head: string) => `${head}, "~> ${major}.${minor}"`)
  }
  // Python: the name as written (any case, - _ .), its extras kept, its specifiers replaced
  const want = pyName(name)
  const line = /^(\s*["']?)([A-Za-z0-9][A-Za-z0-9._-]*)(\s*\[[^\]]*\])?\s*((?:===|==|~=|!=|>=|<=|>|<)[^;#"'\r\n]*)?/gm
  // The spaces before a comment or a marker stay
  return text.replace(line, (all, lead: string, n: string, extras: string | undefined, spec: string | undefined) =>
    pyName(n) === want ? `${lead}${n}${extras ?? ''}>=${version}${(spec ?? '').match(/\s*$/)![0]}` : all)
}

// ─── Audits ───────────────────────────────────────────────────────────────────

const empty = (): AuditSummary => ({ total: 0, bySeverity: { unknown: 0, info: 0, low: 0, moderate: 0, high: 0, critical: 0 }, packages: {} })
const ORDER: AuditSeverity[] = ['unknown', 'info', 'low', 'moderate', 'high', 'critical']
function add(s: AuditSummary, name: string, sev: AuditSeverity) {
  s.total++
  s.bySeverity[sev]++
  const prev = s.packages[name]
  if (!prev || ORDER.indexOf(sev) > ORDER.indexOf(prev)) s.packages[name] = sev
}
const severity = (raw: unknown): AuditSeverity => {
  const s = String(raw ?? '').toLowerCase()
  return s === 'medium' ? 'moderate' : (ORDER as string[]).includes(s) ? s as AuditSeverity : 'unknown'
}

/** pip-audit -f json: { dependencies: [{ name, vulns: [...] }] } (older versions: the list alone) */
export function parsePipAudit(json: string): AuditSummary | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let r: any
  try { r = JSON.parse(json) } catch { return null }
  const deps = Array.isArray(r) ? r : r?.dependencies
  if (!Array.isArray(deps)) return null
  const s = empty()
  for (const d of deps) for (const _v of Array.isArray(d?.vulns) ? d.vulns : []) add(s, String(d.name), 'unknown')
  return s
}

/** cargo audit --json: vulnerabilities.list[].package.name, the CVSS score when given */
export function parseCargoAudit(json: string): AuditSummary | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let r: any
  try { r = JSON.parse(json) } catch { return null }
  const list = r?.vulnerabilities?.list
  if (!Array.isArray(list)) return null
  const s = empty()
  for (const v of list) {
    const score = Number(v?.advisory?.cvss_score ?? NaN)
    const sev: AuditSeverity = Number.isNaN(score) ? 'unknown' : score >= 9 ? 'critical' : score >= 7 ? 'high' : score >= 4 ? 'moderate' : 'low'
    add(s, String(v?.package?.name ?? v?.advisory?.package ?? '?'), sev)
  }
  return s
}

/** govulncheck -json: a stream of objects; each finding names its OSV entry and module */
export function parseGovulncheck(stream: string): AuditSummary | null {
  const objects: unknown[] = []
  let depth = 0, start = -1, inString = false
  for (let i = 0; i < stream.length; i++) {
    const c = stream[i]
    if (inString) { if (c === '\\') i++; else if (c === '"') inString = false; continue }
    if (c === '"') inString = true
    else if (c === '{') { if (depth++ === 0) start = i }
    else if (c === '}' && --depth === 0 && start >= 0) { try { objects.push(JSON.parse(stream.slice(start, i + 1))) } catch { /* skip */ } }
  }
  if (!objects.length) return null
  const s = empty()
  const seen = new Set<string>()
  for (const o of objects as { finding?: { osv?: string; trace?: { module?: string; function?: string }[] } }[]) {
    const f = o.finding
    const module = f?.trace?.[0]?.module
    // Only what the code calls: a trace that reaches a function
    if (!f?.osv || !module || !f.trace?.some(t => t.function)) continue
    const key = `${f.osv}|${module}`
    if (seen.has(key)) continue
    seen.add(key)
    add(s, module, 'unknown')
  }
  return s
}

/** bundle-audit check --format json: results[].gem.name, advisory.criticality */
export function parseBundleAudit(json: string): AuditSummary | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let r: any
  try { r = JSON.parse(json) } catch { return null }
  if (!Array.isArray(r?.results)) return null
  const s = empty()
  for (const x of r.results) if (x?.gem?.name) add(s, String(x.gem.name), severity(x?.advisory?.criticality))
  return s
}
