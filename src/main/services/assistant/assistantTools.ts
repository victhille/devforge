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
import { loadSshConnections } from '../ssh/sshStorage'
import { executions as n8nExecutions, listInstances as n8nInstances, workflows as n8nWorkflows } from '../n8n/n8nService'
import { deployments as vercelDeployments } from '../vercel/vercelService'

/**
 * Read-only tools the assistant can call. Every path stays inside a saved
 * project, secret files are never read, outputs are capped.
 */

// Kept small on purpose: a tool result is re-sent with every later request of the conversation
const MAX_FILE = 16_000
const MAX_OUTPUT = 12_000
/** read_file without a range shows this many lines */
const DEFAULT_LINES = 250
const MAX_SEARCH_HITS = 30
const MAX_TREE = 150
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
    if (lines.length >= MAX_TREE) return
    let entries = await readdir(abs, { withFileTypes: true }).catch(() => [])
    entries = entries.sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))
    for (const e of entries) {
      if (lines.length >= MAX_TREE) { lines.push(`${prefix}… (more entries: list a sub-folder)`); return }
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
  const b = int(to, Math.min(all.length, a + DEFAULT_LINES - 1), a, all.length)
  const body = all.slice(a - 1, b).map((l, i) => `${String(a + i).padStart(5)}  ${l}`).join('\n')
  const more = b < all.length ? `\n… lines ${b + 1}-${all.length} not shown: ask for a range with from_line/to_line` : ''
  return cap(`${path} (lines ${a}-${b} of ${all.length})\n${body}${more}`, MAX_FILE)
}

async function searchCode(project: Project, query: unknown): Promise<string> {
  if (typeof query !== 'string' || query.trim().length < 2) throw new ToolError('"query" needs at least 2 characters')
  const needle = query.toLowerCase()
  const root = await realpath(project.path)
  const hits: string[] = []
  let scanned = 0
  const walk = async (abs: string) => {
    if (hits.length >= MAX_SEARCH_HITS || scanned > 4000) return
    for (const e of await readdir(abs, { withFileTypes: true }).catch(() => [])) {
      if (hits.length >= MAX_SEARCH_HITS) return
      const p = join(abs, e.name)
      if (e.isDirectory()) { if (!IGNORED_DIRS.has(e.name) && !e.name.startsWith('.')) await walk(p); continue }
      if (isSecretFile(p) || /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|exe|dll|woff2?|ttf|mp[34]|lock)$/i.test(e.name)) continue
      scanned++
      const s = await stat(p).catch(() => null)
      if (!s || s.size > 500_000) continue
      const text = await readFile(p, 'utf-8').catch(() => '')
      if (text.includes('\u0000')) continue
      text.split(/\r?\n/).forEach((line, i) => {
        if (hits.length < MAX_SEARCH_HITS && line.toLowerCase().includes(needle)) hits.push(`${relative(root, p)}:${i + 1}: ${line.trim().slice(0, 200)}`)
      })
    }
  }
  await walk(root)
  return hits.length ? hits.join('\n') + (hits.length >= MAX_SEARCH_HITS ? `\n… (first ${MAX_SEARCH_HITS} matches: refine the query)` : '') : 'No match.'
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
    ...changes.slice(0, 60).map(c => `  ${c.staged ? '[staged] ' : ''}${c.status} ${c.path}${c.insertions !== null ? ` +${c.insertions} -${c.deletions}` : ''}`),
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
  const r = await runFile('docker', ['logs', '--tail', String(int(lines, 60, 1, 300)), container], { timeout: 15_000 })
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

// ─── n8n and Vercel ───────────────────────────────────────────────────────────

/** The n8n server meant by "server" (its SSH name); optional when there is only one */
export function n8nServer(ref: unknown): { id: string; name: string } {
  const conns = loadSshConnections()
  const named = n8nInstances().map(i => ({ id: i.connectionId, name: conns.find(c => c.id === i.connectionId)?.name ?? i.connectionId }))
  if (!named.length) throw new ToolError('n8n is not installed from DevForge on any server (page n8n).')
  if (typeof ref !== 'string' || !ref.trim()) {
    if (named.length === 1) return named[0]
    throw new ToolError(`Several n8n servers: ${named.map(n => n.name).join(', ')}. Pass "server".`)
  }
  const hit = named.find(n => n.name.toLowerCase() === ref.trim().toLowerCase() || n.id === ref.trim())
  if (!hit) throw new ToolError(`No n8n on "${ref}". Servers with n8n: ${named.map(n => n.name).join(', ')}`)
  return hit
}

/** Errors of the services, in words the model can act on */
export function cloudError(err: unknown): never {
  const m = err instanceof Error ? err.message : String(err)
  if (m === 'NO_KEY') throw new ToolError('No n8n API key saved: the user adds it on the n8n page.')
  if (m === 'BAD_KEY') throw new ToolError('n8n refuses the saved API key.')
  if (m === 'NO_TOKEN') throw new ToolError('Vercel is not connected: the user adds a token in the Vercel tab of the project page.')
  if (m === 'BAD_TOKEN') throw new ToolError('Vercel refuses the saved token.')
  if (m === 'NOT_LINKED') throw new ToolError('This project folder is not linked to Vercel (no .vercel/project.json): run `vercel link` in it.')
  throw err
}

