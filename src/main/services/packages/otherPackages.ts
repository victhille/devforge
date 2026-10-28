import { existsSync, readdirSync, readFileSync } from 'fs'
import { join, relative, sep } from 'path'
import type { PackageInfo, PackageManagerKind, PackageManifest } from '@shared/types'
import {
  distInfo, gemfileLockVersions, parseCargo, parseCsproj, parseGemfile, parseGoMod, parseGradle, parsePipfile, parsePom,
  parsePubspec, parsePyproject, parseRequirements, pipfileLockVersions, pubspecLockVersions, pyName, tomlLockVersions
} from '@shared/lib/manifests'
import { UPDATABLE } from '@shared/lib/manifestUpdates'
import { testData } from './npmPackages'

/**
 * v3.5.3: the packages of Python, Rust, Go, Ruby, Dart, .NET and Java
 * projects, in the same tab as npm and Composer: what each file declares,
 * what is installed (lockfile, or the virtual environment for Python) and
 * the latest published version. Read only: the tab shows the command that
 * updates them.
 */

/** Never looked into: dependencies, builds, virtual environments */
const SKIP = new Set(['node_modules', 'vendor', 'dist', 'out', 'build', 'target', 'bin', 'obj', 'venv', 'env', '__pycache__', 'site-packages', 'coverage'])

const read = (path: string): string | null => { try { return readFileSync(path, 'utf-8') } catch { return null } }

/** Files the test picks, the project's root first, 3 levels deep at most */
function findFiles(root: string, test: (name: string) => boolean, depth = 3): string[] {
  const found: string[] = []
  const walk = (dir: string, level: number) => {
    let entries
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const e of entries.filter(e => e.isFile() && test(e.name)).sort((a, b) => a.name.localeCompare(b.name))) found.push(join(dir, e.name))
    if (level >= depth) return
    for (const e of entries.filter(e => e.isDirectory() && !SKIP.has(e.name) && !e.name.startsWith('.')).sort((a, b) => a.name.localeCompare(b.name))) walk(join(dir, e.name), level + 1)
  }
  walk(root, 0)
  return found
}

/** Python: what the virtual environment next to the file holds (.venv, venv, env) */
function venvVersions(dir: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const venv of ['.venv', 'venv', 'env']) {
    const base = join(dir, venv)
    if (!existsSync(join(base, 'pyvenv.cfg'))) continue
    const sites = [join(base, 'Lib', 'site-packages')]
    try { for (const py of readdirSync(join(base, 'lib')).filter(n => n.startsWith('python'))) sites.push(join(base, 'lib', py, 'site-packages')) } catch { /* Windows layout */ }
    for (const site of sites) {
      try { for (const name of readdirSync(site)) { const d = distInfo(name); if (d) out[d[0]] ??= d[1] } } catch { /* none */ }
    }
  }
  return out
}

function pythonInstalled(dir: string): Record<string, string> {
  const lock = read(join(dir, 'poetry.lock')) ?? read(join(dir, 'uv.lock'))
  const pipfileLock = read(join(dir, 'Pipfile.lock'))
  return { ...venvVersions(dir), ...(pipfileLock ? pipfileLockVersions(pipfileLock) : {}), ...(lock ? tomlLockVersions(lock, pyName) : {}) }
}

interface Kind {
  test: (name: string) => boolean
  read: (path: string, text: string) => { deps: Omit<PackageInfo, 'installed'>[]; manager: PackageManagerKind; name?: string | null } | null
  /** Name → installed version, read next to the file */
  installed: (dir: string, deps: Omit<PackageInfo, 'installed'>[]) => Record<string, string>
  /** How a name is looked up in `installed` */
  key?: (name: string) => string
}

const exact = (deps: Omit<PackageInfo, 'installed'>[]) => Object.fromEntries(deps.filter(d => /^v?\d/.test(d.wanted)).map(d => [d.name, d.wanted.replace(/^v/, '')]))

