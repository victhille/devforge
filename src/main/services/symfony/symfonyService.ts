import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { app } from 'electron'
import { dirname, join } from 'path'
import type {
  CommandResult, LogLine, SfApiConfig, SfCommand, SfEntity, SfEntityDraft, SfInspect, SfRoute, SfStatus, SfWriteResult
} from '@shared/types'
import { assertSafeDir, isInsideProject } from '../../lib/safe'
import { runFile } from '../../lib/exec'
import { commandRunner } from '../system/commandRunner'
import { getDbConnection } from '../database/dbStorage'
import { mergeEnv } from '../projects/projectSetup'
import { INSPECT_PHP, parseInspect, parseRoutes, toEntities, toMigrations } from './sfInspect'
import { ENTITY_RE, checkDraft, declaredOwning, extendEntity, inverseOf, newEntityFile, repositoryFile } from './sfEntityWriter'
import { GENERATED_MARK, OPERATIONS, applyPlatform, controllerFile, handEditedResource, jsonController, stripPlatform, withJsonFormat } from './sfApi'
import { appFixtures, tuneFactory } from './sfFixtures'
import { sfCommand } from '@shared/lib/symfonyCommands'

type LogCb = (log: LogLine) => void
type ResultCb = (result: CommandResult) => void

/** A saved DevForge project: the workshop reads and writes only there */
function projectDir(path: unknown): string {
  const dir = assertSafeDir(path)
  if (!isInsideProject(dir)) throw new Error('NOT_A_PROJECT')
  return dir
}

const read = (file: string) => existsSync(file) ? readFileSync(file, 'utf-8') : ''

function write(file: string, content: string): void {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, content)
}

/**
 * End-to-end tests of the workshop: DEVFORGE_TEST_SYMFONY names a JSON file
 * { inspect, routes, serverUrl } used instead of PHP. Ignored in the installed app.
 */
function testData<K extends 'inspect' | 'routes' | 'serverUrl'>(key: K): { inspect: SfInspect; routes: SfRoute[]; serverUrl: string | null }[K] | undefined {
  const file = process.env.DEVFORGE_TEST_SYMFONY
  if (!file || app.isPackaged) return undefined
  try { return JSON.parse(readFileSync(file, 'utf-8'))[key] } catch { return undefined }
}

// ─── Reading ──────────────────────────────────────────────────────────────────

function composer(projectPath: string): { require?: Record<string, string>; 'require-dev'?: Record<string, string> } {
  try { return JSON.parse(read(join(projectPath, 'composer.json')) || '{}') } catch { return {} }
}

export function isSymfony(projectPath: string): boolean {
  const c = composer(projectPath)
  return !!(c.require?.['symfony/framework-bundle'] || c.require?.['symfony/symfony'])
}

const vendor = (projectPath: string, pkg: string) => existsSync(join(projectPath, 'vendor', ...pkg.split('/')))

function inspectScript(): string {
  const file = join(tmpdir(), 'devforge-symfony-inspect.php')
  if (read(file) !== INSPECT_PHP) writeFileSync(file, INSPECT_PHP)
  return file
}

let cliCache: boolean | null = null
async function hasSymfonyCli(): Promise<boolean> {
  if (cliCache === null) cliCache = (await runFile('symfony', ['version', '--no-ansi'], { timeout: 8000 })).ok
  return cliCache
}

