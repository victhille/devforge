import { readdir, readFile, realpath, stat } from 'fs/promises'
import { basename, isAbsolute, join, relative, resolve, sep } from 'path'
import type Anthropic from '@anthropic-ai/sdk'
import type { Project } from '@shared/types'
import { loadProjects } from '../projects/projectStorage'
import { getChanges, getRepoDetails } from '../git/gitRepo'
import { getOverview } from '../docker/dockerService'
import { listDbConnections } from '../database/dbStorage'
import { dbSchema } from '../database/dbClient'
import { runFile } from '../../lib/exec'

/**
 * Read-only tools the assistant can call. Every path stays inside a saved
 * project, secret files are never read, outputs are capped.
 */

const MAX_FILE = 60_000
const MAX_OUTPUT = 40_000
const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt', 'vendor', 'target', '.venv', 'venv', '__pycache__', 'coverage', '.cache', '.turbo', '.idea'])

/** Files whose content must not leave the PC */
export function isSecretFile(path: string): boolean {
  const name = basename(path).toLowerCase()
  if (/^\.env(\..+)?$/.test(name)) return !/(example|sample|template|dist)/.test(name)
  return /\.(pem|key|p12|pfx|keystore|jks)$/.test(name) || /^id_(rsa|ed25519|ecdsa|dsa)/.test(name) ||
    ['.npmrc', '.pypirc', '.netrc', 'credentials', 'credentials.json', 'known_hosts', 'auth.json'].includes(name)
}

const cap = (s: string, max = MAX_OUTPUT) => (s.length > max ? `${s.slice(0, max)}\n… [truncated, ${s.length - max} more characters]` : s)

export class ToolError extends Error {}

/** Saved project by name (case-insensitive) or path */
export function findProject(ref: unknown): Project {
  if (typeof ref !== 'string' || !ref.trim()) throw new ToolError('Missing "project"')
  const r = ref.trim().toLowerCase()
  const projects = loadProjects()
  const p = projects.find(x => x.name.toLowerCase() === r) ?? projects.find(x => resolve(x.path).toLowerCase() === resolve(ref.trim()).toLowerCase())
  if (!p) throw new ToolError(`Unknown project "${ref}". Saved projects: ${projects.map(x => x.name).join(', ')}`)
  return p
}

/** Absolute path inside the project, symlinks resolved; throws when it escapes */
async function insideProject(project: Project, path: unknown): Promise<string> {
  const rel = typeof path === 'string' ? path : ''
  const root = await realpath(project.path)
  const target = resolve(root, rel)
  let real = target
  try { real = await realpath(target) } catch { /* missing: checked by the caller */ }
  const r = relative(root, real)
  if (r === '..' || r.startsWith(`..${sep}`) || isAbsolute(r)) throw new ToolError('Path is outside the project')
  return real
}

const str = (v: unknown) => (typeof v === 'string' ? v : undefined)
const int = (v: unknown, def: number, min: number, max: number) =>
  Math.min(Math.max(Number.isFinite(Number(v)) && v !== undefined && v !== null ? Math.floor(Number(v)) : def, min), max)

// ─── Implementations ──────────────────────────────────────────────────────────

async function listFiles(project: Project, dir: unknown): Promise<string> {
  const start = await insideProject(project, dir ?? '')
  const lines: string[] = []
  const walk = async (abs: string, depth: number, prefix: string) => {
    if (lines.length >= 400) return
    let entries = await readdir(abs, { withFileTypes: true }).catch(() => [])
    entries = entries.sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))
    for (const e of entries) {
      if (lines.length >= 400) { lines.push(`${prefix}…`); return }
      if (e.isDirectory()) {
        if (IGNORED_DIRS.has(e.name)) { lines.push(`${prefix}${e.name}/ (skipped)`); continue }
        lines.push(`${prefix}${e.name}/`)
        if (depth < 2) await walk(join(abs, e.name), depth + 1, `${prefix}  `)
      } else lines.push(`${prefix}${e.name}`)
    }
  }
  await walk(start, 0, '')
  return lines.join('\n') || '(empty folder)'
}

async function readProjectFile(project: Project, path: unknown, from: unknown, to: unknown): Promise<string> {
  if (typeof path !== 'string' || !path) throw new ToolError('Missing "path"')
  const abs = await insideProject(project, path)
  if (isSecretFile(abs)) throw new ToolError('This file may contain secrets: it is not shared with the assistant. Ask the user for the relevant non-secret part.')
  const s = await stat(abs).catch(() => null)
  if (!s?.isFile()) throw new ToolError(`Not a file: ${path}`)
  if (s.size > 2_000_000) throw new ToolError('File too large (over 2 MB)')
  const text = await readFile(abs, 'utf-8')
  if (text.includes('\u0000')) throw new ToolError('Binary file')
  const all = text.split(/\r?\n/)
  const a = int(from, 1, 1, all.length)
  const b = int(to, all.length, a, all.length)
  const body = all.slice(a - 1, b).map((l, i) => `${String(a + i).padStart(5)}  ${l}`).join('\n')
  return cap(`${path} (lines ${a}-${b} of ${all.length})\n${body}`, MAX_FILE)
}