const KINDS: Kind[] = [
  {
    test: n => n === 'pyproject.toml',
    read: (path, text) => {
      const { deps, poetry } = parsePyproject(text)
      const dir = join(path, '..')
      return deps.length ? { deps, manager: poetry ? 'poetry' : existsSync(join(dir, 'uv.lock')) ? 'uv' : 'pip' } : null
    },
    installed: pythonInstalled, key: pyName
  },
  {
    test: n => /^requirements([-_.][\w-]+)?\.txt$/i.test(n),
    read: (path, text) => {
      const dev = /dev|test|lint/i.test(path.split(/[\\/]/).pop() ?? '')
      const deps = parseRequirements(text, dev)
      return deps.length ? { deps, manager: 'pip' } : null
    },
    installed: pythonInstalled, key: pyName
  },
  { test: n => n === 'Pipfile', read: (_p, text) => ({ deps: parsePipfile(text), manager: 'pipenv' }), installed: pythonInstalled, key: pyName },
  {
    test: n => n === 'Cargo.toml',
    read: (_p, text) => ({ deps: parseCargo(text), manager: 'cargo', name: text.match(/^\[package\][\s\S]*?^name\s*=\s*"([^"]+)"/m)?.[1] ?? null }),
    installed: dir => {
      // A crate of a workspace: the lockfile is at the workspace's root
      for (let d = dir, i = 0; i < 4; d = join(d, '..'), i++) { const lock = read(join(d, 'Cargo.lock')); if (lock) return tomlLockVersions(lock) }
      return {}
    }
  },
  { test: n => n === 'go.mod', read: (_p, text) => ({ deps: parseGoMod(text), manager: 'go', name: text.match(/^module\s+(\S+)/m)?.[1] ?? null }), installed: (_d, deps) => exact(deps) },
  { test: n => n === 'Gemfile', read: (_p, text) => ({ deps: parseGemfile(text), manager: 'bundler' }), installed: dir => { const l = read(join(dir, 'Gemfile.lock')); return l ? gemfileLockVersions(l) : {} } },
  {
    test: n => n === 'pubspec.yaml',
    read: (_p, text) => ({ deps: parsePubspec(text), manager: 'pub', name: text.match(/^name:\s*(\S+)/m)?.[1] ?? null }),
    installed: dir => { const l = read(join(dir, 'pubspec.lock')); return l ? pubspecLockVersions(l) : {} }
  },
  { test: n => /\.(csproj|fsproj|vbproj)$/i.test(n), read: (_p, text) => ({ deps: parseCsproj(text), manager: 'nuget' }), installed: (_d, deps) => exact(deps) },
  { test: n => n === 'pom.xml', read: (_p, text) => ({ deps: parsePom(text), manager: 'maven' }), installed: (_d, deps) => exact(deps) },
  { test: n => n === 'build.gradle' || n === 'build.gradle.kts', read: (_p, text) => ({ deps: parseGradle(text), manager: 'gradle' }), installed: (_d, deps) => exact(deps) }
]

export function listOtherManifests(root: string): PackageManifest[] {
  const out: PackageManifest[] = []
  for (const kind of KINDS) {
    for (const path of findFiles(root, kind.test)) {
      const text = read(path)
      const parsed = text === null ? null : kind.read(path, text)
      if (!parsed || !parsed.deps.length) continue
      const dir = join(path, '..')
      const installed = kind.installed(dir, parsed.deps)
      const key = kind.key ?? ((n: string) => n)
      const packages = parsed.deps.map(d => ({ ...d, installed: installed[key(d.name)] ?? null }))
        .sort((a, b) => Number(a.dev) - Number(b.dev) || a.name.localeCompare(b.name))
      out.push({
        dir: relative(root, dir).split(sep).join('/'), file: path.split(/[\\/]/).pop()!, name: parsed.name ?? null,
        manager: parsed.manager, packages, ...(UPDATABLE.includes(parsed.manager) ? {} : { readOnly: true })
      })
    }
  }
  return out
}

// ─── Latest versions, from each registry ─────────────────────────────────────

const latestCache = new Map<string, { at: number; version: string | null }>()
const LATEST_TTL = 10 * 60_000
const HEADERS = { 'User-Agent': 'DevForge (https://github.com/victhille/devforge)', Accept: 'application/json' }

/** A plain release: "2.31.0", not "3.0.0rc1" nor "1.2.0-beta" */
const stable = (v: unknown): v is string => typeof v === 'string' && /^v?\d+(\.\d+)*$/.test(v)

async function json(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10_000) })
  return res.ok ? res.json() : null
}

