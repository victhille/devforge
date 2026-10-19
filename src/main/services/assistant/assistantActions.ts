import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type Anthropic from '@anthropic-ai/sdk'
import type { AssistantAction, AssistantActionStatus, Project } from '@shared/types'
import { writeJsonFile } from '../../lib/jsonFile'
import { forgetRepo, getChanges, getRepoDetails, git, gitCommit, gitPull, gitPush } from '../git/gitRepo'
import { composeAction, containerAction, getOverview } from '../docker/dockerService'
import { composeDirFor, composeName } from '../docker/composeProjects'
import { listDbConnections } from '../database/dbStorage'
import { dbQuery } from '../database/dbClient'
import { readEnvProject, writeEnvValues } from '../envfiles/envFiles'
import { freePort, getListeningPorts } from '../system/portService'
import { processManager } from '../stacks/processManager'
import { ToolError, cloudError, findProject, n8nServer } from './assistantTools'
import { retryExecution, setActive as n8nSetActive, workflows as n8nWorkflows } from '../n8n/n8nService'
import { deployments as vercelDeployments, promote as vercelPromote, redeploy as vercelRedeploy } from '../vercel/vercelService'

/**
 * Actions Forgy may propose. Nothing runs from the model alone: each tool
 * call becomes a plan (title + preview of what will happen) shown to the
 * user, who approves or refuses it. Guard rails refuse dangerous requests
 * before any plan is shown. Every outcome lands in assistant/actions.json,
 * with an undo when one is possible.
 */

/** What the user sees before approving, and what runs after */
export interface ActionPlan {
  title: string
  preview: string
  /** Can be undone from the journal */
  reversible: boolean
  /** May run without a click in the "auto-safe" mode (reversible or read-only) */
  safe: boolean
  run: () => Promise<{ output: string; undo?: UndoSpec }>
}

export type UndoSpec =
  | { type: 'git-reset-soft'; path: string; commit: string }
  | { type: 'compose'; dir: string; name: string; action: 'up' | 'stop' }
  | { type: 'container'; id: string; action: 'start' | 'stop' }
  | { type: 'env-remove'; path: string; file: string; key: string }
  | { type: 'stop-process'; key: string }
  | { type: 'n8n-active'; connectionId: string; workflowId: string; active: boolean }
  | { type: 'vercel-promote'; projectId: string; deploymentId: string }

const project = { type: 'string', description: 'Project name or path from list_projects' } as const