async function searchCode(project: Project, query: unknown): Promise<string> {
  if (typeof query !== 'string' || query.trim().length < 2) throw new ToolError('"query" needs at least 2 characters')
  const needle = query.toLowerCase()
  const root = await realpath(project.path)
  const hits: string[] = []
  let scanned = 0
  const walk = async (abs: string) => {
    if (hits.length >= 60 || scanned > 4000) return
    for (const e of await readdir(abs, { withFileTypes: true }).catch(() => [])) {
      if (hits.length >= 60) return
      const p = join(abs, e.name)
      if (e.isDirectory()) { if (!IGNORED_DIRS.has(e.name) && !e.name.startsWith('.')) await walk(p); continue }
      if (isSecretFile(p) || /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|exe|dll|woff2?|ttf|mp[34]|lock)$/i.test(e.name)) continue
      scanned++
      const s = await stat(p).catch(() => null)
      if (!s || s.size > 500_000) continue
      const text = await readFile(p, 'utf-8').catch(() => '')
      if (text.includes('\u0000')) continue
      text.split(/\r?\n/).forEach((line, i) => {
        if (hits.length < 60 && line.toLowerCase().includes(needle)) hits.push(`${relative(root, p)}:${i + 1}: ${line.trim().slice(0, 200)}`)
      })
    }
  }
  await walk(root)
  return hits.length ? hits.join('\n') + (hits.length >= 60 ? '\n… (first 60 matches)' : '') : 'No match.'
}

async function gitStatus(project: Project): Promise<string> {
  const d = await getRepoDetails(project.path)
  if (!d.isRepo) return 'Not a git repository.'
  const changes = await getChanges(project.path)
  const log = await runFile('git', ['log', '-10', '--pretty=format:%h %ad %an: %s', '--date=short'], { cwd: project.path, timeout: 10_000 })
  return [
    `Branch: ${d.branch}${d.hasUpstream ? ` (ahead ${d.ahead}, behind ${d.behind})` : ' (no upstream)'}`,
    `Remote: ${d.remoteUrl ?? 'none'}`,
    `Changed files (${changes.length}):`,
    ...changes.slice(0, 100).map(c => `  ${c.staged ? '[staged] ' : ''}${c.status} ${c.path}${c.insertions !== null ? ` +${c.insertions} -${c.deletions}` : ''}`),
    'Recent commits:',
    log.stdout
  ].join('\n')
}

async function gitDiff(project: Project, file: unknown, staged: unknown): Promise<string> {
  const args = ['diff', '--no-color', '--no-ext-diff']
  if (staged === true) args.push('--staged')
  if (typeof file === 'string' && file) {
    const abs = await insideProject(project, file)
    if (isSecretFile(abs)) throw new ToolError('This file may contain secrets: its diff is not shared.')
    args.push('--', relative(await realpath(project.path), abs))
  } else {
    // Whole diff without secret files
    args.push('--', '.', ':(exclude).env', ':(exclude).env.*', ':(exclude)*.pem', ':(exclude)*.key')
  }
  const r = await runFile('git', args, { cwd: project.path, timeout: 15_000 })
  if (!r.ok) throw new ToolError(r.stderr || 'git diff failed')
  return r.stdout.trim() ? cap(r.stdout) : 'No difference.'
}

async function dockerStatus(): Promise<string> {
  const o = await getOverview()
  if (!o.available) return `Docker is not available: ${o.error ?? ''}`
  return [
    `Docker ${o.version}`,
    'Containers:',
    ...o.containers.map(c => `  ${c.name} [${c.state}] ${c.image} ${c.ports ? `ports ${c.ports}` : ''}${c.composeProject ? ` (compose: ${c.composeProject})` : ''}`),
    'Compose projects:',
    ...o.compose.map(p => `  ${p.name}: ${p.running}/${p.total} running${p.dir ? ` — ${p.dir}` : ''}`)
  ].join('\n')
}

async function containerLogs(container: unknown, lines: unknown): Promise<string> {
  if (typeof container !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(container)) throw new ToolError('Invalid container name')
  const r = await runFile('docker', ['logs', '--tail', String(int(lines, 100, 1, 500)), container], { timeout: 15_000 })
  if (!r.ok && !r.stdout) throw new ToolError(r.stderr || 'docker logs failed')
  return cap((r.stdout + r.stderr).trim() || '(no output)')
}

function dbList(): string {
  const list = listDbConnections()
  if (!list.length) return 'No saved database connection.'
  return list.map(c => `- ${c.name} (${c.type}${c.type === 'sqlite' ? ` ${c.file}` : ` ${c.host}:${c.port ?? ''}/${c.database ?? ''}`}${c.sshConnectionId ? ', via SSH' : ''})`).join('\n')
}