/** Go's proxy writes capitals as "!x" */
const goPath = (m: string) => m.replace(/[A-Z]/g, c => `!${c.toLowerCase()}`)

type Fetcher = (name: string) => Promise<string | null>
const PYPI: Fetcher = async n => {
  const d = await json(`https://pypi.org/pypi/${encodeURIComponent(n)}/json`) as { info?: { version?: string } } | null
  return stable(d?.info?.version) ? d!.info!.version! : null
}
const MAVEN: Fetcher = async n => {
  const [g, a] = n.split(':')
  const d = await json(`https://search.maven.org/solrsearch/select?q=${encodeURIComponent(`g:"${g}" AND a:"${a}"`)}&rows=1&wt=json`) as { response?: { docs?: { latestVersion?: string }[] } } | null
  return d?.response?.docs?.[0]?.latestVersion ?? null
}

const FETCH: Partial<Record<PackageManagerKind, Fetcher>> = {
  pip: PYPI, poetry: PYPI, uv: PYPI, pipenv: PYPI,
  cargo: async n => {
    const d = await json(`https://crates.io/api/v1/crates/${encodeURIComponent(n)}`) as { crate?: { max_stable_version?: string } } | null
    return d?.crate?.max_stable_version ?? null
  },
  go: async n => {
    const d = await json(`https://proxy.golang.org/${goPath(n).split('/').map(encodeURIComponent).join('/')}/@latest`) as { Version?: string } | null
    return d?.Version ? d.Version.replace(/^v/, '') : null
  },
  bundler: async n => {
    const d = await json(`https://rubygems.org/api/v1/versions/${encodeURIComponent(n)}/latest.json`) as { version?: string } | null
    return stable(d?.version) ? d!.version! : null
  },
  pub: async n => {
    const d = await json(`https://pub.dev/api/packages/${encodeURIComponent(n)}`) as { latest?: { version?: string } } | null
    return d?.latest?.version ?? null
  },
  nuget: async n => {
    const d = await json(`https://api.nuget.org/v3-flatcontainer/${encodeURIComponent(n.toLowerCase())}/index.json`) as { versions?: string[] } | null
    return [...(d?.versions ?? [])].reverse().find(stable) ?? null
  },
  maven: MAVEN, gradle: MAVEN
}

/** Names as each registry writes them: nothing that could leave the URL's path */
const SAFE_NAME = /^[A-Za-z0-9@][A-Za-z0-9._\-/:@+]*$/

/** The registry a file's packages come from */
export function registryOf(file: string): PackageManagerKind | null {
  if (file === 'pyproject.toml' || file === 'Pipfile' || /^requirements([-_.][\w-]+)?\.txt$/i.test(file)) return 'pip'
  if (/\.(csproj|fsproj|vbproj)$/i.test(file)) return 'nuget'
  return ({ 'Cargo.toml': 'cargo', 'go.mod': 'go', Gemfile: 'bundler', 'pubspec.yaml': 'pub', 'pom.xml': 'maven', 'build.gradle': 'gradle', 'build.gradle.kts': 'gradle' } as Record<string, PackageManagerKind>)[file] ?? null
}

export async function otherLatest(manager: PackageManagerKind, names: string[]): Promise<Record<string, string | null>> {
  const fetcher = FETCH[manager]
  const wanted = [...new Set(names.filter(n => n.length <= 214 && SAFE_NAME.test(n) && !n.includes('..')))]
  const test = testData()?.latest as Record<string, string> | undefined
  if (test) return Object.fromEntries(wanted.map(n => [n, test[n] ?? null]))
  const out: Record<string, string | null> = {}
  if (!fetcher) return out
  const todo = wanted.filter(n => {
    const c = latestCache.get(`${manager}:${n}`)
    if (c && Date.now() - c.at < LATEST_TTL) { out[n] = c.version; return false }
    return true
  })
  for (let i = 0; i < todo.length; i += 8) {
    await Promise.all(todo.slice(i, i + 8).map(async n => {
      const v = await fetcher(n).catch(() => null)
      latestCache.set(`${manager}:${n}`, { at: Date.now(), version: v })
      out[n] = v
    }))
  }
  return out
}