export const ACTION_TOOLS: Anthropic.Beta.BetaTool[] = [
  { name: 'git_commit', description: 'Commit changes of a project (all changed files unless "files" lists some). The user sees the files and message and must approve.', input_schema: { type: 'object', properties: { project, message: { type: 'string', description: 'Conventional commit message' }, files: { type: 'array', items: { type: 'string' }, description: 'Paths relative to the project root' } }, required: ['project', 'message'] } },
  { name: 'git_pull', description: 'Pull the current branch (fast-forward only). Needs the user\'s approval.', input_schema: { type: 'object', properties: { project }, required: ['project'] } },
  { name: 'git_push', description: 'Push the current branch to its upstream (never forced). Needs the user\'s approval.', input_schema: { type: 'object', properties: { project }, required: ['project'] } },
  { name: 'compose_action', description: 'Start (up), stop or restart the Docker Compose project of a saved project. Needs the user\'s approval.', input_schema: { type: 'object', properties: { project, action: { type: 'string', enum: ['up', 'stop', 'restart'] } }, required: ['project', 'action'] } },
  { name: 'container_action', description: 'Start, stop or restart one local Docker container. Needs the user\'s approval.', input_schema: { type: 'object', properties: { container: { type: 'string', description: 'Name or id from docker_status' }, action: { type: 'string', enum: ['start', 'stop', 'restart'] } }, required: ['container', 'action'] } },
  { name: 'sql_execute', description: 'Run ONE SQL statement on a saved connection: reads return up to 50 rows, writes need a WHERE. DROP, TRUNCATE and the like are refused. Needs the user\'s approval.', input_schema: { type: 'object', properties: { connection: { type: 'string', description: 'Connection name from db_connections' }, sql: { type: 'string' } }, required: ['connection', 'sql'] } },
  { name: 'free_port', description: 'Free a local port by ending the process listening on it (never a Windows service). Needs the user\'s approval.', input_schema: { type: 'object', properties: { port: { type: 'integer' } }, required: ['port'] } },
  { name: 'run_script', description: 'Start a package.json script of a project in the background (dev server, build, tests). Needs the user\'s approval.', input_schema: { type: 'object', properties: { project, script: { type: 'string' } }, required: ['project', 'script'] } },
  { name: 'n8n_set_workflow', description: 'Activate or deactivate an n8n workflow. Needs the user\'s approval; can be undone.', input_schema: { type: 'object', properties: { server: { type: 'string', description: 'SSH server name; optional with one n8n server' }, workflow: { type: 'string', description: 'Workflow name or id from n8n_workflows' }, active: { type: 'boolean' } }, required: ['workflow', 'active'] } },
  { name: 'n8n_retry_execution', description: 'Retry a failed n8n execution. Needs the user\'s approval.', input_schema: { type: 'object', properties: { server: { type: 'string' }, execution: { type: 'string', description: 'Execution id from n8n_executions' } }, required: ['execution'] } },
  { name: 'vercel_redeploy', description: 'Start a new Vercel build from a deployment (default: the one production points to). Needs the user\'s approval.', input_schema: { type: 'object', properties: { project, deployment: { type: 'string', description: 'Deployment id from vercel_deployments' } }, required: ['project'] } },
  { name: 'vercel_promote', description: 'Point production to a READY Vercel deployment: a preview, or an older production one to roll back. Needs the user\'s approval; can be undone.', input_schema: { type: 'object', properties: { project, deployment: { type: 'string' } }, required: ['project', 'deployment'] } },
  { name: 'env_add', description: 'Add a NEW key to a .env file of a project (existing keys are never changed). Needs the user\'s approval.', input_schema: { type: 'object', properties: { project, key: { type: 'string' }, value: { type: 'string' }, file: { type: 'string', description: 'Default .env' } }, required: ['project', 'key', 'value'] } }
]

const ACTION_NAMES = new Set(ACTION_TOOLS.map(t => t.name))
export const isActionTool = (name: string) => ACTION_NAMES.has(name)

/** A request the guard rails refuse: the model gets the reason */
export class ActionRefused extends ToolError {}

const str = (v: unknown, field: string): string => {
  if (typeof v !== 'string' || !v.trim()) throw new ToolError(`Missing "${field}"`)
  return v.trim()
}
const cap = (s: string, max = 3000) => (s.length > max ? `${s.slice(0, max)}\n… [truncated]` : s)

// ─── Guard rails ──────────────────────────────────────────────────────────────

/**
 * One statement only; reads pass; writes need a WHERE; schema destruction,
 * permissions and file access are refused. Returns whether it only reads.
 */
