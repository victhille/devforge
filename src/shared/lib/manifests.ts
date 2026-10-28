import type { PackageInfo, PackageManagerKind } from '../types/packages'
import { parseToml, type TomlTable, type TomlValue } from './tomlLite'

/**
 * v3.5.3: the dependencies other languages declare, read from their files:
 * Python (requirements.txt, pyproject.toml, Pipfile), Rust (Cargo.toml),
 * Go (go.mod), Ruby (Gemfile), Dart and Flutter (pubspec.yaml), .NET
 * (*.csproj), Java and Kotlin (pom.xml, build.gradle). Pure functions: the
 * main process reads the files, these read the text.
 */

type Dep = Omit<PackageInfo, 'installed'>

/** PEP 503: "Django", "django_rest" and "Django.Rest" are one package */
export const pyName = (name: string) => name.toLowerCase().replace(/[-_.]+/g, '-')

/** One requirement (PEP 508): "requests[socks]>=2.31 ; python_version>'3.8'" */
export function parseRequirement(line: string): { name: string; wanted: string } | null {
  const m = line.trim().match(/^([A-Za-z0-9][A-Za-z0-9._-]*)\s*(\[[^\]]*\])?\s*(@\s*\S+|[^;#]*)/)
  if (!m) return null
  const spec = m[3].trim()
  return { name: m[1], wanted: spec.startsWith('@') ? spec : spec.replace(/\s+/g, '') || '*' }
}

export function parseRequirements(text: string, dev = false): Dep[] {
  const out: Dep[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/(^|\s)#.*$/, '').trim()
    // Options (-r, -e, --index-url) and bare URLs are not packages
    if (!line || line.startsWith('-') || /^[a-z+]+:\/\//i.test(line)) continue
    const r = parseRequirement(line)
    if (r) out.push({ ...r, dev })
  }
  return out
}

const isTable = (v: TomlValue | undefined): v is TomlTable => !!v && typeof v === 'object' && !Array.isArray(v)
const strings = (v: TomlValue | undefined): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

/** A Poetry, Pipfile or Cargo entry: "^1.2", or { version = "1.2", … } (path, git: "*") */
function versionOf(v: TomlValue): string {
  if (typeof v === 'string') return v
  if (isTable(v)) return typeof v.version === 'string' ? v.version : v.workspace === true ? 'workspace' : '*'
  return '*'
}

function tableDeps(table: TomlValue | undefined, dev: boolean, skip: (name: string) => boolean = () => false): Dep[] {
  if (!isTable(table)) return []
  return Object.entries(table).filter(([name]) => !skip(name)).map(([name, v]) => ({ name, wanted: versionOf(v), dev }))
}

/** pyproject.toml: PEP 621 ([project]), its optional groups, PEP 735 groups, and Poetry */
export function parsePyproject(text: string): { deps: Dep[]; poetry: boolean } {
  const { tables } = parseToml(text)
  const deps: Dep[] = []
  const project = tables.project ?? {}
  const fromList = (list: string[], dev: boolean) => list.forEach(l => { const r = parseRequirement(l); if (r) deps.push({ ...r, dev }) })
  fromList(strings(project.dependencies), false)
  const optional = tables['project.optional-dependencies'] ?? (isTable(project['optional-dependencies']) ? project['optional-dependencies'] as TomlTable : {})
  Object.values(optional).forEach(v => fromList(strings(v), true))
  Object.values(tables['dependency-groups'] ?? {}).forEach(v => fromList(strings(v), true))

  const poetry = !!tables['tool.poetry'] || Object.keys(tables).some(k => k.startsWith('tool.poetry.'))
  deps.push(...tableDeps(tables['tool.poetry.dependencies'], false, n => n === 'python'))
  deps.push(...tableDeps(tables['tool.poetry.dev-dependencies'], true))
  for (const [name, table] of Object.entries(tables)) {
    if (/^tool\.poetry\.group\.[^.]+\.dependencies$/.test(name)) deps.push(...tableDeps(table, true))
  }
  return { deps: dedupe(deps), poetry }
}

export function parsePipfile(text: string): Dep[] {
  const { tables } = parseToml(text)
  return [...tableDeps(tables.packages, false), ...tableDeps(tables['dev-packages'], true)]
}

/** Cargo.toml: [dependencies], [dev-dependencies], [build-dependencies], [dependencies.name] and a workspace's own list */
export function parseCargo(text: string): Dep[] {
  const { tables } = parseToml(text)
  const deps: Dep[] = []
  for (const [section, dev] of [['dependencies', false], ['dev-dependencies', true], ['build-dependencies', true], ['workspace.dependencies', false]] as const) {
    deps.push(...tableDeps(tables[section], dev))
    for (const [name, table] of Object.entries(tables)) {
      if (name.startsWith(`${section}.`) && !name.slice(section.length + 1).includes('.')) deps.push({ name: name.slice(section.length + 1), wanted: versionOf(table), dev })
    }
  }
  return dedupe(deps)
}

/** go.mod: the modules required directly (the "// indirect" ones are their dependencies) */
export function parseGoMod(text: string): Dep[] {
  const deps: Dep[] = []
  let block = false
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (/^require\s*\($/.test(line)) { block = true; continue }
    if (block && line === ')') { block = false; continue }
    const body = block ? line : line.match(/^require\s+(.*)$/)?.[1]
    if (!body || body.includes('// indirect')) continue
    const m = body.match(/^(\S+)\s+(v\S+)/)
    if (m) deps.push({ name: m[1], wanted: m[2], dev: false })
  }
  return deps
}

/** Gemfile: `gem "rails", "~> 7.1"`; inside `group :development, :test do` they are dev ones */
export function parseGemfile(text: string): Dep[] {
  const deps: Dep[] = []
  const groups: boolean[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim()
    if (/^group\b.*\bdo$/.test(line)) { groups.push(/:(development|test)\b/.test(line)); continue }
    if (/^(platforms?|source|install_if)\b.*\bdo$/.test(line)) { groups.push(groups[groups.length - 1] ?? false); continue }
    if (line === 'end') { groups.pop(); continue }
    const m = line.match(/^gem\s+["']([^"']+)["']((?:\s*,\s*["'][^"']*["'])*)/)
    if (!m) continue
    const versions = [...m[2].matchAll(/["']([^"']*)["']/g)].map(v => v[1])
    const dev = groups[groups.length - 1] === true || /group:\s*\[?:?(development|test)/.test(line)
    deps.push({ name: m[1], wanted: versions.join(', ') || '*', dev })
  }
  return deps
}

/** pubspec.yaml: `dependencies:` and `dev_dependencies:`, two spaces in (the SDK itself skipped) */
export function parsePubspec(text: string): Dep[] {
  const deps: Dep[] = []
  let section: 'dependencies' | 'dev_dependencies' | null = null
  const lines = text.split(/\r?\n/)
  lines.forEach((raw, i) => {
    if (/^\S/.test(raw)) { section = raw.startsWith('dependencies:') ? 'dependencies' : raw.startsWith('dev_dependencies:') ? 'dev_dependencies' : null; return }
    if (!section) return
    const m = raw.match(/^ {2}([a-z0-9_]+):\s*(.*?)\s*$/)
    if (!m) return
    // A block below: sdk (skipped), path, git, hosted with its version
    const below: string[] = []
    if (!m[2]) for (let j = i + 1; j < lines.length && (/^ {4,}/.test(lines[j]) || !lines[j].trim()); j++) below.push(lines[j])
    if (below.some(l => /^\s+sdk:/.test(l))) return
    const version = m[2] || below.map(l => l.match(/^\s+version:\s*["']?([^"'\s]+)/)?.[1]).find(Boolean) || '*'
    deps.push({ name: m[1], wanted: version.replace(/^["']|["']$/g, ''), dev: section === 'dev_dependencies' })
  })
  return deps
}

/** *.csproj: <PackageReference Include="X" Version="1.2.3" /> (or a <Version> child) */
export function parseCsproj(text: string): Dep[] {
  const deps: Dep[] = []
  for (const m of text.matchAll(/<PackageReference\b([^>]*?)(\/>|>([\s\S]*?)<\/PackageReference>)/g)) {
    const name = m[1].match(/\bInclude="([^"]+)"/)?.[1]
    const version = m[1].match(/\bVersion="([^"]+)"/)?.[1] ?? m[3]?.match(/<Version>([^<]+)<\/Version>/)?.[1]
    if (name) deps.push({ name, wanted: version ?? '*', dev: false })
  }
  return deps
}

/** pom.xml: each <dependency>, its version's ${property} read from <properties>; scope test is dev */
export function parsePom(text: string): Dep[] {
  const props: Record<string, string> = {}
  const propsBlock = text.match(/<properties>([\s\S]*?)<\/properties>/)?.[1] ?? ''
  for (const m of propsBlock.matchAll(/<([\w.-]+)>([^<]*)<\/\1>/g)) props[m[1]] = m[2].trim()
  const tag = (block: string, name: string) => block.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1]?.trim()
  const deps: Dep[] = []
  for (const m of text.matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)) {
    const group = tag(m[1], 'groupId')
    const artifact = tag(m[1], 'artifactId')
    if (!group || !artifact) continue
    const version = (tag(m[1], 'version') ?? '*').replace(/\$\{([^}]+)\}/g, (all, k: string) => props[k] ?? all)
    deps.push({ name: `${group}:${artifact}`, wanted: version, dev: tag(m[1], 'scope') === 'test' })
  }
  return dedupe(deps)
}

/** build.gradle(.kts): `implementation("group:artifact:version")`; test configurations are dev */
export function parseGradle(text: string): Dep[] {
  const deps: Dep[] = []
  for (const m of text.matchAll(/^\s*(\w+)\s*\(?\s*["']([\w.-]+):([\w.-]+):([^"'@]+)(?:@\w+)?["']/gm)) {
    if (!/(implementation|api|compileOnly|runtimeOnly|kapt|ksp|annotationProcessor|classpath)$/i.test(m[1])) continue
    deps.push({ name: `${m[2]}:${m[3]}`, wanted: m[4], dev: /^test/i.test(m[1]) })
  }
  return dedupe(deps)
}

function dedupe(deps: Dep[]): Dep[] {
  const seen = new Set<string>()
  return deps.filter(d => { const k = `${d.name}|${d.dev}`; if (seen.has(k)) return false; seen.add(k); return true })
}

// ─── What is installed: lockfiles ─────────────────────────────────────────────

/** poetry.lock, uv.lock, Cargo.lock: [[package]] name and version */
export function tomlLockVersions(text: string, normalize: (n: string) => string = n => n): Record<string, string> {
  const out: Record<string, string> = {}
  for (const p of parseToml(text).arrays.package ?? []) {
    if (typeof p.name === 'string' && typeof p.version === 'string') out[normalize(p.name)] = p.version
  }
  return out
}

/** Pipfile.lock: "default" and "develop", versions written "==1.2.3" */
export function pipfileLockVersions(text: string): Record<string, string> {
  try {
    const lock = JSON.parse(text) as Record<string, Record<string, { version?: string }>>
    const out: Record<string, string> = {}
    for (const part of [lock.default, lock.develop]) {
      for (const [name, info] of Object.entries(part ?? {})) if (info?.version) out[pyName(name)] = info.version.replace(/^==/, '')
    }
    return out
  } catch { return {} }
}

/** Gemfile.lock: "    rails (7.1.3)" under specs */
export function gemfileLockVersions(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of text.matchAll(/^ {4}([^\s(]+) \(([^)]+)\)\r?$/gm)) out[m[1]] ??= m[2].split('-')[0]
  return out
}

/** pubspec.lock: "  name:" then "    version: \"1.2.3\"" */
export function pubspecLockVersions(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  let name: string | null = null
  for (const raw of text.split(/\r?\n/)) {
    const n = raw.match(/^ {2}([a-z0-9_]+):\s*$/)
    if (n) { name = n[1]; continue }
    const v = raw.match(/^ {4}version:\s*["']?([^"'\s]+)/)
    if (v && name) out[name] = v[1]
  }
  return out
}

/** "requests-2.31.0.dist-info" → ["requests", "2.31.0"] (a site-packages folder name) */
export function distInfo(folder: string): [string, string] | null {
  const m = folder.match(/^(.+?)-(\d[^-]*)\.(dist-info|egg-info)$/)
  return m ? [pyName(m[1]), m[2]] : null
}

// ─── Each manager: its registry page and how to update ────────────────────────

export const REGISTRY_PAGE: Partial<Record<PackageManagerKind, (name: string) => string>> = {
  npm: n => `https://www.npmjs.com/package/${n}`,
  pnpm: n => `https://www.npmjs.com/package/${n}`,
  yarn: n => `https://www.npmjs.com/package/${n}`,
  composer: n => `https://packagist.org/packages/${n}`,
  pip: n => `https://pypi.org/project/${n}/`,
  poetry: n => `https://pypi.org/project/${n}/`,
  uv: n => `https://pypi.org/project/${n}/`,
  pipenv: n => `https://pypi.org/project/${n}/`,
  cargo: n => `https://crates.io/crates/${n}`,
  go: n => `https://pkg.go.dev/${n}`,
  bundler: n => `https://rubygems.org/gems/${n}`,
  pub: n => `https://pub.dev/packages/${n}`,
  nuget: n => `https://www.nuget.org/packages/${n}`,
  maven: n => `https://central.sonatype.com/artifact/${n.replace(':', '/')}`,
  gradle: n => `https://central.sonatype.com/artifact/${n.replace(':', '/')}`
}

/** The command that updates them, for the managers DevForge only reads */
export const UPDATE_HINT: Partial<Record<PackageManagerKind, string>> = {
  pip: 'pip install -U -r requirements.txt',
  poetry: 'poetry update',
  uv: 'uv lock --upgrade && uv sync',
  pipenv: 'pipenv update',
  cargo: 'cargo update',
  go: 'go get -u ./... && go mod tidy',
  bundler: 'bundle update',
  pub: 'dart pub upgrade',
  nuget: 'dotnet list package --outdated',
  maven: 'mvn versions:display-dependency-updates',
  gradle: './gradlew dependencyUpdates'
}