async function dbStructure(connection: unknown): Promise<string> {
  const c = listDbConnections().find(x => typeof connection === 'string' && x.name.toLowerCase() === connection.trim().toLowerCase())
  if (!c) throw new ToolError(`Unknown connection. Saved: ${listDbConnections().map(x => x.name).join(', ')}`)
  const tables = await dbSchema(c.id)
  return cap(tables.map(t => `${t.schema && t.schema !== 'public' ? `${t.schema}.` : ''}${t.name}${t.type === 'view' ? ' (view)' : ''}\n` +
    t.columns.map(col => `  ${col.name} ${col.type}${col.nullable ? '' : ' NOT NULL'}${col.key ? ' PK' : ''}`).join('\n')).join('\n'))
}

// ─── Definitions ──────────────────────────────────────────────────────────────

const project = { type: 'string', description: 'Project name (or its path), from list_projects' } as const

/** Tool list: static and in a fixed order so the prompt cache keeps hitting */
export const TOOLS: Anthropic.Beta.BetaTool[] = [
  { name: 'list_projects', description: 'List the projects saved in DevForge (name, path, framework).', input_schema: { type: 'object', properties: {} } },
  { name: 'list_files', description: 'Tree of a project folder (2 levels, heavy folders like node_modules skipped).', input_schema: { type: 'object', properties: { project, dir: { type: 'string', description: 'Folder relative to the project root, default the root' } }, required: ['project'] } },
  { name: 'read_file', description: 'Read a text file of a project, with line numbers. Secret files (.env, keys) are refused.', input_schema: { type: 'object', properties: { project, path: { type: 'string', description: 'Path relative to the project root' }, from_line: { type: 'integer' }, to_line: { type: 'integer' } }, required: ['project', 'path'] } },
  { name: 'search_code', description: 'Case-insensitive text search in a project (first 60 matches, path:line: text).', input_schema: { type: 'object', properties: { project, query: { type: 'string' } }, required: ['project', 'query'] } },
  { name: 'git_status', description: 'Branch, upstream, changed files and the last 10 commits of a project.', input_schema: { type: 'object', properties: { project }, required: ['project'] } },
  { name: 'git_diff', description: 'Uncommitted changes of a project (or of one file).', input_schema: { type: 'object', properties: { project, file: { type: 'string' }, staged: { type: 'boolean', description: 'Staged changes instead of unstaged' } }, required: ['project'] } },
  { name: 'docker_status', description: 'Local Docker containers and compose projects with their state.', input_schema: { type: 'object', properties: {} } },
  { name: 'container_logs', description: 'Last lines of a local Docker container log.', input_schema: { type: 'object', properties: { container: { type: 'string' }, lines: { type: 'integer', description: 'Default 100, max 500' } }, required: ['container'] } },
  { name: 'db_connections', description: 'Database connections saved in DevForge (no credentials).', input_schema: { type: 'object', properties: {} } },
  { name: 'db_schema', description: 'Tables and columns of a saved database connection.', input_schema: { type: 'object', properties: { connection: { type: 'string', description: 'Connection name from db_connections' } }, required: ['connection'] } }
].map(t => ({ ...t, eager_input_streaming: true }) as Anthropic.Beta.BetaTool)

/** Short label shown in the conversation while the tool runs */
export function describeTool(name: string, input: Record<string, unknown>): string {
  const p = str(input.project) ?? ''
  switch (name) {
    case 'list_projects': return 'projects'
    case 'list_files': return `${p}/${str(input.dir) ?? ''}`
    case 'read_file': return `${p}/${str(input.path) ?? ''}`
    case 'search_code': return `"${str(input.query) ?? ''}" — ${p}`
    case 'git_status': case 'git_diff': return p + (str(input.file) ? `/${str(input.file)}` : '')
    case 'container_logs': return str(input.container) ?? ''
    case 'db_schema': return str(input.connection) ?? ''
    default: return ''
  }
}

/** Run one tool; ToolError → message for the model (is_error) */
export async function runTool(name: string, input: unknown): Promise<string> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new ToolError('Input must be an object')
  const i = input as Record<string, unknown>
  switch (name) {
    case 'list_projects': return loadProjects().map(p => `- ${p.name} (${p.framework}) ${p.path}`).join('\n') || 'No saved project.'
    case 'list_files': return listFiles(findProject(i.project), i.dir)
    case 'read_file': return readProjectFile(findProject(i.project), i.path, i.from_line, i.to_line)
    case 'search_code': return searchCode(findProject(i.project), i.query)
    case 'git_status': return gitStatus(findProject(i.project))
    case 'git_diff': return gitDiff(findProject(i.project), i.file, i.staged)
    case 'docker_status': return dockerStatus()
    case 'container_logs': return containerLogs(i.container, i.lines)
    case 'db_connections': return dbList()
    case 'db_schema': return dbStructure(i.connection)
    default: throw new ToolError(`Unknown tool ${name}`)
  }
}