export function checkSql(raw: string): { sql: string; readOnly: boolean } {
  const sql = raw.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ').trim().replace(/;\s*$/, '').trim()
  if (!sql) throw new ActionRefused('Empty SQL')
  if (/;/.test(sql.replace(/'(?:[^']|'')*'|"(?:[^"]|"")*"/g, ''))) throw new ActionRefused('One SQL statement at a time')
  const first = sql.match(/^\w+/)?.[0].toUpperCase() ?? ''
  if (/^(DROP|TRUNCATE|GRANT|REVOKE|ATTACH|DETACH|VACUUM|SHUTDOWN|CREATE\s+USER|ALTER\s+USER)$/.test(first) || /^ALTER\b[\s\S]*\bDROP\b/i.test(sql)) {
    throw new ActionRefused(`${first} statements are refused: run them yourself from the Database page`)
  }
  if (/\b(INTO\s+OUTFILE|LOAD_FILE|LOAD\s+DATA|COPY\b[\s\S]*\bPROGRAM)\b/i.test(sql)) throw new ActionRefused('File access from SQL is refused')
  if (['SELECT', 'WITH', 'EXPLAIN', 'SHOW', 'DESCRIBE', 'DESC'].includes(first) && !/\b(INSERT|UPDATE|DELETE|MERGE)\b/i.test(sql)) return { sql, readOnly: true }
  if (first === 'PRAGMA' && !sql.includes('=')) return { sql, readOnly: true }
  if ((first === 'DELETE' || first === 'UPDATE') && !/\bWHERE\b/i.test(sql)) throw new ActionRefused(`${first} without WHERE is refused`)
  return { sql, readOnly: false }
}

const ENV_FILE = /^\.env(\.[\w.-]+)?$/
const ENV_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/

// ─── Plans ────────────────────────────────────────────────────────────────────

async function commitPlan(p: Project, message: string, files: unknown): Promise<ActionPlan> {
  const changes = await getChanges(p.path)
  if (!changes.length) throw new ActionRefused(`${p.name} has nothing to commit`)
  const chosen = Array.isArray(files) && files.length ? files.filter((f): f is string => typeof f === 'string') : changes.map(c => c.path)
  const unknown = chosen.filter(f => !changes.some(c => c.path === f))
  if (unknown.length) throw new ToolError(`Not changed in ${p.name}: ${unknown.join(', ')}`)
  return {
    title: `Commit · ${p.name}`,
    preview: `${message}\n\n${chosen.map(f => `  ${f}`).join('\n')}`,
    reversible: true, safe: true,
    run: async () => {
      const r = await gitCommit(p.path, message, chosen)
      if (!r.ok) throw new Error(r.output)
      const head = (await git(p.path, ['rev-parse', 'HEAD'])).stdout.trim()
      return { output: r.output, undo: { type: 'git-reset-soft', path: p.path, commit: head } }
    }
  }
}

async function pushPlan(p: Project): Promise<ActionPlan> {
  const d = await getRepoDetails(p.path, true)
  if (!d.isRepo) throw new ToolError(`${p.name} is not a git repository`)
  if (!d.hasUpstream) throw new ActionRefused(`${d.branch} has no upstream: push it the first time from the Git page`)
  if (d.ahead === 0) throw new ActionRefused('Nothing to push')
  const log = (await git(p.path, ['log', '--oneline', '@{u}..HEAD'])).stdout.trim()
  return {
    title: `Push · ${p.name} (${d.branch})`,
    preview: log,
    reversible: false, safe: false,
    run: async () => { const r = await gitPush(p.path); if (!r.ok) throw new Error(r.output); return { output: r.output } }
  }
}

async function pullPlan(p: Project): Promise<ActionPlan> {
  const d = await getRepoDetails(p.path, true)
  if (!d.isRepo || !d.hasUpstream) throw new ActionRefused(`${p.name} has no upstream to pull from`)
  return {
    title: `Pull · ${p.name} (${d.branch})`,
    preview: `git pull --ff-only · ${d.behind} commit(s) behind${d.changes ? ` · ${d.changes} local change(s)` : ''}`,
    reversible: false, safe: false,
    run: async () => { const r = await gitPull(p.path); if (!r.ok) throw new Error(r.output); return { output: r.output } }
  }
}

function composePlan(p: Project, action: unknown): ActionPlan {
  if (action !== 'up' && action !== 'stop' && action !== 'restart') throw new ToolError('"action" must be up, stop or restart')
  const dir = composeDirFor(p.path)
  if (!dir) throw new ToolError(`${p.name} has no compose file`)
  const name = composeName(dir)
  return {
    title: `Compose ${action} · ${name}`,
    preview: `docker compose ${action === 'up' ? 'up -d' : action}\n${dir}`,
    reversible: action !== 'restart', safe: action !== 'restart',
    run: async () => {
      const r = await composeAction({ name, dir, configFiles: '' }, action)
      if (!r.ok) throw new Error(r.output)
      return { output: r.output, undo: action === 'restart' ? undefined : { type: 'compose', dir, name, action: action === 'up' ? 'stop' : 'up' } }
    }
  }
}

async function containerPlan(ref: string, action: unknown): Promise<ActionPlan> {
  if (action !== 'start' && action !== 'stop' && action !== 'restart') throw new ToolError('"action" must be start, stop or restart')
  const c = (await getOverview()).containers.find(x => x.name === ref || x.id.startsWith(ref))
  if (!c) throw new ToolError(`Unknown container "${ref}"`)
  return {
    title: `Container ${action} · ${c.name}`,
    preview: `docker ${action} ${c.name}\n${c.image} · ${c.status}`,
    reversible: action !== 'restart', safe: false,
    run: async () => {
      const r = await containerAction(c.id, action)
      if (!r.ok) throw new Error(r.output)
      return { output: r.output, undo: action === 'restart' ? undefined : { type: 'container', id: c.id, action: action === 'start' ? 'stop' : 'start' } }
    }
  }
}

function sqlPlan(connection: string, raw: string): ActionPlan {
  const conn = listDbConnections().find(c => c.name.toLowerCase() === connection.toLowerCase())
  if (!conn) throw new ToolError(`Unknown connection "${connection}"`)
  const { sql, readOnly } = checkSql(raw)
  return {
    title: `${readOnly ? 'SQL read' : 'SQL write'} · ${conn.name}`,
    preview: sql,
    reversible: false, safe: readOnly,
    run: async () => {
      const r = await dbQuery(conn.id, sql)
      if (r.error) throw new Error(r.error)
      if (r.affected !== null && !r.columns.length) return { output: `${r.affected} row(s) affected` }
      const rows = r.rows.slice(0, 50).map(row => row.map(v => (v === null ? 'NULL' : String(v))).join(' | '))
      return { output: [r.columns.join(' | '), ...rows, r.rows.length > 50 || r.truncated ? '… more rows not shown' : ''].filter(Boolean).join('\n') }
    }
  }
}

async function freePortPlan(port: unknown): Promise<ActionPlan> {
  if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) throw new ToolError('"port" must be a port number')
  const owner = (await getListeningPorts()).find(p => p.port === port)
  if (!owner || owner.pid === null) throw new ActionRefused(`Nothing is listening on port ${port}`)
  return {
    title: `Free port ${port}`,
    preview: `Stop ${owner.processName} (PID ${owner.pid}) and its child processes`,
    reversible: false, safe: false,
    run: async () => { const p = await freePort(port, owner.pid ?? undefined); return { output: `${p.processName} (PID ${p.pid}) stopped` } }
  }
}