/** Everything the workshop shows: status, entities and migrations */
export async function inspect(projectPath: string): Promise<SfInspect> {
  const dir = projectDir(projectPath)
  const canned = testData('inspect')
  if (canned) return canned
  const packages = {
    orm: vendor(dir, 'doctrine/orm'), maker: vendor(dir, 'symfony/maker-bundle'), apiPlatform: vendor(dir, 'api-platform/core') || vendor(dir, 'api-platform/symfony'),
    serializer: vendor(dir, 'symfony/serializer'), validator: vendor(dir, 'symfony/validator'), security: vendor(dir, 'symfony/security-bundle'),
    fixtures: vendor(dir, 'doctrine/doctrine-fixtures-bundle'), foundry: vendor(dir, 'zenstruck/foundry')
  }
  const status: SfStatus = {
    symfony: isSymfony(dir), booted: false, error: null, version: null, database: null,
    composeDatabase: /^\s{2}database:\s*$/m.test(read(join(dir, 'compose.yaml')) || read(join(dir, 'docker-compose.yml'))),
    packages, symfonyCli: await hasSymfonyCli(), hasUserEntity: existsSync(join(dir, 'src', 'Entity', 'User.php'))
  }
  if (!status.symfony) return { status, entities: [], migrations: [] }
  if (!existsSync(join(dir, 'vendor', 'autoload.php'))) {
    status.error = 'NO_VENDOR'
    return { status, entities: [], migrations: [] }
  }

  const r = await runFile('php', [inspectScript(), dir], { cwd: dir, timeout: 60_000 })
  const raw = parseInspect(r.stdout)
  if (!raw) {
    status.error = (r.stderr || r.stdout).trim().split(/\r?\n/).slice(-3).join(' ') || 'PHP_FAILED'
    return { status, entities: [], migrations: [] }
  }
  status.booted = raw.booted
  status.error = raw.error
  status.version = raw.version
  status.database = raw.db

  const migDir = join(dir, 'migrations')
  const files = existsSync(migDir) ? readdirSync(migDir).filter(f => f.endsWith('.php')).map(name => ({ name, php: read(join(migDir, name)) })) : []
  return { status, entities: toEntities(raw, dir), migrations: toMigrations(files, raw.executed) }
}

export async function routes(projectPath: string): Promise<SfRoute[]> {
  const dir = projectDir(projectPath)
  const canned = testData('routes')
  if (canned) return canned
  const r = await runFile('php', ['bin/console', 'debug:router', '--format=json', '--no-ansi'], { cwd: dir, timeout: 60_000 })
  if (!r.ok) throw new Error((r.stderr || r.stdout).trim().split(/\r?\n/).slice(-2).join(' '))
  return parseRoutes(r.stdout)
}

export async function serverUrl(projectPath: string): Promise<string | null> {
  const canned = testData('serverUrl')
  if (canned !== undefined) return canned
  if (!(await hasSymfonyCli())) return null
  const r = await runFile('symfony', ['server:status', '--no-ansi'], { cwd: projectDir(projectPath), timeout: 15_000 })
  return r.stdout.match(/Listening on (https?:\/\/[^\s]+)/)?.[1] ?? null
}

// ─── Commands ─────────────────────────────────────────────────────────────────

const console_ = (...args: string[]) => ({ exe: 'php', args: ['bin/console', ...args] })

export function run(projectPath: string, command: SfCommand, arg: string | undefined, onLog: LogCb, onResult: ResultCb): string {
  const c = sfCommand(command, arg)
  return commandRunner.run({ executable: c.exe, args: c.args, cwd: projectDir(projectPath), onLog, onResult })
}

type Step = { exe: string; args: string[] } | (() => void)

/** Several steps as one task (commands, or work done here): only the last result, or the first failure, is sent */
function runChain(cwd: string, steps: Step[], onLog: LogCb, onResult: ResultCb): string {
  const taskId = `sf-${Date.now()}`
  const fail = (err: unknown) => {
    onLog({ taskId, type: 'error', text: err instanceof Error ? err.message : String(err), timestamp: new Date().toISOString() })
    onResult({ taskId, exitCode: 1, status: 'failed' })
  }
  const next = (i: number): void => {
    if (i >= steps.length) { onResult({ taskId, exitCode: 0, status: 'success' }); return }
    const step = steps[i]
    if (typeof step === 'function') {
      try { step() } catch (err) { fail(err); return }
      next(i + 1)
      return
    }
    commandRunner.run({
      executable: step.exe, args: step.args, cwd, onLog,
      onResult: r => r.status === 'success' ? next(i + 1) : onResult({ ...r, taskId })
    })
  }
  // The caller gets the id before any result
  setTimeout(() => next(0))
  return taskId
}

// ─── Entities ─────────────────────────────────────────────────────────────────

const entityFile = (dir: string, name: string) => join(dir, 'src', 'Entity', `${name}.php`)