async function n8nWorkflowList(server: unknown): Promise<string> {
  const s = n8nServer(server)
  const list = await n8nWorkflows(s.id).catch(cloudError)
  if (!list.length) return `No workflow on ${s.name}.`
  return [`n8n on ${s.name}:`, ...list.map(w => `- ${w.name} (id ${w.id}) ${w.active ? 'ACTIVE' : 'inactive'}, updated ${w.updatedAt}${w.tags.length ? `, tags ${w.tags.join(', ')}` : ''}`)].join('\n')
}

async function n8nExecutionList(server: unknown, onlyErrors: unknown): Promise<string> {
  const s = n8nServer(server)
  const list = await n8nExecutions(s.id, onlyErrors !== false).catch(cloudError)
  if (!list.length) return onlyErrors !== false ? `No failed execution on ${s.name}.` : `No execution on ${s.name}.`
  return list.map(e => `- #${e.id} ${e.workflowName} [${e.status}] ${e.mode}, started ${e.startedAt}${e.stoppedAt ? `, stopped ${e.stoppedAt}` : ''}`).join('\n')
}

async function vercelDeploymentList(p: Project): Promise<string> {
  const list = await vercelDeployments(p.id).catch(cloudError)
  if (!list.length) return 'No deployment.'
  return list.map(d => `- ${d.id} [${d.state}] ${d.target ?? 'preview'}${d.current ? ' (CURRENT PRODUCTION)' : ''} ${new Date(d.createdAt).toISOString()}${d.branch ? ` ${d.branch}` : ''}${d.commitMessage ? ` "${d.commitMessage}"` : ''} ${d.url}`).join('\n')
}

// ─── Definitions ──────────────────────────────────────────────────────────────

const project = { type: 'string', description: 'Project name (or its path), from list_projects' } as const

/** Tool list: static and in a fixed order so the prompt cache keeps hitting */
export const TOOLS: Anthropic.Beta.BetaTool[] = [
  { name: 'list_projects', description: 'List the projects saved in DevForge (name, path, framework).', input_schema: { type: 'object', properties: {} } },
  { name: 'list_files', description: 'Tree of a project folder (2 levels, node_modules and the like skipped).', input_schema: { type: 'object', properties: { project, dir: { type: 'string', description: 'Folder relative to the project root, default the root' } }, required: ['project'] } },
  { name: 'read_file', description: 'Read lines of a project text file (250 by default; pass from_line/to_line for the useful part). Secret files are refused.', input_schema: { type: 'object', properties: { project, path: { type: 'string', description: 'Path relative to the project root' }, from_line: { type: 'integer' }, to_line: { type: 'integer' } }, required: ['project', 'path'] } },
  { name: 'search_code', description: 'Case-insensitive text search in a project (first 30 matches, path:line: text).', input_schema: { type: 'object', properties: { project, query: { type: 'string' } }, required: ['project', 'query'] } },
  { name: 'git_status', description: 'Branch, upstream, changed files and the last 10 commits of a project.', input_schema: { type: 'object', properties: { project }, required: ['project'] } },
  { name: 'git_diff', description: 'Uncommitted changes of a project (or of one file).', input_schema: { type: 'object', properties: { project, file: { type: 'string' }, staged: { type: 'boolean', description: 'Staged changes instead of unstaged' } }, required: ['project'] } },
  { name: 'docker_status', description: 'Local Docker containers and compose projects with their state.', input_schema: { type: 'object', properties: {} } },
  { name: 'container_logs', description: 'Last lines of a local Docker container log.', input_schema: { type: 'object', properties: { container: { type: 'string' }, lines: { type: 'integer', description: 'Default 60, max 300' } }, required: ['container'] } },
  { name: 'db_connections', description: 'Database connections saved in DevForge (no credentials).', input_schema: { type: 'object', properties: {} } },
  { name: 'db_schema', description: 'Tables and columns of a saved database connection.', input_schema: { type: 'object', properties: { connection: { type: 'string', description: 'Connection name from db_connections' } }, required: ['connection'] } },
  { name: 'n8n_workflows', description: 'Workflows of the n8n installed on a VPS from DevForge (name, id, active, last change).', input_schema: { type: 'object', properties: { server: { type: 'string', description: 'SSH server name; optional when n8n runs on one server only' } } } },
  { name: 'n8n_executions', description: 'Recent n8n executions with their workflow and status (failed ones only by default).', input_schema: { type: 'object', properties: { server: { type: 'string' }, only_errors: { type: 'boolean', description: 'Default true' } } } },
  { name: 'vercel_deployments', description: 'Last Vercel deployments of a project linked with `vercel link`: state, production or preview, branch, commit, which one production points to.', input_schema: { type: 'object', properties: { project }, required: ['project'] } }
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
    case 'n8n_workflows': case 'n8n_executions': return str(input.server) ?? 'n8n'
    case 'vercel_deployments': return p
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
    case 'n8n_workflows': return n8nWorkflowList(i.server)
    case 'n8n_executions': return n8nExecutionList(i.server, i.only_errors)
    case 'vercel_deployments': return vercelDeploymentList(findProject(i.project))
    default: throw new ToolError(`Unknown tool ${name}`)
  }
}