function scriptPlan(p: Project, script: string): ActionPlan {
  let scripts: Record<string, string> = {}
  try { scripts = (JSON.parse(readFileSync(join(p.path, 'package.json'), 'utf-8')) as { scripts?: Record<string, string> }).scripts ?? {} } catch { /* no package.json */ }
  if (!scripts[script]) throw new ToolError(`No "${script}" script in ${p.name}. Scripts: ${Object.keys(scripts).join(', ') || 'none'}`)
  const pm = p.packageManager || 'npm'
  const command = `${pm} run ${script}`
  const key = `assistant:${p.id}:${script}`
  return {
    title: `Run ${script} · ${p.name}`,
    preview: `${command}\n${scripts[script]}`,
    reversible: true, safe: true,
    run: async () => {
      processManager.start(key, command, p.path)
      // A few seconds of output tell whether it started
      await new Promise(r => setTimeout(r, 4000))
      const lines = processManager.logs(key).slice(-15).map(l => l.text).join('\n')
      return { output: `${processManager.isRunning(key) ? 'Running' : 'Exited'}\n${lines}`, undo: { type: 'stop-process', key } }
    }
  }
}

async function envPlan(p: Project, key: string, value: unknown, file: unknown): Promise<ActionPlan> {
  const name = typeof file === 'string' && file.trim() ? file.trim() : '.env'
  if (!ENV_FILE.test(name)) throw new ToolError('"file" must be a .env file name')
  if (!ENV_KEY.test(key)) throw new ToolError('Invalid variable name')
  if (typeof value !== 'string') throw new ToolError('Missing "value"')
  const env = await readEnvProject(p.path)
  if (env.files.find(f => f.name === name)?.values[key] !== undefined) throw new ActionRefused(`${key} already exists in ${name}: change it yourself from the Env variables page`)
  return {
    title: `Add ${key} · ${p.name}`,
    // The value is masked: it may be a secret
    preview: `${name}\n${key}=${'•'.repeat(Math.min(12, Math.max(4, value.length)))}`,
    reversible: true, safe: true,
    run: async () => {
      await writeEnvValues(p.path, name, { [key]: value })
      return { output: `${key} added to ${name}`, undo: { type: 'env-remove', path: p.path, file: name, key } }
    }
  }
}

// ─── n8n and Vercel ───────────────────────────────────────────────────────────