function entityNames(dir: string): string[] {
  const d = join(dir, 'src', 'Entity')
  return existsSync(d) ? readdirSync(d).filter(f => /^[A-Z]\w*\.php$/.test(f)).map(f => f.slice(0, -4)) : []
}

/** Writes a new entity (and its repository), or adds to an existing one; the other side of each relation too */
export function writeEntity(projectPath: string, draft: SfEntityDraft): SfWriteResult {
  const dir = projectDir(projectPath)
  const names = entityNames(dir)
  const error = checkDraft(draft, names)
  if (error) throw new Error(error)

  const result: SfWriteResult = { created: [], changed: [], removed: [] }
  const rel = (p: string) => p.slice(dir.length + 1).replace(/\\/g, '/')
  // The other sides, grouped by target entity
  const others = new Map<string, { relations: SfEntityDraft['relations']; owning: boolean[] }>()
  const selfInverse: SfEntityDraft['relations'] = []
  for (const r of draft.relations) {
    const inv = inverseOf(draft.name, r)
    if (!inv) continue
    if (r.target === draft.name) { selfInverse.push(inv); continue }
    const g = others.get(r.target) ?? { relations: [], owning: [] }
    g.relations.push(inv)
    g.owning.push(!declaredOwning(r))
    others.set(r.target, g)
  }

  // Everything is computed before the first write: a refusal leaves no half-written project
  const writes: { file: string; content: string; isNew: boolean }[] = []
  const file = entityFile(dir, draft.name)
  if (draft.existing) {
    const own = extendEntity(read(file), draft.fields, [...draft.relations, ...selfInverse], [...draft.relations.map(declaredOwning), ...selfInverse.map(r => r.kind === 'ManyToOne')])
    writes.push({ file, content: own, isNew: false })
  } else {
    writes.push({ file, content: newEntityFile(draft, selfInverse), isNew: true })
    const repo = join(dir, 'src', 'Repository', `${draft.name}Repository.php`)
    if (!existsSync(repo)) writes.push({ file: repo, content: repositoryFile(draft.name), isNew: true })
  }
  for (const [target, g] of others) {
    const f = entityFile(dir, target)
    writes.push({ file: f, content: extendEntity(read(f), [], g.relations, g.owning), isNew: false })
  }
  for (const w of writes) {
    write(w.file, w.content)
    ;(w.isNew ? result.created : result.changed).push(rel(w.file))
  }
  return result
}

// ─── API ──────────────────────────────────────────────────────────────────────

const apiConfigFile = (dir: string) => join(dir, '.devforge', 'api.json')

export function apiConfig(projectPath: string): SfApiConfig | null {
  try { return JSON.parse(read(apiConfigFile(projectDir(projectPath)))) as SfApiConfig } catch { return null }
}

export async function applyApi(projectPath: string, config: SfApiConfig): Promise<SfWriteResult> {
  const dir = projectDir(projectPath)
  const status = await inspect(dir)
  if (config.mode === 'platform' && !status.status.packages.apiPlatform) throw new Error('NEEDS:install:api-platform')
  if (config.mode === 'json' && !(status.status.packages.serializer && status.status.packages.validator)) throw new Error('NEEDS:install:serializer')
  if (!status.status.booted) throw new Error(status.status.error ?? 'NOT_BOOTED')

  const result: SfWriteResult = { created: [], changed: [], removed: [] }
  const entities = status.entities
  const conf = (e: SfEntity) => {
    const c = config.entities[e.name]
    return { operations: (c?.operations ?? []).filter(o => OPERATIONS.includes(o)), hidden: (c?.hidden ?? []).filter(h => e.fields.some(f => f.name === h)) }
  }

  for (const e of entities) {
    const file = join(dir, e.file)
    const src = read(file)
    if (handEditedResource(src)) throw new Error(`HAND_EDITED:${e.name}`)
    const { operations, hidden } = conf(e)
    // API Platform embeds an entity that is not a resource, and loops on the way back: such links stay out
    const exposed = (name: string) => (config.entities[name]?.operations ?? []).length > 0
    const linksOut = e.relations.filter(r => !exposed(r.target)).map(r => r.name)
    const next = config.mode === 'platform' ? applyPlatform(src, operations, [...hidden, ...linksOut]) : stripPlatform(src)
    if (next !== src) { write(file, next); result.changed.push(e.file) }

    const ctrl = join(dir, controllerFile(e.name))
    const generated = read(ctrl).includes(GENERATED_MARK)
    if (config.mode === 'json' && operations.length) {
      const content = jsonController(e, operations, hidden)
      if (read(ctrl) !== content) {
        if (existsSync(ctrl) && !generated) throw new Error(`HAND_EDITED:${controllerFile(e.name)}`)
        ;(existsSync(ctrl) ? result.changed : result.created).push(controllerFile(e.name))
        write(ctrl, content)
      }
    } else if (generated) {
      rmSync(ctrl)
      result.removed.push(controllerFile(e.name))
    }
  }
  if (config.mode === 'platform') {
    const yaml = join(dir, 'config', 'packages', 'api_platform.yaml')
    const src = read(yaml)
    const next = src && withJsonFormat(src)
    if (src && next !== src) { write(yaml, next); result.changed.push('config/packages/api_platform.yaml') }
  }
  write(apiConfigFile(dir), JSON.stringify(config, null, 2) + '\n')
  return result
}