async function n8nTogglePlan(server: unknown, ref: string, active: unknown): Promise<ActionPlan> {
  if (typeof active !== 'boolean') throw new ToolError('"active" must be true or false')
  const s = n8nServer(server)
  const list = await n8nWorkflows(s.id).catch(cloudError)
  const wf = list.find(w => w.id === ref) ?? list.find(w => w.name.toLowerCase() === ref.toLowerCase())
  if (!wf) throw new ToolError(`Unknown workflow "${ref}" on ${s.name}`)
  if (wf.active === active) throw new ActionRefused(`${wf.name} is already ${active ? 'active' : 'inactive'}`)
  return {
    title: `${active ? 'Activate' : 'Deactivate'} n8n workflow · ${wf.name}`,
    preview: `${s.name} · workflow ${wf.id}\n${wf.active ? 'active' : 'inactive'} → ${active ? 'active' : 'inactive'}`,
    reversible: true, safe: true,
    run: async () => {
      const u = await n8nSetActive(s.id, wf.id, active)
      return { output: `${u.name} is now ${u.active ? 'active' : 'inactive'}`, undo: { type: 'n8n-active', connectionId: s.id, workflowId: wf.id, active: !active } }
    }
  }
}

function n8nRetryPlan(server: unknown, execution: string): ActionPlan {
  if (!/^[\w-]{1,64}$/.test(execution)) throw new ToolError('Invalid execution id')
  const s = n8nServer(server)
  return {
    title: `Retry n8n execution #${execution}`,
    preview: `${s.name} · POST /executions/${execution}/retry\nThe workflow runs again with the same input.`,
    reversible: false, safe: false,
    run: async () => ({ output: await retryExecution(s.id, execution).catch(cloudError) })
  }
}

async function vercelRedeployPlan(p: Project, ref: unknown): Promise<ActionPlan> {
  const list = await vercelDeployments(p.id).catch(cloudError)
  const asked = typeof ref === 'string' && ref.trim() ? ref.trim() : null
  const d = asked ? list.find(x => x.id === asked) : list.find(x => x.current) ?? list[0]
  if (!d) throw new ToolError(asked ? `Unknown deployment "${asked}"` : 'No deployment to rebuild')
  return {
    title: `Redeploy on Vercel · ${p.name}`,
    preview: `${d.target ?? 'preview'} · ${d.id}${d.branch ? ` · ${d.branch}` : ''}${d.commitMessage ? `\n"${d.commitMessage}"` : ''}\nA new build starts from the same source.`,
    reversible: false, safe: false,
    run: async () => { const n = await vercelRedeploy(p.id, d.id).catch(cloudError); return { output: `New deployment ${n.id} (${n.state}) ${n.url}` } }
  }
}

async function vercelPromotePlan(p: Project, ref: string): Promise<ActionPlan> {
  const list = await vercelDeployments(p.id).catch(cloudError)
  const d = list.find(x => x.id === ref)
  if (!d) throw new ToolError(`Unknown deployment "${ref}"`)
  if (d.current) throw new ActionRefused('Production already points to this deployment')
  if (d.state !== 'READY') throw new ActionRefused(`This deployment is ${d.state}, not READY`)
  const previous = list.find(x => x.current)
  return {
    title: `${d.target === 'production' ? 'Roll back' : 'Promote'} on Vercel · ${p.name}`,
    preview: `Production → ${d.id}${d.commitMessage ? ` "${d.commitMessage}"` : ''}${previous ? `\nwas ${previous.id}` : ''}`,
    reversible: !!previous, safe: false,
    run: async () => {
      await vercelPromote(p.id, d.id).catch(cloudError)
      return { output: `Production now points to ${d.url}`, undo: previous ? { type: 'vercel-promote', projectId: p.id, deploymentId: previous.id } : undefined }
    }
  }
}

/** Validates a tool call and describes it; throws ToolError (bad input) or ActionRefused (guard rail) */
export async function planAction(name: string, input: Record<string, unknown>): Promise<ActionPlan> {
  switch (name) {
    case 'git_commit': return commitPlan(findProject(input.project), str(input.message, 'message'), input.files)
    case 'git_push': return pushPlan(findProject(input.project))
    case 'git_pull': return pullPlan(findProject(input.project))
    case 'compose_action': return composePlan(findProject(input.project), input.action)
    case 'container_action': return containerPlan(str(input.container, 'container'), input.action)
    case 'sql_execute': return sqlPlan(str(input.connection, 'connection'), str(input.sql, 'sql'))
    case 'free_port': return freePortPlan(input.port)
    case 'run_script': return scriptPlan(findProject(input.project), str(input.script, 'script'))
    case 'env_add': return envPlan(findProject(input.project), str(input.key, 'key'), input.value, input.file)
    case 'n8n_set_workflow': return n8nTogglePlan(input.server, str(input.workflow, 'workflow'), input.active)
    case 'n8n_retry_execution': return n8nRetryPlan(input.server, str(input.execution, 'execution'))
    case 'vercel_redeploy': return vercelRedeployPlan(findProject(input.project), input.deployment)
    case 'vercel_promote': return vercelPromotePlan(findProject(input.project), str(input.deployment, 'deployment'))
    default: throw new ToolError(`Unknown action ${name}`)
  }
}