// ─── Fake data ────────────────────────────────────────────────────────────────

/** Missing factories (make:factory), AppFixtures, then fixtures:load: one console task */
export async function writeFixtures(projectPath: string, counts: Record<string, number>, onLog: LogCb, onResult: ResultCb): Promise<string> {
  const dir = projectDir(projectPath)
  const status = await inspect(dir)
  if (!status.status.packages.foundry || !status.status.packages.fixtures) throw new Error('NEEDS:install:fixtures')
  if (!status.status.packages.maker) throw new Error('NEEDS:install:maker')
  const clean: Record<string, number> = {}
  for (const [name, n] of Object.entries(counts)) {
    if (ENTITY_RE.test(name) && status.entities.some(e => e.name === name) && Number.isInteger(n) && n > 0) clean[name] = Math.min(n, 10_000)
  }
  if (!Object.keys(clean).length) throw new Error('EMPTY')
  const missing = Object.keys(clean).filter(name => !existsSync(join(dir, 'src', 'Factory', `${name}Factory.php`)))
  const factory = (name: string) => join(dir, 'src', 'Factory', `${name}Factory.php`)
  const steps: Step[] = [
    ...missing.map(name => console_('make:factory', `App\\Entity\\${name}`, '--no-interaction')),
    // Realistic values in the factories just written (the user's own ones stay as they are)
    () => {
      for (const name of missing) {
        const e = status.entities.find(x => x.name === name)
        if (e && existsSync(factory(name))) writeFileSync(factory(name), tuneFactory(read(factory(name)), e))
      }
      write(join(dir, 'src', 'DataFixtures', 'AppFixtures.php'), appFixtures(status.entities, clean))
    },
    console_('doctrine:fixtures:load', '--no-interaction')
  ]
  return runChain(dir, steps, onLog, onResult)
}

// ─── Database connection ──────────────────────────────────────────────────────

/** DATABASE_URL in .env.local, built from a connection of the Database page */
export function useConnection(projectPath: string, connectionId: string): void {
  const dir = projectDir(projectPath)
  const c = getDbConnection(connectionId)
  if (!c) throw new Error('NO_CONNECTION')
  if (c.sshConnectionId) throw new Error('SSH_CONNECTION')
  const enc = encodeURIComponent
  const url = c.type === 'sqlite'
    ? `sqlite:///${(c.file ?? '').replace(/\\/g, '/')}`
    : `${c.type === 'postgres' ? 'postgresql' : 'mysql'}://${enc(c.user ?? '')}:${enc(c.password ?? '')}@${c.host ?? '127.0.0.1'}:${c.port ?? (c.type === 'postgres' ? 5432 : 3306)}/${enc(c.database ?? '')}`
  const file = join(dir, '.env.local')
  write(file, mergeEnv(read(file), { DATABASE_URL: url }))
}