// ─── Approvals ────────────────────────────────────────────────────────────────

const waiting = new Map<string, (approve: boolean) => void>()

/** Resolves when the user clicks, or false when the answer is stopped */
export function waitForDecision(id: string, signal: AbortSignal): Promise<boolean> {
  return new Promise(resolve => {
    if (signal.aborted) { resolve(false); return }
    waiting.set(id, resolve)
    signal.addEventListener('abort', () => { waiting.delete(id); resolve(false) }, { once: true })
  })
}

export function decideAction(id: string, approve: boolean): void {
  const resolve = waiting.get(id)
  waiting.delete(id)
  resolve?.(approve === true)
}

// ─── Journal and undo ─────────────────────────────────────────────────────────

interface StoredAction extends Omit<AssistantAction, 'canUndo'> { undo?: UndoSpec }

const MAX_JOURNAL = 200
const journalPath = () => join(app.getPath('userData'), 'assistant', 'actions.json')

function readJournal(): StoredAction[] {
  if (!existsSync(journalPath())) return []
  try { return JSON.parse(readFileSync(journalPath(), 'utf-8')) as StoredAction[] } catch { return [] }
}

const publicAction = ({ undo, ...a }: StoredAction): AssistantAction => ({ ...a, canUndo: !!undo && a.status === 'done' })

export function recordAction(entry: StoredAction): void {
  const list = [entry, ...readJournal().filter(a => a.id !== entry.id)].slice(0, MAX_JOURNAL)
  writeJsonFile(journalPath(), list)
}

export const listActions = (): AssistantAction[] => readJournal().map(publicAction)

async function runUndo(u: UndoSpec): Promise<string> {
  switch (u.type) {
    case 'git-reset-soft': {
      const head = (await git(u.path, ['rev-parse', 'HEAD'])).stdout.trim()
      if (head !== u.commit) throw new Error('Other commits came after this one: undo it from the Git page')
      const remote = (await git(u.path, ['branch', '-r', '--contains', u.commit])).stdout.trim()
      if (remote) throw new Error('This commit is already pushed')
      const r = await git(u.path, ['reset', '--soft', 'HEAD~1'], 30_000)
      forgetRepo(u.path)
      if (!r.ok) throw new Error((r.stdout + r.stderr).trim())
      return 'Commit undone, changes kept staged'
    }
    case 'compose': { const r = await composeAction({ name: u.name, dir: u.dir, configFiles: '' }, u.action); if (!r.ok) throw new Error(r.output); return `compose ${u.action}` }
    case 'container': { const r = await containerAction(u.id, u.action); if (!r.ok) throw new Error(r.output); return `docker ${u.action}` }
    case 'env-remove': await writeEnvValues(u.path, u.file, { [u.key]: null }); return `${u.key} removed from ${u.file}`
    case 'stop-process': await processManager.stop(u.key); return 'Stopped'
    case 'n8n-active': { const w = await n8nSetActive(u.connectionId, u.workflowId, u.active); return `${w.name} ${w.active ? 'active' : 'inactive'} again` }
    case 'vercel-promote': await vercelPromote(u.projectId, u.deploymentId); return 'Production points back to the previous deployment'
  }
}

export async function undoAction(id: string): Promise<AssistantAction> {
  const entry = readJournal().find(a => a.id === id)
  if (!entry?.undo || entry.status !== 'done') throw new Error('This action cannot be undone')
  const output = await runUndo(entry.undo)
  const next: StoredAction = { ...entry, status: 'undone' as AssistantActionStatus, output: cap(`${entry.output ?? ''}\n↩ ${output}`.trim(), 2000), undo: undefined }
  recordAction(next)
  return publicAction(next)
}

export const outputCap = cap
